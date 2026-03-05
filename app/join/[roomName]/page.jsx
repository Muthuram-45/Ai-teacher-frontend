'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import './studentjoin.css';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

/* -------- Meeting Ended Full-Screen Gate -------- */
function MeetingEndedGate() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
            fontFamily: 'Inter, system-ui, sans-serif',
            padding: '24px',
        }}>
            <div style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(244, 67, 54, 0.35)',
                borderRadius: '24px',
                padding: '60px 52px',
                textAlign: 'center',
                maxWidth: '420px',
                width: '100%',
                boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
                animation: 'fadeUp 0.5s ease',
            }}>
                <div style={{ fontSize: '4.5rem', marginBottom: '20px' }}>🚫</div>
                <h1 style={{
                    color: '#fff',
                    fontSize: '1.7rem',
                    fontWeight: 700,
                    margin: '0 0 14px',
                    letterSpacing: '-0.5px',
                }}>
                    Meeting Ended
                </h1>
                <p style={{
                    color: 'rgba(255,255,255,0.65)',
                    fontSize: '1rem',
                    margin: '0',
                    lineHeight: 1.7,
                }}>
                    Teacher has closed the meeting.<br />
                    You can no longer join this session.
                </p>
            </div>
            <style>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}

/* -------- Student Join Form -------- */
export default function StudentJoinPage() {
    const { roomName } = useParams();
    const router = useRouter();

    const [status, setStatus] = useState('checking'); // 'checking' | 'ended' | 'active' | 'waiting'
    const [studentName, setStudentName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [requestId, setRequestId] = useState(null);

    // Check if meeting is ended
    useEffect(() => {
        if (!roomName) return;
        fetch(`${BACKEND_URL}/room-status/${encodeURIComponent(roomName)}`)
            .then(r => r.json())
            .then(data => {
                setStatus(data.ended ? 'ended' : 'active');
            })
            .catch(() => {
                // If backend is unreachable, allow joining (fail open)
                setStatus('active');
            });
    }, [roomName]);

    // Polling for admission status
    useEffect(() => {
        let interval;
        if (status === 'waiting' && requestId) {
            interval = setInterval(() => {
                fetch(`${BACKEND_URL}/join-status/${requestId}`)
                    .then(r => r.json())
                    .then(data => {
                        if (data.status === 'admitted' && data.token) {
                            router.push(
                                `/rooms/${roomName}?token=${encodeURIComponent(data.token)}&url=${encodeURIComponent(data.url)}`
                            );
                            clearInterval(interval);
                        } else if (data.status === 'rejected') {
                            setError(data.error || 'Teacher rejected your request.');
                            setStatus('active');
                            setLoading(false);
                            clearInterval(interval);
                        }
                    })
                    .catch(err => console.error("Polling error:", err));
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [status, requestId, roomName, router]);

    const handleJoin = async (e) => {
        e.preventDefault();
        if (!studentName.trim()) {
            setError('Please enter your name.');
            return;
        }
        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${BACKEND_URL}/request-join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: studentName.trim(),
                    room: roomName,
                }),
            });

            const data = await res.json();

            if (res.status === 403) {
                setError(data.error);
                setLoading(false);
                return;
            }

            if (data.requestId) {
                setRequestId(data.requestId);
                setStatus('waiting');
            } else {
                setError('Could not send join request. Please try again.');
                setLoading(false);
            }
        } catch (err) {
            console.error(err);
            setError('Something went wrong. Please try again.');
            setLoading(false);
        }
    };

    // ---- States ----
    if (status === 'checking') {
        return (
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: '#0f172a',
                color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter, sans-serif',
                fontSize: '1rem', gap: '12px',
            }}>
                <span style={{ fontSize: '1.4rem', animation: 'spin 1s linear infinite' }}>⌛</span>
                Checking meeting status…
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (status === 'ended') {
        return <MeetingEndedGate />;
    }

    if (status === 'waiting') {
        return (
            <div className="joinWrap">
                <div className="joinCard" style={{ textAlign: 'center', padding: '60px 40px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '20px', animation: 'pulse 2s infinite' }}>⏳</div>
                    <h1 className="joinTitle">Waiting for Teacher</h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                        Hello <b>{studentName}</b>,<br />
                        The teacher has been notified. Please wait until they admit you to the room.
                    </p>
                    <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'center' }}>
                        <div className="loading-dots">
                            <span>.</span><span>.</span><span>.</span>
                        </div>
                    </div>
                </div>
                <style>{`
                    @keyframes pulse {
                        0% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.1); opacity: 0.7; }
                        100% { transform: scale(1); opacity: 1; }
                    }
                    .loading-dots span {
                        font-size: 2rem;
                        color: #2196F3;
                        animation: blink 1.4s infinite both;
                    }
                    .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
                    .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
                    @keyframes blink {
                        0% { opacity: 0.2; }
                        20% { opacity: 1; }
                        100% { opacity: 0.2; }
                    }
                `}</style>
            </div>
        );
    }

    // ---- Active: Show Join Form ----
    return (
        <div className="joinWrap">
            <div className="joinCard">
                <h1 className="joinTitle">Join Meeting</h1>
                <p className="joinRoom">
                    Room: <span className="joinRoomCode">{roomName}</span>
                </p>

                <form onSubmit={handleJoin} className="joinForm">
                    <div className="joinField">
                        <label className="joinLabel">Your Name</label>
                        <input
                            className="joinInput"
                            type="text"
                            placeholder="Enter your name"
                            value={studentName}
                            onChange={e => setStudentName(e.target.value)}
                            disabled={loading}
                            autoFocus
                        />
                    </div>

                    {error && (
                        <p style={{ color: '#ef4444', fontSize: '0.875rem', margin: 0 }}>
                            ⚠️ {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        className="joinBtn"
                        disabled={loading}
                    >
                        {loading ? 'Joining...' : '🎓 Join Now'}
                    </button>
                </form>
            </div>
        </div>
    );
}
