'use client';
import { useEffect, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { HiOutlineHandRaised, HiOutlineMicrophone } from "react-icons/hi2";


export default function TeacherHandPanel() {
    const room = useRoomContext();
    const [hands, setHands] = useState([]);
    const [visible, setVisible] = useState(false); // ✅ NEW

    useEffect(() => {
        if (!room) return;

        let hideTimer; // ✅ NEW

        const handleData = (payload) => {
            try {
                const msg = JSON.parse(new TextDecoder().decode(payload));

                // --- HAND RAISE LOGIC ---
                if (msg.action === 'HAND_RAISE') {
                    if (msg.raised) {
                        setHands(prev => {
                            if (prev.some(h => h.name === msg.name && h.type === 'hand')) return prev;
                            return [...prev, { name: msg.name, role: msg.role, type: 'hand' }];
                        });
                        setVisible(true);
                    } else {
                        setHands(prev => prev.filter(h => !(h.name === msg.name && h.type === 'hand')));
                    }

                    if (msg.raised) {
                        clearTimeout(hideTimer);
                        hideTimer = setTimeout(() => {
                            setVisible(false);
                            setHands(prev => prev.filter(h => h.type !== 'hand'));
                        }, 15000);
                    }
                }

                // --- VOICE DOUBT LOGIC ---
                if (msg.action === 'VOICE_DOUBT_START') {
                    setHands(prev => {
                        if (prev.some(h => h.name === msg.name && h.type === 'mic')) return prev;
                        return [...prev, { name: msg.name, type: 'mic' }];
                    });
                    setVisible(true);

                    // Enforce 15sec limit for mic popup as well
                    clearTimeout(hideTimer);
                    hideTimer = setTimeout(() => {
                        setVisible(false);
                        setHands(prev => prev.filter(h => h.type !== 'mic'));
                    }, 15000);
                }

                if (msg.action === 'VOICE_DOUBT_END') {
                    setHands(prev => prev.filter(h => !(h.name === msg.name && h.type === 'mic')));
                    // If no hands or mics left, hide after a short delay
                    if (hands.length <= 1) { // Current hands state might be stale in closure, but filter will handle it
                        setTimeout(() => {
                            setHands(current => {
                                if (current.length === 0) setVisible(false);
                                return current;
                            });
                        }, 2000);
                    }
                }

            } catch { }
        };

        room.on('dataReceived', handleData);
        return () => {
            room.off('dataReceived', handleData);
            clearTimeout(hideTimer);
        };
    }, [room]);

    // ✅ hide completely when not needed
    if (!visible || hands.length === 0) return null;

    return (
        <div style={{
            position: 'absolute',
            top: 24,
            right: 24,
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            pointerEvents: 'none'
        }}>
            {hands.map((h, i) => (
                <div
                    key={i}
                    style={{
                        background: h.type === 'mic' ? '#1a73e8' : '#1e8e3e',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        animation: 'handRaiseSlideInRight 0.4s cubic-bezier(0, 0, 0.2, 1)',
                        fontSize: '14px',
                        fontWeight: '500',
                        fontFamily: 'Inter, sans-serif'
                    }}
                >
                    {h.type === 'mic' ? (
                        <HiOutlineMicrophone size={18} style={{ color: 'white' }} />
                    ) : (
                        <HiOutlineHandRaised size={18} style={{ color: 'black' }} />
                    )}

                    <span style={{ color: h.type === 'mic' ? 'white' : 'black' }}>
                        <b>{h.name}</b> &nbsp;{h.type === 'mic' ? 'is on the mic' : 'raised'}
                    </span>

                    <style>{`
                        @keyframes handRaiseSlideInRight {
                            from { transform: translateX(100%); opacity: 0; }
                            to { transform: translateX(0); opacity: 1; }
                        }
                    `}</style>
                </div>
            ))}
        </div>
    );
}