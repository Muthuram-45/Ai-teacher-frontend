import { BACKEND_URL, PYTHON_BACKEND_URL } from './config';
import { sanitizeTextForTTS } from './aiTTSSanitizer';

// 🔌 Global trackers for stopping audio
let localContext = null;
let activeSource = null;    // Tracks current playing AudioBufferSourceNode
let stopRequested = false; // Flag to prevent subsequent chunks from starting

let audioCtx = null;
let currentSource = null;
let isPlaying = false;
let abortController = null;
let speechQueue = Promise.resolve();
let cachedActiveVoice = null;
let lastVoiceCheckTime = 0;
let queueEpoch = 0;

/**
 * Splits text into chunks ≤ maxLen chars, breaking at sentence boundaries.
 */
function splitIntoChunks(text, maxLen = 200) {
    const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
    const chunks = [];
    let current = "";

    for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (!trimmed) continue;

        if ((current + " " + trimmed).trim().length <= maxLen) {
            current = (current + " " + trimmed).trim();
        } else {
            if (current) chunks.push(current);
            // If a single sentence is still too long, hard-split it
            if (trimmed.length > maxLen) {
                for (let i = 0; i < trimmed.length; i += maxLen) {
                    chunks.push(trimmed.slice(i, i + maxLen));
                }
                current = "";
            } else {
                current = trimmed;
            }
        }
    }
    if (current) chunks.push(current);
    return chunks;
}


export async function speakText(text, options = {}) {
    if (!text) return;

    const preferredLanguage = options.forceLanguage || (typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('preferredLanguage')) : null) || 'auto';

    // 🌐 Automatically translate hardcoded UI text to target language before speaking
    let finalSpeechText = text;
    if (preferredLanguage && preferredLanguage !== 'en' && preferredLanguage !== 'auto' && !options.skipTranslation) {
        try {
            const res = await fetch(`${BACKEND_URL}/api/multilingual/translate-text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, targetLanguage: preferredLanguage })
            });
            const data = await res.json();
            if (data.translatedText) {
                finalSpeechText = data.translatedText;
            }
        } catch (e) {
            console.error('Auto-translation for TTS failed', e);
        }
    }

    const myEpoch = queueEpoch;

    // 🔊 FIFO Queue: chain this speak request after all previous ones
    // This ensures sequential playback — Student 1's response finishes
    // completely before Student 2's response begins.
    const speakJob = () => {
        if (myEpoch !== queueEpoch) {
            return Promise.resolve();
        }
        stopRequested = false; // Reset stop flag for this new speak request

        const { audioContext, destinationNode } = options;
        console.log(`🎙️ AI Voice Processing (queued): "${finalSpeechText.substring(0, 50)}${finalSpeechText.length > 50 ? '...' : ''}"`);

        return (async () => {
            if (options.startAt) {
                const waitMs = options.startAt - Date.now();
                if (waitMs > 0) {
                    console.log(`⏰ [Synchronized Playback] Waiting ${waitMs}ms until startAt (${new Date(options.startAt).toISOString()})...`);
                    await new Promise((r) => setTimeout(r, waitMs));
                }
            }
            const chunks = splitIntoChunks(finalSpeechText, 200);
            for (const chunk of chunks) {
                if (stopRequested) break;
                try {
                    await playRecordableChunk(chunk, audioContext, destinationNode, options);
                } catch (err) {
                    if (!stopRequested) {
                        console.warn("⚠️ Gemini 3.8 Flash TTS chunk playback error:", err);
                    }
                }
            }
        })();
    };

    // Chain onto the queue — waits for previous speech to finish first
    speechQueue = speechQueue.then(speakJob, speakJob);
    return speechQueue;
}

// 🔌 Global singleton for local playback (used by students who aren't recording)
function getLocalContext() {
    if (!localContext) {
        localContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return localContext;
}

export function initAudioContext() {
    const ctx = getLocalContext();
    if (ctx.state === 'suspended') {
        ctx.resume().catch(() => { });
    }
}

/**
 * 🔊 Plays a single chunk with zero-latency streaming (Most Reliable for Continuity)
 */
async function playRecordableChunk(text, audioContext, destinationNode, options = {}) {
    if (stopRequested) return;

    const ctx = audioContext || getLocalContext();
    if (ctx.state === 'suspended') await ctx.resume();

    try {
        console.log(`🔊 Playing response via Gemini 3.8 Flash TTS (Mohan)`);

        const preferredLanguage = options.forceLanguage || (typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('preferredLanguage')) : null) || 'auto';

        const ttsLang = preferredLanguage;
        const url = `${BACKEND_URL}/api/tts`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                lang: ttsLang,
                roomName: options.roomName,
                role: options.role,
                voiceId: 'voice_74080a81-5951-4b5f-972b-72b4064d116a'
            })
        });
        
        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Gemini 3.8 Flash TTS returned ${response.status}: ${errBody}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

        await new Promise((resolve) => {
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            if (audioContext && destinationNode) source.connect(destinationNode);
            source.connect(ctx.destination);
            source.onended = resolve;
            activeSource = source;
            source.start(0);
        });

    } catch (err) {
        console.error("❌ Gemini 3.8 Flash TTS playback failed:", err);
        throw err;
    }
}

export function stopSpeaking() {
    stopRequested = true; // Set flag to stop the loop
    queueEpoch++;

    // Reset the queue so pending speech jobs don't play after stop
    speechQueue = Promise.resolve();

    // 1. Stop Web Audio source if playing
    if (activeSource) {
        try {
            activeSource.stop();
            console.log("⏹ Active AI Audio Source stopped");
        } catch (e) {
            console.warn("⚠️ Error stopping audio source:", e);
        }
        activeSource = null;
    }
}

/**
 * 🔊 Plays hand-raise notification audio tailored to the receiver's preferred language
 */
let lastHandRaiseAudioStudent = null;
let lastHandRaiseAudioTime = 0;

export async function playHandRaiseAudioForStudent(studentName, options = {}) {
    const now = Date.now();
    if (lastHandRaiseAudioStudent === studentName && (now - lastHandRaiseAudioTime) < 3000) {
        console.log(`[HAND RAISE AUDIO] Skipping duplicate playback for ${studentName} within 3s`);
        return;
    }
    lastHandRaiseAudioStudent = studentName;
    lastHandRaiseAudioTime = now;

    const preferredLanguage = typeof window !== 'undefined'
        ? (new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('preferredLanguage') || 'en')
        : 'en';

    console.log(`[HAND RAISE AUDIO REQUEST] Student: ${studentName}, Receiver Lang: ${preferredLanguage}`);

    try {
        const res = await fetch(`${BACKEND_URL}/api/multilingual/hand-raise-audio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentName: studentName || 'Student',
                lang: preferredLanguage
            })
        });

        if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            const ctx = options.audioContext || getLocalContext();
            if (ctx.state === 'suspended') await ctx.resume();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

            await new Promise((resolve) => {
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                if (options.destinationNode) source.connect(options.destinationNode);
                source.connect(ctx.destination);
                source.onended = resolve;
                activeSource = source;
                source.start(0);
            });
            console.log(`[HAND RAISE AUDIO] Successfully played ${preferredLanguage} audio for ${studentName}`);
            return;
        }
    } catch (e) {
        console.warn(`⚠️ [HAND RAISE AUDIO] Custom fetch failed for ${preferredLanguage}, using speakText fallback:`, e);
    }

    const promptMap = {
        'ta': `${studentName}, உங்களுக்கு ஏதாவது doubt இருக்கா? அப்படி இருந்தா Ask Doubt button click பண்ணி உங்க doubt கேளுங்க.`,
        'ml': `${studentName}, നിങ്ങൾക്ക് എന്തെങ്കിലും doubt ഉണ്ടോ? ഉണ്ടെങ്കിൽ Ask Doubt button ക്ലിക്ക് ചെയ്ത് നിങ്ങളുടെ doubt ചോദിക്കുക.`,
        'hi': `${studentName}, क्या आपका कोई doubt है? अगर है तो Ask Doubt button पर click करके अपना doubt पूछें.`,
        'te': `${studentName}, మీకు ఏదైనా doubt ఉందా? ఉంటే Ask Doubt button పై click చేసి మీ doubt అడగండి.`,
        'kn': `${studentName}, ನಿಮಗೆ ಯಾವುದಾದರೂ doubt ಇದೆಯಾ? ಇದ್ದರೆ Ask Doubt button ಕ್ಲಿಕ್ ಮಾಡಿ ನಿಮ್ಮ doubt ಕೇಳಿ.`,
        'en': `${studentName}, do you have any doubt? If so, click the Ask Doubt button and ask your doubt.`
    };
    const text = promptMap[preferredLanguage] || promptMap['en'];
    return speakText(text, { ...options, skipTranslation: true });
}
