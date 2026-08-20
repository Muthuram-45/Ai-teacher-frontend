'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRoomContext, useRemoteParticipants, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { SUPPORTED_LANGUAGES } from '@/app/lib/config';

/* ---- Mini thumbnail that attaches a participant's video track ---- */
function ParticipantThumb({ participant, label }) {
    const thumbRef = useRef(null);

    useEffect(() => {
        const attach = () => {
            participant.videoTrackPublications.forEach((pub) => {
                if (pub.isSubscribed && pub.track && thumbRef.current) {
                    pub.track.attach(thumbRef.current);
                }
            });
        };
        attach();
        participant.on('trackSubscribed', attach);
        return () => participant.off('trackSubscribed', attach);
    }, [participant]);

    return (
        <div style={{
            borderRadius: 10,
            overflow: 'hidden',
            background: '#1a1a2e',
            border: '1px solid rgba(255,255,255,0.12)',
            aspectRatio: '16/9',
            position: 'relative',
            flexShrink: 0,
        }}>
            <video
                ref={thumbRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                padding: '4px 8px',
                fontSize: '0.7rem', color: '#fff',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
                {label}
            </div>
        </div>
    );
}

export default function StudentVideoPanel({ isEmbedded = false }) {
    const room = useRoomContext();
    const remoteParticipants = useRemoteParticipants();

    const videoRef = useRef(null);
    const audioRef = useRef(null);
    const containerRef = useRef(null);

    const [teacherParticipant, setTeacherParticipant] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showTeacherVideo, setShowTeacherVideo] = useState(false);
    
    // Multi-lingual tracks
    const [selectedLang, setSelectedLang] = useState(() => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('lang') || localStorage.getItem('preferredLanguage') || 'en';
        }
        return 'en';
    });

    const [videoTracks, setVideoTracks] = useState({});
    const [audioTracks, setAudioTracks] = useState({});

    const { localParticipant } = useLocalParticipant();

    let role = '';
    try {
        role = localParticipant?.metadata
            ? JSON.parse(localParticipant.metadata).role
            : '';
    } catch {
        role = localParticipant?.metadata || '';
    }
    const isStudent = role === 'student';


    /* ---------------- FIND TEACHER ---------------- */
    useEffect(() => {
        const teacher = remoteParticipants.find(p => {
            try {
                return JSON.parse(p.metadata || '{}').role === 'teacher';
            } catch {
                return false;
            }
        });

        setTeacherParticipant(teacher || null);
    }, [remoteParticipants]);

    /* ---------------- MANAGE TRACK SUBSCRIPTION ---------------- */
    useEffect(() => {
        if (!teacherParticipant) {
            setVideoTracks({});
            setAudioTracks({});
            setShowTeacherVideo(false);
            return;
        }

        const handleTrackSubscribed = (track, pub) => {
            const trackName = pub?.trackName || track?.name || '';
            console.log('👀 Track subscribed on student:', track.kind, trackName);
            if (track.kind === Track.Kind.Video && trackName.startsWith('class-video-')) {
                const lang = trackName.split('-')[2];
                setVideoTracks(prev => ({ ...prev, [lang]: track }));
                setShowTeacherVideo(true);
            }
            if (track.kind === Track.Kind.Audio && trackName.startsWith('class-audio-')) {
                const lang = trackName.split('-')[2];
                setAudioTracks(prev => ({ ...prev, [lang]: track }));
            }
        };

        const handleTrackUnsubscribed = (track, pub) => {
            const trackName = pub?.trackName || track?.name || '';
            if (track.kind === Track.Kind.Video && trackName.startsWith('class-video-')) {
                const lang = trackName.split('-')[2];
                setVideoTracks(prev => {
                    const newMap = { ...prev };
                    delete newMap[lang];
                    if (Object.keys(newMap).length === 0) setShowTeacherVideo(false);
                    return newMap;
                });
            }
            if (track.kind === Track.Kind.Audio && trackName.startsWith('class-audio-')) {
                const lang = trackName.split('-')[2];
                setAudioTracks(prev => {
                    const newMap = { ...prev };
                    delete newMap[lang];
                    return newMap;
                });
            }
        };

        teacherParticipant.on('trackSubscribed', handleTrackSubscribed);
        teacherParticipant.on('trackUnsubscribed', handleTrackUnsubscribed);

        // Check for existing tracks (important for late joins)
        teacherParticipant.videoTrackPublications.forEach((pub) => {
            if (pub.isSubscribed && pub.track) {
                handleTrackSubscribed(pub.track, pub);
            }
        });
        teacherParticipant.audioTrackPublications.forEach((pub) => {
            if (pub.isSubscribed && pub.track) {
                handleTrackSubscribed(pub.track, pub);
            }
        });

        return () => {
            teacherParticipant.off('trackSubscribed', handleTrackSubscribed);
            teacherParticipant.off('trackUnsubscribed', handleTrackUnsubscribed);
        };
    }, [teacherParticipant]);

    /* ---------------- ATTACH VIDEO & AUDIO TRACK ---------------- */
    useEffect(() => {
        const videoEl = videoRef.current;
        const audioEl = audioRef.current;
        if (!showTeacherVideo) return;

        // Fallback to English if selected lang doesn't exist yet, else take first available
        const currentVideoTrack = videoTracks[selectedLang] || videoTracks['en'] || Object.values(videoTracks)[0];
        const currentAudioTrack = audioTracks[selectedLang] || audioTracks['en'] || Object.values(audioTracks)[0];

        // MUTE ALL AUDIO TRACKS (LiveKit auto-plays them, so we must silence the inactive ones)
        Object.values(audioTracks).forEach(track => {
            if (track && track.setVolume) {
                track.setVolume(0);
            }
            if (track && track.attachedElements) {
                track.attachedElements.forEach(el => {
                    el.muted = true;
                    el.volume = 0;
                });
            }
        });

        if (videoEl && currentVideoTrack) {
            currentVideoTrack.attach(videoEl);
        }
        if (audioEl && currentAudioTrack) {
            // UNMUTE THE SELECTED AUDIO TRACK
            if (currentAudioTrack.setVolume) {
                currentAudioTrack.setVolume(1);
            }
            if (currentAudioTrack.attachedElements) {
                currentAudioTrack.attachedElements.forEach(el => {
                    el.muted = false;
                    el.volume = 1;
                });
            }
            currentAudioTrack.attach(audioEl);
            audioEl.muted = false;
            audioEl.volume = 1;
        }

        return () => {
            if (videoEl && currentVideoTrack) currentVideoTrack.detach(videoEl);
            if (audioEl && currentAudioTrack) currentAudioTrack.detach(audioEl);
        };
    }, [videoTracks, audioTracks, selectedLang, showTeacherVideo]);

    /* ---------------- TIME UPDATE ---------------- */
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const update = () => {
            setCurrentTime(video.currentTime);
            setDuration(video.duration || 0);
        };

        video.addEventListener('timeupdate', update);
        return () => video.removeEventListener('timeupdate', update);
    }, []);

    /* ---------------- LIVEKIT SIGNALS ---------------- */
    useEffect(() => {
        if (!room) return;

        const handleData = payload => {
            try {
                const msg = JSON.parse(new TextDecoder().decode(payload));
                const video = videoRef.current;

                if (msg.action === 'VIDEO_START' || msg.action === 'VIDEO_RESUME') {
                    setShowTeacherVideo(true);
                }

                if (msg.action === 'VIDEO_STOP') {
                    setShowTeacherVideo(false);
                    setVideoTracks({});
                    setAudioTracks({});
                }

                if (!video) return;

                if (msg.action === 'VIDEO_TIME_UPDATE') {
                    const drift = Math.abs(video.currentTime - msg.currentTime);
                    if (drift > 0.5) {
                        video.currentTime = msg.currentTime;
                    }
                    if (isFinite(msg.duration)) setDuration(msg.duration);
                }

                if (msg.action === 'VIDEO_PAUSE') {
                    if (typeof msg.currentTime === 'number') {
                        video.currentTime = msg.currentTime;
                    }
                    video.pause();
                }

                if (msg.action === 'VIDEO_RESUME') {
                    if (typeof msg.currentTime === 'number') {
                        video.currentTime = msg.currentTime;
                    }
                    video.play().catch(() => { });
                }
            } catch { }
        };

        room.on('dataReceived', handleData);
        return () => room.off('dataReceived', handleData);
    }, [room]);

    /* ---------------- FULLSCREEN ---------------- */
    useEffect(() => {
        const fs = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', fs);
        return () => document.removeEventListener('fullscreenchange', fs);
    }, []);

    const toggleFullscreen = () => {
        if (!containerRef.current) return;

        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(() => { });
        } else {
            document.exitFullscreen();
        }
    };

    const handleLanguageChange = (e) => {
        const newLang = e.target.value;
        setSelectedLang(newLang);
        if (typeof window !== 'undefined') {
            localStorage.setItem('preferredLanguage', newLang);
        }
    };

    if (!showTeacherVideo) {
        return null; // Don't show anything (PageClientImpl handles empty state)
    }

    return (
        <div
            ref={containerRef}
            onContextMenu={isStudent ? (e) => e.preventDefault() : undefined}
            style={isEmbedded ? {
                width: '100%',
                height: '100%',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative',
                zIndex: 1
            } : {
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '90vh',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                zIndex: 1
            }}
        >
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted // Mute the video element because audio is played via a separate WebRTC track
                controlsList={isStudent ? "nodownload" : undefined}
                disablePictureInPicture={isStudent}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    background: '#000'
                }}
                onLoadedMetadata={() => console.log('🎬 Video metadata loaded')}
            />
            <audio ref={audioRef} autoPlay playsInline />
        </div>
    );
}
