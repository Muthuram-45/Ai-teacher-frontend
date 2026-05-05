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

    stopRequested = false; // Reset stop flag on new speak request

    const { audioContext, destinationNode } = options;
    console.log(`🎙️ AI Voice Processing: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

    try {
        // Use AudioBuffer approach for reliable recording injection (Full text in one go)
        await playRecordableChunk(text, audioContext, destinationNode);
    } catch (err) {
        if (!stopRequested) {
            console.warn("⚠️ Text playback failed, falling back to browser synthesis:", err);
            await fallbackToBrowserTTS(text).catch(() => { });
        }
    }
}

// 🔌 Global singleton for local playback (used by students who aren't recording)
function getLocalContext() {
    if (!localContext) {
        localContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return localContext;
}

/**
 * 🔊 Plays a single chunk with zero-latency streaming (Most Reliable for Continuity)
 */
async function playRecordableChunk(text, audioContext, destinationNode) {
    if (stopRequested) return;

    const ctx = audioContext || getLocalContext();
    if (ctx.state === 'suspended') await ctx.resume();

    try {
        console.log("🚀 Starting Streamed Synthesis...");
        const response = await fetch(`${PYTHON_BACKEND_URL}/synthesize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });

        if (!response.ok) throw new Error("Synthesis failed");

        const reader = response.body.getReader();
        let nextStartTime = ctx.currentTime + 0.1; // Small buffer to start

        // Internal PCM buffer
        let leftover = new Uint8Array(0);

        while (true) {
            if (stopRequested) {
                reader.cancel();
                break;
            }

            const { done, value } = await reader.read();
            if (done) break;

            // Combine with leftovers from previous read
            const combined = new Uint8Array(leftover.length + value.length);
            combined.set(leftover);
            combined.set(value, leftover.length);

            // We need 16-bit PCM (2 bytes per sample)
            const numSamples = Math.floor(combined.length / 2);
            const pcmData = new Int16Array(combined.buffer, 0, numSamples);

            // Save any trailing odd byte
            leftover = combined.slice(numSamples * 2);

            if (pcmData.length === 0) continue;

            // Convert to Float32
            const floatData = new Float32Array(pcmData.length);
            for (let i = 0; i < pcmData.length; i++) {
                floatData[i] = pcmData[i] / 32768.0;
            }

            // Create and play buffer immediately
            const audioBuffer = ctx.createBuffer(1, floatData.length, 24000);
            audioBuffer.getChannelData(0).set(floatData);

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            activeSource = source;

            if (audioContext && destinationNode) {
                source.connect(destinationNode);
            }
            source.connect(ctx.destination);

            // Schedule precision timing for gapless playback
            const startTime = Math.max(ctx.currentTime, nextStartTime);
            source.start(startTime);
            nextStartTime = startTime + audioBuffer.duration;
        }

        console.log("✅ Streaming finished");
    } catch (err) {
        console.warn("⚠️ Streaming failed, falling back to Google TTS:", err);

        // Split text into sentence chunks ≤200 chars so Google TTS doesn't truncate
        const chunks = splitIntoChunks(text, 200);
        console.log(`🔊 Google TTS fallback: speaking ${chunks.length} chunk(s)`);

        for (const chunk of chunks) {
            if (stopRequested) break;
            try {
                const url = `${BACKEND_URL}/api/tts?text=${encodeURIComponent(chunk)}`;
                const response = await fetch(url);
                if (!response.ok) continue;
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
            } catch (chunkErr) {
                console.warn("⚠️ Chunk TTS failed:", chunkErr);
            }
        }
    }
}

/**
 * Consolidate browser TTS into a reliable function
 */
function fallbackToBrowserTTS(text) {
    return new Promise((resolve) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return resolve();

        // Cancel any existing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // Find Indian Voice (Preferring Tamil-English)
        const voices = window.speechSynthesis.getVoices();
        const indianVoice = voices.find(v =>
            v.name.toLowerCase().includes('tamil') ||
            v.name.toLowerCase().includes('india') ||
            v.lang.includes('en-IN') ||
            v.name.toLowerCase().includes('heera') ||
            v.name.toLowerCase().includes('ravi')
        );

        if (indianVoice) {
            utterance.voice = indianVoice;
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
