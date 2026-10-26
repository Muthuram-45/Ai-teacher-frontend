'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BACKEND_URL } from '../lib/config';
import {
  FaMicrophone,
  FaStop,
  FaPlay,
  FaDownload,
  FaTrash,
  FaCheckCircle,
  FaExclamationTriangle,
  FaVolumeUp,
  FaRedo
} from 'react-icons/fa';
import { BsSoundwave, BsCheck2Circle } from 'react-icons/bs';
import { MdRecordVoiceOver, MdContentCopy } from 'react-icons/md';

export default function VoiceReplicationStudio({
  teacherEmail,
  teacherName,
  activeVoice,
  onVoiceChanged
}) {
  // Replicated Voices List
  const [voices, setVoices] = useState([]);
  const [loadingVoices, setLoadingVoices] = useState(false);

  // Voice Creation State
  const [displayName, setDisplayName] = useState('');
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [isReplicating, setIsReplicating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createSuccess, setCreateSuccess] = useState(null);

  // Reference Audio State
  const [refAudioBlob, setRefAudioBlob] = useState(null);
  const [refAudioUrl, setRefAudioUrl] = useState(null);
  const [isRecordingRef, setIsRecordingRef] = useState(false);
  const [refRecordDuration, setRefRecordDuration] = useState(0);

  // Consent Audio State
  const [consentAudioBlob, setConsentAudioBlob] = useState(null);
  const [consentAudioUrl, setConsentAudioUrl] = useState(null);
  const [isRecordingConsent, setIsRecordingConsent] = useState(false);
  const [consentRecordDuration, setConsentRecordDuration] = useState(0);

  // MediaRecorder refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const refFileInputRef = useRef(null);
  const consentFileInputRef = useRef(null);

  // Speech Generation State
  const [selectedVoiceId, setSelectedVoiceId] = useState('voice_74080a81-5951-4b5f-972b-72b4064d116a');
  const [lessonText, setLessonText] = useState(
    'Welcome students to today\'s session. Today we will explore how binary search algorithms work by repeatedly dividing the search interval in half to achieve logarithmic time complexity.'
  );
  const [language, setLanguage] = useState('tamil');
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [deliveryStyle, setDeliveryStyle] = useState('teacher');
  const [emotion, setEmotion] = useState('confident');
  const [intensity, setIntensity] = useState('medium');
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [generatedAudio, setGeneratedAudio] = useState(null);
  const [speechError, setSpeechError] = useState(null);
  const [speechSuccess, setSpeechSuccess] = useState(null);

  const effectiveEmail = (teacherEmail || 'tutor@skymeet.com').toLowerCase().trim();

  const fetchVoices = useCallback(async () => {
    setLoadingVoices(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/voice-replication/voices?teacherEmail=${encodeURIComponent(effectiveEmail)}`, {
        headers: { 'x-teacher-email': effectiveEmail }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.voices)) {
        setVoices(data.voices);
        if (data.voices.length > 0 && !selectedVoiceId) {
          setSelectedVoiceId(data.voices[0].voiceId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch replicated voices:', err);
    } finally {
      setLoadingVoices(false);
    }
  }, [effectiveEmail, selectedVoiceId]);

  // Load teacher voices on mount
  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

  // Start recording audio
  const startRecording = async (type) => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        if (type === 'ref') {
          setRefAudioBlob(audioBlob);
          setRefAudioUrl(audioUrl);
          setIsRecordingRef(false);
        } else {
          setConsentAudioBlob(audioBlob);
          setConsentAudioUrl(audioUrl);
          setIsRecordingConsent(false);
        }
        clearInterval(timerRef.current);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();

      if (type === 'ref') {
        setIsRecordingRef(true);
        setRefRecordDuration(0);
        timerRef.current = setInterval(() => {
          setRefRecordDuration((prev) => prev + 1);
        }, 1000);
      } else {
        setIsRecordingConsent(true);
        setConsentRecordDuration(0);
        timerRef.current = setInterval(() => {
          setConsentRecordDuration((prev) => prev + 1);
        }, 1000);
      }
    } catch (err) {
      alert('Microphone access denied or unavailable: ' + err.message);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(timerRef.current);
  };

  // Handle file uploads
  const handleFileUpload = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (type === 'ref') {
      setRefAudioBlob(file);
      setRefAudioUrl(url);
    } else {
      setConsentAudioBlob(file);
      setConsentAudioUrl(url);
    }
  };

  // Create Replicated Voice
  const handleCreateVoice = async () => {
    if (!refAudioBlob) {
      setCreateError('Please record or upload a reference voice recording.');
      return;
    }
    if (!consentAudioBlob) {
      setCreateError('Please record or upload the teacher consent recording.');
      return;
    }
    if (!consentConfirmed) {
      setCreateError('Please check the explicit consent checkbox to proceed.');
      return;
    }

    setIsReplicating(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const formData = new FormData();
      formData.append('referenceAudio', refAudioBlob, 'reference.wav');
      formData.append('consentAudio', consentAudioBlob, 'consent.wav');
      formData.append('displayName', displayName.trim() || `${teacherName || 'Teacher'}'s Voice`);
      formData.append('consentConfirmed', 'true');
      formData.append('teacherEmail', effectiveEmail);

      const res = await fetch(`${BACKEND_URL}/api/voice-replication/create-voice`, {
        method: 'POST',
        headers: {
          'x-teacher-email': effectiveEmail
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Voice creation failed');
      }

      setCreateSuccess(`Voice replicated successfully! Voice ID: ${data.voiceId}`);
      setDisplayName('');
      setRefAudioBlob(null);
      setRefAudioUrl(null);
      setConsentAudioBlob(null);
      setConsentAudioUrl(null);
      setConsentConfirmed(false);

      // Refresh voices list
      await fetchVoices();
      setSelectedVoiceId(data.voiceId);

      if (onVoiceChanged) {
        onVoiceChanged(data.voiceId);
      }
    } catch (err) {
      setCreateError(err.message || 'Failed to create replicated voice.');
    } finally {
      setIsReplicating(false);
    }
  };

  // Generate Lesson Speech
  const handleGenerateSpeech = async () => {
    if (!lessonText.trim()) {
      setSpeechError('Please enter lesson text to generate speech.');
      return;
    }
    if (!selectedVoiceId) {
      setSpeechError('Please select a voice identifier.');
      return;
    }

    setIsGeneratingSpeech(true);
    setSpeechError(null);
    setSpeechSuccess(null);
    setGeneratedAudio(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/voice-replication/generate-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-teacher-email': effectiveEmail
        },
        body: JSON.stringify({
          text: lessonText.trim(),
          voiceId: selectedVoiceId,
          teacherEmail: effectiveEmail,
          language,
          translateIfNeeded: autoTranslate,
          deliveryStyle,
          emotion,
          intensity
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Speech generation failed');
      }

      setGeneratedAudio(data);
      setSpeechSuccess('Lesson speech generated successfully using Gemini 3.8 Flash TTS!');
    } catch (err) {
      setSpeechError(err.message || 'Speech generation failed.');
    } finally {
      setIsGeneratingSpeech(false);
    }
  };

  // Set active voice for live classroom
  const handleSetActiveVoice = async (voiceId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/select-voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: voiceId })
      });
      const data = await res.json();
      if (data.success && onVoiceChanged) {
        onVoiceChanged(voiceId);
      }
    } catch (err) {
      console.error('Failed to set active voice:', err);
    }
  };

  // Delete voice
  const handleDeleteVoice = async (voiceId) => {
    if (!confirm('Are you sure you want to remove this replicated voice?')) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/voice-replication/voices/${voiceId}`, {
        method: 'DELETE',
        headers: { 'x-teacher-email': effectiveEmail }
      });
      const data = await res.json();
      if (data.success) {
        fetchVoices();
        if (selectedVoiceId === voiceId) {
          setSelectedVoiceId('');
        }
      }
    } catch (err) {
      alert('Failed to delete voice: ' + err.message);
    }
  };

  const copyUrlToClipboard = (url) => {
    const fullUrl = url.startsWith('http') ? url : `${BACKEND_URL}${url}`;
    navigator.clipboard.writeText(fullUrl);
    alert('Audio URL copied to clipboard: ' + fullUrl);
  };

  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', marginTop: '10px' }}>
      
      {/* Top Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.15) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.4)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ maxWidth: '640px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(99, 102, 241, 0.3)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', color: '#c7d2fe', marginBottom: '8px' }}>
            <span>⚡ POWERED BY VERTEX AI</span>
            <span>•</span>
            <span>gemini-3.8-flash-tts</span>
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#ffffff', marginBottom: '8px' }}>
            Teacher Voice Replication Studio
          </h2>
          <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: '1.5' }}>
            Replicate your own authentic voice from reference recordings, ensure explicit consent compliance, and generate high-fidelity lesson narration in English, Hindi, and Tamil.
          </p>
        </div>
        <div style={{ background: '#0f172a', padding: '12px 18px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Session Voice</div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#4ade80', marginTop: '2px' }}>
            {activeVoice?.startsWith('voice_') ? `Mohan (${activeVoice.slice(0, 14)}...)` : activeVoice || 'Mohan'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        
        {/* ============================================================== */}
        {/* LEFT COLUMN: CREATE REPLICATED VOICE */}
        {/* ============================================================== */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <FaMicrophone /> 1. Replicate Your Voice
          </h3>

          {/* Voice Display Name */}
          <div className="inputGroup">
            <label className="inputLabel" style={{ color: '#cbd5e1' }}>Voice Name / Label</label>
            <div className="inputWrapper">
              <input
                type="text"
                placeholder="e.g. Prof. Raman - Physics Narration"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="inputTight"
              />
            </div>
          </div>

          {/* Step 1: Reference Audio */}
          <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9' }}>A. Reference Voice Recording (10-30s)</span>
              {refAudioBlob && <span style={{ fontSize: '12px', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px' }}><FaCheckCircle /> Ready</span>}
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>
              Speak clearly in your natural teaching tone with varied pitch and expression.
            </p>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {!isRecordingRef ? (
                <button
                  type="button"
                  onClick={() => startRecording('ref')}
                  style={{
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <FaMicrophone /> Record Mic
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  style={{
                    background: '#f97316',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    animation: 'pulse 1.5s infinite'
                  }}
                >
                  <FaStop /> Stop Recording ({formatSeconds(refRecordDuration)})
                </button>
              )}

              <button
                type="button"
                onClick={() => refFileInputRef.current?.click()}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#cbd5e1',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Upload File (.wav, .mp3)
              </button>
              <input
                type="file"
                ref={refFileInputRef}
                accept="audio/*"
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload(e, 'ref')}
              />
            </div>

            {refAudioUrl && (
              <div style={{ marginTop: '12px' }}>
                <audio controls src={refAudioUrl} style={{ width: '100%', height: '36px' }} />
              </div>
            )}
          </div>

          {/* Step 2: Consent Audio */}
          <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9' }}>B. Required Consent Recording</span>
              {consentAudioBlob && <span style={{ fontSize: '12px', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px' }}><FaCheckCircle /> Ready</span>}
            </div>

            <div style={{ background: '#090d16', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid #6366f1', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: '#818cf8', fontWeight: 'bold', marginBottom: '4px' }}>READ ALOUD INTO MIC:</div>
              <p style={{ fontSize: '12px', color: '#e2e8f0', fontStyle: 'italic', margin: 0 }}>
                &ldquo;I, {teacherName || 'Teacher'}, provide explicit consent to SkyMeet to replicate my voice using Google Gemini 3.8 Flash TTS for lesson narration.&rdquo;
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {!isRecordingConsent ? (
                <button
                  type="button"
                  onClick={() => startRecording('consent')}
                  style={{
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <FaMicrophone /> Record Consent
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  style={{
                    background: '#f97316',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    animation: 'pulse 1.5s infinite'
                  }}
                >
                  <FaStop /> Stop Recording ({formatSeconds(consentRecordDuration)})
                </button>
              )}

              <button
                type="button"
                onClick={() => consentFileInputRef.current?.click()}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#cbd5e1',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Upload File (.wav, .mp3)
              </button>
              <input
                type="file"
                ref={consentFileInputRef}
                accept="audio/*"
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload(e, 'consent')}
              />
            </div>

            {consentAudioUrl && (
              <div style={{ marginTop: '12px' }}>
                <audio controls src={consentAudioUrl} style={{ width: '100%', height: '36px' }} />
              </div>
            )}
          </div>

          {/* Consent Checkbox */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '12px', color: '#cbd5e1' }}>
            <input
              type="checkbox"
              checked={consentConfirmed}
              onChange={(e) => setConsentConfirmed(e.target.checked)}
              style={{ marginTop: '3px', accentColor: '#6366f1' }}
            />
            <span>
              I confirm that I am the genuine voice owner in these recordings and grant authorization to SkyMeet to store and use this replicated voice model for lesson narration.
            </span>
          </label>

          {createError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', padding: '10px 14px', color: '#fca5a5', fontSize: '13px' }}>
              ⚠️ {createError}
            </div>
          )}

          {createSuccess && (
            <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', borderRadius: '8px', padding: '10px 14px', color: '#86efac', fontSize: '13px' }}>
              ✅ {createSuccess}
            </div>
          )}

          <button
            type="button"
            onClick={handleCreateVoice}
            disabled={isReplicating || !refAudioBlob || !consentAudioBlob || !consentConfirmed}
            style={{
              background: isReplicating || !refAudioBlob || !consentAudioBlob || !consentConfirmed
                ? 'rgba(79, 70, 229, 0.5)'
                : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              color: '#fff',
              border: 'none',
              padding: '14px',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '14px',
              cursor: isReplicating || !refAudioBlob || !consentAudioBlob || !consentConfirmed ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)'
            }}
          >
            {isReplicating ? (
              <>
                <span style={{
                  width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff', borderRadius: '50%',
                  animation: 'spin 1s linear infinite', display: 'inline-block'
                }} />
                Replicating with Vertex AI Gemini 3.8 Flash...
              </>
            ) : (
              <>
                <MdRecordVoiceOver fontSize="18px" /> Replicate Voice with Gemini 3.8 Flash
              </>
            )}
          </button>
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: GENERATE LESSON SPEECH & MANAGE VOICES */}
        {/* ============================================================== */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <FaVolumeUp /> 2. Generate Lesson Narration
          </h3>

          {/* Voice Selector */}
          <div className="inputGroup">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="inputLabel" style={{ color: '#cbd5e1', margin: 0 }}>Select Replicated Voice</label>
              <button
                type="button"
                onClick={fetchVoices}
                style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <FaRedo /> Refresh
              </button>
            </div>

            <div className="inputWrapper">
              <select
                value={selectedVoiceId}
                onChange={(e) => setSelectedVoiceId(e.target.value)}
                className="inputTight"
              >
                <option value="" disabled>-- Select a Replicated Voice --</option>
                {voices.map((v) => (
                  <option key={v.voiceId} value={v.voiceId}>
                    {v.displayName || v.voiceId} ({v.voiceId.slice(0, 16)}...)
                  </option>
                ))}
              </select>
            </div>
            {voices.length === 0 && !loadingVoices && (
              <span style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                No replicated voices yet. Use the left panel to replicate your voice first.
              </span>
            )}
          </div>

          {/* Preset Buttons for Quick Lesson Narration */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setLessonText("Today's lesson covers recursive algorithms. Notice how each recursive call breaks down the complex problem into smaller identical sub-problems until reaching the base case.")}
              style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#cbd5e1', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
            >
              CS Lesson
            </button>
            <button
              type="button"
              onClick={() => setLessonText("In today's calculus lecture, we will examine derivatives from first principles, visualizing the instantaneous rate of change as the tangent slope to our curve.")}
              style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#cbd5e1', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
            >
              Math Lecture
            </button>
            <button
              type="button"
              onClick={() => setLessonText("Photosynthesis allows plants to transform light energy into chemical energy. Let us observe the light-dependent reactions taking place within the thylakoid membrane.")}
              style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#cbd5e1', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
            >
              Science Concept
            </button>
          </div>

          {/* Lesson Narration Text */}
          <div className="inputGroup">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="inputLabel" style={{ color: '#cbd5e1', margin: 0 }}>Lesson Script / Narration Text</label>
              <span style={{ fontSize: '11px', color: lessonText.length > 3500 ? '#f59e0b' : '#94a3b8' }}>
                {lessonText.length} chars {lessonText.length > 3500 ? '(auto-chunked)' : ''}
              </span>
            </div>
            <textarea
              rows={4}
              value={lessonText}
              onChange={(e) => setLessonText(e.target.value)}
              placeholder="Enter lecture explanation or narration script..."
              style={{
                width: '100%',
                background: '#0a0f1d',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '10px',
                fontSize: '13px',
                lineHeight: '1.5',
                resize: 'vertical',
                outline: 'none'
              }}
            />
          </div>

          {/* Controls: Language, Emotion, Intensity */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
            <div className="inputGroup">
              <label className="inputLabel" style={{ color: '#cbd5e1' }}>Language</label>
              <div className="inputWrapper">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="inputTight"
                >
                  <option value="tamil">Tamil (தமிழ்)</option>
                  <option value="malayalam">Malayalam (മലയാളം)</option>
                  <option value="hindi">Hindi (हिंदी)</option>
                  <option value="telugu">Telugu (తెలుగు)</option>
                  <option value="kannada">Kannada (ಕನ್ನಡ)</option>
                  <option value="english">English</option>
                </select>
              </div>
            </div>

            <div className="inputGroup">
              <label className="inputLabel" style={{ color: '#cbd5e1' }}>Emotion</label>
              <div className="inputWrapper">
                <select
                  value={emotion}
                  onChange={(e) => setEmotion(e.target.value)}
                  className="inputTight"
                >
                  <option value="confident">Confident</option>
                  <option value="warm">Warm</option>
                  <option value="excited">Excited</option>
                  <option value="encouraging">Encouraging</option>
                  <option value="calm">Calm</option>
                  <option value="serious">Serious</option>
                  <option value="storytelling">Storytelling</option>
                  <option value="playful">Playful</option>
                </select>
              </div>
            </div>

            <div className="inputGroup">
              <label className="inputLabel" style={{ color: '#cbd5e1' }}>Intensity</label>
              <div className="inputWrapper">
                <select
                  value={intensity}
                  onChange={(e) => setIntensity(e.target.value)}
                  className="inputTight"
                >
                  <option value="low">Subtle</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="inputGroup">
              <label className="inputLabel" style={{ color: '#cbd5e1' }}>Style</label>
              <div className="inputWrapper">
                <select
                  value={deliveryStyle}
                  onChange={(e) => setDeliveryStyle(e.target.value)}
                  className="inputTight"
                >
                  <option value="teacher">Teacher</option>
                  <option value="natural">Conversational</option>
                </select>
              </div>
            </div>
          </div>

          {speechError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', padding: '10px 14px', color: '#fca5a5', fontSize: '13px' }}>
              ⚠️ {speechError}
            </div>
          )}

          {speechSuccess && (
            <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', borderRadius: '8px', padding: '10px 14px', color: '#86efac', fontSize: '13px' }}>
              ✅ {speechSuccess}
            </div>
          )}

          {/* Generate Speech Button */}
          <button
            type="button"
            onClick={handleGenerateSpeech}
            disabled={isGeneratingSpeech || !selectedVoiceId || !lessonText.trim()}
            style={{
              background: isGeneratingSpeech || !selectedVoiceId || !lessonText.trim()
                ? 'rgba(99, 102, 241, 0.4)'
                : 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
              color: '#fff',
              border: 'none',
              padding: '14px',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '14px',
              cursor: isGeneratingSpeech || !selectedVoiceId || !lessonText.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
            }}
          >
            {isGeneratingSpeech ? (
              <>
                <span style={{
                  width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff', borderRadius: '50%',
                  animation: 'spin 1s linear infinite', display: 'inline-block'
                }} />
                Synthesizing with Gemini 3.8 Flash TTS...
              </>
            ) : (
              <>
                <BsSoundwave fontSize="18px" /> Generate Lesson Narration (Gemini 3.8 Flash TTS)
              </>
            )}
          </button>

          {/* Generated Audio Preview & Actions */}
          {generatedAudio && (
            <div style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FaVolumeUp /> Generated Lesson Audio
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Model: {generatedAudio.model || 'gemini-3.8-flash-tts'}
                </span>
              </div>

              <audio
                controls
                autoPlay
                src={`${BACKEND_URL}${generatedAudio.audioUrl}`}
                style={{ width: '100%', height: '40px' }}
              />

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <a
                  href={`${BACKEND_URL}${generatedAudio.audioUrl}`}
                  download={generatedAudio.filename || 'lesson_narration.mp3'}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: '#22c55e',
                    color: '#fff',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <FaDownload /> Download MP3
                </a>

                <button
                  type="button"
                  onClick={() => copyUrlToClipboard(generatedAudio.audioUrl)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#cbd5e1',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <MdContentCopy /> Copy Audio URL
                </button>

                <button
                  type="button"
                  onClick={() => handleSetActiveVoice(selectedVoiceId)}
                  style={{
                    background: 'rgba(99, 102, 241, 0.2)',
                    color: '#c7d2fe',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <BsCheck2Circle /> Set as Active Classroom Voice
                </button>
              </div>
            </div>
          )}

          {/* Voice Management Table / List */}
          {voices.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                My Replicated Voices ({voices.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {voices.map((v) => (
                  <div
                    key={v.voiceId}
                    style={{
                      background: v.voiceId === selectedVoiceId ? 'rgba(99, 102, 241, 0.15)' : 'rgba(30, 41, 59, 0.4)',
                      border: v.voiceId === selectedVoiceId ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '700', color: '#f1f5f9' }}>{v.displayName || 'Replicated Voice'}</div>
                      <div style={{ color: '#94a3b8', fontSize: '11px' }}>ID: {v.voiceId}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedVoiceId(v.voiceId)}
                        style={{
                          background: v.voiceId === selectedVoiceId ? '#4f46e5' : 'rgba(255,255,255,0.08)',
                          color: '#fff',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        Select
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetActiveVoice(v.voiceId)}
                        title="Set as classroom active voice"
                        style={{
                          background: activeVoice === v.voiceId ? '#16a34a' : 'rgba(255,255,255,0.08)',
                          color: '#fff',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        {activeVoice === v.voiceId ? 'Active' : 'Set Active'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteVoice(v.voiceId)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#ef4444',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                        title="Delete voice record"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
