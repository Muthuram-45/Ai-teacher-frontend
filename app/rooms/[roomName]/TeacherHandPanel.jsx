'use client';
import { useEffect, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { HiOutlineHandRaised, HiOutlineMicrophone } from "react-icons/hi2";


export default function TeacherHandPanel() {
    const room = useRoomContext();
    const [hands, setHands] = useState([]);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!room) return;

        let hideTimer;

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

                    clearTimeout(hideTimer);
                    hideTimer = setTimeout(() => {
                        setVisible(false);
                        setHands(prev => prev.filter(h => h.type !== 'mic'));
                    }, 15000);
                }

                if (msg.action === 'VOICE_DOUBT_END') {
                    setHands(prev => prev.filter(h => !(h.name === msg.name && h.type === 'mic')));
                    if (hands.length <= 1) {
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
    }, [room, hands.length]);

    if (!visible || hands.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10001,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            pointerEvents: 'none'
        }}>
            {hands.map((h, i) => (
                <div
                    key={i}
                    style={{
                        background: "rgba(15, 23, 42, 0.92)",
                        backdropFilter: "blur(12px)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        borderRadius: "14px",
                        padding: "8px 24px",
                        color: "#fff",
                        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        animation: "toastSlideInVertical 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                        pointerEvents: "auto",
                        minWidth: "fit-content",
                    }}
                >
                    <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: h.type === 'mic' ? 'rgba(33, 150, 243, 0.2)' : 'rgba(76, 175, 80, 0.2)',
                        color: h.type === 'mic' ? '#2196F3' : '#4CAF50'
                    }}>
                        {h.type === 'mic' ? (
                            <HiOutlineMicrophone size={20} />
                        ) : (
                            <HiOutlineHandRaised size={20} />
                        )}
                    </div>

                    <div style={{
                        fontSize: "15px",
                        fontFamily: "Inter, sans-serif",
                        fontWeight: "500",
                        letterSpacing: "-0.2px",
                    }}>
                        <span style={{ fontWeight: "700" }}>{h.name}</span>
                        {h.type === 'mic' ? "'s microphone is ON" : " raised hand"}
                    </div>
                </div>
            ))}
            <style>{`
                @keyframes toastSlideInVertical {
                    from { opacity: 0; transform: translateY(-30px) scale(0.9); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}