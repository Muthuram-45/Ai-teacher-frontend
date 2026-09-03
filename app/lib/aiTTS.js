import { BACKEND_URL, PYTHON_BACKEND_URL } from './config';

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

    const preferredLanguage = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('preferredLanguage') || 'en') : 'en';

    // 🌐 Automatically translate hardcoded UI text to the user's preferred language before speaking
    let finalSpeechText = text;
    if (preferredLanguage !== 'en' && !options.skipTranslation) {
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
            const chunks = splitIntoChunks(finalSpeechText, 200);
            for (const chunk of chunks) {
                if (stopRequested) break;
                try {
                    await playRecordableChunk(chunk, audioContext, destinationNode, options);
                } catch (err) {
                    if (!stopRequested) {
                        console.warn("⚠️ Text playback failed, falling back to browser synthesis:", err);
                        await fallbackToBrowserTTS(chunk, options).catch(() => { });
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

    // Also unlock browser's native speech synthesis (required for fallback on Safari/iOS/Chrome)
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        const unlockUtterance = new SpeechSynthesisUtterance(" ");
        unlockUtterance.volume = 0; // silent
        window.speechSynthesis.speak(unlockUtterance);
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
        console.log(`🔊 Playing full response via Google Cloud TTS`);

        const preferredLanguage = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('preferredLanguage') || 'en') : 'en';

        const ttsLang = preferredLanguage;
        const url = `${BACKEND_URL}/api/tts`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, lang: ttsLang })
        });
        
        if (!response.ok) {
            throw new Error(`Google Cloud TTS failed with status ${response.status}`);
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
        console.error("❌ Google Cloud TTS failed completely:", err);
    }
}

/**
 * Consolidate browser TTS into a reliable function
 */
function fallbackToBrowserTTS(text, options = {}) {
    return new Promise((resolve) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return resolve();

        const preferredLanguage = options.forceLanguage || new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('preferredLanguage') || 'en';

        // Cancel any existing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = preferredLanguage; // Help browser pick the right voice automatically

        // Find specific voice based on preferredLanguage
        const voices = window.speechSynthesis.getVoices();
        
        let targetVoice = null;
        if (preferredLanguage === 'hi') {
            targetVoice = voices.find(v => v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi'));
        } else if (preferredLanguage === 'ml') {
            targetVoice = voices.find(v => v.lang.startsWith('ml') || v.name.toLowerCase().includes('malayalam'));
        } else {
            // Default English/Indian English fallback (Also used for Thanglish since it's Latin script)
            targetVoice = voices.find(v =>
                v.name.toLowerCase().includes('india') ||
                v.lang.includes('en-IN') ||
                v.name.toLowerCase().includes('heera') ||
                v.name.toLowerCase().includes('ravi')
            );
        }

        if (targetVoice) {
            utterance.voice = targetVoice;
            utterance.rate = 0.95;
            utterance.pitch = 1.0;
        }

        utterance.onend = () => {
            console.log("✅ Browser TTS finished");
            resolve();
        };
        utterance.onerror = (e) => {
            console.error("❌ Browser TTS Error:", e);
            resolve();
        };

        window.speechSynthesis.speak(utterance);
    });
}


// Pre-fetch voices for browser TTS
if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
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

    // 2. Stop Browser TTS
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        console.log("⏹ Browser Synthesis cancelled");
    }
}
