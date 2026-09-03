'use client';

import { useEffect, useRef, useState } from 'react';
import { DataPacket_Kind } from 'livekit-client';
import { useRoomContext } from '@livekit/components-react';
import { TeacherVideoPublisher } from './TeacherVideoPublisher';
import { speakText } from '@/app/lib/aiTTS';
import { SUPPORTED_LANGUAGES } from '@/app/lib/config';
import { MdUploadFile, MdOutlineCancel } from "react-icons/md";
import { BsRecordCircle, BsStopCircle, BsFileText, BsPauseCircle, BsPlayCircle, BsCloudUpload } from "react-icons/bs";

const formatTime = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export default function TeacherVideoController({
  recordingAudioContext,
  recordingDestNode,
  onGenerateQuiz,
  onClassStatusChange,
  isRecording,
  isPaused,
  showRecordMenu,
  setShowRecordMenu,
  handleStartRecording,
  handleStopRecording,
  handlePauseRecording,
  handleResumeRecording,
  handleSaveRecording,
  recordingDuration
}) {
  const room = useRoomContext();

  const videoRef = useRef(null);
  const publisherRef = useRef(null);
  const publishedRef = useRef(false);

  // NEW: Multilingual Video State
  const [videoFiles, setVideoFiles] = useState({});
  const [videoURLs, setVideoURLs] = useState({});
  const videoRefs = useRef({});
  const videoInputRefs = useRef({});
  
  // Initialize refs for all supported languages
  if (Object.keys(videoRefs.current).length === 0) {
    SUPPORTED_LANGUAGES.forEach(lang => {
      videoRefs.current[lang.code] = { current: null };
      videoInputRefs.current[lang.code] = { current: null };
    });
  }

  // Primary video (usually English) used for UI tracking and time sync
  const primaryLang = 'en';
  const primaryVideoURL = videoURLs[primaryLang]?.url;

  const [popupName, setPopupName] = useState(null);
  const [showControlPanel, setShowControlPanel] = useState(false);

  // 🔒 Class control
  const [classStarted, setClassStarted] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [showQuizPopup, setShowQuizPopup] = useState(false); // ✅ Teacher quiz pop-in
  const [quizLoading, setQuizLoading] = useState(false); // loading state while generating quiz

  // ✅ Doubt count + auto finish announce (after 3 doubts)
  const [doubtCount, setDoubtCount] = useState(0);
  const MAX_DOUBTS = 6;
  const doubtCountRef = useRef(0);
  const announcedFinishRef = useRef(false);

  // ✅ NEW: video end announcement (speak once)
  const endedAnnouncedRef = useRef(false);

  // ✅ NEW: Auto-resume tracking logic
  const activeMicsRef = useRef(new Set());
  const activeHandsRef = useRef(new Set());
  const isAIspeakingRef = useRef(false);
  const resumeTimerRef = useRef(null);

  /* ---------------- INIT ---------------- */
  useEffect(() => {
    if (!room) return;

    publisherRef.current = new TeacherVideoPublisher(room);

    // ⭐ IMPORTANT: Merge metadata instead of overwriting
    const existingMetadata = room.localParticipant.metadata
      ? JSON.parse(room.localParticipant.metadata)
      : {};

    room.localParticipant.setMetadata(JSON.stringify({ ...existingMetadata, role: 'teacher' }));

    return () => { };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  /* ---------------- VIDEO FILES ---------------- */
  useEffect(() => {
    const newURLs = { ...videoURLs };
    const urlsToRevoke = [];
    let hasPrimary = false;
    
    Object.keys(videoFiles).forEach(lang => {
      if (videoFiles[lang] && (!videoURLs[lang] || videoURLs[lang].file !== videoFiles[lang])) {
        if (videoURLs[lang]) urlsToRevoke.push(videoURLs[lang].url);
        const url = URL.createObjectURL(videoFiles[lang]);
        newURLs[lang] = { file: videoFiles[lang], url };
      }
      if (videoFiles[lang]) hasPrimary = true;
    });

    setVideoURLs(newURLs);

    if (hasPrimary) {
      setClassStarted(false);
      setVideoEnded(false);
      publishedRef.current = false;
      setPopupName(null);
      doubtCountRef.current = 0;
      announcedFinishRef.current = false;
      endedAnnouncedRef.current = false;
    }

    return () => {
      urlsToRevoke.forEach(u => URL.revokeObjectURL(u));
    };
  }, [videoFiles]);

  // Handle video end (✅ UPDATED: speaks when video ends)
  useEffect(() => {
    const video = videoRefs.current[primaryLang]?.current || videoRef.current;
    if (!video) return;

    const handleEnded = async () => {
      setVideoEnded(true);
      stopTimeSync(); // ✅ stop sending time updates when video finishes
      console.log('🎬 Video ended');

      // ✅ Show quiz pop-in to teacher automatically
      setShowQuizPopup(true);

      // ✅ speak only once when video completes
      if (!endedAnnouncedRef.current) {
        endedAnnouncedRef.current = true;
        try {
          const txt = "Ok guys, I have finished the class. ask doubt box enter your doubt i am clarify one by one .";
          await speakText(txt);
          if (room) {
            room.localParticipant.publishData(
              new TextEncoder().encode(JSON.stringify({ action: "AI_SPEAK_BROADCAST", text: txt })),
              { reliable: true }
            );
          }
        } catch (e) {
          console.error('End TTS failed:', e);
        }
      }
    };

    video.addEventListener('ended', handleEnded);
    return () => video.removeEventListener('ended', handleEnded);
  }, [primaryVideoURL]);

  /* ---------------- TIME SYNC INTERVAL ---------------- */
  const timeSyncRef = useRef(null);

  const startTimeSync = (video) => {
    if (timeSyncRef.current) clearInterval(timeSyncRef.current);
    timeSyncRef.current = setInterval(() => {
      if (!video || !room) return;
      room.localParticipant.publishData(
        new TextEncoder().encode(
          JSON.stringify({
            action: 'VIDEO_TIME_UPDATE',
            currentTime: video.currentTime,
            duration: isFinite(video.duration) ? video.duration : 0,
          })
        ),
        { reliable: false } // unreliable is fine for time sync (frequent updates)
      );
    }, 1000); // every 1 second
  };

  const stopTimeSync = () => {
    if (timeSyncRef.current) {
      clearInterval(timeSyncRef.current);
      timeSyncRef.current = null;
    }
  };

  /* ---------------- START CLASS ---------------- */
  const startClass = async () => {
    const hasAnyVideo = Object.values(videoRefs.current).some(ref => ref.current);
    if (!hasAnyVideo || publishedRef.current) return;

    // Validate durations if multiple videos are uploaded
    let durations = [];
    Object.entries(videoRefs.current).forEach(([lang, ref]) => {
      if (ref.current && isFinite(ref.current.duration)) {
        durations.push({ lang, duration: ref.current.duration });
      }
    });

    if (durations.length > 1) {
      const minD = Math.min(...durations.map(d => d.duration));
      const maxD = Math.max(...durations.map(d => d.duration));
      if (maxD - minD > 1) {
        if (!window.confirm(`Warning: Video durations differ by ${Math.round(maxD - minD)} seconds. They may lose sync. Do you still want to start the class?`)) {
          return;
        }
      }
    }

    const ok = window.confirm('Do you want to start the class now?');
    if (!ok) return;

    try {
      // publish all language video tracks
      await publisherRef.current.publishVideo(videoRefs.current);
      publishedRef.current = true;

      // play all video elements simultaneously
      const playPromises = [];
      Object.values(videoRefs.current).forEach(ref => {
        if (ref.current) {
          playPromises.push(ref.current.play().catch(e => console.error("Play failed:", e)));
        }
      });
      await Promise.all(playPromises);

      const primaryVideo = videoRefs.current[primaryLang]?.current || Object.values(videoRefs.current).find(r => r.current)?.current;

      // ✅ Start broadcasting time updates to students every second based on primary video
      if (primaryVideo) {
        startTimeSync(primaryVideo);

        // notify students
        const duration = primaryVideo.duration;
        room.localParticipant.publishData(
          new TextEncoder().encode(
            JSON.stringify({
              action: 'VIDEO_START',
              duration: isFinite(duration) ? duration : 0,
            })
          ),
          { reliable: true }
        );
      }

      setClassStarted(true);
      setVideoEnded(false);
      if (onClassStatusChange) onClassStatusChange(true);
      console.log('✅ Class started');
    } catch (e) {
      console.error('Error starting class', e);
    }
  };

  /* ---------------- QUIZ GENERATION ---------------- */
  const handleQuizRequest = async () => {
    setQuizLoading(true);
    try {
      if (onGenerateQuiz) {
        await onGenerateQuiz();
      }
      setShowQuizPopup(false);
    } catch (e) {
      console.error("Failed to generate quiz", e);
    } finally {
      setQuizLoading(false);
    }
  };

  /* ---------------- LIVEKIT DATA ---------------- */

  useEffect(() => {
    if (!room) return;

    const checkAndResume = () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      
      if (activeMicsRef.current.size === 0 && activeHandsRef.current.size === 0 && !isAIspeakingRef.current) {
        resumeTimerRef.current = setTimeout(() => {
          // Verify again before actually resuming
          if (activeMicsRef.current.size === 0 && activeHandsRef.current.size === 0 && !isAIspeakingRef.current) {
            const primaryVideo = videoRefs.current[primaryLang]?.current || Object.values(videoRefs.current).find(r => r.current)?.current;
            if (classStarted && primaryVideo && primaryVideo.paused) {
              console.log('▶️ Auto-resuming video after 3s (all clear)');
              
              Object.values(videoRefs.current).forEach(ref => {
                if (ref.current) {
                  ref.current.play().catch(e => console.error("Auto-resume play failed:", e));
                }
              });

              room.localParticipant.publishData(
                new TextEncoder().encode(
                  JSON.stringify({
                    action: 'VIDEO_RESUME',
                    currentTime: primaryVideo.currentTime
                  })
                ),
                { reliable: true }
              );
            }
          }
        }, 3000);
      }
    };

    const handleData = async (payload, _participant, kind) => {
      if (kind !== DataPacket_Kind.RELIABLE) return;

      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));

        /* ✋ HAND RAISE */
        if (msg.action === 'HAND_RAISE' && msg.raised) {
          activeHandsRef.current.add(msg.name);
          setPopupName(msg.name);

          const primaryVideo = videoRefs.current[primaryLang]?.current || Object.values(videoRefs.current).find(r => r.current)?.current;
          const isPlaying = classStarted && primaryVideo && !primaryVideo.paused;

          // auto pause class video
          if (isPlaying) {
            console.log('⏸ Pausing video due to hand raise');
            Object.values(videoRefs.current).forEach(ref => ref.current && ref.current.pause());

            // Notify students to pause
            room.localParticipant.publishData(
              new TextEncoder().encode(
                JSON.stringify({
                  action: 'VIDEO_PAUSE',
                  currentTime: primaryVideo.currentTime
                })
              ),
              { reliable: true }
            );
          }
        } else if (msg.action === 'HAND_RAISE') {
          console.log('✋ Hand lowered by:', msg.name);
          activeHandsRef.current.delete(msg.name);
          checkAndResume();
        }

        /* 🎤 STUDENT MIC ON → auto-pause teacher video */
        if (msg.action === 'VOICE_DOUBT_START') {
          activeMicsRef.current.add(msg.name);
          const primaryVideo = videoRefs.current[primaryLang]?.current || Object.values(videoRefs.current).find(r => r.current)?.current;
          const isPlaying = classStarted && primaryVideo && !primaryVideo.paused;

          if (isPlaying) {
            console.log('⏸ Pausing video: student mic ON by', msg.name);
            Object.values(videoRefs.current).forEach(ref => ref.current && ref.current.pause());

            room.localParticipant.publishData(
              new TextEncoder().encode(
                JSON.stringify({
                  action: 'VIDEO_PAUSE',
                  currentTime: primaryVideo.currentTime
                })
              ),
              { reliable: true }
            );
          }
        }

        /* 🎤 STUDENT MIC OFF → auto-resume teacher video */
        if (msg.action === 'VOICE_DOUBT_END') {
          console.log('🎤 Student mic turned off by:', msg.name);
          activeMicsRef.current.delete(msg.name);
          checkAndResume();
        }

        /* 🤖 AI ANSWER SYNC */
        if (msg.action === 'AI_ANSWER_START') {
          isAIspeakingRef.current = true;
          const primaryVideo = videoRefs.current[primaryLang]?.current || Object.values(videoRefs.current).find(r => r.current)?.current;
          const isPlaying = classStarted && primaryVideo && !primaryVideo.paused;

          if (isPlaying) {
            console.log('⏸ Pausing video: AI starts speaking');
            Object.values(videoRefs.current).forEach(ref => ref.current && ref.current.pause());

            room.localParticipant.publishData(
              new TextEncoder().encode(
                JSON.stringify({
                  action: 'VIDEO_PAUSE',
                  currentTime: primaryVideo.currentTime
                })
              ),
              { reliable: true }
            );
          }
        }

        if (msg.action === 'AI_ANSWER_FINISHED') {
          console.log('🤖 AI finished speaking');
          isAIspeakingRef.current = false;
          checkAndResume();
        }

        // auto hide popup
        if (msg.raised) {
          setTimeout(() => setPopupName(null), 4000);
        }

        /* 💬 STUDENT DOUBT RECEIVED */
        if (msg.action === 'STUDENT_DOUBT') {
          console.log('💬 Doubt received.');
          setDoubtCount((prev) => {
            const next = prev + 1;
            if (next >= MAX_DOUBTS && !announcedFinishRef.current) {
              announcedFinishRef.current = true;
              Object.values(videoRefs.current).forEach(ref => {
                if (ref.current && !ref.current.paused) {
                  ref.current.pause();
                }
              });
            }
            return next;
          });
        }
      } catch (e) {
        console.error('Invalid data message', e);
      }
    };
    const handleLocalAIStart = () => {
      isAIspeakingRef.current = true;
      const primaryVideo = videoRefs.current[primaryLang]?.current || Object.values(videoRefs.current).find(r => r.current)?.current;
      const isPlaying = classStarted && primaryVideo && !primaryVideo.paused;

      if (isPlaying) {
        console.log('⏸ Pausing video: AI starts speaking (local event)');
        Object.values(videoRefs.current).forEach(ref => ref.current && ref.current.pause());

        room.localParticipant.publishData(
          new TextEncoder().encode(
            JSON.stringify({
              action: 'VIDEO_PAUSE',
              currentTime: primaryVideo.currentTime
            })
          ),
          { reliable: true }
        );
      }
    };

    const handleLocalAIFinish = () => {
      console.log('🤖 AI finished speaking (local event)');
      isAIspeakingRef.current = false;
      checkAndResume();
    };

    window.addEventListener('LOCAL_AI_ANSWER_START', handleLocalAIStart);
    window.addEventListener('LOCAL_AI_ANSWER_FINISHED', handleLocalAIFinish);

    room.on('dataReceived', handleData);
    return () => {
      room.off('dataReceived', handleData);
      window.removeEventListener('LOCAL_AI_ANSWER_START', handleLocalAIStart);
      window.removeEventListener('LOCAL_AI_ANSWER_FINISHED', handleLocalAIFinish);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [room, classStarted, recordingAudioContext, recordingDestNode, primaryLang]);



  return (
    <div style={{ position: 'relative' }}>

      {/* ✅ TEACHER QUIZ POP-IN MODAL — appears when class video ends */}
      {showQuizPopup && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.82)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'tqFadeIn 0.35s ease-out',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
            borderRadius: '24px',
            padding: '48px 44px 40px',
            maxWidth: '500px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.1)',
            animation: 'tqPopIn 0.45s cubic-bezier(0.34,1.56,0.64,1)',
            position: 'relative',
          }}>
            {/* Close button */}
            <button
              onClick={() => setShowQuizPopup(false)}
              style={{
                position: 'absolute', top: 14, right: 16,
                background: 'rgba(255,255,255,0.1)', border: 'none',
                color: '#fff', width: 30, height: 30, borderRadius: '50%',
                cursor: 'pointer', fontSize: 15, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>

            {/* Trophy icon */}
            <div style={{ fontSize: '68px', marginBottom: '18px', animation: 'tqBounce 0.9s ease infinite alternate', display: 'inline-block' }}>
              🏆
            </div>

            <h2 style={{
              margin: '0 0 10px 0', color: '#fff', fontSize: '24px', fontWeight: '800', fontFamily: "'Source Sans Pro', 'Noto Sans Tamil', 'Segoe UI', Roboto, Arial, sans-serif", letterSpacing: '-0.4px',
            }}>
              Class Completed! 🎉
            </h2>
            <p style={{
              margin: '0 0 28px 0', color: 'rgba(255,255,255,0.65)',
              fontSize: '14px', lineHeight: '1.7', fontFamily: "'Source Sans Pro', 'Noto Sans Tamil', 'Segoe UI', Roboto, Arial, sans-serif",
            }}>
              Great session! You can now generate an AI-powered quiz<br />
              based on the class topic and student doubts.<br />
              <strong style={{ color: 'rgba(255,255,255,0.88)' }}>Students will see the quiz immediately on their screen.</strong>
            </p>

            {/* Stats bar */}
            <div style={{
              display: 'flex', gap: '10px', marginBottom: '28px',
              justifyContent: 'center',
            }}>
              {[['📚', 'AI Quiz'], ['⚡', 'Instant'], ['📊', 'Track Results']].map(([icon, label], i) => (
                <div key={i} style={{
                  flex: 1, background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px', padding: '10px 8px',
                  color: 'rgba(255,255,255,0.7)', fontSize: '12px',
                  fontFamily: "'Source Sans Pro', 'Noto Sans Tamil', 'Segoe UI', Roboto, Arial, sans-serif",
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '22px', marginBottom: '4px' }}>{icon}</div>
                  {label}
                </div>
              ))}
            </div>

            {/* Primary CTA */}
            <button
              onClick={handleQuizRequest}
              disabled={quizLoading}
              style={{
                width: '100%', padding: '15px',
                background: quizLoading
                  ? 'rgba(76,175,80,0.4)'
                  : 'linear-gradient(90deg, #43a047 0%, #1e88e5 100%)',
                border: 'none', borderRadius: '12px',
                color: '#fff', fontSize: '16px', fontWeight: '700',
                cursor: quizLoading ? 'not-allowed' : 'pointer',
                fontFamily: "'Source Sans Pro', 'Noto Sans Tamil', 'Segoe UI', Roboto, Arial, sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '10px', boxShadow: '0 6px 20px rgba(33,150,243,0.35)',
                transition: 'transform 0.15s, opacity 0.15s',
                letterSpacing: '0.2px',
                marginBottom: '12px',
              }}
              onMouseOver={e => { if (!quizLoading) e.currentTarget.style.transform = 'scale(1.02)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {quizLoading ? (
                <><span style={{ animation: 'tqSpin 0.8s linear infinite', display: 'inline-block' }}>⏳</span> Generating Quiz...</>
              ) : (
                <>🚀 Start Quiz Assessment</>
              )}
            </button>

            <button
              onClick={() => setShowQuizPopup(false)}
              style={{
                width: '100%', padding: '9px',
                background: 'none',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: '10px', color: 'rgba(255,255,255,0.45)',
                fontSize: '13px', cursor: 'pointer', fontFamily: "'Source Sans Pro', 'Noto Sans Tamil', 'Segoe UI', Roboto, Arial, sans-serif",
              }}
            >
              Skip for now
            </button>
          </div>

          <style>{`
            @keyframes tqFadeIn { from { opacity:0 } to { opacity:1 } }
            @keyframes tqPopIn  { from { opacity:0; transform:scale(0.75) } to { opacity:1; transform:scale(1) } }
            @keyframes tqBounce { from { transform:translateY(0) } to { transform:translateY(-10px) } }
            @keyframes tqSpin   { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
          `}</style>
        </div>
      )}


      {/* 🌐 Live Translation Control */}
      <button
        onClick={() => {
          alert('Live Translation feature is implemented. See Student Language Router for details.');
        }}
        style={{
          position: 'absolute', right: '150px', top: '-50px',
          padding: '8px 12px', background: 'rgba(33, 150, 243, 0.4)',
          border: '1px solid rgba(33, 150, 243, 0.8)', color: '#fff',
          borderRadius: '8px', cursor: 'pointer',
          zIndex: 1000
        }}
      >
        🌐 Enable Live Translation
      </button>

      {/* 🎥 Buttons Container */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', width: 'max-content' }}>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {/* 🎙 Recording Options Menu (Aligned with Record button) */}
          {showRecordMenu && !isRecording && (
            <div
              style={{
                position: "absolute",
                left: "0px",
                bottom: "60px",
                background: "#1e1e1e",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.1)",
                padding: "4px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                width: "180px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                zIndex: 1000,
              }}
            >
              <button
                onClick={() => handleStartRecording(false)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: "transparent",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "background 0.2s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <BsRecordCircle size={14} color="#e53935" /> Record Only
              </button>
              <button
                onClick={() => handleStartRecording(true)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: "transparent",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "background 0.2s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <BsFileText size={14} color="#2196F3" /> Record with Transcription
              </button>
            </div>
          )}

          {/* 1. RECORDING SECTION (Record Toggle or Recording Controls) */}
          {!isRecording ? (
            <button
              onClick={() => setShowRecordMenu(!showRecordMenu)}
              title="Choose Recording Option"
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "#222",
                color: "#e53935",
                border: "1px solid #444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.2s",
                fontSize: "1.2rem",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#222")}
            >
              <BsRecordCircle />
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* ⏱ Duration Timer */}
              <div
                style={{
                  background: "rgba(0, 0, 0, 0.6)",
                  color: "#e53935",
                  padding: "6px 14px",
                  borderRadius: "20px",
                  fontFamily: "monospace",
                  fontWeight: "bold",
                  border: "1px solid rgba(229, 57, 53, 0.3)",
                  fontSize: "0.9rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginRight: "4px"
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: isPaused ? "#ffca28" : "#e53935",
                    animation: isPaused ? "none" : "pulseDot 1s infinite",
                  }}
                />
                {formatTime(recordingDuration)}
              </div>

              {/* ⏸ Pause / Resume */}
              <button
                onClick={isPaused ? handleResumeRecording : handlePauseRecording}
                title={isPaused ? "Resume Recording" : "Pause Recording"}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: isPaused ? "#ffca28" : "rgba(255, 255, 255, 0.1)",
                  color: isPaused ? "#000" : "#fff",
                  border: "1px solid rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  fontSize: "1.2rem",
                }}
              >
                {isPaused ? <BsPlayCircle /> : <BsPauseCircle />}
              </button>

              {/* Stop & Save (Merged) */}
              <button
                onClick={handleSaveRecording}
                title="Stop and Save Recording"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "rgba(229, 57, 53, 0.2)",
                  color: "#e53935",
                  border: "1px solid rgba(229, 57, 53, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  fontSize: "1.2rem",
                  animation: !isPaused ? "pulse 1.5s infinite" : "none",
                }}
              >
                <BsStopCircle />
              </button>
            </div>
          )}
        </div>

        {/* 2. UPLOAD SECTION (Upload or Cancel) */}
        {primaryVideoURL ? (
          <button
            onClick={async () => {
              if (window.confirm("Are you sure you want to close the uploaded class video?")) {
                if (room && publishedRef.current) {
                  try {
                    room.localParticipant.publishData(
                      new TextEncoder().encode(JSON.stringify({ action: 'VIDEO_STOP' })),
                      { reliable: true }
                    );
                  } catch (e) { console.error('Failed to send VIDEO_STOP', e); }
                  try { await publisherRef.current.stopPublishing(); } catch (e) { console.error('Failed to stop publishing', e); }
                }
                stopTimeSync();
                Object.values(videoRefs.current).forEach(ref => ref.current && ref.current.pause());
                setVideoURLs({});
                setVideoFiles({});
                setClassStarted(false);
                if (onClassStatusChange) onClassStatusChange(false);
                publishedRef.current = false;
                doubtCountRef.current = 0;
                announcedFinishRef.current = false;
                endedAnnouncedRef.current = false;
                setShowControlPanel(false);
                // ✅ clear file input so same file can be selected again
                Object.values(videoInputRefs.current).forEach(ref => { if (ref.current) ref.current.value = ""; });
              }
            }}
            title="Cancel Class"
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#222',
              border: '1px solid #444',
              color: '#ee1d1dff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.2rem',
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#333")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#222")}
          >
            <MdOutlineCancel size={28} />
          </button>
        ) : (
          <button
            onClick={() => setShowControlPanel(!showControlPanel)}
            title={showControlPanel ? "Close Upload Panel" : "Upload Video Class"}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#222',
              border: '1px solid #444',
              color: showControlPanel ? '#ee1d1dff' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.2rem',
              transition: 'background 0.2s',
            }}
          >
            {showControlPanel ? <MdOutlineCancel size={28} /> : <MdUploadFile />}
          </button>
        )}
      </div>

      <style>{`
        @keyframes pulseDot {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(1.1); }
            100% { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(229, 57, 53, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(229, 57, 53, 0); }
            100% { box-shadow: 0 0 0 0 rgba(229, 57, 53, 0); }
        }
      `}</style>

      {/* 📺 Class Management Panel */}
      {(primaryVideoURL || showControlPanel || classStarted) && (
        <div
          style={classStarted ? { display: 'contents' } : {
            position: 'absolute',
            bottom: 60,
            left: 0,
            width: 320,
            background: '#111',
            border: '1px solid #333',
            borderRadius: 12,
            padding: 16,
            color: '#fff',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            zIndex: 100,
          }}
        >
          {!classStarted && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <h4 style={{ margin: 0 }}>👩‍🏫 Class Control</h4>
              <button
                onClick={async () => {
                  // 📡 Notify students that video has stopped
                  if (room && publishedRef.current) {
                    try {
                      room.localParticipant.publishData(
                        new TextEncoder().encode(
                          JSON.stringify({ action: 'VIDEO_STOP' })
                        ),
                        { reliable: true }
                      );
                    } catch (e) {
                      console.error('Failed to send VIDEO_STOP', e);
                    }

                    // Unpublish the video/audio tracks from LiveKit
                    try {
                      await publisherRef.current.stopPublishing();
                    } catch (e) {
                      console.error('Failed to stop publishing', e);
                    }
                  }

                  // ✅ Stop broadcasting time updates
                  stopTimeSync();

                  // Pause the local video element
                  Object.values(videoRefs.current).forEach(ref => { if (ref.current) ref.current.pause(); });

                  setVideoURLs({});
                  setClassStarted(false);
                  if (onClassStatusChange) onClassStatusChange(false);
                  publishedRef.current = false;

                  // ✅ reset finish logic
                  doubtCountRef.current = 0;
                  announcedFinishRef.current = false;

                  // ✅ reset end announcement
                  endedAnnouncedRef.current = false;
                  // ✅ clear file input so same file can be selected again
                  Object.values(videoInputRefs.current).forEach(ref => { if (ref.current) ref.current.value = ""; });
                  
                  
                }}
                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
          )}

          {/* 🎥 Video preview */}
          {primaryVideoURL && (
            <>
              {SUPPORTED_LANGUAGES.map(lang => {
                const urlObj = videoURLs[lang.code];
                if (!urlObj) return null;
                const isPrimary = lang.code === primaryLang;
                return (
                  <video
                    key={lang.code}
                    ref={videoRefs.current[lang.code]}
                    src={urlObj.url}
                    controls={isPrimary}
                    muted={!isPrimary} // Only primary video plays sound locally for the teacher
                    onPlay={(e) => {
                      if (isPrimary) {
                        Object.entries(videoRefs.current).forEach(([l, ref]) => {
                          if (l !== primaryLang && ref.current) ref.current.play().catch(() => {});
                        });
                      }
                    }}
                    onPause={(e) => {
                      if (isPrimary) {
                        Object.entries(videoRefs.current).forEach(([l, ref]) => {
                          if (l !== primaryLang && ref.current) ref.current.pause();
                        });
                      }
                    }}
                    onSeeked={(e) => {
                      if (isPrimary) {
                        const t = e.target.currentTime;
                        Object.entries(videoRefs.current).forEach(([l, ref]) => {
                          if (l !== primaryLang && ref.current) ref.current.currentTime = t;
                        });
                      }
                    }}
                    onWaiting={(e) => {
                      if (isPrimary) {
                        Object.entries(videoRefs.current).forEach(([l, ref]) => {
                          if (l !== primaryLang && ref.current) ref.current.pause();
                        });
                      }
                    }}
                    onPlaying={(e) => {
                      if (isPrimary) {
                        Object.entries(videoRefs.current).forEach(([l, ref]) => {
                          if (l !== primaryLang && ref.current) ref.current.play().catch(() => {});
                        });
                      }
                    }}
                    className={isPrimary ? "teacher-main-video" : ""}
                    style={isPrimary ? (classStarted ? {
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      width: '80vw',
                      height: '90vh',
                      background: '#000',
                      zIndex: 9999,
                      objectFit: 'contain',
                    } : {
                      width: '100%',
                      borderRadius: 8,
                      maxHeight: 180,
                      background: '#000',
                    }) : { display: 'none' }}
                  />
                );
              })}
            </>
          )}

          {/* 🎵 Language Videos Upload UI */}
          {!classStarted && (
            <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#ccc', marginBottom: '8px' }}>Upload Video for each language</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {SUPPORTED_LANGUAGES.map(lang => (
                  <div key={lang.code} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <button
                      onClick={() => videoInputRefs.current[lang.code]?.current?.click()}
                      style={{
                        padding: '4px 8px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer',
                        background: videoFiles[lang.code] ? '#4CAF50' : '#444', color: '#fff', border: 'none'
                      }}
                    >
                      {lang.name}
                    </button>
                    <input
                      type="file"
                      accept="video/*"
                      ref={videoInputRefs.current[lang.code]}
                      style={{ display: 'none' }}
                      onChange={(e) => setVideoFiles(prev => ({ ...prev, [lang.code]: e.target.files?.[0] || null }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* ▶ Start Class / 📝 Generate Quiz */}
          {!classStarted && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {primaryVideoURL && !classStarted && (
                <button
                  onClick={startClass}
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontWeight: 'bold',
                    background: '#4CAF50',
                    color: '#fff',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  ▶ Start Class
                </button>
              )}

              {classStarted && videoEnded && (
                <button
                  onClick={handleQuizRequest}
                  disabled={quizLoading}
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontWeight: 'bold',
                    background: quizLoading ? '#4CAF50' : '#2196F3',
                    color: '#fff',
                    borderRadius: 8,
                    border: 'none',
                    cursor: quizLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: quizLoading ? 0.7 : 1
                  }}
                >
                  {quizLoading ? (
                    <><span style={{ animation: 'tqSpin 1s linear infinite' }}>⏳</span> Generating Quiz...</>
                  ) : (
                    "📝 Generate AI Quiz"
                  )}
                </button>
              )}
            </div>
          )}

          {!classStarted && classStarted && !videoEnded && (
            <div
              style={{
                marginTop: 10,
                color: '#4CAF50',
                fontWeight: 'bold',
                textAlign: 'center',
                fontSize: '13px',
              }}
            >
              🟢 Class handles active
            </div>
          )}

          {!classStarted && videoEnded && (
            <div
              style={{
                marginTop: 10,
                color: '#FF9800',
                fontWeight: 'bold',
                textAlign: 'center',
                fontSize: '13px',
              }}
            >
              🎬 Video Completed
            </div>
          )}
        </div>
      )}
    </div>
  );
}