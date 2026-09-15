import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import styles from '../analytics.module.css';

export default function ChartsOverview({ trendData }) {
  if (!trendData || trendData.length === 0) return null;

  const formattedData = trendData.map(d => ({
    name: d.date.split('T')[0],
    Score: Math.round(d.averageScore || 0),
    Engagement: Math.round(d.averageEngagement || 0),
    Attention: Math.round(d.averageAttention || 0)
  }));

  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>Performance Trend</h3>
      <div style={{ height: '320px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Line type="monotone" dataKey="Score" stroke="#3B82F6" strokeWidth={3} activeDot={{ r: 8 }} />
            <Line type="monotone" dataKey="Engagement" stroke="#10B981" strokeWidth={3} />
            <Line type="monotone" dataKey="Attention" stroke="#F59E0B" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
