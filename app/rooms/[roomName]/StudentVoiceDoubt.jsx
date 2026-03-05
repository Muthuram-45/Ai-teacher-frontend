'use client';
import { useRoomContext } from '@livekit/components-react';
import { speakText } from '@/app/lib/aiTTS';

export default function StudentVoiceDoubt() {
  const room = useRoomContext();

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;

      room.localParticipant.publishData(
        new TextEncoder().encode(
          JSON.stringify({
            action: 'STUDENT_DOUBT',
            text,
            name: room.localParticipant.identity,
          })
        ),
        { reliable: true }
      );

      // 🌟 Encourage Student
      (async () => {
        try {
          const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
          const res = await fetch(`${backendUrl}/encourage-student`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: room.localParticipant.identity,
              question: text
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

    recognition.start();
  };

  return (
    <button
      onClick={startListening}
      style={{
        padding: '0 12px',
        minWidth: '44px',
        height: '44px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)', // Match LiveKit control bar bg
        color: '#fff',
        border: 'none', // LiveKit buttons have no visible border
        borderRadius: '8px',
        fontWeight: 500,
        fontFamily: 'Inter, sans-serif', // Match LiveKit font
        fontSize: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        cursor: 'pointer',
        transition: 'background 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; // hover effect like LiveKit
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
      }}
    >
      <span style={{ fontSize: '18px' }}>🎤</span>
      <span>Ask a Doubt</span>
    </button>
  );
}
