import React, { useEffect, useState } from 'react';
import { ActivityStatus } from '../../lib/useActivityMonitor';
import { MdWarningAmber } from 'react-icons/md';

export default function StudentWarning({ status, durationAwayMs }) {
  const [displayDuration, setDisplayDuration] = useState(durationAwayMs);

  useEffect(() => {
    let interval;
    if (status !== 'ACTIVE') {
      interval = setInterval(() => {
        setDisplayDuration((prev) => prev + 1000);
      }, 1000);
    } else {
      setDisplayDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status]);

  useEffect(() => {
    setDisplayDuration(durationAwayMs);
  }, [durationAwayMs, status]);

  if (status === 'ACTIVE') return null;

  const formatDuration = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  let title = '⚠️ Attention Needed';
  let message = 'Please return to the meeting and stay active.';

  switch (status) {
    case 'TAB_AWAY':
      title = '⚠️ Switched Tab';
      message = 'You have switched to another tab. Please return to the class.';
      break;
    case 'INACTIVE':
      title = '⚠️ Inactive';
      message = 'You appear to be inactive. Please stay attentive during the class.';
      break;
    case 'POSSIBLE_EXTERNAL_ACTIVITY':
      title = '⚠️ Possible External Activity';
      message = 'We detected you might be using another application. Please stay on the class screen.';
      break;
    case 'BACKGROUND':
      title = '⚠️ Background Active';
      message = 'The class is running in the background. Please return to the meeting.';
      break;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: 'rgba(30, 41, 59, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid #f59e0b',
        borderRadius: '12px',
        padding: '16px 24px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
        color: '#fff',
        animation: 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        minWidth: '320px',
        maxWidth: '90vw',
      }}
    >
      <div style={{ color: '#f59e0b', fontSize: '24px', paddingTop: '2px' }}>
        <MdWarningAmber />
      </div>
      <div style={{ flex: 1 }}>
        <h3
          style={{
            margin: '0 0 4px 0',
            fontSize: '16px',
            fontWeight: 600,
            color: '#fcd34d',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {title.replace('⚠️ ', '')}
        </h3>
        <p
          style={{
            margin: '0 0 8px 0',
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.8)',
            fontFamily: 'Inter, sans-serif',
            lineHeight: 1.4,
          }}
        >
          {message}
        </p>
        <div
          style={{
            fontSize: '13px',
            color: 'rgba(255, 255, 255, 0.5)',
            fontFamily: 'monospace',
            background: 'rgba(0,0,0,0.2)',
            padding: '4px 8px',
            borderRadius: '4px',
            display: 'inline-block',
          }}
        >
          Away for: {formatDuration(displayDuration)}
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}
