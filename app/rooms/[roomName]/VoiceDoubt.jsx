'use client';
import { useEffect, useState, useRef } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';

export default function VoiceDoubt() {
    const room = useRoomContext();
    const { localParticipant } = useLocalParticipant();
    const [transcript, setTranscript] = useState('');
    const recognitionRef = useRef(null);
    const [isRecording, setIsRecording] = useState(false);
    const intentSentRef = useRef(false); // Track if greeting intent was sent
    const transcriptRef = useRef(''); // Ref for faster, more reliable updates

    useEffect(() => {
        // Check if browser supports SpeechRecognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('Speech Recognition not supported in this browser.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN'; // Optimized for Indian English accents

        recognition.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    transcriptRef.current += event.results[i][0].transcript + ' ';
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            const currentTranscript = (transcriptRef.current + interimTranscript).trim();
            setTranscript(currentTranscript);

            // Detect Greeting Intent (Ref prevents duplicate signals)
            if (!intentSentRef.current) {
                let segmentFinal = false;
                let segmentText = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    segmentText += event.results[i][0].transcript.toLowerCase();
                    if (event.results[i].isFinal) segmentFinal = true;
                }

                const keywords = ['hi', 'hello', 'hey', 'sir', 'mam', "ma'am", 'doubt', 'question', 'teacher', 'i have a', 'one doubt'];
                const found = keywords.some(k => segmentText.includes(k));

                if (found && segmentFinal) {
                    intentSentRef.current = true;
                    console.log('🗣️ Greeting finalized, signaling teacher and responding...');

                    localParticipant.publishData(
                        new TextEncoder().encode(
                            JSON.stringify({
                                action: 'VOICE_DOUBT_INTENT',
                                name: localParticipant.identity,
                            })
                        ),
                        { reliable: true }
                    );
                }
            }
        };

        recognition.onerror = (event) => {
            if (event.error === 'no-speech') {
                return; // Ignore "no-speech" as it's common and handled by onend
            }
            console.error('Speech Recognition Error:', event.error);
        };

        recognition.onend = () => {
            if (isRecording) {
                recognition.start();
            }
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    // Monitor microphone state
    useEffect(() => {
        if (!localParticipant || !recognitionRef.current) return;

        const handleTrackSubscribed = () => {
            const isMicOn = localParticipant.isMicrophoneEnabled;

            if (isMicOn && !isRecording) {
                setIsRecording(true);
                intentSentRef.current = false; // Reset for new session
                setTranscript('');
                transcriptRef.current = '';

                // Notify teacher that a voice doubt is starting
                localParticipant.publishData(
                    new TextEncoder().encode(
                        JSON.stringify({
                            action: 'VOICE_DOUBT_START',
                            name: localParticipant.identity,
                        })
                    ),
                    { reliable: true }
                );

                try {
                    recognitionRef.current.start();
                } catch (e) { console.error(e); }
            } else if (!isMicOn && isRecording) {
                // Publish end event for UI indicators
                localParticipant.publishData(
                    new TextEncoder().encode(
                        JSON.stringify({
                            action: 'VOICE_DOUBT_END',
                            name: localParticipant.identity,
                        })
                    ),
                    { reliable: true }
                );
                setIsRecording(false);
                recognitionRef.current.stop();

                // ⏳ Wait 500ms for SpeechRecognition to finalize the last sentence
                setTimeout(() => {
                    handleExtraction(transcriptRef.current || transcript);
                }, 500);
            }
        };

        // LiveKit events for track changes
        localParticipant.on('trackMuted', handleTrackSubscribed);
        localParticipant.on('trackUnmuted', handleTrackSubscribed);

        return () => {
            localParticipant.off('trackMuted', handleTrackSubscribed);
            localParticipant.off('trackUnmuted', handleTrackSubscribed);
        };
    }, [localParticipant, isRecording, transcript]);

    const handleExtraction = async (fullTranscript) => {
        if (!fullTranscript.trim()) return;

        console.log('🎤 Finished recording. Transcript:', fullTranscript);

        try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
            const res = await fetch(`${backendUrl}/extract-question`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: fullTranscript }),
            });

            const data = await res.json();
            const extracted = data.extractedQuestion;

            if (extracted && extracted.trim() && extracted.trim().toUpperCase() !== '<NONE>') {
                console.log('🤖 Extracted Question:', extracted);

                // Extra check: ignore if AI returned meta-talk or filler
                const cleanExtracted = extracted.replace(/[?.!]/g, '').trim().toLowerCase();
                const blacklistedPatterns = [
                    /^i (have|got) (a|one|some) (doubt|question)s?$/i,
                    /^i (have|got) one more (doubt|question)$/i,
                    /^can you hear me$/i,
                    /^hi (ma'am|sir|teacher)$/i,
                    /^one (more )?(doubt|question) please$/i,
                    /^wait a (second|moment)$/i
                ];

                const isBlacklisted = blacklistedPatterns.some(pattern => pattern.test(cleanExtracted));

                if (isBlacklisted || cleanExtracted.length < 5) {
                    console.log('🚫 Ignoring meta-talk or too short question:', extracted);
                    return;
                }

                // Publish as STUDENT_DOUBT
                localParticipant.publishData(
                    new TextEncoder().encode(
                        JSON.stringify({
                            action: 'STUDENT_DOUBT',
                            id: Date.now() + '-' + Math.random().toString(36).substring(7),
                            text: extracted.trim(),
                            name: localParticipant.identity,
                            voiceGenerated: true // Mark for identification
                        })
                    ),
                    { reliable: true }
                );

                // 🌟 Encourage Student (Voice) with 2-second delay
                (async () => {
                    try {
                        const encourageRes = await fetch(`${backendUrl}/encourage-student`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                name: localParticipant.identity,
                                question: extracted.trim()
                            }),
                        });
                        const encourageData = await encourageRes.json();
                        if (encourageData.encouragement) {
                            const { speakText } = await import('@/app/lib/aiTTS');
                            setTimeout(() => {
                                speakText(encourageData.encouragement).catch(err => console.error('Encourage TTS error:', err));
                            }, 2000); // 2-second deliberate pause
                        }
                    } catch (err) {
                        console.error('Encouragement failed:', err);
                    }
                })();
            }
        } catch (err) {
            console.error('Extraction failed:', err);
        }
    };

    return null; // This is a logic-only component
}
