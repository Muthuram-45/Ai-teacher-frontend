'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TbBrandZoom } from 'react-icons/tb';
import { MdMeetingRoom, MdArrowForward } from 'react-icons/md';
import '../../styles/Page.css';

export default function StudentPortalPage() {
  const router = useRouter();
  const [inputVal, setInputVal] = useState('');
  const [error, setError] = useState('');

  const extractRoomName = (rawInput) => {
    let cleaned = rawInput.trim();
    if (!cleaned) return '';

    // If full URL was pasted (e.g. http://localhost:3000/join/room-name-123 or http://localhost:3000/rooms/room-name-123)
    try {
      if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
        const urlObj = new URL(cleaned);
        const parts = urlObj.pathname.split('/').filter(Boolean);
        // Look for part after 'join' or 'rooms'
        const joinIdx = parts.indexOf('join');
        if (joinIdx !== -1 && parts[joinIdx + 1]) {
          return parts[joinIdx + 1];
        }
        const roomsIdx = parts.indexOf('rooms');
        if (roomsIdx !== -1 && parts[roomsIdx + 1]) {
          return parts[roomsIdx + 1];
        }
        // Fallback to last path segment if path is non-empty
        if (parts.length > 0) {
          return parts[parts.length - 1];
        }
      }
    } catch (e) {
      // Not a valid URL, treat as raw room ID
    }

    // Strip leading /join/ or /rooms/ if user pasted partial path
    cleaned = cleaned.replace(/^\/?(join|rooms)\//i, '');
    return cleaned;
  };

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    setError('');

    const roomName = extractRoomName(inputVal);

    if (!roomName) {
      setError('Please enter a valid Meeting ID or paste a complete Class Link.');
      return;
    }

    router.push(`/join/${encodeURIComponent(roomName)}`);
  };

  return (
    <div className="dashPage" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="dashWrap" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header className="dashHeader" style={{ justifyContent: 'center' }}>
          <div className="brand">
            <TbBrandZoom className="brandIcon" aria-hidden />
            <span className="brandName">Student Portal</span>
          </div>
        </header>

        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
          <div className="cardInner" style={{ maxWidth: '480px', width: '100%', padding: '36px', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(79, 70, 229, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <MdMeetingRoom style={{ fontSize: '32px', color: '#818cf8' }} />
              </div>
              <h1 style={{ color: '#ffffff', fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
                Join Live Classroom
              </h1>
              <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.5', margin: 0 }}>
                Enter your <strong>Meeting ID</strong> or paste the <strong>Invite Link</strong> provided by your teacher.
              </p>
            </div>

            <form onSubmit={handleJoinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="inputGroup">
                <label className="inputLabel" style={{ color: '#cbd5e1', fontWeight: '600' }}>
                  Meeting ID or Invite Link
                </label>
                <div className="inputWrapper">
                  <input
                    type="text"
                    placeholder="e.g. python-intro-x9z2a or https://.../join/..."
                    value={inputVal}
                    onChange={(e) => {
                      setInputVal(e.target.value);
                      if (error) setError('');
                    }}
                    className="inputTight"
                    style={{ fontSize: '14px', padding: '14px 16px' }}
                    autoFocus
                  />
                </div>
                {error && (
                  <p style={{ color: '#fca5a5', fontSize: '13px', marginTop: '6px', margin: '6px 0 0 0' }}>
                    ⚠️ {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="ctaBtn"
                style={{
                  width: '100%',
                  height: '48px',
                  background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                  color: '#fff',
                  fontWeight: '700',
                  fontSize: '15px',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)'
                }}
              >
                Proceed to Class <MdArrowForward style={{ fontSize: '18px' }} />
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
