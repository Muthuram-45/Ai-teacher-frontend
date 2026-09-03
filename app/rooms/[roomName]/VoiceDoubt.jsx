"use client";
import { useEffect, useState, useRef } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { speakText, stopSpeaking, initAudioContext } from '@/app/lib/aiTTS';
import { BACKEND_URL } from "../../lib/config";

export default function VoiceDoubt() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const intentSentRef = useRef(false);
  const transcriptRef = useRef("");
  const inactivityTimerRef = useRef(null);
  const gracePeriodTimerRef = useRef(null);

  const clearTimers = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (gracePeriodTimerRef.current) {
      clearTimeout(gracePeriodTimerRef.current);
      gracePeriodTimerRef.current = null;
    }
  };

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

        if (segmentText.trim().length > 0) {
          clearTimers();
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
      if (event.error === "no-speech" || event.error === "network" || event.error === "not-allowed") {
        console.warn("Speech recognition error (ignored):", event.error);
        return;
      }

      console.error("Speech recognition error:", event.error);
    };

    recognition.onend = () => {
      if (isRecordingRef.current) {
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

      if (isMicOn && !isRecordingRef.current) {
        isRecordingRef.current = true;

        intentSentRef.current = false;
        setTranscript("");
        transcriptRef.current = "";

        clearTimers();
        inactivityTimerRef.current = setTimeout(async () => {
          const studentName = localParticipant.identity || "Student";
          const langCode = new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('preferredLanguage') || 'en';
          const reminderMessages = {
            ta: `${studentName}, உங்க microphone on-ல இருக்கு. உங்களுக்கு ஏதாவது doubt இருந்தா, please உங்க question-அ கேளுங்க. Doubt இல்லைனா, உங்க microphone-அ off பண்ணுங்க.`,
            te: `${studentName}, మీ microphone on లో ఉంది. మీకు ఏదైనా doubt ఉంటే, please మీ question అడగండి. Doubt లేకపోతే, మీ microphone off చేయండి.`,
            hi: `${studentName}, आपका microphone on है. अगर आपका कोई doubt है, तो please अपना question पूछिए. अगर doubt नहीं है, तो अपना microphone off कर दीजिए.`,
            kn: `${studentName}, ನಿಮ್ಮ microphone on ಇದೆ. ನಿಮಗೆ ಯಾವುದಾದರು doubt ಇದ್ರೆ, ದಯವಿಟ್ಟು ನಿಮ್ಮ question ಕೇಳ್ರಿ. Doubt ಇಲ್ಲಾಂದ್ರೆ, ನಿಮ್ಮ microphone off ಮಾಡಿ.`,
            ml: `${studentName}, നിങ്ങളുടെ microphone on ആണ്. നിങ്ങൾക്ക് എന്തെങ്കിലും doubt ഉണ്ടെങ്കിൽ, please നിങ്ങളുടെ question ചോദിക്കുക. Doubt ഇല്ലെങ്കിൽ, നിങ്ങളുടെ microphone off ചെയ്യുക.`,
            en: `${studentName}, your microphone is on. If you have a question, please ask it. If you don't have a doubt, please turn off your microphone.`
          };
          
          const txt = reminderMessages[langCode] || reminderMessages.en;
          
          initAudioContext();
          try {
            await speakText(txt, { forceLanguage: langCode, skipTranslation: true });
          } catch (err) {
            console.error("TTS Reminder error:", err);
          }
          
          gracePeriodTimerRef.current = setTimeout(() => {
            if (localParticipant.isMicrophoneEnabled) {
              console.log("🎙 Auto-muting microphone due to inactivity.");
              localParticipant.setMicrophoneEnabled(false);
            }
          }, 5000);
        }, 7000);

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
          console.warn("Recognition already started or failed to start:", e);
        }
      } else if (!isMicOn && isRecordingRef.current) {
        clearTimers();
        stopSpeaking(); // stop the inactivity reminder if playing

        localParticipant.publishData(
          new TextEncoder().encode(
            JSON.stringify({
              action: "VOICE_DOUBT_END",
              name: localParticipant.identity,
            }),
          ),
          { reliable: true },
        );

        isRecordingRef.current = false;

        try {
          recognitionRef.current.stop();
        } catch(e) {}

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
  }, [localParticipant, transcript]);

  const handleExtraction = async (fullTranscript) => {
    if (!fullTranscript.trim()) return;

    console.log("🎤 Transcript:", fullTranscript);
    const questionId = "q_" + Date.now() + "_" + Math.random().toString(36).substring(7);

    localParticipant.publishData(
      new TextEncoder().encode(
        JSON.stringify({
          type: "student_question",
          questionId: questionId,
          studentName: localParticipant.identity,
          question: fullTranscript.trim(),
          topic: new URLSearchParams(window.location.search).get('topic') || "General Class",
          language: new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('preferredLanguage') || 'en',
          timestamp: new Date().toISOString()
        })
      ),
      { reliable: true }
    );
  };

  return null;
}