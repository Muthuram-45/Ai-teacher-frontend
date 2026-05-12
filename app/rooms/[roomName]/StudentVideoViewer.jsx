'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRoomContext, useRemoteParticipants, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';

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
export default function StudentVideoPanel() {
    const room = useRoomContext();
    const remoteParticipants = useRemoteParticipants();

    const videoRef = useRef(null);
    const containerRef = useRef(null);

    const [teacherParticipant, setTeacherParticipant] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showTeacherVideo, setShowTeacherVideo] = useState(false);
    const [videoTrack, setVideoTrack] = useState(null);
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
            setVideoTrack(null);
            setShowTeacherVideo(false);
            return;
        }

        const handleTrackSubscribed = (track) => {
            if (track.kind === Track.Kind.Video) {
                console.log('🎥 Teacher video track subscribed');
                setVideoTrack(track);
                setShowTeacherVideo(true);
            }
        };

        const handleTrackUnsubscribed = (track) => {
            if (track.kind === Track.Kind.Video) {
                console.log('❌ Teacher video track unsubscribed');
                setVideoTrack(null);
                setShowTeacherVideo(false);
            }
        };

        teacherParticipant.on('trackSubscribed', handleTrackSubscribed);
        teacherParticipant.on('trackUnsubscribed', handleTrackUnsubscribed);

        // Check for existing tracks (important for late joins)
        teacherParticipant.videoTrackPublications.forEach((pub) => {
            if (pub.isSubscribed && pub.track) {
                handleTrackSubscribed(pub.track);
            }
        });

        return () => {
            teacherParticipant.off('trackSubscribed', handleTrackSubscribed);
            teacherParticipant.off('trackUnsubscribed', handleTrackUnsubscribed);
        };
    }, [teacherParticipant]);

    /* ---------------- ATTACH VIDEO TRACK ---------------- */
    useEffect(() => {
        const videoEl = videoRef.current;
        if (!videoEl || !videoTrack) return;

        console.log('🔗 Attaching teacher video track to element');
        videoTrack.attach(videoEl);

        return () => {
            console.log('🔓 Detaching teacher video track');
            videoTrack.detach(videoEl);
        };
    }, [videoTrack, showTeacherVideo]); // Re-run when videoTrack or showTeacherVideo changes

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

                // 🛑 Teacher cancelled/closed the video — hide the viewer on student side
                if (msg.action === 'VIDEO_STOP') {
                    setShowTeacherVideo(false);
                    setVideoTrack(null);
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

    // const formatTime = s => {
    //     if (!isFinite(s)) return '0:00';
    //     const m = Math.floor(s / 60);
    //     const sec = Math.floor(s % 60);
    //     return `${m}:${sec.toString().padStart(2, '0')}`;
    // };

    if (!showTeacherVideo) {
        return null; // Don't show anything (PageClientImpl handles empty state)
    }

    return (
        <div
            ref={containerRef}
            onContextMenu={isStudent ? (e) => e.preventDefault() : undefined}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '90vh',
                background: 'transparent',
                // zIndex: 1, // Slightly above base background
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
                muted
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

            {/* ⏱ Time overlay (Bottom Left, above control bar) */}
            {/* <div style={{
                position: 'absolute',
                bottom: 4,
                left: 20,
                color: '#fff',
                padding: '6px 12px',
                fontFamily: 'monospace',
                background: 'rgba(0,0,0,0.5)',
                borderRadius: 4,
                zIndex: 10,
            }}>
                {formatTime(currentTime)} / {formatTime(duration)}
            </div> */}
        </div>
    );
}
