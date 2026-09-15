import React, { useState, useEffect } from 'react';
import { BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import styles from '../../analytics.module.css';

export default function OverviewTab({overview, topic, date, subTopic, onViewClass}) {
  const [quizStats, setQuizStats] = useState({});
  const [studentsData, setStudentsData] = useState([]);
  const [recentClasses, setRecentClasses] = useState([]);

  useEffect(() => {
    const fetchQuizStats = async () => {
      try {
        let url = new URL('http://localhost:3001/api/analytics/quiz-stats');
        if (topic && topic !== 'All Topics') url.searchParams.append('topic', topic);
        if (subTopic && subTopic !== 'All Topics') url.searchParams.append('subTopic', subTopic);
        if (date) url.searchParams.append('date', date);
        const res = await fetch(url.toString());
        setQuizStats(await res.json());
      } catch (e) { console.error(e); }
    };
    fetchQuizStats();
  }, [topic, subTopic, date]);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        let url = new URL('http://localhost:3001/api/analytics/students');
        if (topic && topic !== 'All Topics') url.searchParams.append('topic', topic);
        if (subTopic && subTopic !== 'All Topics') url.searchParams.append('subTopic', subTopic);
        if (date) url.searchParams.append('date', date);
        const res = await fetch(url.toString());
        setStudentsData(await res.json());
      } catch (e) { console.error(e); }
    };
    fetchStudents();
  }, [topic, subTopic, date]);

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        let url = new URL('http://localhost:3001/api/analytics/recent-classes');
        const res = await fetch(url.toString());
        setRecentClasses(await res.json());
      } catch (e) { console.error(e); }
    };
    fetchRecent();
  }, []);

  const cards = [
    { title: 'Total Students', value: overview.totalStudents || 0 },
    { title: 'Total Classes', value: overview.totalClasses || 0 },
    { title: 'Avg Quiz Score', value: quizStats.averageScore !== undefined && quizStats.averageScore !== null ? `${Math.round(quizStats.averageScore)}%` : 'N/A' },
    { title: 'Quiz Submissions', value: quizStats.attempts || 0 },
    { title: 'Avg Attendance', value: overview.averageAttendance ? `${Math.floor(overview.averageAttendance / 60)}m ${Math.floor(overview.averageAttendance % 60)}s` : 'N/A' },
    { title: 'Avg Engagement', value: overview.averageEngagement !== undefined && overview.averageEngagement !== null ? `${Math.round(overview.averageEngagement)}%` : 'N/A' },
    { title: 'Avg Attention', value: overview.averageAttention !== undefined && overview.averageAttention !== null ? `${Math.round(overview.averageAttention)}%` : 'N/A' },
    { title: 'Total Questions', value: overview.totalQuestions || 0 }
  ];

  // 1. Student Performance Comparison (Bar Chart)
  // Calculate attendance % robustly if max exists, otherwise use raw duration. The user wants actual data. 
  const maxAttendanceDuration = studentsData.length > 0 ? Math.max(...studentsData.map(s => s.averageAttendance || 0)) : 0;
  
  const studentPerformanceData = studentsData.map(s => {
    const data = {
      name: s.student_name,
      Attendance: s.averageAttendance && maxAttendanceDuration > 0 ? Math.round((s.averageAttendance / maxAttendanceDuration) * 100) : 0,
      Engagement: s.averageEngagement !== null ? Math.round(s.averageEngagement) : null,
      Attention: s.averageAttention !== null ? Math.round(s.averageAttention) : null,
    };
    if (s.averageScore !== null && s.averageScore !== undefined) {
      data.Quiz = Math.round(s.averageScore);
    }
    return data;
  });

  // 2. Attendance vs Engagement (Scatter Chart)
  const scatterData = studentsData
    .filter(s => s.averageAttendance !== null && s.averageEngagement !== null)
    .map(s => ({
      name: s.student_name,
      Attendance: s.averageAttendance && maxAttendanceDuration > 0 ? Math.round((s.averageAttendance / maxAttendanceDuration) * 100) : 0,
      Engagement: Math.round(s.averageEngagement)
    }));

  // 3. Quiz Performance Distribution (Donut Chart)
  let excellent = 0, good = 0, needsImprovement = 0;
  studentsData.forEach(s => {
    if (s.averageScore !== null && s.averageScore !== undefined) {
      const score = Math.round(s.averageScore);
      if (score >= 80) excellent++;
      else if (score >= 60) good++;
      else needsImprovement++;
    }
  });

  const donutData = [];
  if (excellent > 0) donutData.push({ name: 'Excellent', value: excellent });
  if (good > 0) donutData.push({ name: 'Good', value: good });
  if (needsImprovement > 0) donutData.push({ name: 'Needs Improvement', value: needsImprovement });

  // 4. Class Analytics Summary (Radar Chart)
  const classSummaryData = [
    { subject: 'Attendance', A: overview.averageAttendance && maxAttendanceDuration > 0 ? Math.round((overview.averageAttendance / maxAttendanceDuration) * 100) : 0, fullMark: 100 },
    { subject: 'Engagement', A: overview.averageEngagement !== undefined && overview.averageEngagement !== null ? Math.round(overview.averageEngagement) : 0, fullMark: 100 },
    { subject: 'Attention', A: overview.averageAttention !== undefined && overview.averageAttention !== null ? Math.round(overview.averageAttention) : 0, fullMark: 100 },
    { subject: 'Quiz Score', A: quizStats.averageScore !== undefined && quizStats.averageScore !== null ? Math.round(quizStats.averageScore) : 0, fullMark: 100 }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      
      <div className={styles.kpiGrid}>
        {cards.map((card, i) => (
          <div key={i} className={styles.kpiCard}>
            <div className={styles.kpiTitle}>{card.title}</div>
            <div className={styles.kpiValue}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className={styles.chartsGrid}>
        
        {/* Class Analytics Summary */}
        <div className={styles.chartContainer} style={{ gridColumn: 'span 2' }}>
          <h3 className={styles.chartTitle}>Class Analytics Summary</h3>
          <div style={{ width: '100%', height: 350 }}>
            {overview.totalStudents === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b' }}>No data available</div>
            ) : (
              <ResponsiveContainer>
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={classSummaryData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{fill: '#475569', fontSize: 13, fontWeight: 600}} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{fill: '#94a3b8'}} />
                  <Radar name="Class Average" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Student Performance Comparison */}
        <div className={styles.chartContainer} style={{ gridColumn: 'span 2' }}>
          <h3 className={styles.chartTitle}>Student Performance Comparison</h3>
          <div style={{ width: '100%', height: 400 }}>
            {studentPerformanceData.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b' }}>No data available</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={studentPerformanceData} margin={{ top: 20, right: 30, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="Quiz" name="Quiz %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Attendance" name="Attendance %" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Engagement" name="Engagement %" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Attention" name="Attention %" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Attendance vs Engagement */}
        <div className={styles.chartContainer}>
          <h3 className={styles.chartTitle}>Attendance vs Engagement</h3>
          <div style={{ width: '100%', height: 350 }}>
            {scatterData.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b' }}>No data available</div>
            ) : (
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" dataKey="Attendance" name="Attendance" unit="%" domain={[0, 100]} tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                  <YAxis type="number" dataKey="Engagement" name="Engagement" unit="%" domain={[0, 100]} tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{strokeDasharray: '3 3'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Scatter name="Students" data={scatterData} fill="#f59e0b">
                    {scatterData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#f59e0b" />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Quiz Performance Distribution */}
        <div className={styles.chartContainer}>
          <h3 className={styles.chartTitle}>Quiz Performance Distribution</h3>
          <div style={{ width: '100%', height: 350 }}>
            {donutData.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b' }}>No submitted quizzes for the selected filters.</div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={donutData}
                    innerRadius={80}
                    outerRadius={120}
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
      </div>



    </div>
  );
}
