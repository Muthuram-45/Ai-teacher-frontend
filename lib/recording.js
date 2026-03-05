let mediaRecorder = null;
let recordedChunks = [];
let partNumber = 1;
let currentRoomName = null;
let currentClassName = null;
let currentSessionId = null; // Unique ID for each recording session
let currentTranscribe = false; // Whether transcription is requested for this session

let isManualStop = false;

export function startClassRecording(combinedStream, roomName, className, isRestart = false, transcribe = false) {
    if (mediaRecorder) {
        console.warn('⚠️ MediaRecorder already exists, ignoring start request');
        return;
    }

    // Reset part number & Session ID only on a fresh start
    if (!isRestart) {
        partNumber = 1;
        currentSessionId = Date.now(); // 🕒 Generate unique timestamp
        currentTranscribe = transcribe;
    }

    console.log(`📼 startClassRecording called for room: ${roomName}, class: ${className} (Part ${partNumber}, Session ${currentSessionId})`);
    currentRoomName = roomName;
    currentClassName = className;
    recordedChunks = [];
    isManualStop = false; // Reset flag

    try {
        console.log('🎥 Creating MediaRecorder with stream tracks:', combinedStream.getTracks().length);

        // SWITCH to VP8 for better stability and compatibility
        let options = {
            mimeType: "video/webm; codecs=vp8,opus",
            bitsPerSecond: 3000000 // 3 Mbps for better quality
        };

        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            console.warn(`${options.mimeType} is not Supported, trying default video/webm`);
            options = { mimeType: "video/webm", bitsPerSecond: 3000000 };
        }

        mediaRecorder = new MediaRecorder(combinedStream, options);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                console.log('📦 Chunk received size:', event.data.size);
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            console.log('⏹ Recorder stopped. chunks:', recordedChunks.length);
            const streamToRestart = combinedStream;
            const chunksToUpload = [...recordedChunks]; // Copy for upload
            const currentPart = partNumber; // Capture current part number

            mediaRecorder = null;
            recordedChunks = []; // Clear global buffer immediately

            // 🔄 Restart IMMEDIATELY if it was an auto-split (not manual)
            // Note: Auto-split is now removed, but keeping logic structure for manual restart if ever needed
            if (!isManualStop) {
                console.log('🔄 Auto-split/Restart: Restarting recording immediately...');
                partNumber++;
                startClassRecording(streamToRestart, currentRoomName, currentClassName, true);
            }

            // 📤 Upload in background
            uploadChunks(chunksToUpload, currentRoomName, currentClassName, currentPart, isManualStop);
        };
        mediaRecorder.onerror = (e) => {
            console.error('❌ MediaRecorder Error:', e);
            alert(`Failed to start recording: ${e.message}`);
        };

        mediaRecorder.start();

        console.log("✅ Recording started successfully");

    } catch (e) {
        console.error('❌ Failed to create MediaRecorder:', e);
        alert(`Failed to start recording: ${e.message}`);
    }
}

export function pauseClassRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.pause();
        console.log("⏸ Recording paused");
    }
}

export function resumeClassRecording() {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
        mediaRecorder.resume();
        console.log("▶ Recording resumed");
    }
}

let currentChatData = null; // Store chat history for final summary

async function uploadChunks(chunks, roomName, className, partNum, isFinal = false) {
    if (chunks.length === 0) {
        console.warn('⚠️ No chunks to upload.');
        return;
    }

    const blob = new Blob(chunks, { type: "video/webm" });

    // 🛡️ Prevent empty/tiny files (under 1KB)
    if (blob.size < 1000) {
        console.warn(`⚠️ Recording too small (${blob.size} bytes). Discarding.`);
        return;
    }

    const formData = new FormData();
    formData.append("roomName", roomName);
    formData.append("className", className || roomName);
    formData.append("partNumber", partNum);
    formData.append("sessionId", currentSessionId);
    formData.append("transcribe", currentTranscribe);
    formData.append("isFinal", isFinal);
    formData.append("video", blob);

    // 💬 Include chat history for final summary
    if (isFinal && currentChatData) {
        formData.append("chatHistory", currentChatData);
        currentChatData = null; // Reset after sending
    }

    console.log(`📤 Uploading Part ${partNum} (${(blob.size / 1024 / 1024).toFixed(2)} MB) for class ${className}...`);

    try {
        const response = await fetch("http://localhost:3001/api/upload", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status} ${response.statusText}`);
        }

        console.log(`✅ Uploaded Part ${partNum} Successfully`);
    } catch (e) {
        console.error(`❌ Upload failed for Part ${partNum}:`, e);
        if (e.name === 'QuotaExceededError') {
            alert("Upload Failed: Browser storage quota exceeded.");
        } else {
            alert(`Upload Failed: ${e.message}`);
        }
    }
}

export function stopClassRecording(chatData = null) {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

    isManualStop = true;
    currentChatData = chatData; // Capture chat for final upload

    if (mediaRecorder.state === "recording" || mediaRecorder.state === "paused") {
        mediaRecorder.stop();
    }
}
