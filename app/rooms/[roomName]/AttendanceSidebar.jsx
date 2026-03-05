'use client';
import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx-js-style';

export default function AttendanceSidebar({ attendance, doubtsWithAnswers = [], classSummary, topic, onClose, right = 0 }) {
    const studentAttendance = Object.values(attendance).filter(a => a.role === 'student');
    const totalStudents = studentAttendance.length;

    const formatTime = (ms) => {
        if (!ms || ms <= 0) return '0s';
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor(ms / (1000 * 60 * 60));

        let parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
        return parts.join(' ');
    };

    const formatTimestamp = (ts) => {
        if (!ts) return '-';
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const downloadExcel = () => {
        const today = new Date();
        const dateStr = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;

        // 1. Data Structure with Styles
        const headerStyle = { font: { bold: true } };
        const studentDetailsStyle = {
            font: { bold: true },
            fill: { fgColor: { rgb: "FFFF00" } }, // Yellow Background
            alignment: { horizontal: "center", vertical: "center" }
        };

        const rows = [
            // Heading for Class Details
            [{ v: 'CLASS DETAILS', s: studentDetailsStyle }, '', '', '', '', '', ''],
            // Metadata
            [{ v: 'Date:', s: headerStyle }, { v: dateStr, s: headerStyle }],
            [{ v: 'Topic:', s: headerStyle }, { v: topic || 'Python', s: headerStyle }],
            [{ v: 'CLASS SUMMARY:', s: headerStyle }, { v: classSummary || 'No summary available.' }],
            [], // SPACE AFTER SUMMARY
            [{ v: 'STUDENT DETAILS', s: studentDetailsStyle }, '', '', '', '', '', ''], // Will be merged
            [
                { v: 'Name', s: headerStyle },
                { v: 'First Join', s: headerStyle },
                { v: 'Last Leave', s: headerStyle },
                { v: 'Total Stay', s: headerStyle },
                { v: 'Join Count', s: headerStyle },
                { v: 'Join/Leave History', s: headerStyle },
                { v: 'Question', s: headerStyle }
            ]
        ];

        const historyStyle = { alignment: { wrapText: true, vertical: "center" } };

        // 2. Process attendance records
        studentAttendance.forEach(s => {
            const stayTime = formatTime(s.totalStayTime + (s.status === 'online' ? (Date.now() - s.lastJoined) : 0));
            const firstJoin = formatTimestamp(s.firstJoined);
            const lastLeave = formatTimestamp(s.lastLeft);
            const studentQuestions = doubtsWithAnswers.filter(d => d.name === s.identity);

            const historyText = (s.sessions || []).map((sess, idx) => {
                const join = formatTimestamp(sess.joinedAt);
                const leave = sess.leftAt ? formatTimestamp(sess.leftAt) : 'Still Online';
                return `Join ${idx + 1}: ${join} - ${leave}`;
            }).join('\n');

            let questionText = '-';
            if (studentQuestions.length > 0) {
                questionText = studentQuestions.map((q, i) => `${i + 1}. ${q.text}`).join(' ');
            }

            rows.push([s.identity, firstJoin, lastLeave, stayTime, s.joinCount, { v: historyText, s: historyStyle }, questionText]);
        });

        // 3. Create Workbook and Worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows, { cellStyles: true });

        // 4. Set Merges
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // Merge "CLASS DETAILS" (Row 1)
            { s: { r: 5, c: 0 }, e: { r: 5, c: 6 } } // Merge "STUDENT DETAILS" (Row 6)
        ];

        // 5. Set Column Widths
        ws['!cols'] = [
            { wch: 20 }, // A
            { wch: 15 }, // B
            { wch: 15 }, // C (Last Leave)
            { wch: 15 }, // D
            { wch: 12 }, // E
            { wch: 50 }, // F (History)
            { wch: 100 } // G (Questions)
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Class Report');
        XLSX.writeFile(wb, `Class_Report_${dateStr}.xlsx`);
    };

    return (
        <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: right,
            width: '380px',
            height: '90vh',
            background: '#111',
            borderLeft: '1px solid #333',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1001,
            boxShadow: '-4px 0 12px rgba(0,0,0,0.5)',
            transition: 'right 0.3s ease'
        }}>
            {/* Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Attendance Insights:</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#888' }}>
                        Total Students: <span style={{ color: '#2196F3', fontWeight: 'bold' }}>{totalStudents}</span>
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                        onClick={downloadExcel}
                        title="Download Excel Report"
                        style={{
                            background: '#4CAF50',
                            border: 'none',
                            color: '#fff',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        📊 Download
                    </button>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1.5rem' }}>✕</button>
                </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                {studentAttendance.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#555' }}>
                        No students have joined yet.
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid #333', color: '#aaa' }}>
                                <th style={{ padding: '10px 5px' }}>Name</th>
                                <th style={{ padding: '10px 5px' }}>Joined</th>
                                <th style={{ padding: '10px 5px' }}>Left</th>
                                <th style={{ padding: '10px 5px' }}>Stay Time</th>
                                <th style={{ padding: '10px 5px', textAlign: 'center' }}>Joins</th>
                            </tr>
                        </thead>
                        <tbody>
                            {studentAttendance.map((a) => (
                                <tr key={a.identity} style={{ borderBottom: '1px solid #222' }}>
                                    <td style={{ padding: '12px 5px' }}>
                                        <div style={{ fontWeight: 500 }}>{a.identity}</div>
                                        <div style={{ fontSize: '0.7rem', color: a.status === 'online' ? '#4CAF50' : '#f44336' }}>
                                            ● {a.status === 'online' ? 'Online' : 'Left'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px 5px', color: '#ccc' }}>
                                        {formatTimestamp(a.firstJoined)}
                                    </td>
                                    <td style={{ padding: '12px 5px', color: '#ccc' }}>
                                        {formatTimestamp(a.lastLeft)}
                                    </td>
                                    <td style={{ padding: '12px 5px', color: '#ccc' }}>
                                        {formatTime(a.totalStayTime + (a.status === 'online' ? (Date.now() - a.lastJoined) : 0))}
                                    </td>
                                    <td style={{ padding: '12px 5px', textAlign: 'center' }}>
                                        <span
                                            title={(a.sessions || []).map((sess, idx) => `Join ${idx + 1}: ${formatTimestamp(sess.joinedAt)} - ${sess.leftAt ? formatTimestamp(sess.leftAt) : 'Online'}`).join('\n')}
                                            style={{
                                                background: a.joinCount > 2 ? 'rgba(255, 152, 0, 0.2)' : 'rgba(255,255,255,0.05)',
                                                color: a.joinCount > 2 ? '#FF9800' : '#fff',
                                                padding: '2px 8px',
                                                borderRadius: '10px',
                                                fontSize: '0.75rem',
                                                cursor: 'help'
                                            }}
                                        >
                                            {a.joinCount}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* AI Summary Section */}
                {classSummary && (
                    <div style={{
                        marginTop: '20px',
                        padding: '15px',
                        background: 'rgba(33, 150, 243, 0.05)',
                        border: '1px solid rgba(33, 150, 243, 0.2)',
                        borderRadius: '10px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#2196F3' }}>
                            <span style={{ fontSize: '1.2rem' }}>🤖</span>
                            <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>AI Class Summary</span>
                        </div>
                        <p style={{
                            margin: 0,
                            fontSize: '0.85rem',
                            lineHeight: '1.5',
                            color: '#ccc',
                        }}>
                            {classSummary}
                        </p>
                    </div>
                )}
            </div>

            <div style={{ padding: '15px', borderTop: '1px solid #222', fontSize: '0.75rem', color: '#666', fontStyle: 'italic' }}>
                Note: Stay time is calculated until the current moment for online students.
            </div>
        </div>
    );
}
