'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { TbBrandZoom } from "react-icons/tb";
import { MdContentCopy } from "react-icons/md";
import { BACKEND_URL } from './lib/config';

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
  const [selectedVoice, setSelectedVoice] = useState('reference_voice.wav');

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

        <div className="panel">
          {!createdRoom ? (
            <>
              <h2 className="panelTitle" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                <span style={{ color: 'var(--blue)', fontSize: '24px' }}>+</span> Create a New Session
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '20px' }}>
                <div className="inputGroup">
                  <label className="inputLabel">Class Name</label>
                  <div className="inputWrapper">
                    <input
                      placeholder="Eg: Python"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      className="inputTight"
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

                    >
                      {availableVoices.length > 0 ? (
                        availableVoices.map(v => (
                          <option key={v} value={v}>
                            {v.replace('.wav', '').replace(/_/g, ' ')}
                          </option>
                        ))
                      ) : (
                        <option value="reference_voice.wav">Default Voice</option>
                      )}
                    </select>

                  </div>
                </div>

                <button onClick={createMeeting} className="successBtn" type="button" style={{ height: '52px', marginTop: '10px', background: '#4f46e5' }}>
                  Create Session
                </button>
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


