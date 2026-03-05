'use client';
import { useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { FiEdit } from "react-icons/fi";
import { speakText } from '@/app/lib/aiTTS';

export default function StudentTextDoubt() {
    const room = useRoomContext();
    const [showInput, setShowInput] = useState(false);
    const [text, setText] = useState('');

    const sendDoubt = () => {
        if (!text.trim()) return;

        room.localParticipant.publishData(
            new TextEncoder().encode(
                JSON.stringify({
                    action: 'STUDENT_DOUBT',
                    id: Date.now() + '-' + Math.random().toString(36).substring(7),
                    text: text.trim(),
                    name: room.localParticipant.identity,
                })
            ),
            { reliable: true }
        );

        setText('');
        setShowInput(false);

        // 🌟 Encourage Student
        (async () => {
            try {
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
                const res = await fetch(`${backendUrl}/encourage-student`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: room.localParticipant.identity,
                        question: text.trim()
                    }),
                });
                const data = await res.json();
                if (data.encouragement) {
                    speakText(data.encouragement).catch(err => console.error('Encourage TTS error:', err));
                }
            } catch (err) {
                console.error('Failed to get encouragement', err);
            }
        })();
    };

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setShowInput(!showInput)}
                style={{
                    padding: '0 12px',
                    height: '44px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '16px',
                    fontWeight: 500,
                    transition: 'background 0.2s',
                    fontFamily: 'Inter, sans-serif'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
            >
                <FiEdit size={18} />
                Ask a Doubt
            </button>

            {showInput && (
                <div style={{
                    position: 'absolute',
                    bottom: '60px',
                    right: 0,
                    width: '300px',
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    zIndex: 1000
                }}>
                    <h4 style={{ margin: '0 0 12px 0', color: '#fff' }}>Type your doubt</h4>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="What is your question?"
                        style={{
                            width: '100%',
                            height: '80px',
                            background: '#000',
                            border: '1px solid #444',
                            borderRadius: '8px',
                            color: '#fff',
                            padding: '10px',
                            marginBottom: '12px',
                            resize: 'none',
                            outline: 'none'
                        }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={sendDoubt}
                            style={{
                                flex: 1,
                                padding: '8px',
                                background: '#2196F3',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            Send
                        </button>
                        <button
                            onClick={() => setShowInput(false)}
                            style={{
                                padding: '8px 12px',
                                background: '#333',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
