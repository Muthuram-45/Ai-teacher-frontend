"use client";
import { useEffect, useState, useRef } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { BACKEND_URL } from "../../lib/config";

export default function VoiceDoubt() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const intentSentRef = useRef(false);
  const transcriptRef = useRef("");

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported");
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onresult = (event) => {
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          transcriptRef.current += text + " ";
        } else {
          interimTranscript += text;
        }
      }

      const currentTranscript = (
        transcriptRef.current + interimTranscript
      ).trim();

      setTranscript(currentTranscript);

      // Greeting / doubt intent detection
      if (!intentSentRef.current) {
        let segmentText = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          segmentText += event.results[i][0].transcript.toLowerCase();
        }

        const keywords = [
          "hi",
          "hello",
          "hey",
          "sir",
          "mam",
          "ma'am",
          "teacher",
          "doubt",
          "question",
        ];

        const found = keywords.some((k) => segmentText.includes(k));

        if (found) {
          intentSentRef.current = true;

          console.log("👋 Greeting / doubt intent detected");

          localParticipant.publishData(
            new TextEncoder().encode(
              JSON.stringify({
                action: "VOICE_DOUBT_INTENT",
                name: localParticipant.identity,
              }),
            ),
            { reliable: true },
          );
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech") return;

      console.error("Speech recognition error:", event.error);
    };

    recognition.onend = () => {
      if (isRecording) {
        try {
          recognition.start();
        } catch (err) {
          console.log(err);
        }
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

    const handleMicChange = () => {
      const isMicOn = localParticipant.isMicrophoneEnabled;

      if (isMicOn && !isRecording) {
        setIsRecording(true);

        intentSentRef.current = false;
        setTranscript("");
        transcriptRef.current = "";

        localParticipant.publishData(
          new TextEncoder().encode(
            JSON.stringify({
              action: "VOICE_DOUBT_START",
              name: localParticipant.identity,
            }),
          ),
          { reliable: true },
        );

        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error(e);
        }
      } else if (!isMicOn && isRecording) {
        localParticipant.publishData(
          new TextEncoder().encode(
            JSON.stringify({
              action: "VOICE_DOUBT_END",
              name: localParticipant.identity,
            }),
          ),
          { reliable: true },
        );

        setIsRecording(false);

        recognitionRef.current.stop();

        setTimeout(() => {
          handleExtraction(transcriptRef.current || transcript);
        }, 500);
      }
    };

    localParticipant.on("trackMuted", handleMicChange);
    localParticipant.on("trackUnmuted", handleMicChange);

    return () => {
      localParticipant.off("trackMuted", handleMicChange);
      localParticipant.off("trackUnmuted", handleMicChange);
    };
  }, [localParticipant, isRecording, transcript]);

  const handleExtraction = async (fullTranscript) => {
    if (!fullTranscript.trim()) return;

    console.log("🎤 Transcript:", fullTranscript);

    // Send transcript to teacher UI
    localParticipant.publishData(
      new TextEncoder().encode(
        JSON.stringify({
          action: "STUDENT_VOICE",
          name: localParticipant.identity,
          transcript: fullTranscript,
        }),
      ),
      { reliable: true },
    );

    const lower = fullTranscript.toLowerCase().trim();

    const greetings = [
      "hi",
      "hello",
      "hey",
      "good morning",
      "good afternoon",
      "good evening",
    ];

    const isGreeting = greetings.some(
      (g) => lower === g || lower.startsWith(g + " "),
    );

    // Greeting → ONLY teacher side
    if (isGreeting) {
      console.log("👋 Greeting detected (teacher-only)");

      localParticipant.publishData(
        new TextEncoder().encode(
          JSON.stringify({
            action: "STUDENT_GREETING",
            id: Date.now() + "-greeting",
            text: fullTranscript,
            name: localParticipant.identity,
            voiceGenerated: true,
          }),
        ),
        { reliable: true },
      );

      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/extract-question`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript: fullTranscript,
        }),
      });

      const data = await res.json();

      let question = fullTranscript.trim();

      // Use extracted question if available
      if (
        data.extractedQuestion &&
        data.extractedQuestion.trim() &&
        data.extractedQuestion.toUpperCase() !== "<NONE>"
      ) {
        question = data.extractedQuestion.trim();
      }

      console.log("🤖 Sending Question:", question);

      localParticipant.publishData(
        new TextEncoder().encode(
          JSON.stringify({
            action: "STUDENT_DOUBT",
            id: Date.now() + "-" + Math.random().toString(36),
            text: question,
            name: localParticipant.identity,
            voiceGenerated: true,
          }),
        ),
        { reliable: true },
      );
    } catch (err) {
      console.error("Extraction failed:", err);

      // Fallback → send full transcript
      localParticipant.publishData(
        new TextEncoder().encode(
          JSON.stringify({
            action: "STUDENT_DOUBT",
            id: Date.now() + "-" + Math.random().toString(36),
            text: fullTranscript.trim(),
            name: localParticipant.identity,
            voiceGenerated: true,
          }),
        ),
        { reliable: true },
      );
    }
  };

  return null;
}