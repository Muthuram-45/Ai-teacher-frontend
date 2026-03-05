'use client';

import { useEffect, useState, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { DataPacket_Kind } from 'livekit-client';

export default function CustomChat() {
    const room = useRoomContext();

    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const bottomRef = useRef(null);

    // 📥 Receive messages
    useEffect(() => {
        if (!room) return;

        const handler = (payload) => {
            const decoded = JSON.parse(
                new TextDecoder().decode(payload)
            );

            if (decoded.type === 'CHAT') {
                setMessages(prev => [...prev, decoded]);

                // 🔔 increment unread count only if chat is closed
                if (!isOpen) {
                    setUnreadCount(prev => prev + 1);
                }
            }
        };

        room.on('dataReceived', handler);
        return () => {
            room.off('dataReceived', handler);
        };
    }, [room, isOpen]);

    // ⬇️ Auto-scroll to latest message
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // 📤 Send message (local echo added)
    const sendMessage = async () => {
        if (!text.trim() || !room?.localParticipant) return;

        const payload = {
            type: 'CHAT',
            from: room.localParticipant.identity,
            role: JSON.parse(
                room.localParticipant.metadata || '{}'
            ).role,
            message: text,
        };

        // ✅ Add message immediately for sender
        setMessages(prev => [...prev, payload]);

        await room.localParticipant.publishData(
            new TextEncoder().encode(JSON.stringify(payload)),
            DataPacket_Kind.RELIABLE
        );

        setText('');
    };

    return (
        <>
            {/* 💬 Chat toggle button */}
            <button
                onClick={() => {
                    setIsOpen(true);
                    setUnreadCount(0);
                }}
                style={{
                    position: 'absolute',
                    right: 20,
                    bottom: 20,
                    padding: '10px 14px',
                    borderRadius: 20,
                    background: '#4caf50',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    display: isOpen ? 'none' : 'block',
                }}
            >
                💬 Chat
                {unreadCount > 0 && (
                    <span
                        style={{
                            marginLeft: 6,
                            background: 'red',
                            borderRadius: '50%',
                            padding: '2px 6px',
                            fontSize: 12,
                        }}
                    >
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* 🧾 Chat panel */}
            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        right: 20,
                        bottom: 20,
                        width: 300,
                        background: '#1c1c1c',
                        borderRadius: 8,
                        padding: 10,
                        color: 'white',
                        fontSize: 14,
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: 6,
                        }}
                    >
                        <b>Class Chat</b>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                background: 'transparent',
                                color: 'white',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: 16,
                            }}
                        >
                            ✖
                        </button>
                    </div>

                    {/* Messages */}
                    <div style={{ height: 180, overflowY: 'auto' }}>
                        {messages.map((m, i) => (
                            <div key={i} style={{ marginBottom: 4 }}>
                                <b>{m.from}</b> ({m.role}): {m.message}
                            </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <input
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder="Type message…"
                        style={{ width: '100%', marginTop: 6 }}
                    />

                    <button
                        onClick={sendMessage}
                        style={{ width: '100%', marginTop: 6 }}
                    >
                        Send
                    </button>
                </div>
            )}
        </>
    );
}
