'use client';
import { useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { HiOutlineHandRaised } from 'react-icons/hi2';
import { initAudioContext } from '@/app/lib/aiTTS';

export default function StudentHandRaise({ isHandRaised, onToggle }) {
    const room = useRoomContext();

    const toggleHandRaise = async () => {
        initAudioContext();
        if (!room?.localParticipant) return;

        await room.localParticipant.publishData(
            new TextEncoder().encode(
                JSON.stringify({
                    action: 'HAND_RAISE',
                    role: 'student',
                    name: room.localParticipant.identity,
                    raised: !isHandRaised,
                    timestamp: Date.now(),
                })
            ),
            { reliable: true }
        );

        onToggle();
    };

    return (
        <button
            onClick={toggleHandRaise}
            className="lk-button"
            style={{
                background: isHandRaised ? '#1e8e3e' : undefined,
                color: isHandRaised ? '#000' : undefined,
                fontWeight: 400,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
            }}
        >
            <HiOutlineHandRaised
                size={20}
                style={{
                    animation: 'handRaiseSlideInRight 0.4s cubic-bezier(0, 0, 0.2, 1)',
                }}
            />
            <span className="hide-on-mobile">{isHandRaised ? 'Raise' : 'Raise'}</span>
        </button>
    );
}
