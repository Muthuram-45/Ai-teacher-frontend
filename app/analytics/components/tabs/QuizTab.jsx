import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import styles from '../../analytics.module.css';

export default function QuizTab({topic, date , subTopic }) {
  const [stats, setStats] = useState({});
  const [sessions, setSessions] = useState([]);
  const [dateScores, setDateScores] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let qsUrl = new URL('http://localhost:3001/api/analytics/quiz-stats');
        let sessUrl = new URL('http://localhost:3001/api/analytics/sessions');
        let jUrl = new URL('http://localhost:3001/api/analytics/learning-journey');

        if (topic && topic !== 'All Topics') {
          qsUrl.searchParams.append('topic', topic);
          sessUrl.searchParams.append('topic', topic);
          jUrl.searchParams.append('topic', topic);
        }
        if (subTopic && subTopic !== 'All Topics') {
          qsUrl.searchParams.append('subTopic', subTopic);
          sessUrl.searchParams.append('subTopic', subTopic);
        }
        if (date) {
          qsUrl.searchParams.append('date', date);
          sessUrl.searchParams.append('date', date);
        }

        const qsRes = await fetch(qsUrl.toString());
        setStats(await qsRes.json());
        
        const sessRes = await fetch(sessUrl.toString());
        const allSessions = await sessRes.json();
        // Only include those who actually started the quiz or got a score
        setSessions(allSessions.filter(s => s.quiz_completed || s.quiz_score !== null));
        
        const jRes = await fetch(jUrl.toString());
        setDateScores(await jRes.json());

      } catch (e) { console.error(e); }
    };
    fetchData();
  }, [topic, subTopic, date]);

  const cards = [
    { title: 'Total Submissions', value: stats.attempts || 0 },
    { title: 'Average Score', value: stats.averageScore !== undefined && stats.averageScore !== null ? `${Math.round(stats.averageScore)}%` : 'N/A' },
    { title: 'Highest Score', value: stats.highestScore !== undefined && stats.highestScore !== null ? `${Math.round(stats.highestScore)}%` : 'N/A' },
    { title: 'Lowest Score', value: stats.lowestScore !== undefined && stats.lowestScore !== null ? `${Math.round(stats.lowestScore)}%` : 'N/A' },
    { title: 'Avg Correct Answers', value: stats.avgCorrectAnswers !== undefined && stats.avgCorrectAnswers !== null ? Math.round(stats.avgCorrectAnswers * 10) / 10 : 'N/A' }
  ];

  const studentScores = sessions
    .filter(s => s.quiz_score !== null)
    .map(s => ({
      name: s.student_name,
      score: s.quiz_score !== null ? Math.round(s.quiz_score) : 0,
    }));

  const integrityData = sessions
    .filter(s => s.tab_switches > 0 || s.violations > 0)
    .map(s => ({
      name: s.student_name,
      'Tab Switches': s.tab_switches || 0,
      'Video Violations': s.violations || 0
    }));

  // Quiz Performance Distribution (Donut Chart)
  let excellent = 0, good = 0, needsImprovement = 0;
  sessions.forEach(s => {
    if (s.quiz_score !== null && s.quiz_score !== undefined) {
      const score = Math.round(s.quiz_score);
      if (score >= 80) excellent++;
      else if (score >= 60) good++;
      else needsImprovement++;
    }
  });

  const donutData = [];
  if (excellent > 0) donutData.push({ name: 'Excellent', value: excellent });
  if (good > 0) donutData.push({ name: 'Good', value: good });
  if (needsImprovement > 0) donutData.push({ name: 'Needs Improvement', value: needsImprovement });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      
      <div className={styles.sectionHeader}>
        <h2>QUIZ ANALYTICS</h2>
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
        
        {/* Student Quiz Score (Bar) */}
        <div className={styles.chartContainer}>
          <h3 className={styles.chartTitle}>Student Quiz Score</h3>
          <div style={{ width: '100%', height: 300 }}>
            {studentScores.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b' }}>No data available</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={studentScores.slice(0, 15)} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="score" name="Score %" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Quiz Performance Distribution (Donut) */}
        <div className={styles.chartContainer}>
          <h3 className={styles.chartTitle}>Quiz Performance Distribution</h3>
          <div style={{ width: '100%', height: 300 }}>
            {donutData.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b' }}>No submitted quizzes for the selected filters.</div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={donutData}
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.name === 'Excellent' ? '#10b981' : entry.name === 'Good' ? '#3b82f6' : '#ef4444'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Quiz Integrity / Monitoring */}
        {integrityData.length > 0 && (
          <div className={styles.chartContainer} style={{ gridColumn: 'span 2' }}>
            <h3 className={styles.chartTitle}>Quiz Integrity / Monitoring</h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={integrityData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="Tab Switches" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Video Violations" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>

      <div className={styles.tableContainer}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Student</th>
              <th>Date</th>
              <th>Topic</th>
              <th>Score</th>
              <th>Correct Answers</th>
              <th>Total Questions</th>
              <th>Tab Switches</th>
              <th>Video Violations</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', color: '#64748b' }}>No quiz submissions found.</td></tr>
            ) : (
              sessions.map((row, i) => (
                <tr key={i} className={styles.clickableRow}>
                  <td style={{ fontWeight: 600, color: '#334155' }}>{row.student_name}</td>
                  <td>{row.date ? new Date(row.date).toLocaleDateString() : 'N/A'}</td>
                  <td>{row.topic}</td>
                  <td style={{ fontWeight: 600 }}>{row.quiz_score !== null ? `${Math.round(row.quiz_score)}%` : 'N/A'}</td>
                  <td>{row.correct_answers !== null ? row.correct_answers : 'N/A'}</td>
                  <td>{row.total_questions !== null ? row.total_questions : 'N/A'}</td>
                  <td>{row.tab_switches !== null ? row.tab_switches : 'N/A'}</td>
                  <td>{row.violations !== null ? row.violations : 'N/A'}</td>
                  <td>
                    {row.quiz_score >= 80 ? <span className={styles.badgeSuccess}>Passed</span> : 
                     row.quiz_score !== null ? <span className={styles.badgeDanger}>Needs Review</span> :
                     <span style={{ color: '#94a3b8' }}>N/A</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
