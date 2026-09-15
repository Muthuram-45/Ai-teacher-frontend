import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import styles from '../../analytics.module.css';

export default function AttendanceTab({topic, date, overview , subTopic }) {
  const [sessions, setSessions] = useState([]);
  const [topicScores, setTopicScores] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let sessUrl = new URL('http://localhost:3001/api/analytics/sessions');
        
        if (topic && topic !== 'All Topics') sessUrl.searchParams.append('topic', topic);
        if (subTopic && subTopic !== 'All Topics') sessUrl.searchParams.append('subTopic', subTopic);
        if (date) sessUrl.searchParams.append('date', date);
        const sessRes = await fetch(sessUrl.toString());
        const allSessions = await sessRes.json();
        // Only include those from class report (have attendance data)
        setSessions(allSessions.filter(s => s.attendance_duration !== null));

        const tpUrl = new URL('http://localhost:3001/api/analytics/topic-comparison');
        const tpRes = await fetch(tpUrl.toString());
        setTopicScores(await tpRes.json());
      } catch (e) { console.error(e); }
    };
    fetchData();
  }, [topic, subTopic, date]);

  const totalStudents = sessions.length;
  const avgStay = totalStudents > 0 ? sessions.reduce((acc, s) => acc + (s.attendance_duration || 0), 0) / totalStudents : 0;
  const avgJoinCount = totalStudents > 0 ? sessions.reduce((acc, s) => acc + (s.join_count || 1), 0) / totalStudents : 1;
  const maxStay = totalStudents > 0 ? Math.max(...sessions.map(s => s.attendance_duration || 0)) : 0;
  const attendancePercentage = avgStay > 0 && maxStay > 0 ? Math.round((avgStay / maxStay) * 100) : 0;

  const cards = [
    { title: 'Total Students', value: totalStudents },
    { title: 'Average Stay Duration', value: avgStay ? `${Math.floor(avgStay / 60)}m ${Math.floor(avgStay % 60)}s` : 'N/A' },
    { title: 'Average Join Count', value: avgJoinCount.toFixed(1) },
    { title: 'Attendance %', value: attendancePercentage ? `${attendancePercentage}%` : 'N/A' }
  ];

  const formatDuration = (seconds) => {
    if (seconds === null || seconds === undefined) return 'N/A';
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const studentAttendance = sessions.map(s => ({
    name: s.student_name,
    attendance: s.attendance_duration ? Math.round(s.attendance_duration / 60) : 0,
    joinCount: s.join_count || 1
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      
      <div className={styles.sectionHeader}>
        <h2>ATTENDANCE ANALYTICS</h2>
      </div>

      <div className={styles.kpiGrid}>
        {cards.map((card, i) => (
          <div key={i} className={styles.kpiCard}>
            <div className={styles.kpiTitle}>{card.title}</div>
            <div className={styles.kpiValue}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className={styles.chartsGrid}>
        
        {/* Student Attendance (Bar) */}
        <div className={styles.chartContainer}>
          <h3 className={styles.chartTitle}>Student Attendance (Mins)</h3>
          <div style={{ width: '100%', height: 300 }}>
            {studentAttendance.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b' }}>No data available</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={studentAttendance.slice(0, 15)} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="attendance" name="Attendance (min)" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Join Count (Bar) */}
        <div className={styles.chartContainer}>
          <h3 className={styles.chartTitle}>Student Join Count</h3>
          <div style={{ width: '100%', height: 300 }}>
            {studentAttendance.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b' }}>No data available</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={studentAttendance.slice(0, 15)} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="joinCount" name="Join Count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Attendance by Topic */}
        <div className={styles.chartContainer} style={{ gridColumn: 'span 2' }}>
          <h3 className={styles.chartTitle}>Attendance by Topic</h3>
          <div style={{ width: '100%', height: 300 }}>
            {topicScores.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b' }}>No data available</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={topicScores} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="topic" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="averageAttendance" name="Avg Attendance (sec)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Topic</th>
              <th>Date</th>
              <th>First Join</th>
              <th>Last Leave</th>
              <th>Total Stay</th>
              <th>Join Count</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', color: '#64748b' }}>No class records found.</td></tr>
            ) : (
              sessions.map((row, i) => (
                <tr key={i} className={styles.clickableRow}>
                  <td style={{ fontWeight: 600, color: '#334155' }}>{row.student_name}</td>
                  <td>{row.topic}</td>
                  <td>{row.date ? new Date(row.date).toLocaleDateString() : 'N/A'}</td>
                  <td>{row.first_join_time || 'N/A'}</td>
                  <td>{row.last_leave_time || 'N/A'}</td>
                  <td style={{ fontWeight: 600 }}>{formatDuration(row.attendance_duration)}</td>
                  <td>{row.join_count || 1}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
