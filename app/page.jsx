'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import '../styles/page.css';

export default function Home() {
  const router = useRouter();

  // Auth (teacher login)
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

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
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const resp = await fetch(`${backendUrl}/list-voices`);
        const data = await resp.json();
        if (data.voices) setAvailableVoices(data.voices);

        const activeResp = await fetch(`${backendUrl}/active-voice`);
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
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      await fetch(`${backendUrl}/select-voice`, {
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

  const handleLogin = (e) => {
    e.preventDefault();

    if (!username || !password || !teacherName.trim()) {
      alert('Please fill in all fields');
      return;
    }

    if (username === 'teacher' && password === 'password123') {
      setIsLoggedIn(true);
    } else {
      alert('Invalid credentials');
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
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const res = await fetch(`${backendUrl}/token`, {
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
            <div className="brandIcon" aria-hidden />
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
              {/* Only one tab now */}
              <div className="tabs tabsSingle">
                <h1 style={{ textAlign: 'center', color: '#2563eb' }}>
                  Generate Meeting
                </h1>
              </div>

              <form onSubmit={handleLogin} className="authForm authFormTight">
                <input
                  type="text"
                  placeholder="Teacher Name "
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="input inputBig"
                />

                <input
                  type="text"
                  placeholder="Username"
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
                  Create Meeting <span className="arrow"></span>
                </button>

                {/* <p className="hintLine">Use your teacher credentials to proceed</p> */}
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
          <h1 className="dashTitle">Teacher Dashboard</h1>
          <button onClick={logout} className="ghostBtn" type="button">
            Logout
          </button>
        </header>

        <div className="panel">
          {!createdRoom ? (
            <>
              <h2 className="panelTitle">Create a New Meeting</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="inputGroup">
                  <label className="inputLabel">Class Name</label>
                  <div className="inputWrapper">
                    <input
                      placeholder="Eg: Python "
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
                      placeholder="Introduction to python "
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
                      style={{ outline: 'none', cursor: 'pointer' }}
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

                <button onClick={createMeeting} className="successBtn" type="button">
                  Create
                </button>
              </div>
            </>
          ) : (
            <div className="stack">
              <div className="shareBox">
                <div className="shareHint">Share this link with students:</div>

                <div className="shareRow">
                  <code className="shareCode">{`${window.location.origin}/join/${createdRoom}`}</code>

                  <button onClick={onCopyLink} className="linkBtn" type="button">
                    Copy Link
                  </button>
                </div>
              </div>

              <div className="row">
                <button
                  onClick={startMeeting}
                  className="primaryBtn primaryBtnXL"
                  type="button"
                  disabled={loading}
                >
                  {loading ? 'Starting...' : 'Start Meeting Now'}
                </button>

                <button onClick={() => setCreatedRoom(null)} className="outlineBtn" type="button">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div >
  );
}


