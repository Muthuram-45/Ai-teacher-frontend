'use client';
import { useRoomContext } from '@livekit/components-react';
import { speakText, initAudioContext } from '@/app/lib/aiTTS';
import { BACKEND_URL } from "../../lib/config";

export default function StudentVoiceDoubt() {
  const room = useRoomContext();

  const startListening = () => {
    initAudioContext();
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
            preferredLanguage: new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('preferredLanguage') || 'en'
          })
        ),
        { reliable: true }
      );

      // Encouragement is now handled on the Teacher side in PageClientImpl
    };
    recognition.onerror = (event) => {
      if (event.error === "network" || event.error === "not-allowed") {
        alert("Speech recognition failed due to browser network/security restrictions. Please use the text chat.");
      }
      console.warn('Speech recognition error:', event.error);
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
        fontFamily: "'Source Sans Pro', 'Noto Sans Tamil', 'Segoe UI', Roboto, Arial, sans-serif",
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
