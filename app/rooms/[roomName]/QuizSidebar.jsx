'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx-js-style';
import { BACKEND_URL } from "../../lib/config";

export default function QuizSidebar({ quizId, topic, onClose, right = 0 }) {
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!quizId) return;

        const fetchResults = async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/quiz-results/${quizId}`);
                const data = await res.json();
                setResults(data);
            } catch (err) {
                console.error('Failed to fetch quiz results:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
        // Poll for updates every 3 seconds
        const interval = setInterval(fetchResults, 3000);
        return () => clearInterval(interval);
    }, [quizId]);

    const downloadExcel = () => {
        if (!results) return;

        const today = new Date();
        const dateStr = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;

        // styles
        const headerStyle = { font: { bold: true, sz: 11 }, fill: { fgColor: { rgb: "E9ECEF" } }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } };
        const titleStyle = { font: { bold: true, sz: 16 }, alignment: { horizontal: "center" } };
        const sectionStyle = { font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4CAF50" } }, alignment: { horizontal: "center" } };
        const cellStyle = { border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'center', wrapText: true } };
        const malpracticeStyle = { font: { color: { rgb: "D32F2F" }, bold: true }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'center', wrapText: true } };
        const suspiciousStyle = { font: { color: { rgb: "F57C00" }, bold: true }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'center', wrapText: true } };
        const goodStyle = { font: { color: { rgb: "2E7D32" } }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'center', wrapText: true } };

        const totalCols = 9; // Total column count

        const rows = [
            [{ v: `QUIZ REPORT: ${topic || 'General'}`, s: titleStyle }, ...Array(totalCols - 1).fill('')],
            [{ v: `Date: ${dateStr}`, s: { font: { italic: true, bold: true } } }],
            [],
            // Statistics Section
            [{ v: 'QUIZ STATISTICS', s: sectionStyle }, ...Array(totalCols - 1).fill('')],
            [
                { v: 'Total Submissions', s: headerStyle },
                { v: 'Average Score', s: headerStyle },
                { v: 'Highest Score', s: headerStyle },
                { v: 'Lowest Score', s: headerStyle }
            ],
            [
                { v: results.stats.totalSubmissions, s: cellStyle },
                { v: `${results.stats.averageScore}%`, s: cellStyle },
                { v: `${results.stats.highestScore}%`, s: cellStyle },
                { v: `${results.stats.lowestScore}%`, s: cellStyle }
            ],
            [],
            // Student Results Section
            [{ v: 'STUDENT RESULTS', s: sectionStyle }, ...Array(totalCols - 1).fill('')],
            [
                { v: 'Student Name', s: headerStyle },
                { v: 'Score (%)', s: headerStyle },
                { v: 'Correct Answers', s: headerStyle },
                { v: 'Tab Switches', s: headerStyle },
                { v: 'Video Violations', s: headerStyle },
                { v: 'Video Activity', s: headerStyle },
                { v: 'Status', s: headerStyle },
                { v: 'Reason', s: headerStyle },
                { v: 'Submission Time', s: headerStyle }
            ]
        ];

        // Add students with conditional formatting
        results.submissions.forEach(s => {
            const isMalpractice = s.status === 'Malpractice';
            const isSuspicious = s.video_activity === 'Suspicious Activity' || s.video_activity === 'Unstable';
            const rowStyle = isMalpractice ? malpracticeStyle : (isSuspicious ? suspiciousStyle : goodStyle);

            // Count video violations from logs
            const videoViolationCount = s.logs ? s.logs.length : 0;
            const tabSwitchCount = s.browserSwitchCount || 0;

            // Build detailed reason
            let detailedReason = s.reason || 'Good';
            if (s.status === 'Good' && (s.video_activity === 'Stable' || !s.video_activity)) {
                detailedReason = 'Good';
            }
            if (isMalpractice && !detailedReason.includes('Malpractice')) {
                detailedReason = `MALPRACTICE: ${detailedReason}`;
            }

            rows.push([
                { v: s.studentName, s: isMalpractice ? malpracticeStyle : cellStyle },
                { v: `${s.score}%`, s: isMalpractice ? malpracticeStyle : cellStyle },
                { v: `${s.correctCount}/${s.totalQuestions}`, s: cellStyle },
                { v: tabSwitchCount, s: tabSwitchCount >= 2 ? suspiciousStyle : cellStyle },
                { v: videoViolationCount, s: videoViolationCount >= 10 ? suspiciousStyle : cellStyle },
                { v: s.video_activity || 'Stable', s: rowStyle },
                { v: s.status || 'Good', s: rowStyle },
                { v: detailedReason, s: isMalpractice ? malpracticeStyle : cellStyle },
                { v: new Date(s.submittedAt).toLocaleTimeString(), s: cellStyle }
            ]);
        });

        rows.push([]);
        // Questions Section
        rows.push([{ v: 'QUIZ QUESTIONS & CORRECT ANSWERS', s: sectionStyle }, ...Array(totalCols - 1).fill('')]);
        rows.push([
            { v: '#', s: headerStyle },
            { v: 'Question', s: headerStyle },
            { v: 'Correct Option', s: headerStyle },
            ''
        ]);

        results.questions.forEach((q, idx) => {
            rows.push([
                { v: idx + 1, s: cellStyle },
                { v: q.question, s: cellStyle },
                { v: `${String.fromCharCode(65 + q.correctAnswer)}. ${q.options[q.correctAnswer]}`, s: cellStyle },
                ''
            ]);
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows, { cellStyles: true });

        // Merges
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }, // Title
            { s: { r: 3, c: 0 }, e: { r: 3, c: totalCols - 1 } }, // Stats Header
            { s: { r: 7, c: 0 }, e: { r: 7, c: totalCols - 1 } }, // Results Header
            { s: { r: rows.length - results.questions.length - 2, c: 0 }, e: { r: rows.length - results.questions.length - 2, c: totalCols - 1 } } // Questions Header
        ];

        // AutoFit Column Widths — calculate based on actual data content
        const colWidths = [];
        for (let col = 0; col < totalCols; col++) {
            let maxLen = 5; // Base minimum width

            rows.forEach((row, rowIndex) => {
                // Ignore merged bars and title/date rows that span multiple columns conceptually
                if (rowIndex <= 3 || rowIndex === 7) return;

                // Identify the Questions Header Bar dynamically
                if (row && row[0] && row[0].s === sectionStyle) return;

                if (row[col]) {
                    const cell = row[col];
                    const val = typeof cell === 'object' ? String(cell.v ?? '') : String(cell ?? '');

                    // Slightly more padding for headers, very tight for data
                    const isHeader = typeof cell === 'object' && cell.s === headerStyle;
                    const len = val.length + (isHeader ? 4 : 2);

                    if (len > maxLen) maxLen = len;
                }
            });

            // Cap at 100 characters for text columns to keep it professional
            colWidths.push({ wch: Math.min(maxLen, 100) });
        }
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, 'Quiz Report');
        XLSX.writeFile(wb, `Quiz_Report_${topic.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            right: right,
            bottom: 0,
            width: 'min(380px, 100vw)',
            height: '90vh',
            background: 'linear-gradient(135deg, #1e1e2e 0%, #2a2a3e 100%)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 1001,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.3)'
        }}>
            {/* Header */}
            <div style={{
                padding: '20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'linear-gradient(90deg, #4CAF50 0%, #2196F3 100%)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>
                            📊 Quiz Results
                        </h3>
                        <p style={{ margin: '4px 0 0 0', color: 'rgba(255, 255, 255, 0.9)', fontSize: '13px' }}>
                            {topic}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {results && (
                            <button
                                onClick={downloadExcel}
                                title="Download Excel"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    border: 'none',
                                    color: '#fff',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                📊 Download
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            style={{
                                background: 'rgba(255, 255, 255, 0.2)',
                                border: 'none',
                                color: '#fff',
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                fontSize: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
                {loading && (
                    <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)', padding: '40px 0' }}>
                        <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
                        <p>Loading results...</p>
                    </div>
                )}

                {!loading && results && (
                    <>
                        {/* Statistics */}
                        <div style={{
                            background: 'rgba(76, 175, 80, 0.1)',
                            border: '1px solid rgba(76, 175, 80, 0.3)',
                            borderRadius: '12px',
                            padding: '16px',
                            marginBottom: '20px'
                        }}>
                            <h4 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '14px' }}>
                                📈 Statistics
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4CAF50' }}>
                                        {results.stats.totalSubmissions}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>
                                        Submissions
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196F3' }}>
                                        {results.stats.averageScore}%
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>
                                        Average
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4CAF50' }}>
                                        {results.stats.highestScore}%
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>
                                        Highest
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#FF9800' }}>
                                        {results.stats.lowestScore}%
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>
                                        Lowest
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Student Submissions */}
                        <h4 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '14px' }}>
                            👥 Student Submissions ({results.submissions.length})
                        </h4>

                        {results.submissions.length === 0 && (
                            <div style={{
                                textAlign: 'center',
                                color: 'rgba(255, 255, 255, 0.5)',
                                padding: '40px 20px',
                                background: 'rgba(255, 255, 255, 0.03)',
                                borderRadius: '8px'
                            }}>
                                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
                                <p style={{ margin: 0, fontSize: '13px' }}>No submissions yet</p>
                            </div>
                        )}

                        {results.submissions.map((submission, idx) => (
                            <div key={idx} style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                borderRadius: '8px',
                                padding: '14px',
                                marginBottom: '10px',
                                border: '1px solid rgba(255, 255, 255, 0.1)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>
                                        {submission.studentName}
                                    </div>
                                    <div style={{
                                        background: submission.score >= 70 ? '#4CAF50' : '#FF9800',
                                        color: '#fff',
                                        padding: '4px 10px',
                                        borderRadius: '12px',
                                        fontSize: '13px',
                                        fontWeight: 'bold'
                                    }}>
                                        {submission.score}%
                                    </div>
                                </div>
                                <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{submission.correctCount}/{submission.totalQuestions} correct</span>
                                    <span>{new Date(submission.submittedAt).toLocaleTimeString()}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                    <div style={{
                                        fontSize: '10px',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: (submission.video_activity === 'Stable' || submission.video_activity === 'Good') ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)',
                                        color: (submission.video_activity === 'Stable' || submission.video_activity === 'Good') ? '#4CAF50' : '#f44336',
                                        border: `1px solid ${(submission.video_activity === 'Stable' || submission.video_activity === 'Good') ? 'rgba(76, 175, 80, 0.4)' : 'rgba(244, 67, 54, 0.4)'}`
                                    }}>
                                        📹 {submission.video_activity || 'N/A'}
                                    </div>
                                    <div style={{
                                        fontSize: '10px',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: submission.status === 'Good' ? 'rgba(33, 150, 243, 0.2)' : 'rgba(244, 67, 54, 0.2)',
                                        color: submission.status === 'Good' ? '#2196F3' : '#f44336',
                                        border: `1px solid ${submission.status === 'Good' ? 'rgba(33, 150, 243, 0.4)' : 'rgba(244, 67, 54, 0.4)'}`
                                    }}>
                                        🛡️ {submission.status || 'Good'}
                                    </div>
                                </div>
                                {submission.reason && submission.reason !== 'None' && (
                                    <div style={{
                                        marginTop: '8px',
                                        fontSize: '11px',
                                        color: '#fff',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        padding: '8px',
                                        borderRadius: '6px',
                                        border: '1px solid rgba(255, 255, 255, 0.1)'
                                    }}>
                                        <strong style={{ color: '#36b5f4ff' }}>Review:</strong> {submission.reason}
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Quiz Questions */}
                        <div style={{ marginTop: '24px' }}>
                            <h4 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '14px' }}>
                                📝 Quiz Questions ({results.questions.length})
                            </h4>
                            {results.questions.map((q, idx) => (
                                <div key={idx} style={{
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    marginBottom: '10px',
                                    border: '1px solid rgba(255, 255, 255, 0.1)'
                                }}>
                                    <div style={{ color: '#fff', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>
                                        {idx + 1}. {q.question}
                                    </div>
                                    <div style={{ fontSize: '12px' }}>
                                        {q.options.map((opt, optIdx) => (
                                            <div
                                                key={optIdx}
                                                style={{
                                                    padding: '6px 8px',
                                                    marginBottom: '4px',
                                                    borderRadius: '4px',
                                                    background: optIdx === q.correctAnswer
                                                        ? 'rgba(76, 175, 80, 0.2)'
                                                        : 'rgba(255, 255, 255, 0.03)',
                                                    color: optIdx === q.correctAnswer ? '#4CAF50' : 'rgba(255, 255, 255, 0.7)',
                                                    border: optIdx === q.correctAnswer ? '1px solid #4CAF50' : '1px solid transparent'
                                                }}
                                            >
                                                {String.fromCharCode(65 + optIdx)}. {opt}
                                                {optIdx === q.correctAnswer && ' ✓'}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}