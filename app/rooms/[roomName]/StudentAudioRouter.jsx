'use client';
import { useTracks, AudioTrack } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useEffect, useState } from 'react';

export default function StudentAudioRouter() {
    const tracks = useTracks([Track.Source.Microphone, Track.Source.Unknown]);
    const [preferredLanguage, setPreferredLanguage] = useState('en');

    useEffect(() => {
        const lang = localStorage.getItem('preferredLanguage') || 'en';
        setPreferredLanguage(lang);
    }, []);

    return (
        <div style={{ display: 'none' }}>
            {tracks.map((trackRef) => {
                const track = trackRef.publication.track;
                if (!track || track.kind !== 'audio') return null;

                // Identify if this is a teacher's translated audio track
                const isTeacherAudio = track.name && track.name.startsWith('audio_');
                
                if (isTeacherAudio) {
                    // Check if the preferred language track exists in the room
                    const hasPreferredLangTrack = tracks.some(t => t.publication.track?.name === `audio_${preferredLanguage}`);
                    const targetLang = hasPreferredLangTrack ? preferredLanguage : 'en';

                    if (track.name !== `audio_${targetLang}`) {
                        // Skip rendering this audio track because it's for a different language
                        return null;
                    }
                }

                // If it's a student's microphone or a track that doesn't match the "audio_" pattern, render it
                return <AudioTrack key={trackRef.publication.trackSid} trackRef={trackRef} />;
            })}
        </div>
    );
}
