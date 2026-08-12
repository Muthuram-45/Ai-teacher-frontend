'use client';
import React from 'react';
import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash } from 'react-icons/fa';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function ParticipantList({ onClose, studentActivities = {} }) {
    const participants = useParticipants();
    const { localParticipant } = useLocalParticipant();

    let myRole = 'Student';
    try {
        const metadata = JSON.parse(localParticipant?.metadata || '{}');
        myRole = metadata.role || 'Student';
    } catch (e) { }

    return (
        <div style={{
            position: 'absolute',
            bottom: 80,
            right: 20,
            width: 380,
            background: 'rgba(17, 17, 17, 0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: '20px',
            color: '#fff',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            zIndex: 1000,
            fontFamily: 'Inter, sans-serif'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Participants ({participants.length})</h3>
                    {myRole === 'teacher' && (
                        <button
                            onClick={() => {
                                const roomName = window.location.pathname.split("/").pop();
                                window.open(`${BACKEND_URL}/api/activity-history/${roomName}`, '_blank');
                            }}
                            title="Download Activity Report"
                            style={{
                                background: 'rgba(33, 150, 243, 0.2)',
                                border: '1px solid rgba(33, 150, 243, 0.4)',
                                color: '#2196F3',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(33, 150, 243, 0.4)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(33, 150, 243, 0.2)'; }}
                        >
                            ⬇ CSV Report
                        </button>
                    )}
                </div>
                <button
                    onClick={onClose}
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: 'none',
                        color: '#aaa',
                        cursor: 'pointer',
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#aaa'; }}
                >✕</button>
            </div>

            <div style={{ maxHeight: 350, overflowY: 'auto', paddingRight: '4px' }}>
                {participants.map((p) => {
                    let role = 'Student';
                    try {
                        role = JSON.parse(p.metadata || '{}').role || 'Student';
                    } catch { }

                    const isMicOn = p.isMicrophoneEnabled;
                    const isCameraOn = p.isCameraEnabled;
                    
                    const activity = studentActivities[p.identity];
                    let statusColor = '#4CAF50';
                    let statusText = '🟢 Active';
                    
                    if (activity && activity.status !== 'ACTIVE') {
                        statusColor = '#f59e0b';
                        if (activity.status === 'INACTIVE') statusText = '🟡 Inactive';
                        else if (activity.status === 'TAB_AWAY') statusText = '🔴 Switched Tab';
                        else if (activity.status === 'POSSIBLE_EXTERNAL_ACTIVITY') statusText = '🔴 Possible External Activity';
                        else if (activity.status === 'BACKGROUND') statusText = '🟣 Background Active';
                    }

                    const formatDuration = (ms) => {
                        if (!ms) return '00:00';
                        const totalSeconds = Math.floor(ms / 1000);
                        const m = Math.floor(totalSeconds / 60);
                        const s = totalSeconds % 60;
                        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                    };

                    return (
                        <div key={p.sid} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 0',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                        }}>
                            <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                                <div style={{
                                    fontWeight: 500,
                                    fontSize: '0.95rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {p.identity} {p.isLocal && <span style={{ color: '#4CAF50', fontSize: '0.8rem', marginLeft: '4px' }}>(You)</span>}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                                    {role} 
                                    {role === 'student' && !p.isLocal && (
                                        <span style={{ marginLeft: '8px', color: statusColor, fontWeight: 'bold' }}>
                                            {statusText}
                                        </span>
                                    )}
                                </div>
                                {role === 'student' && activity?.durationAwayMs > 0 && (
                                    <div style={{ fontSize: '0.7rem', color: '#f59e0b', marginTop: '2px' }}>
                                        Away Time: {formatDuration(activity.durationAwayMs)}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <div title={isMicOn ? "Microphone On" : "Microphone Off"} style={{ color: isMicOn ? '#4CAF50' : '#f44336', display: 'flex' }}>
                                    {isMicOn ? <FaMicrophone size={16} /> : <FaMicrophoneSlash size={16} />}
                                </div>
                                <div title={isCameraOn ? "Camera On" : "Camera Off"} style={{ color: isCameraOn ? '#4CAF50' : '#f44336', display: 'flex' }}>
                                    {isCameraOn ? <FaVideo size={16} /> : <FaVideoSlash size={16} />}
                                </div>
                            </div>

                            {/* Teacher Only: Remove Action */}
                            {myRole === 'teacher' && !p.isLocal && (
                                <button
                                    onClick={async () => {
                                        if (window.confirm(`Are you sure you want to remove and block ${p.identity}?`)) {
                                            try {
                                                const res = await fetch(`${BACKEND_URL}/remove-participant`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        roomName: p.room.name,
                                                        identity: p.identity,
                                                        block: true
                                                    })
                                                });
                                                if (res.ok) {
                                                    alert(`${p.identity} has been removed and blocked.`);
                                                }
                                            } catch (err) {
                                                console.error("Removal error:", err);
                                            }
                                        }
                                    }}
                                    style={{
                                        background: 'rgba(244, 67, 54, 0.1)',
                                        border: '1px solid rgba(244, 67, 54, 0.3)',
                                        color: '#f44336',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        fontSize: '0.7rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseOver={(e) => {
                                        e.currentTarget.style.background = '#f44336';
                                        e.currentTarget.style.color = '#fff';
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.background = 'rgba(244, 67, 54, 0.1)';
                                        e.currentTarget.style.color = '#f44336';
                                    }}
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
