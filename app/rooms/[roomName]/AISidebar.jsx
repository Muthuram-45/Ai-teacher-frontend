'use client';
import { useState } from 'react';

function PendingDoubtItem({ d, role, loadingAI, onAskAI, onSendToStudent, onEditStart, onSaveDoubt, onResolve }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(d.text);

    const handleEditClick = () => {
        setIsEditing(true);
        if (onEditStart) onEditStart(d.id); // ✅ Freeze auto-timer
    };

    const handleSave = () => {
        if (onSaveDoubt) onSaveDoubt(d.id, editedText); // ✅ Unfreeze + 5s auto-ask
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditedText(d.text); // Reset text
        if (onSaveDoubt) onSaveDoubt(d.id, d.text); // ✅ Unfreeze with original text
        setIsEditing(false);
    };

    return (
        <div style={{
            marginBottom: '16px',
            background: d.isBroadcasting ? 'rgba(33, 150, 243, 0.05)' : '#1a1a1a',
            borderRadius: '12px',
            padding: '16px',
            border: d.isBroadcasting ? '1px solid rgba(33, 150, 243, 0.3)' : '1px solid #333',
            transition: 'all 0.3s'
        }}>
            <div style={{ fontSize: '0.8rem', color: '#2196F3', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b>{d.name}</b> asked:
                {role === 'teacher' && !isEditing && !d.answer && !d.isBroadcasting && (
                    <button onClick={handleEditClick} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}>Edit</button>
                )}
            </div>

            {isEditing ? (
                <div style={{ marginBottom: '12px' }}>
                    <textarea
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                        style={{
                            width: '100%', minHeight: '60px', background: '#000', color: '#fff',
                            border: '1px solid #444', borderRadius: '6px', padding: '8px',
                            fontSize: '0.9rem', outline: 'none', marginBottom: '8px', resize: 'vertical'
                        }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={handleSave} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: 'none', background: '#4CAF50', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Save</button>
                        <button onClick={handleCancel} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: 'none', background: '#333', color: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>Cancel</button>
                    </div>
                </div>
            ) : (
                <div style={{ fontSize: '0.95rem', marginBottom: '12px', lineHeight: '1.4' }}>{d.text}</div>
            )}

            {d.isBroadcasting ? (
                <div style={{ padding: '12px', background: 'rgba(33, 150, 243, 0.1)', borderRadius: '8px', border: '1px solid rgba(33, 150, 243, 0.2)' }}>
                    <div style={{ color: '#2196F3', marginBottom: role === 'teacher' ? '12px' : '0', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="animate-pulse">📣</span> {role === 'teacher' ? 'Broadcasting to Students...' : 'Discussed in Class'}
                    </div>
                    {role === 'teacher' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => onSendToStudent(d)}
                                style={{
                                    flex: 1, padding: '8px', borderRadius: '6px', border: 'none',
                                    background: '#2196F3', color: '#fff', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                }}
                            >
                                <span>▶️</span> Replay
                            </button>
                            <button
                                onClick={() => onResolve(d.id)}
                                style={{
                                    flex: 1, padding: '8px', borderRadius: '6px', border: 'none',
                                    background: '#4CAF50', color: '#fff', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem'
                                }}
                            >
                                ✅ Move to History
                            </button>
                        </div>
                    )}
                </div>
            ) : d.answer ? (
                <div style={{ padding: '12px', background: '#0a2e0a', borderRadius: '8px', border: '1px solid #1b5e20', fontSize: '0.85rem' }}>
                    <div style={{ color: '#81c784', marginBottom: role === 'teacher' ? '8px' : '0' }}><b>{role === 'teacher' ? 'Preview:' : 'AI Teacher:'}</b><br />{d.answer}</div>
                    {role === 'teacher' && (
                        <button
                            onClick={() => onSendToStudent(d)}
                            style={{
                                width: '100%', padding: '10px', borderRadius: '6px', border: 'none',
                                background: '#4CAF50', color: '#fff', cursor: 'pointer', fontWeight: 'bold'
                            }}
                        >
                            🚀 Send & Speak to Student
                        </button>
                    )}
                </div>

            ) : (
                !isEditing && role === 'teacher' && (
                    <button
                        onClick={() => onAskAI(d)}
                        disabled={loadingAI === d.id}
                        style={{
                            width: '100%', padding: '10px', borderRadius: '6px', border: 'none',
                            background: '#2196F3', color: '#fff', cursor: 'pointer', fontWeight: 'bold'
                        }}
                    >
                        {loadingAI === d.id ? 'Thinking...' : '🤖 Ask AI'}
                    </button>
                )
            )}
        </div>
    );
}

export default function AISidebar({
    role,
    doubts = [],
    loadingAI,
    onAskAI,
    onSendToStudent,
    onStopAudio,
    onEditStart,
    onSaveDoubt,
    onUpdateDoubt,
    onResolve,
    onClose,
    right = 0
}) {
    // const hasContent = doubts.length > 0;
    // if (!hasContent) return null; // We want to show it even if empty to access Stop button

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            right: `${right}px`,
            width: '380px',
            height: '90vh',
            background: '#111',
            borderLeft: '1px solid #333',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-8px 0 24px rgba(0,0,0,0.5)',
            color: '#fff',
            fontFamily: "'Source Sans Pro', 'Noto Sans Tamil', 'Segoe UI', Roboto, Arial, sans-serif",
            transition: 'right 0.3s ease'
        }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🤖 AI Assistant
                </h3>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {role === 'teacher' && (
                        <button
                            onClick={onStopAudio}
                            title="Stop Current AI Audio"
                            style={{
                                background: 'rgba(244, 67, 54, 0.1)',
                                border: '1px solid #f44336',
                                color: '#f44336',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <span>⏹</span> Stop Audio
                        </button>
                    )}
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

                {/* 👨‍🏫 TEACHER: PENDING DOUBTS SECTION */}
                {role === 'teacher' && (
                    <div style={{ marginBottom: '32px' }}>
                        <h4 style={{ color: '#888', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px', marginBottom: '16px' }}>
                            Active Student Doubts ({doubts.length})
                        </h4>
                        {doubts.length > 0 ? (
                            doubts.map((d) => (
                                <PendingDoubtItem
                                    key={d.id}
                                    d={d}
                                    role={role}
                                    loadingAI={loadingAI}
                                    onAskAI={onAskAI}
                                    onSendToStudent={onSendToStudent}
                                    onEditStart={onEditStart}
                                    onSaveDoubt={onSaveDoubt}
                                    onResolve={onResolve}
                                />
                            ))
                        ) : (
                            <div style={{
                                padding: '40px 20px',
                                textAlign: 'center',
                                color: '#555',
                                border: '1px dashed #333',
                                borderRadius: '12px',
                                fontSize: '0.9rem'
                            }}>
                                <div style={{ fontSize: '2rem', marginBottom: '12px', opacity: 0.5 }}>📭</div>
                                No active doubts from students.
                            </div>
                        )}
                    </div>
                )}

                {/* 👨‍🎓 STUDENT: DOUBTS SECTION */}
                {role === 'student' && (
                    <div style={{ marginBottom: '32px' }}>
                        <h4 style={{ color: '#888', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px', marginBottom: '16px' }}>
                            Doubts & Answers
                        </h4>
                        {doubts.length > 0 ? (
                            doubts.map((d) => (
                                <PendingDoubtItem
                                    key={d.id}
                                    d={d}
                                    role={role}
                                    loadingAI={loadingAI}
                                />
                            ))
                        ) : (
                            <div style={{
                                padding: '40px 20px',
                                textAlign: 'center',
                                color: '#555',
                                border: '1px dashed #333',
                                borderRadius: '12px',
                                fontSize: '0.9rem'
                            }}>
                                <div style={{ fontSize: '2rem', marginBottom: '12px', opacity: 0.5 }}>🤖</div>
                                AI will reply to your voice doubts here.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

