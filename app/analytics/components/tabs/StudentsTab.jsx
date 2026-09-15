import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import styles from '../../analytics.module.css';

export default function StudentsTab({topic, date, students , subTopic }) {
  const [selectedStudent, setSelectedStudent] = useState('');
  const [studentProgress, setStudentProgress] = useState([]);
  const [studentStats, setStudentStats] = useState(null);

  useEffect(() => {
    if (students && students.length > 0 && !selectedStudent) {
      setSelectedStudent(students[0]); // students is an array of strings
    }
  }, [students, selectedStudent]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedStudent) return;
      try {
        const progUrl = new URL('http://localhost:3001/api/analytics/student-progress');
        progUrl.searchParams.append('student', selectedStudent);
        
        const progRes = await fetch(progUrl.toString());
        setStudentProgress(await progRes.json());
        
        let stUrl = new URL('http://localhost:3001/api/analytics/students');
        stUrl.searchParams.append('student', selectedStudent);
        
        if (topic && topic !== 'All Topics') stUrl.searchParams.append('topic', topic);
        if (subTopic && subTopic !== 'All Topics') stUrl.searchParams.append('subTopic', subTopic);
        if (date) stUrl.searchParams.append('date', date);
        const stRes = await fetch(stUrl.toString());
        const data = await stRes.json();
        if (data && data.length > 0) setStudentStats(data[0]);
      } catch (e) { console.error(e); }
    };
    fetchData();
  }, [selectedStudent, topic, subTopic, date]);

  const formatDuration = (seconds) => {
    if (seconds === null || seconds === undefined) return 'N/A';
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const determineStatus = (row) => {
    if (row.score !== null && row.score < 50) return <span className={styles.badgeDanger}>At Risk</span>;
    if (row.attention !== null && row.attention < 50) return <span className={styles.badgeDanger}>Distracted</span>;
    if (row.engagement !== null && row.engagement < 50) return <span className={styles.badgeDanger}>Low Engagement</span>;
    if (row.score >= 80 && row.attention >= 80) return <span className={styles.badgeSuccess}>Excellent</span>;
    return <span className={styles.badgeSuccess}>On Track</span>;
  };

  // Prepare Radar Chart Data for Student Performance
  let performanceData = [];
  if (studentStats) {
    // We normalize Attendance if possible. If not, we just show raw minutes or a rough % based on an assumed 60m class (for visual radar only, or just bar chart).
    // Let's use a Bar Chart for easier reading since we don't have a max attendance. Or we can just calculate an approximate percentage.
    const attendanceVal = studentStats.averageAttendance ? Math.min(100, Math.round((studentStats.averageAttendance / 3600) * 100)) : 0;
    
    performanceData = [
      { name: 'Quiz Score', value: studentStats.averageScore !== null ? Math.round(studentStats.averageScore) : 0 },
      { name: 'Engagement', value: studentStats.averageEngagement !== null ? Math.round(studentStats.averageEngagement) : 0 },
      { name: 'Attention', value: studentStats.averageAttention !== null ? Math.round(studentStats.averageAttention) : 0 },
      { name: 'Attendance (Est. %)', value: attendanceVal }
    ];
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      
      <div className={styles.sectionHeader}>
        <h2>STUDENT ANALYTICS</h2>
      </div>

      {/* Student Selector */}
      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#475569' }}>Select Student:</h3>
        <select 
          value={selectedStudent} 
          onChange={(e) => setSelectedStudent(e.target.value)}
          style={{ 
            padding: '0.75rem 1.2rem', 
            width: '300px', 
            borderRadius: '10px', 
            border: '1px solid #cbd5e1', 
            background: '#ffffff', 
            color: '#334155', 
            fontSize: '0.95rem',
            fontWeight: 500,
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          {students.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {studentStats ? (
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiTitle}>Quiz Performance</div>
            <div className={styles.kpiValue}>{studentStats.averageScore !== null ? `${Math.round(studentStats.averageScore)}%` : 'N/A'}</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiTitle}>Avg Attendance</div>
            <div className={styles.kpiValue}>{studentStats.averageAttendance ? `${Math.floor(studentStats.averageAttendance / 60)}m ${Math.floor(studentStats.averageAttendance % 60)}s` : 'N/A'}</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiTitle}>Avg Engagement</div>
            <div className={styles.kpiValue}>{studentStats.averageEngagement !== null ? `${Math.round(studentStats.averageEngagement)}%` : 'N/A'}</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiTitle}>Avg Attention</div>
            <div className={styles.kpiValue}>{studentStats.averageAttention !== null ? `${Math.round(studentStats.averageAttention)}%` : 'N/A'}</div>
          </div>
        </div>
      ) : null}

      <div className={styles.chartsGrid}>
        
        {/* Student Overall Performance (Bar Chart) */}
        <div className={styles.chartContainer} style={{ gridColumn: studentProgress.length <= 1 ? 'span 2' : 'span 1' }}>
          <h3 className={styles.chartTitle}>Overall Performance</h3>
          <div style={{ width: '100%', height: 300 }}>
            {performanceData.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b' }}>No data available</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={performanceData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="value" name="Score %" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Student Progress (Line Charts) ONLY if > 1 date */}
        {studentProgress.length > 1 && (
          <>
            <div className={styles.chartContainer}>
              <h3 className={styles.chartTitle}>Quiz Trend</h3>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <LineChart data={studentProgress} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="score" name="Quiz Score %" stroke="#10b981" strokeWidth={3} dot={{r: 4}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className={styles.chartContainer} style={{ gridColumn: 'span 2' }}>
              <h3 className={styles.chartTitle}>Engagement & Attention Trend</h3>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <LineChart data={studentProgress} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line type="monotone" dataKey="engagement" name="Engagement %" stroke="#0ea5e9" strokeWidth={3} dot={{r: 4}} />
                    <Line type="monotone" dataKey="attention" name="Attention %" stroke="#8b5cf6" strokeWidth={3} dot={{r: 4}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>

      <div className={styles.tableContainer}>
        <h3 className={styles.chartTitle} style={{ padding: '1.5rem 1.5rem 0', borderBottom: 'none', marginBottom: 0 }}>Date-wise Records for {selectedStudent || 'Selected Student'}</h3>
        <table className={styles.dataTable} style={{ marginTop: '0.5rem' }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Topic</th>
              <th>Sub Topic</th>
              <th>Engagement</th>
              <th>Attention</th>
              <th>Score</th>
              <th>Total Stay</th>
              <th>Questions</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {studentProgress.length === 0 ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', color: '#64748b' }}>No records found.</td></tr>
            ) : (
              studentProgress.map((row, i) => (
                <tr key={i} className={styles.clickableRow}>
                  <td style={{ fontWeight: 600, color: '#334155' }}>{row.date ? new Date(row.date).toLocaleDateString() : 'N/A'}</td>
                  <td>{row.topic}</td>
                  <td>{row.sub_topic}</td>
                  <td>{row.engagement !== null ? `${Math.round(row.engagement)}%` : 'N/A'}</td>
                  <td>{row.attention !== null ? `${Math.round(row.attention)}%` : 'N/A'}</td>
                  <td style={{ fontWeight: 600 }}>{row.score !== null ? `${Math.round(row.score)}%` : 'N/A'}</td>
                  <td>{formatDuration(row.stay)}</td>
                  <td>{row.questions !== null ? row.questions : 'N/A'}</td>
                  <td>{determineStatus(row)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
