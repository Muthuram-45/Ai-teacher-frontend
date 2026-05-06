'use client';

import { useEffect, useRef, useState } from 'react';
import { DataPacket_Kind } from 'livekit-client';
import { useRoomContext } from '@livekit/components-react';
import { TeacherVideoPublisher } from './TeacherVideoPublisher';
import { speakText } from '@/app/lib/aiTTS';
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

  const [videoFile, setVideoFile] = useState(null);
  const [videoURL, setVideoURL] = useState(null);

  const [popupName, setPopupName] = useState(null);


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

  /* ---------------- VIDEO FILE ---------------- */
  useEffect(() => {
    if (!videoFile) return;

    const url = URL.createObjectURL(videoFile);
    setVideoURL(url);

    // reset class state
    setClassStarted(false);
    setVideoEnded(false);
    publishedRef.current = false;
    setPopupName(null);

    // ✅ reset doubt finish logic
    doubtCountRef.current = 0;
    announcedFinishRef.current = false;

    // ✅ reset end announcement for new video
    endedAnnouncedRef.current = false;

    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoFile]);

  // Handle video end (✅ UPDATED: speaks when video ends)
  useEffect(() => {
    const video = videoRef.current;
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
  }, [videoURL]);

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
    if (!videoRef.current || publishedRef.current) return;

    const ok = window.confirm('Do you want to start the class now?');
    if (!ok) return;

    try {
      // publish video track
      await publisherRef.current.publishVideo(videoRef.current);
      publishedRef.current = true;

      await videoRef.current.play();

      // ✅ Start broadcasting time updates to students every second
      startTimeSync(videoRef.current);

      // notify students (include real duration so timeline shows immediately)
      const duration = videoRef.current.duration;
      room.localParticipant.publishData(
        new TextEncoder().encode(
          JSON.stringify({
            action: 'VIDEO_START',
            duration: isFinite(duration) ? duration : 0,
          })
        ),
        { reliable: true }
      );

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
    setShowQuizPopup(false);
    if (onGenerateQuiz) {
      await onGenerateQuiz();
    }
    setQuizLoading(false);
  };

  /* ---------------- LIVEKIT DATA ---------------- */

  useEffect(() => {
    if (!room) return;

    const handleData = async (payload, _participant, kind) => {
      if (kind !== DataPacket_Kind.RELIABLE) return;

      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));

        /* ✋ HAND RAISE */
        if (msg.action === 'HAND_RAISE' && msg.raised) {
          setPopupName(msg.name);

          const isPlaying =
            classStarted &&
            videoRef.current &&
            !videoRef.current.paused;


          // auto pause class video
          if (isPlaying) {
            console.log('⏸ Pausing video due to hand raise');
            videoRef.current.pause();

            // Notify students to pause (purely additive, doesn't change local pause logic)
            room.localParticipant.publishData(
              new TextEncoder().encode(
                JSON.stringify({
                  action: 'VIDEO_PAUSE',
                  currentTime: videoRef.current.currentTime
                })
              ),
              { reliable: true }
            );

            const txt = `${msg.name}, you raised your hand. Do you have any doubts? If so, please click the ‘Ask a Doubt’ button to submit your question.`;
            await speakText(txt, {
              audioContext: recordingAudioContext.current,
              destinationNode: recordingDestNode.current
            });
            if (room) {
              room.localParticipant.publishData(
                new TextEncoder().encode(JSON.stringify({ action: "AI_SPEAK_BROADCAST", text: txt })),
                { reliable: true }
              );
            }
          }
        } else if (msg.action === 'HAND_RAISE') {
          console.log('✋ Hand lowered by:', msg.name);
        }

        /* 🎤 STUDENT MIC ON → auto-pause teacher video */
        if (msg.action === 'VOICE_DOUBT_START') {
          const isPlaying =
            classStarted &&
            videoRef.current &&
            !videoRef.current.paused;

          if (isPlaying) {
            console.log('⏸ Pausing video: student mic ON by', msg.name);
            videoRef.current.pause();

            room.localParticipant.publishData(
              new TextEncoder().encode(
                JSON.stringify({
                  action: 'VIDEO_PAUSE',
                  currentTime: videoRef.current.currentTime
                })
              ),
              { reliable: true }
            );
          }
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
              if (videoRef.current && !videoRef.current.paused) {
                videoRef.current.pause();
              }
            }
            return next;
          });
        }
      } catch (e) {
        console.error('Invalid data message', e);
      }
    };

    room.on('dataReceived', handleData);
    return () => room.off('dataReceived', handleData);
  }, [room, classStarted, recordingAudioContext, recordingDestNode]);


  const fileInputRef = useRef(null);

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
      {/* 🎥 Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="video/*"
        onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
        style={{ display: 'none' }}
      />

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
        {videoURL ? (
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
                if (videoRef.current) videoRef.current.pause();
                setVideoURL(null);
                setVideoFile(null);
                setClassStarted(false);
                if (onClassStatusChange) onClassStatusChange(false);
                publishedRef.current = false;
                doubtCountRef.current = 0;
                announcedFinishRef.current = false;
                endedAnnouncedRef.current = false;
                // ✅ clear file input so same file can be selected again
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
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
            onClick={() => fileInputRef.current?.click()}
            title="Upload Video Class"
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#222',
              border: '1px solid #444',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.2rem',
              transition: 'background 0.2s',
            }}
          >
            <MdUploadFile />
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
      {(videoURL || classStarted) && (
        <div
          style={{
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
                if (videoRef.current) {
                  videoRef.current.pause();
                }

                setVideoURL(null);
                setClassStarted(false);
                if (onClassStatusChange) onClassStatusChange(false);
                publishedRef.current = false;

                // ✅ reset finish logic
                doubtCountRef.current = 0;
                announcedFinishRef.current = false;

                // ✅ reset end announcement
                endedAnnouncedRef.current = false;
                // ✅ clear file input so same file can be selected again
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
              style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          {/* 🎥 Video preview */}
          {videoURL && (
            <video
              ref={videoRef}
              src={videoURL}
              controls={true}
              onPlay={() => { }}
              style={classStarted ? {
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
              }}
            />
          )}

          {/* ▶ Start Class / 📝 Generate Quiz */}
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {videoURL && !classStarted && (
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
                style={{
                  width: '100%',
                  padding: '10px',
                  fontWeight: 'bold',
                  background: '#2196F3',
                  color: '#fff',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                📝 Generate AI Quiz
              </button>
            )}
          </div>

          {classStarted && !videoEnded && (
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

          {videoEnded && (
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