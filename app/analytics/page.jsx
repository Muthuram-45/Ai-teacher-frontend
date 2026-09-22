'use client';
import React, { useState, useEffect } from 'react';
import styles from './analytics.module.css';
import FileUpload from './components/FileUpload';
import OverviewTab from './components/tabs/OverviewTab';
import QuizTab from './components/tabs/QuizTab';
import AttendanceTab from './components/tabs/AttendanceTab';
import ActivityMonitorTab from './components/tabs/ActivityMonitorTab';
import TopicsTab from './components/tabs/TopicsTab';
import StudentsTab from './components/tabs/StudentsTab';
import * as xlsx from 'xlsx';

export default function AnalyticsDashboard() {
  const [topics, setTopics] = useState([]);
  const [subTopics, setSubTopics] = useState([]);
  const [dates, setDates] = useState([]);
  const [students, setStudents] = useState([]);
  
  const [selectedTopic, setSelectedTopic] = useState('All Topics');
  const [selectedSubTopic, setSelectedSubTopic] = useState('All Topics');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('All Students');
  
  const [overview, setOverview] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const [activeTab, setActiveTab] = useState('Overview');
  const tabs = ['Overview', 'Quiz', 'Attendance', 'Activity Monitor', 'Topics', 'Students'];

  const fetchFilters = async () => {
    try {
      const topicUrl = new URL('http://localhost:3001/api/analytics/topics');
      const topicRes = await fetch(topicUrl.toString());
      setTopics(await topicRes.json());
      
      
      const subTopicUrl = new URL('http://localhost:3001/api/analytics/subtopics');
      if (selectedTopic !== 'All Topics') subTopicUrl.searchParams.append('topic', selectedTopic);
      const subTopicRes = await fetch(subTopicUrl.toString());
      setSubTopics(await subTopicRes.json());
      
      const dateUrl = new URL('http://localhost:3001/api/analytics/dates');

      if (selectedTopic !== 'All Topics') dateUrl.searchParams.append('topic', selectedTopic);
      if (selectedSubTopic !== 'All Topics') dateUrl.searchParams.append('subTopic', selectedSubTopic);
      const dateRes = await fetch(dateUrl.toString());
      setDates(await dateRes.json());
      
      const studentsUrl = new URL('http://localhost:3001/api/analytics/students');
      if (selectedTopic !== 'All Topics') studentsUrl.searchParams.append('topic', selectedTopic);
      if (selectedSubTopic !== 'All Topics') studentsUrl.searchParams.append('subTopic', selectedSubTopic);
      const studentsRes = await fetch(studentsUrl.toString());
      const studentsData = await studentsRes.json();
      setStudents(studentsData.map(s => s.student_name));
    } catch (e) {
      console.error(e);
    }
  };

  const handleUploadSuccess = (summary) => {
    setRefreshKey(k => k + 1);
    if (summary && summary.length > 0) {
      if (summary[0].topic) setSelectedTopic(summary[0].topic);
      if (summary[0].subTopic) setSelectedSubTopic(summary[0].subTopic);
    }
  };

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const url = new URL('http://localhost:3001/api/analytics/overview');
      if (selectedTopic && selectedTopic !== 'All Topics') url.searchParams.append('topic', selectedTopic);
      if (selectedSubTopic && selectedSubTopic !== 'All Topics') url.searchParams.append('subTopic', selectedSubTopic);
      if (selectedDate) url.searchParams.append('startDate', selectedDate); // Keeping startDate as it was originally used
      
      const res = await fetch(url.toString());
      const data = await res.json();
      setOverview(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFilters();
  }, [selectedTopic, selectedSubTopic, refreshKey]);

  useEffect(() => {
    fetchOverview();
  }, [selectedTopic, selectedSubTopic, selectedDate, refreshKey]);

  const handleExport = () => {
    const ws = xlsx.utils.json_to_sheet([{
      Topic: selectedTopic,
      Date: selectedDate,
      TotalStudents: overview.totalStudents,
      Classes: overview.totalClasses,
      AvgScore: overview.averageScore,
      Engagement: overview.averageEngagement,
      Attention: overview.averageAttention
    }]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Analytics");
    xlsx.writeFile(wb, `Skymeet_Analytics_${selectedTopic}_${selectedDate || 'All'}.xlsx`);
  };

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={styles.analyticsLayout}>
      
      {/* Responsive Side / Top Navbar */}
      <nav className={styles.sideNav}>
        <div className={styles.navHeader}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>SKYMEET</h1>
          <span style={{ fontWeight: 300, fontSize: '0.85rem', color: '#cbd5e1' }}>Learning Analytics</span>
        </div>
        
        {topics.length > 0 && (
          <div className={styles.tabsContainer}>
            {tabs.map(nav => (
              <button 
                key={nav} 
                onClick={() => setActiveTab(nav)} 
                className={`${styles.tabBtn} ${activeTab === nav ? styles.activeTabBtn : ''}`}
              >
                {nav}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <div className={styles.mainArea}>
        
        {/* Fixed / Sticky Top Header (Filters & Export) */}
        <div className={styles.topHeader}>
          {topics.length > 0 ? (
            <div className={styles.filterRow}>
              
              <div className={styles.filterGroup}>
                <label>Topic</label>
                <select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)}>
                  <option value="All Topics">All Topics</option>
                  {topics.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label>Sub Topic</label>
                <select value={selectedSubTopic} onChange={(e) => setSelectedSubTopic(e.target.value)}>
                  <option value="All Topics">All Sub Topics</option>
                  {subTopics.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div style={{ fontWeight: 600, color: '#64748b' }}>Awaiting Data...</div>
          )}
          
          {topics.length > 0 && (
            <button onClick={handleExport} className={styles.exportBtn}>
              Export Report
            </button>
          )}
        </div>

        {/* Scrollable Dashboard Container */}
        <div className={styles.contentPadding}>
          <section className={styles.uploadSection}>
            <FileUpload onSuccess={handleUploadSuccess} />
          </section>

      {loading ? (
        <div className={styles.loading}>Loading analytics...</div>
      ) : (
        <main className={styles.dashboardGrid}>
          {activeTab === 'Overview' && <OverviewTab topic={selectedTopic} subTopic={selectedSubTopic} date={selectedDate} overview={overview} onViewClass={(t, st, d) => {
            setSelectedTopic(t);
            setSelectedSubTopic(st);
            setSelectedDate(d);
          }} />}
          {activeTab === 'Quiz' && <QuizTab topic={selectedTopic} subTopic={selectedSubTopic} date={selectedDate} />}
          {activeTab === 'Attendance' && <AttendanceTab topic={selectedTopic} subTopic={selectedSubTopic} date={selectedDate} overview={overview} />}
          {activeTab === 'Activity Monitor' && <ActivityMonitorTab topic={selectedTopic} subTopic={selectedSubTopic} date={selectedDate} overview={overview} />}
          {activeTab === 'Topics' && <TopicsTab topic={selectedTopic} subTopic={selectedSubTopic} />}
          {activeTab === 'Students' && <StudentsTab topic={selectedTopic} subTopic={selectedSubTopic} date={selectedDate} students={students} />}
        </main>
      )}
        </div>
      </div>
    </div>
  );
}
