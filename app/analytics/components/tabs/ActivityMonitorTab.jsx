import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import styles from '../../analytics.module.css';

export default function ActivityMonitorTab({ topic, subTopic, date, overview }) {
  const [engagementStats, setEngagementStats] = useState([]);
  const [activityStats, setActivityStats] = useState([]);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let engUrl = new URL('http://localhost:3001/api/analytics/engagement');
        let actUrl = new URL('http://localhost:3001/api/analytics/activity-breakdown');
        let sessUrl = new URL('http://localhost:3001/api/analytics/sessions');
        
        if (topic && topic !== 'All Topics') {
          engUrl.searchParams.append('topic', topic);
          actUrl.searchParams.append('topic', topic);
          sessUrl.searchParams.append('topic', topic);
        }
        if (subTopic && subTopic !== 'All Topics') {
          engUrl.searchParams.append('subTopic', subTopic);
          actUrl.searchParams.append('subTopic', subTopic);
          sessUrl.searchParams.append('subTopic', subTopic);
        }
        if (date) {
          engUrl.searchParams.append('date', date);
          actUrl.searchParams.append('date', date);
          sessUrl.searchParams.append('date', date);
        }

        const [engRes, actRes, sessRes] = await Promise.all([
          fetch(engUrl.toString()),
          fetch(actUrl.toString()),
          fetch(sessUrl.toString())
        ]);

        setEngagementStats(await engRes.json());
        setActivityStats(await actRes.json());
        
        const allSessions = await sessRes.json();
        setSessions(allSessions.filter(s => s.attention_score !== null || s.engagement_score !== null || s.away_time !== null));

      } catch (e) { console.error(e); }
    };
    fetchData();
  }, [topic, subTopic, date]);

  const totalAwayTime = sessions.reduce((acc, s) => acc + (s.away_time || 0), 0);
  const totalInactiveTime = sessions.reduce((acc, s) => acc + (s.inactive_time || 0), 0);
  const totalWarnings = sessions.reduce((acc, s) => acc + (s.warnings || 0), 0);
  const totalBackgroundTime = sessions.reduce((acc, s) => acc + (s.background_time || 0), 0);

  const formatDuration = (seconds) => {
    if (seconds === null || seconds === undefined) return 'N/A';
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const warningsData = sessions
    .filter(s => s.warnings !== null && s.warnings > 0)
    .map(s => ({
      name: s.student_name,
      warnings: s.warnings
    }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      
      <div className={styles.sectionHeader}>
        <h2>ACTIVITY MONITOR</h2>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div className={styles.kpiCard} style={{ flex: '1 1 300px' }}>
          <div className={styles.kpiTitle}>Attention</div>
          <div className={styles.kpiValue}>{overview.averageAttention !== undefined && overview.averageAttention !== null ? `${Math.round(overview.averageAttention)}%` : 'N/A'}</div>
          <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Away Time:</span> <strong>{formatDuration(totalAwayTime)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Inactive Time:</span> <strong>{formatDuration(totalInactiveTime)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Warnings:</span> <strong>{totalWarnings}</strong></div>
          </div>
        </div>
        <div className={styles.kpiCard} style={{ flex: '1 1 300px' }}>
          <div className={styles.kpiTitle}>Engagement</div>
          <div className={styles.kpiValue}>{overview.averageEngagement !== undefined && overview.averageEngagement !== null ? `${Math.round(overview.averageEngagement)}%` : 'N/A'}</div>
          <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Active Time (approx):</span> <strong>{formatDuration(sessions.reduce((acc, s) => acc + (s.attendance_duration || 0), 0))}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Inactive Time:</span> <strong>{formatDuration(totalInactiveTime)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Background Time:</span> <strong>{formatDuration(totalBackgroundTime)}</strong></div>
          </div>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        
        {/* Activity Breakdown (Time) */}
        <div className={styles.chartContainer} style={{ gridColumn: 'span 2' }}>
          <h3 className={styles.chartTitle}>Activity Breakdown (Time)</h3>
          <div style={{ width: '100%', height: 350 }}>
            {activityStats.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b' }}>No data available</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={activityStats.slice(0, 15)} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="student_name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="away_time" name="Away Time (s)" stackId="a" fill="#ef4444" />
                  <Bar dataKey="inactive_time" name="Inactive Time (s)" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="background_time" name="Background Time (s)" stackId="a" fill="#64748b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Engagement vs Attention */}
        <div className={styles.chartContainer}>
          <h3 className={styles.chartTitle}>Engagement vs Attention</h3>
          <div style={{ width: '100%', height: 300 }}>
            {engagementStats.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b' }}>No data available</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={engagementStats.slice(0, 15)} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="student_name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="engagement" name="Engagement %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="attention" name="Attention %" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Warnings by Student */}
        <div className={styles.chartContainer}>
          <h3 className={styles.chartTitle}>Warnings by Student</h3>
          <div style={{ width: '100%', height: 300 }}>
            {warningsData.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b' }}>No warnings issued</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={warningsData.slice(0, 15)} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="warnings" name="Warnings" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={40} />
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
              <th>Student</th>
              <th>Date</th>
              <th>Topic</th>
              <th>Engagement</th>
              <th>Attention</th>
              <th>Away Time</th>
              <th>Inactive Time</th>
              <th>Warnings</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', color: '#64748b' }}>No activity records found.</td></tr>
            ) : (
              sessions.map((row, i) => (
                <tr key={i} className={styles.clickableRow}>
                  <td style={{ fontWeight: 600, color: '#334155' }}>{row.student_name}</td>
                  <td>{row.date ? new Date(row.date).toLocaleDateString() : 'N/A'}</td>
                  <td>{row.topic}</td>
                  <td style={{ fontWeight: 600 }}>{row.engagement_score !== null ? `${Math.round(row.engagement_score)}%` : 'N/A'}</td>
                  <td style={{ fontWeight: 600 }}>{row.attention_score !== null ? `${Math.round(row.attention_score)}%` : 'N/A'}</td>
                  <td>{formatDuration(row.away_time)}</td>
                  <td>{formatDuration(row.inactive_time)}</td>
                  <td>{row.warnings || 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
