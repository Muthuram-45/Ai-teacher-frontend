import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import styles from '../../analytics.module.css';

export default function TopicsTab({topic , subTopic }) {
  const [subTopics, setSubTopics] = useState([]);
  const [learningJourney, setLearningJourney] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let stUrl = new URL('http://localhost:3001/api/analytics/sub-topic');
        
        if (topic && topic !== 'All Topics') stUrl.searchParams.append('topic', topic);
        const stRes = await fetch(stUrl.toString());
        setSubTopics(await stRes.json());
        
        let ljUrl = new URL('http://localhost:3001/api/analytics/learning-journey');
        
        if (topic && topic !== 'All Topics') ljUrl.searchParams.append('topic', topic);
        const ljRes = await fetch(ljUrl.toString());
        setLearningJourney(await ljRes.json());
      } catch (e) { console.error(e); }
    };
    fetchData();
  }, [topic, subTopic]);

  const totalStudents = subTopics.reduce((acc, s) => acc + (s.students || 0), 0);
  // Average of averages is a rough estimate but it works for high-level KPIs
  const validScores = subTopics.filter(t => t.averageScore != null);
  const avgScore = validScores.length > 0 ? validScores.reduce((acc, t) => acc + t.averageScore, 0) / validScores.length : 0;
  
  const validEngagements = subTopics.filter(t => t.averageEngagement != null);
  const avgEngagement = validEngagements.length > 0 ? validEngagements.reduce((acc, t) => acc + t.averageEngagement, 0) / validEngagements.length : 0;

  const cards = [
    { title: 'Total Students', value: totalStudents },
    { title: 'Average Score', value: avgScore ? `${Math.round(avgScore)}%` : 'N/A' },
    { title: 'Avg Engagement', value: avgEngagement ? `${Math.round(avgEngagement)}%` : 'N/A' }
  ];

  // Calculate normalized max attendance for % display if desired, or use raw for chart
  const maxAttendance = Math.max(...subTopics.map(s => s.averageAttendance || 0));
  const metricsData = subTopics.map(s => ({
    name: s.sub_topic || 'Unknown',
    Quiz: s.averageScore != null && !isNaN(s.averageScore) ? Math.round(s.averageScore) : null,
    Engagement: s.averageEngagement != null && !isNaN(s.averageEngagement) ? Math.round(s.averageEngagement) : null,
    Attendance: s.averageAttendance != null && maxAttendance > 0 ? Math.round((s.averageAttendance / maxAttendance) * 100) : null,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      
      <div className={styles.sectionHeader}>
        <h2>TOPICS ANALYTICS</h2>
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
        
        {/* Students by Sub Topic */}
        <div className={styles.chartContainer}>
          <h3 className={styles.chartTitle}>Students by Sub Topic</h3>
          <div style={{ width: '100%', height: 300 }}>
            {subTopics.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b' }}>No data available</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={subTopics} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="sub_topic" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="students" name="Students" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Metrics by Sub Topic */}
        <div className={styles.chartContainer}>
          <h3 className={styles.chartTitle}>Metrics by Sub Topic</h3>
          <div style={{ width: '100%', height: 300 }}>
            {metricsData.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b' }}>No data available</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={metricsData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="Quiz" name="Quiz %" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Engagement" name="Engagement %" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Attendance" name="Attendance %" fill="#f59e0b" radius={[4, 4, 0, 0]} />
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
              <th>Sub-topic</th>
              <th>Students</th>
              <th>Average Score</th>
              <th>Attendance</th>
              <th>Engagement</th>
            </tr>
          </thead>
          <tbody>
            {subTopics.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', color: '#64748b' }}>No sub-topic records found.</td></tr>
            ) : (
              subTopics.map((row, i) => (
                <tr key={i} className={styles.clickableRow}>
                  <td style={{ fontWeight: 600, color: '#334155' }}>{row.sub_topic}</td>
                  <td>{row.students || 0}</td>
                  <td style={{ fontWeight: 600 }}>{row.averageScore !== null ? `${Math.round(row.averageScore)}%` : 'N/A'}</td>
                  <td>{row.averageAttendance ? `${Math.floor(row.averageAttendance / 60)}m ${Math.round(row.averageAttendance % 60)}s` : 'N/A'}</td>
                  <td>{row.averageEngagement !== null ? `${Math.round(row.averageEngagement)}%` : 'N/A'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
