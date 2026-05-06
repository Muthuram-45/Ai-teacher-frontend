'use client';
import { FaEnvelopeOpenText } from "react-icons/fa";

export default function HistorySidebar({ doubtsWithAnswers = [], right = 0, onClose }) {
    if (doubtsWithAnswers.length === 0) return null;

    return (
        <div className="sidebar-panel" style={{
            position: 'fixed',
            top: 0,
            right: `${right}px`,
            width: '380px',
            height: '90vh',
            background: '#111',
            borderLeft: '1px solid #333',
            zIndex: 1950, // Slightly lower than AISidebar to feel like it sits behind/next to it
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-8px 0 24px rgba(0,0,0,0.5)',
            color: '#fff',
            fontFamily: 'Inter, sans-serif',
            transition: 'right 0.3s ease'
        }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FaEnvelopeOpenText />Questions Inbox :
                </h3>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '16px', fontStyle: 'italic' }}>
                    Total Qs:: {doubtsWithAnswers.length}
                </div>
                {doubtsWithAnswers.map((item, idx) => (
                    <div key={idx} style={{
                        marginBottom: '12px',
                        background: '#1a1a1a',
                        borderRadius: '8px',
                        padding: '12px',
                        border: '1px solid #222',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
                            <b style={{ color: '#2196F3' }}>[{item.name}]</b>: {item.text}
                        </div>
                    </div>
                )).reverse()}
            </div>
        </div>
    );
}
