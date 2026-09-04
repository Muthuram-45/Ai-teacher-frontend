'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { TbBrandZoom } from "react-icons/tb";
import { MdContentCopy } from "react-icons/md";
import { BACKEND_URL, VIDEOGEN_URL } from './lib/config';
import '../styles/Page.css'

export default function Home() {
  const router = useRouter();

  // Auth (teacher login)
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Password Reset State
  const [authMode, setAuthMode] = useState('login'); // 'login', 'otp', 'reset'
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Dashboard meeting create
  const [meetingName, setMeetingName] = useState('');
  const [createdRoom, setCreatedRoom] = useState(null);
  const [className, setClassName] = useState('');
  const [topic, setTopic] = useState('');

  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState('Female');
  const [showRejoinPopup, setShowRejoinPopup] = useState(false);

  // Video Generation State
  const [videoLanguages, setVideoLanguages] = useState(['ta', 'hi', 'ml', 'te', 'kn']);
  const [videoDuration, setVideoDuration] = useState(5);
  const [videoVoices, setVideoVoices] = useState([]);
  const [selectedVideoVoice, setSelectedVideoVoice] = useState('Female');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [generatedVideo, setGeneratedVideo] = useState(null);
  const [videoError, setVideoError] = useState(null);

  // Fetch video voices from videogenerator
  const fetchVideoVoices = async () => {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/video-voices`);
      const data = await resp.json();
      if (data.success && data.voices) setVideoVoices(data.voices);
    } catch (e) {
      console.error("Failed to fetch video voices:", e);
    }
  };

  // Generate Teaching Video (one-shot)
  const handleGenerateVideo = async () => {
    if (!className.trim() || !topic.trim()) {
      alert('Please enter both Class Name and Topic before generating a video.');
      return;
    }

    setIsGeneratingVideo(true);
    setVideoProgress(0);
    setGeneratedVideo(null);
    setVideoError(null);

    // Simulate progress (the actual generation is a single long request)
    const progressInterval = setInterval(() => {
      setVideoProgress(prev => {
        if (prev >= 95) return prev;
        return prev + 1;
      });
    }, 2000);

    try {
      const response = await fetch(`${BACKEND_URL}/api/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: className.trim(),
          subTopic: topic.trim(),
          durationMinutes: videoDuration,
          languages: videoLanguages,
          voiceId: selectedVideoVoice
        })
      });

      clearInterval(progressInterval);
      setVideoProgress(100);

      const data = await response.json();

      if (data.success) {
        if (data.data?.processing) {
          setVideoError(`🎬 ${data.message || 'Video generation is processing in the background on the server.'}`);
        } else {
          setGeneratedVideo(data.data);
        }
      } else {
        setVideoError(data.message || data.error || 'Video generation failed');
      }
    } catch (err) {
      clearInterval(progressInterval);
      console.error('Video generation error:', err);
      if (videoDuration >= 3 || videoLanguages.length > 2) {
        setVideoError(`Your ${videoDuration}-minute video is rendering in the background on the cloud server. Please check the video list in a couple minutes.`);
      } else {
        setVideoError('Video generation request timed out or network disconnected. The server may still be processing your video.');
      }
    } finally {
      setTimeout(() => {
        setIsGeneratingVideo(false);
        setVideoProgress(0);
      }, 500);
    }
  };

  // Force file download directly to gallery/downloads folder
  const downloadFile = async (fileUrl, fileName) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'teaching_video.mp4';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      window.location.href = fileUrl;
    }
  };

  useEffect(() => {
    setIsClient(true);
    // Fetch voices
    const fetchVoices = async () => {
      try {
        const resp = await fetch(`${BACKEND_URL}/list-voices`);
        const data = await resp.json();
        if (data.voices) setAvailableVoices(data.voices);

        const activeResp = await fetch(`${BACKEND_URL}/active-voice`);
        const activeData = await activeResp.json();
        if (activeData.activeVoice) setSelectedVoice(activeData.activeVoice);
      } catch (e) {
        console.error("Failed to fetch voices:", e);
      }
    };
    fetchVoices();
    fetchVideoVoices();
  }, []);

  const handleVoiceChange = async (e) => {
    const voice = e.target.value;
    setSelectedVoice(voice);
    try {
      await fetch(`${BACKEND_URL}/select-voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice })
      });
    } catch (e) {
      console.error("Failed to select voice:", e);
    }
  };

  // Landing UI tab (only create)
  const [activeTab, setActiveTab] = useState('create');

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!username || !password) {
      alert('Please fill in Email and Password');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username, password, name: teacherName })
      });

      const data = await response.json();
      if (data.success) {
        setIsLoggedIn(true);
        if (data.teacherName) {
          setTeacherName(data.teacherName);
        }
        if (localStorage.getItem("lastMeetingRoom")) {
          setShowRejoinPopup(true);
        }
      } else {
        alert(data.error || 'Invalid credentials');
      }
    } catch (err) {
      console.error(err);
      alert('Login failed. Ensure backend is running.');
    }
  };

  const initForgotPassword = async () => {
    if (!username) {
      alert('Please enter your Gmail / Email Address first to reset your password.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username })
      });
      const data = await response.json();
      if (data.success) {
        alert('OTP sent to your email. Please check your inbox.');
        setAuthMode('otp');
      } else {
        alert(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      alert('Network error. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otp) {
      alert('Please enter the OTP');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username, otp })
      });
      const data = await response.json();
      if (data.success) {
        setAuthMode('reset');
      } else {
        alert(data.error || 'Invalid OTP');
      }
    } catch (err) {
      alert('Network error. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword) {
      alert('Please enter a new password');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username, otp, newPassword })
      });
      const data = await response.json();
      if (data.success) {
        alert('Password has been reset successfully! You can now login.');
        setAuthMode('login');
        setPassword('');
        setOtp('');
        setNewPassword('');
      } else {
        alert(data.error || 'Failed to reset password');
      }
    } catch (err) {
      alert('Network error. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const createMeeting = () => {
    if (!className.trim() || !topic.trim()) {
      alert('Please enter both Class Name and Topic');
      return;
    }

    // Auto-generate meeting name from class name and topic
    const meetingName = `${className.trim()}-${topic.trim()}`;

    const roomName =
      meetingName.replace(/\s+/g, '-').toLowerCase() +
      '-' +
      Math.random().toString(36).substring(7);

    setCreatedRoom(roomName);
  };

  async function startMeeting() {
    if (!createdRoom) return;

    // Validate class name and topic
    if (!className.trim() || !topic.trim()) {
      alert('Please enter both Class Name and Topic before starting the meeting');
      return;
    }

    setLoading(true);

    try {
      localStorage.setItem("lastMeetingRoom", createdRoom);
      localStorage.setItem("lastMeetingClassName", className.trim());
      localStorage.setItem("lastMeetingTopic", topic.trim());
      localStorage.setItem("lastMeetingMeetingName", meetingName);

      const res = await fetch(`${BACKEND_URL}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teacherName,
          room: createdRoom,
          role: 'teacher',
          className: className.trim(),
          topic: topic.trim()
        }),
      });

      const data = await res.json();

      if (typeof data.token === 'string') {
        router.push(
          `/rooms/${createdRoom}?token=${encodeURIComponent(data.token)}&url=${encodeURIComponent(
            data.url,
          )}&className=${encodeURIComponent(meetingName)}`,
        );
      } else {
        alert('Invalid token received. Check your .env.local API key/secret.');
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert('Something went wrong while generating token');
      setLoading(false);
    }
  }

  const logout = () => {
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
    setMeetingName('');
    setCreatedRoom(null);
    setClassName('');
    setTopic('');
    setLoading(false);
    setActiveTab('create');
    setAuthMode('login');
    setOtp('');
    setNewPassword('');
  };

  const handleRejoinYes = () => {
    const r = localStorage.getItem("lastMeetingRoom");
    const c = localStorage.getItem("lastMeetingClassName") || "";
    const t = localStorage.getItem("lastMeetingTopic") || "";
    const m = localStorage.getItem("lastMeetingMeetingName") || `${c}-${t}`;

    setCreatedRoom(r);
    setClassName(c);
    setTopic(t);
    relaunchMeeting(r, c, t, m);
  };

  const handleRejoinNo = () => {
    localStorage.removeItem("lastMeetingRoom");
    localStorage.removeItem("lastMeetingClassName");
    localStorage.removeItem("lastMeetingTopic");
    localStorage.removeItem("lastMeetingMeetingName");
    setShowRejoinPopup(false);
  };

  async function relaunchMeeting(r, c, t, m) {
    setShowRejoinPopup(false);
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teacherName,
          room: r,
          role: 'teacher',
          className: c,
          topic: t
        }),
      });

      const data = await res.json();

      if (typeof data.token === 'string') {
        router.push(
          `/rooms/${r}?token=${encodeURIComponent(data.token)}&url=${encodeURIComponent(
            data.url,
          )}&className=${encodeURIComponent(m)}`,
        );
      } else {
        alert('Invalid token received. Check your .env.local API key/secret.');
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert('Something went wrong while generating token');
      setLoading(false);
    }
  }

  const onCopyLink = async () => {
    try {
      const link = `${window.location.origin}/join/${createdRoom}`;
      await navigator.clipboard.writeText(link);
      alert('Link copied!');
    } catch {
      alert('Copy failed. Please copy manually.');
    }
  };

  if (!isClient) return null;

  // ---------------- LANDING PAGE (before login) ----------------
  if (!isLoggedIn) {
    return (
      <div className="landingPage">
        {/* Top bar */}
        <header className="topbar">
          <div className="brand">
            <TbBrandZoom className="brandIcon" aria-hidden />
            <span className="brandName">SkyMeet</span>
          </div>
        </header>

        {/* Main */}
        <main className="landingMain">
          {/* Left hero */}
          <section className="hero">
            <h1 className="heroTitle">
              Smart Virtual Sessions for <span className="heroAccent">Modern Learning</span>
            </h1>

            <p className="heroSub">
              Conduct structured virtual sessions with clarity, reliability, and seamless
              collaboration tools built for academic excellence.
            </p>
          </section>

          {/* Right card */}
          <section className="rightCard">
            <div className="cardInner">
              <div className="tabs tabsSingle">
                <h1 style={{ textAlign: 'center', color: 'var(--blue)', marginBottom: '10px' }}>
                  Teacher Login
                </h1>
              </div>

              <form onSubmit={handleLogin} className="authForm authFormTight">
                <input
                  type="text"
                  placeholder="Tutor Name "
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="input inputBig"
                />

                <input
                  type="email"
                  placeholder="Gmail / Email Address"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input inputBig"
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input inputBig"
                />

                <button type="submit" className="ctaBtn">
                  Login <span className="arrow"></span>
                </button>
              </form>
            </div>
          </section>
        </main>
      </div>
    );
  }

  // ---------------- DASHBOARD (after login) ----------------
  return (
    <div className="dashPage">
      {showRejoinPopup && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{ background: '#1e293b', padding: '30px', borderRadius: '12px', textAlign: 'center', border: '1px solid #334155' }}>
            <h2 style={{ color: '#fff', marginBottom: '20px' }}>Join Last Meeting?</h2>
            <p style={{ color: '#cbd5e1', marginBottom: '30px' }}>You left a meeting recently. Would you like to rejoin it?</p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button onClick={handleRejoinYes} style={{ padding: '10px 24px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                Yes, Rejoin
              </button>
              <button onClick={handleRejoinNo} style={{ padding: '10px 24px', background: 'transparent', color: '#cbd5e1', border: '1px solid #475569', borderRadius: '8px', cursor: 'pointer' }}>
                No, Create New
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="dashWrap">
        <header className="dashHeader">
          <div className="brand" style={{ cursor: 'pointer' }} onClick={() => router.push('/')}>
            <TbBrandZoom className="brandIcon" aria-hidden />
            <span className="brandName">Teacher Dashboard</span>
          </div>
          <button onClick={logout} className="ghostBtn" type="button">
            Logout
          </button>
        </header>

        <div className="panel" style={{ maxWidth: '960px' }}>
          {!createdRoom ? (
            <>
              <h2 className="panelTitle" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '20px' }}>
                <span style={{ color: 'var(--blue)', fontSize: '24px' }}>+</span> Create & Configure Session
              </h2>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                gap: '28px',
                alignItems: 'start'
              }}>
                {/* Left Column: Session Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ color: '#818cf8', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    1. Session Details
                  </h3>

                  <div className="inputGroup">
                    <label className="inputLabel">Class Name</label>
                    <div className="inputWrapper">
                      <input
                        placeholder="Eg: Python"
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                        className="inputTight"
                        disabled={isGeneratingVideo}
                      />
                    </div>
                  </div>

                  <div className="inputGroup">
                    <label className="inputLabel">Topic Name</label>
                    <div className="inputWrapper">
                      <input
                        placeholder="Introduction to python"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="inputTight"
                        disabled={isGeneratingVideo}
                      />
                    </div>
                  </div>

                  <div className="inputGroup">
                    <label className="inputLabel">AI Voice (Tone)</label>
                    <div className="inputWrapper">
                      <select
                        value={selectedVoice}
                        onChange={handleVoiceChange}
                        className="inputTight"
                        disabled={isGeneratingVideo}
                      >
                        <option value="" disabled>Select Voice</option>
                        {availableVoices
                          .map(v => (
                            <option key={v} value={v}>
                              {v.replace('.wav', '').replace(/_/g, ' ')}
                            </option>
                          ))
                        }
                      </select>
                    </div>
                  </div>

                  <button onClick={createMeeting} className="successBtn" type="button" style={{ height: '48px', marginTop: '12px', background: '#4f46e5', fontSize: '15px' }}>
                    Create Session
                  </button>
                </div>

                {/* Right Column: AI Video Generation */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: '16px',
                  background: 'rgba(30, 41, 59, 0.35)', padding: '20px', borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  <h3 style={{ color: '#818cf8', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🎬 2. AI Video Generation (Optional)
                  </h3>

                  {/* Additional Languages */}
                  <div className="inputGroup">
                    <label className="inputLabel">Additional Languages</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                      {[
                        { code: 'ta', name: 'Tamil' },
                        { code: 'hi', name: 'Hindi' },
                        { code: 'ml', name: 'Malayalam' },
                        { code: 'te', name: 'Telugu' },
                        { code: 'kn', name: 'Kannada' }
                      ].map(lang => (
                        <label key={lang.code} style={{
                          display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                          background: videoLanguages.includes(lang.code) ? 'rgba(99,102,241,0.2)' : 'rgba(15,23,42,0.6)',
                          border: videoLanguages.includes(lang.code) ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(255,255,255,0.08)',
                          padding: '5px 10px', borderRadius: '8px', fontSize: '12px', color: '#cbd5e1'
                        }}>
                          <input
                            type="checkbox"
                            checked={videoLanguages.includes(lang.code)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setVideoLanguages([...videoLanguages, lang.code]);
                              } else {
                                setVideoLanguages(videoLanguages.filter(c => c !== lang.code));
                              }
                            }}
                            disabled={isGeneratingVideo}
                            style={{ accentColor: '#6366f1' }}
                          />
                          {lang.name}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Duration + Voice */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="inputGroup">
                      <label className="inputLabel">Duration</label>
                      <div className="inputWrapper">
                        <select
                          value={videoDuration}
                          onChange={(e) => setVideoDuration(Number(e.target.value))}
                          className="inputTight"
                          disabled={isGeneratingVideo}
                        >
                          <option value={5}>5 Mins</option>
                          <option value={15}>15 Mins</option>
                          <option value={30}>30 Mins</option>
                          <option value={40}>40 Mins</option>
                          <option value={60}>60 Mins</option>
                        </select>
                      </div>
                    </div>

                    <div className="inputGroup">
                      <label className="inputLabel">Teacher Voice</label>
                      <div className="inputWrapper">
                        <select
                          value={selectedVideoVoice}
                          onChange={(e) => setSelectedVideoVoice(e.target.value)}
                          className="inputTight"
                          disabled={isGeneratingVideo}
                        >
                          <option value="Female">Female</option>
                          <option value="Male">Male</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Generate Video Button */}
                  <button
                    onClick={handleGenerateVideo}
                    type="button"
                    disabled={isGeneratingVideo || !className.trim() || !topic.trim()}
                    style={{
                      width: '100%', height: '44px', border: 'none', borderRadius: '12px',
                      background: isGeneratingVideo
                        ? 'linear-gradient(135deg, #4338ca, #6366f1)'
                        : 'linear-gradient(135deg, #7c3aed, #6366f1)',
                      color: '#fff', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      opacity: (!className.trim() || !topic.trim()) ? 0.5 : 1
                    }}
                  >
                    {isGeneratingVideo ? (
                      <>
                        <span style={{
                          width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)',
                          borderTopColor: '#fff', borderRadius: '50%',
                          animation: 'spin 1s linear infinite', display: 'inline-block'
                        }} />
                        Generating Video... ({videoProgress}%)
                      </>
                    ) : (
                      <>
                        🎬 Generate Video
                      </>
                    )}
                  </button>

                  {/* Progress Bar */}
                  {isGeneratingVideo && (
                    <div style={{
                      width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)',
                      borderRadius: '4px', overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${videoProgress}%`, height: '100%',
                        background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                        transition: 'width 0.5s ease', borderRadius: '4px'
                      }} />
                    </div>
                  )}

                  {/* Error */}
                  {videoError && (
                    <div style={{
                      padding: '10px 14px', borderRadius: '8px',
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                      color: '#fca5a5', fontSize: '12px'
                    }}>
                      ❌ {videoError}
                    </div>
                  )}

                  {/* Generated Video Result */}
                  {generatedVideo && (
                    <div style={{
                      padding: '14px', borderRadius: '14px',
                      background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.3)',
                      marginTop: '4px'
                    }}>
                      <div style={{
                        color: '#34d399', fontSize: '13px', fontWeight: '700', marginBottom: '8px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                      }}>
                        <span>✅ Video Generated Successfully!</span>
                      </div>

                      {/* Video Player */}
                      <video
                        controls
                        style={{ width: '100%', borderRadius: '10px', marginBottom: '10px', background: '#000' }}
                        src={`${VIDEOGEN_URL}${generatedVideo.videoUrl}`}
                      />

                      {/* Main Download Video Button */}
                      <button
                        onClick={() => downloadFile(`${VIDEOGEN_URL}${generatedVideo.videoUrl}`, `${className || 'teaching'}_video.mp4`)}
                        type="button"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                          width: '100%', padding: '10px 16px', borderRadius: '10px',
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          color: '#ffffff', fontWeight: '700', fontSize: '13px',
                          border: 'none', cursor: 'pointer', marginBottom: '10px',
                          boxShadow: '0 4px 14px rgba(16,185,129,0.3)', transition: 'all 0.2s ease'
                        }}
                      >
                        📥 Download Main Video (MP4)
                      </button>

                      {/* Multi-Language Download Options */}
                      {generatedVideo.videos && Object.keys(generatedVideo.videos).length > 1 && (
                        <div>
                          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', display: 'block', marginBottom: '6px' }}>
                            Other Language MP4 Downloads:
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {Object.entries(generatedVideo.videos).map(([code, video]) => (
                              <button
                                key={code}
                                onClick={() => downloadFile(`${VIDEOGEN_URL}${video.url}`, `${className || 'teaching'}_${code}.mp4`)}
                                type="button"
                                style={{
                                  padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                                  background: code === 'en' ? 'rgba(99,102,241,0.3)' : 'rgba(30,41,59,0.8)',
                                  border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0',
                                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
                                }}
                              >
                                📥 {video.language}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="stack">
              <div className="shareBox" style={{ background: 'rgba(30, 41, 59, 0.3)', border: '1px solid var(--border)' }}>
                <div className="shareHint" style={{ color: 'var(--muted)', fontWeight: '500' }}>Student Invite Link</div>

                <div className="shareRow" style={{ background: '#050814', border: '1px solid var(--border)', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, overflow: 'hidden' }}>
                    <span style={{ color: 'var(--blue)', fontSize: '18px' }}>🌐</span>
                    <code className="shareCode" style={{ color: 'var(--blue-light)', fontSize: '14px' }}>{`${window.location.origin}/join/${createdRoom}`}</code>
                  </div>

                  <button onClick={onCopyLink} className="linkBtn" type="button" style={{
                    background: 'var(--blue)',
                    color: 'white',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <MdContentCopy />
                  </button>
                </div>
              </div>

              <div className="row" style={{ gap: '16px' }}>
                <button
                  onClick={startMeeting}
                  className="primaryBtn primaryBtnXL"
                  type="button"
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: '#4f46e5' }}
                >
                  {loading ? 'Starting...' : <> Launch Meeting</>}
                </button>

                <button onClick={() => setCreatedRoom(null)} className="outlineBtn" type="button" style={{ background: 'transparent', color: 'var(--muted)', fontWeight: '600' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


