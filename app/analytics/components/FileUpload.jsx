import React, { useState } from 'react';
import styles from '../analytics.module.css';
import * as xlsx from 'xlsx';

export default function FileUpload({ onSuccess }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  
  const [preview, setPreview] = useState(null); // stores parsed data for preview
  const [errorMsg, setErrorMsg] = useState('');
  const [successSummary, setSuccessSummary] = useState(null);

  const normalizeDate = (dateStr) => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      const parts = dateStr.toString().split('-');
      if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return dateStr;
    } catch (e) { return dateStr; }
  };

  const normalizeTopic = (topic) => {
    if (!topic) return 'Unknown Topic';
    let t = topic.toString().trim().toLowerCase().replace(/-/g, ' ').replace(/_/g, ' ');
    if (t === 'general topic' || t === 'unknown topic') return t;
    return t.replace(/\b\w/g, l => l.toUpperCase());
  };

  const extractMetadata = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = xlsx.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1 });
        
        let type = 'unknown';
        const lowerName = file.name.toLowerCase();
        if (lowerName.includes('class_report')) type = 'Class Report';
        else if (lowerName.includes('quiz_report')) type = 'Quiz Report';
        else if (lowerName.includes('activity_report')) type = 'Activity Report';
        
        let date = null;
        let topic = 'General';
        let subTopic = 'General';
        let studentsCount = 0;
        
        // Extract metadata
        for (let i = 0; i < Math.min(15, sheetData.length); i++) {
          const row = sheetData[i];
          if (!row || !Array.isArray(row)) continue;
          const cell0 = row[0] ? String(row[0]).trim().toLowerCase() : '';
          const cell1 = row[1] ? String(row[1]).trim() : '';
          
          if (cell0.includes('date')) {
            if (cell1) date = normalizeDate(cell1);
            else {
              const match = cell0.match(/date[\s:]*([\d-]+)/);
              if (match) date = normalizeDate(match[1]);
            }
          }
          if (cell0 === 'topic:' || cell0 === 'topic') {
            if (cell1) topic = normalizeTopic(cell1);
          }
          if (cell0 === 'sub topic:' || cell0 === 'sub topic' || cell0 === 'subtopic:') {
            if (cell1) subTopic = normalizeTopic(cell1);
          }
        }
        
        // Extract students
        let inStudentSection = false;
        let nameColIdx = -1;
        for (let i = 0; i < sheetData.length; i++) {
           const row = sheetData[i];
           if (!row || !Array.isArray(row)) continue;
           
           if (!inStudentSection) {
             if (row[0] && row[0].toString().toUpperCase().includes('STUDENT DETAILS')) inStudentSection = true;
             else if (row[0] && row[0].toString().toUpperCase().includes('STUDENT RESULTS')) inStudentSection = true;
             else if (row[0] && row[0].toString().toUpperCase().includes('ACTIVITY DETAILS')) inStudentSection = true;
           } else {
             if (row[0] && (row[0].toString().toUpperCase().includes('QUIZ QUESTIONS') || row[0].toString().toUpperCase().includes('ACTIVITY TIMELINE'))) {
               inStudentSection = false;
               continue;
             }
             if (nameColIdx === -1) {
               if (row.includes('Name')) nameColIdx = row.indexOf('Name');
               else if (row.includes('Student Name')) nameColIdx = row.indexOf('Student Name');
             } else {
               if (row[nameColIdx] && String(row[nameColIdx]).trim() !== '') studentsCount++;
             }
           }
        }
        
        resolve({ type, file: file.name, date, topic, subTopic, students: studentsCount });
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setPreview(null);
    setErrorMsg('');
    setMessage('');
    
    if (selectedFiles.length === 0) return;
    
    // Validate
    const parsed = [];
    for (const f of selectedFiles) {
      const meta = await extractMetadata(f);
      parsed.push(meta);
    }
    
    // Check mismatches
    let refTopic = parsed[0].topic;
    let refSubTopic = parsed[0].subTopic;
    let refDate = parsed[0].date;
    
    let mismatch = null;
    for (const p of parsed) {
      if (p.topic !== refTopic || p.subTopic !== refSubTopic || p.date !== refDate) {
        mismatch = p.type;
        break;
      }
    }
    
    if (mismatch) {
      setErrorMsg(`⚠ Reports do not match\n\n${mismatch} has a different Topic, Sub Topic, or Date.\n\nPlease upload the correct report.`);
    } else {
      setPreview(parsed);
    }
  };

  const handleCancel = () => {
    setFiles([]);
    setPreview(null);
    setErrorMsg('');
    // reset file input
    document.getElementById('fileUploadInput').value = '';
  };

  const handleUploadProcess = async () => {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('reports', files[i]);
    }

    setUploading(true);
    setPreview(null);
    
    try {
      const res = await fetch('http://localhost:3001/api/analytics/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessSummary(preview);
        if (onSuccess) onSuccess(preview);
        setFiles([]);
        document.getElementById('fileUploadInput').value = '';
      } else {
        setMessage(data.error || 'Upload failed');
      }
    } catch (err) {
      setMessage('Network error');
    }
    setUploading(false);
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>UPLOAD SKYMEET REPORTS</h2>
      <p style={{ color: '#6c757d', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Upload Class, Quiz and Activity reports together.<br/>
        Topic, Sub Topic and Date are automatically detected from the uploaded reports.
      </p>
      
      <div className={styles.formGroup}>
        <input id="fileUploadInput" type="file" multiple accept=".xlsx, .xls, .csv" onChange={handleFileChange} className={styles.formInput} />
      </div>

      {errorMsg && (
        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fff3cd', color: '#856404', borderRadius: '8px', border: '1px solid #ffeeba', whiteSpace: 'pre-wrap' }}>
          {errorMsg}
        </div>
      )}

      {preview && !errorMsg && (
        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#212529' }}>DATA VALIDATION</h3>
          
          {preview.map((r, i) => (
            <div key={i} style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #dee2e6' }}>
              <strong style={{ color: '#198754' }}>? {r.type} detected</strong>
              <div style={{ fontSize: '0.9rem', color: '#495057', marginTop: '0.25rem' }}>
                <div>Topic: {r.topic}</div>
                <div>Sub Topic: {r.subTopic}</div>
                <div>Date: {r.date}</div>
                <div>{r.type === 'Quiz Report' ? 'Submissions' : 'Students'}: {r.students}</div>
              </div>
            </div>
          ))}
          
          <div style={{ color: '#198754', fontWeight: 500, fontSize: '0.9rem', marginBottom: '1rem' }}>
            ? Reports belong to the same class
          </div>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
             <button onClick={handleCancel} disabled={uploading} style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
             <button onClick={handleUploadProcess} disabled={uploading} className={styles.btnPrimary}>
               {uploading ? 'Processing...' : 'Upload & Process'}
             </button>
          </div>
        </div>
      )}
      
      {successSummary && !preview && !errorMsg && (
        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
          <strong style={{ display: 'block', marginBottom: '1rem', color: '#198754', fontSize: '1.1rem' }}>✓ Data saved successfully</strong>
          
          <div style={{ fontSize: '0.9rem', color: '#495057', marginBottom: '1rem' }}>
            <div>Topic: {successSummary[0]?.topic}</div>
            <div>Sub Topic: {successSummary[0]?.subTopic}</div>
            <div>Date: {successSummary[0]?.date}</div>
          </div>
          
          <div style={{ fontSize: '0.9rem', color: '#495057', marginBottom: '1rem' }}>
            {successSummary.map((r, i) => (
               <div key={i}>{r.type.split(' ')[0]} {r.type === 'Quiz Report' ? 'Submissions' : 'Students'}: {r.students}</div>
            ))}
          </div>
          
          <div style={{ color: '#0d6efd', fontWeight: 500, fontSize: '0.9rem' }}>
            All reports successfully combined.
          </div>
        </div>
      )}
    </div>
  );
}
