"use client";

import { useState, useEffect, useRef } from "react";

export default function StudentQuizView({
  quiz,
  onSubmit,
  onClose,
  studentName = "Student",
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState(null);
  const [autoCloseSeconds, setAutoCloseSeconds] = useState(10);
  const timerRef = useRef(null);
  const exitTimerRef = useRef(null);
  const [flaggedQuestions, setFlaggedQuestions] = useState([]);

  // Proctoring states
  const [browserSwitchCount, setBrowserSwitchCount] = useState(0);
  const [proctoringStatus, setProctoringStatus] = useState("safe"); // 'safe', 'warning', 'violation'
  const [faceInFrame, setFaceInFrame] = useState(true);
  const [showProctorNote, setShowProctorNote] = useState(true);
  const [videoActivityLogs, setVideoActivityLogs] = useState([]);

  // Alert popups
  const [showOutOfFrameAlert, setShowOutOfFrameAlert] = useState(false);
  const [showTabSwitchAlert, setShowTabSwitchAlert] = useState(false);
  const [lastAlertReason, setLastAlertReason] = useState("");
  const tabSwitchAlertTimer = useRef(null);
  const outOfFrameAlertTimer = useRef(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const browserSwitchRef = useRef(0);
  const FaceViolationFrameCountRef = useRef(0); // For temporal buffering
  const videoActivityLogsRef = useRef([]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [showSecurityAlert, setShowSecurityAlert] = useState(false);
  const [isTerminated, setIsTerminated] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const lastViolationTimeRef = useRef(0);

  const questions = quiz.questions || [];
  const isLastQuestion = currentIndex === questions.length - 1;

  // ─── Phase 1: Fullscreen Control ───
  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => { });
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen().catch(() => { });
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen().catch(() => { });
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    // 🔒 System-Level Key Locking (Chrome/Edge Only)
    if (
      typeof navigator !== "undefined" &&
      navigator.keyboard &&
      navigator.keyboard.lock
    ) {
      navigator.keyboard.lock(["Escape", "Tab"]).catch(() => { });
    }

    // 🔇 Suppress harmless MediaPipe/TFLite info logs that Next.js treats as errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const msg = args[0]?.toString?.().toLowerCase() || "";
      if (
        msg.includes("tensorflow lite") ||
        msg.includes("xnnpack") ||
        msg.includes("mediapipe") ||
        msg.includes("face_landmarker")
      ) return;
      originalConsoleError.apply(console, args);
    };
    return () => {
      console.error = originalConsoleError;
    };

  }, []);

  useEffect(() => {
    if (!mounted || submitted || isTerminated) return;

    // Auto-enter fullscreen removed as it fails without user gesture
    // Rely on the 'Start Examination' overlay button


    // 🛡️ Aggressive Focus Recovery
    const restoreFocus = () => {
      if (!submitted && !isTerminated) {
        window.focus();
        if (!document.fullscreenElement) enterFullscreen();
      }
    };
    window.addEventListener("click", restoreFocus);
    window.addEventListener("mousedown", restoreFocus);

    const handleFullscreenChange = () => {
      const isFS = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isFS);

      if (!isFS && !submitted && !isTerminated) {
        handleViolation("Exited Fullscreen Mode");
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleViolation("Tab Switching Detected");
      }
    };

    const handleBlur = () => {
      handleViolation("Window Minimized/Switch Attempt");
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleViolation("Escape key pressed");
        return false;
      }

      if (e.altKey && e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        handleViolation("Tab switching detected");
        return false;
      }

      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      if (e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    const handleViolation = (reason) => {
      const now = Date.now();
      if (now - lastViolationTimeRef.current < 1500) return;
      lastViolationTimeRef.current = now;

      const isEscape = reason.toLowerCase().includes("escape");

      if (
        reason.includes("Tab") ||
        reason.includes("Window") ||
        reason.includes("Exited") ||
        isEscape
      ) {
        setBrowserSwitchCount((c) => c + 1);
        browserSwitchRef.current += 1;
      }

      setViolationCount((prev) => {
        const next = prev + 1;
        if (next >= 2) {
          terminateQuiz(isEscape ? "Escape key pressed (Second Attempt)" : "Security Breach (Second Attempt)");
          return next;
        }

        // First violation: Show message and force stay in app
        if (isEscape) {
          setLastAlertReason(
            "you cannot switch tab /browe during quiz, if you do agin consider as malpractice an terimate you",);
        } else {
          setLastAlertReason(
            "Security Protocol: Tab/Window switching is not allowed. Further attempts will terminate your exam.",
          );
        }
        setShowSecurityAlert(true);
        setTimeout(() => setShowSecurityAlert(false), 8000);

        // Force stay/re-entry
        enterFullscreen();
        window.focus();

        return next;
      });
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("keydown", handleKeyDown, true); // Use capture phase
    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("click", restoreFocus);
      window.removeEventListener("mousedown", restoreFocus);
      if (navigator.keyboard && navigator.keyboard.unlock)
        navigator.keyboard.unlock();
    };
  }, [mounted, submitted, isTerminated]);

  useEffect(() => {
    // ❌ removed setInterval auto-fullscreen as it causes console errors 
    // The UI overlay already provides a button for the user to resume fullscreen.
  }, [mounted, isFullscreen, submitted, isTerminated, violationCount]);


  const exitFS = () => {
    if (typeof document === "undefined") return;
    if (document.exitFullscreen) document.exitFullscreen().catch(() => { });
    else if (document.webkitExitFullscreen)
      document.webkitExitFullscreen().catch(() => { });
    else if (document.msExitFullscreen)
      document.msExitFullscreen().catch(() => { });
  };

  const terminateQuiz = (reason) => {
    setIsTerminated(true);
    setLastAlertReason("Quiz Terminated: " + reason);
    handleSubmit(true); // Force submit immediately without showing confirmation modal
    exitFS();
  };

  // ─── TOTAL TIMER ───────────────────────────────────────────
  const TOTAL_TIME = questions.length * 30;
  const [totalTimeLeft, setTotalTimeLeft] = useState(TOTAL_TIME);

  useEffect(() => {
    if (submitted || isTerminated) return;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTotalTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [submitted, isTerminated]);

  const minutes = Math.floor(totalTimeLeft / 60);
  const seconds = totalTimeLeft % 60;

  // ─── Proctoring (MediaPipe) ───────────────────────────────────
  useEffect(() => {
    if (!mounted || submitted || isTerminated) return;
    let isActive = true;
    let faceLandmarker = null;

    const initProctoring = async () => {
      try {
        const vision = await new Function(
          'return import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3")',
        )();
        const { FaceLandmarker, FilesetResolver } = vision;
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm",
        );

        faceLandmarker = await FaceLandmarker.createFromOptions(
          filesetResolver,
          {
            baseOptions: {
              modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
              delegate: "GPU",
            },
            outputFaceBlendshapes: true,
            runningMode: "VIDEO",
            numFaces: 2,
          },
        );

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: true,
        });
        if (!isActive) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play().catch(() => { });
        }

        let lastVideoTime = -1;
        const predictLoop = async () => {
          if (!isActive || !videoRef.current || !faceLandmarker) return;
          const video = videoRef.current;
          if (video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            const detectedResults = faceLandmarker.detectForVideo(
              video,
              performance.now(),
            );

            if (
              detectedResults.faceLandmarks &&
              detectedResults.faceLandmarks.length > 0
            ) {
              let currentStatus = "safe";
              let reason = "";

              if (detectedResults.faceLandmarks.length > 1) {
                currentStatus = "violation";
                reason = "Multiple Faces Detected";
              } else {
                const landmarks = detectedResults.faceLandmarks[0];
                const nose = landmarks[4],
                  lEye = landmarks[33],
                  rEye = landmarks[263];

                // Head Pose Ratios (Robust to lighting/scaling)
                const yaw =
                  ((Math.abs(nose.x - lEye.x) - Math.abs(nose.x - rEye.x)) /
                    (Math.abs(nose.x - lEye.x) + Math.abs(nose.x - rEye.x))) *
                  100;
                const pitch = (nose.y - (lEye.y + rEye.y) / 2) * 500 - 15;

                // Yaw/Pitch Tiers
                if (Math.abs(yaw) > 30) {
                  currentStatus = "violation";
                  reason = yaw > 0 ? "Looking Left" : "Looking Right";
                } else if (Math.abs(yaw) > 18) {
                  currentStatus = "warning";
                  reason = "Minor head tilt detected";
                }

                if (pitch > 28) {
                  currentStatus = "violation";
                  reason = "Looking Down (Phone/Notes)";
                } else if (pitch < -50) {
                  currentStatus = "violation";
                  reason = "Looking Up";
                } else if (pitch > 16 || pitch < -40) {
                  if (currentStatus !== "violation") {
                    currentStatus = "warning";
                    reason = "Please look at the screen";
                  }
                }
              }

              if (currentStatus === "violation")
                FaceViolationFrameCountRef.current++;
              else FaceViolationFrameCountRef.current = 0;

              const isSustainedViolation =
                FaceViolationFrameCountRef.current > 45;

              setProctoringStatus(
                isSustainedViolation ? "violation" : currentStatus,
              );
              setFaceInFrame(!isSustainedViolation);
              setLastAlertReason(
                isSustainedViolation
                  ? reason
                  : currentStatus === "warning"
                    ? reason
                    : "",
              );

              if (
                isSustainedViolation &&
                FaceViolationFrameCountRef.current % 60 === 0
              ) {
                const log = {
                  time: new Date().toLocaleTimeString(),
                  status: "Direction Violation",
                  reason,
                };
                videoActivityLogsRef.current = [
                  ...videoActivityLogsRef.current,
                  log,
                ];
                setVideoActivityLogs([...videoActivityLogsRef.current]);
                setShowOutOfFrameAlert(true);
                if (outOfFrameAlertTimer.current)
                  clearTimeout(outOfFrameAlertTimer.current);
                outOfFrameAlertTimer.current = setTimeout(
                  () => setShowOutOfFrameAlert(false),
                  3000,
                );
              }
            } else {
              FaceViolationFrameCountRef.current++;
              const isSustainedNoFace = FaceViolationFrameCountRef.current > 45;
              setFaceInFrame(!isSustainedNoFace);
              setProctoringStatus(isSustainedNoFace ? "violation" : "warning");
              setLastAlertReason(
                isSustainedNoFace ? "No Face Detected" : "Align face to center",
              );

              if (
                isSustainedNoFace &&
                FaceViolationFrameCountRef.current % 60 === 0
              ) {
                const log = {
                  time: new Date().toLocaleTimeString(),
                  status: "Face Missing",
                  reason: "No Face Detected",
                };
                videoActivityLogsRef.current = [
                  ...videoActivityLogsRef.current,
                  log,
                ];
                setVideoActivityLogs([...videoActivityLogsRef.current]);
                setShowOutOfFrameAlert(true);
                if (outOfFrameAlertTimer.current)
                  clearTimeout(outOfFrameAlertTimer.current);
                outOfFrameAlertTimer.current = setTimeout(
                  () => setShowOutOfFrameAlert(false),
                  3000,
                );
              }
            }
          }
          if (isActive) requestAnimationFrame(predictLoop);
        };
        requestAnimationFrame(predictLoop);
      } catch (err) {
        console.error("Proctoring Error:", err);
      }
    };

    initProctoring();

    return () => {
      isActive = false;
      if (streamRef.current)
        streamRef.current.getTracks().forEach((t) => t.stop());
      if (faceLandmarker) faceLandmarker.close();
    };
  }, [mounted, submitted, isTerminated]);

  // ─── Handlers ────────────────────────────────────────────────────────
  const toggleFlag = (index) => {
    setFlaggedQuestions((prev) =>
      prev.includes(index) ? prev.filter((q) => q !== index) : [...prev, index],
    );
  };
  const handleOptionSelect = (optionIndex) => {
    if (submitted || isTerminated) return;
    setAnswers((prev) => {
      const currentAnswer = prev[currentIndex];
      if (currentAnswer === optionIndex) {
        // Deselect if already selected
        const updated = { ...prev };
        delete updated[currentIndex];
        return updated;
      }
      return { ...prev, [currentIndex]: optionIndex };
    });
  };

  const handleNext = () => {
    if (isLastQuestion) handleSubmit();
    else setCurrentIndex((prev) => prev + 1);
  };

  const handleSubmit = async (force = false) => {
    if (submitted) return;

    // ✅ SUBMISSION VALIDATION
    const totalQuestions = questions.length;
    const answeredCount = Object.keys(answers).length;
    const unansweredCount = totalQuestions - answeredCount;
    const flaggedCount = flaggedQuestions.length;

    // Show custom confirmation modal if:
    // 1. Not already forced/confirmed
    // 2. Not a termination/timeout violation (those submit instantly)
    // 3. There are unanswered or flagged questions
    if (!force && !isTerminated && totalTimeLeft > 0 && (unansweredCount > 0 || flaggedCount > 0)) {
      setShowSubmitConfirm(true);
      return;
    }

    if (timerRef.current) clearInterval(timerRef.current);
    setShowSubmitConfirm(false);
    setSubmitted(true); // Mark as submitted to stop activity tracking

    const answersArray = questions.map((_, idx) =>
      answers[idx] !== undefined ? answers[idx] : null,
    );
    const switchCount = browserSwitchRef.current;
    const logsSnap = videoActivityLogsRef.current;
    const totalViolations = logsSnap.length;

    // Build detailed reason
    const reasonParts = [];
    if (switchCount > 0) reasonParts.push(`Tab switches: ${switchCount}x`);
    if (totalViolations > 0) {
      const byType = {};
      logsSnap.forEach((l) => {
        const k = l.reason || l.status || "Unknown";
        byType[k] = (byType[k] || 0) + 1;
      });
      Object.entries(byType).forEach(([k, v]) =>
        reasonParts.push(`${k} (${v}x)`),
      );
    }
    if (isTerminated) reasonParts.push("Quiz terminated by system");

    // Video activity: >=10 face violations = Suspicious Activity
    const videoActivity =
      totalViolations >= 10
        ? "Suspicious Activity"
        : totalViolations >= 3
          ? "Unstable"
          : "Stable";
    // Status: Malpractice if >=10 video violations, >=2 tab switches, or terminated
    const status =
      totalViolations >= 10 || switchCount >= 2 || isTerminated
        ? "Malpractice"
        : "Good";
    const reason =
      status === "Good" && videoActivity === "Stable"
        ? "Good"
        : reasonParts.length > 0
          ? reasonParts.join(" | ")
          : "Good";

    const proctorData = {
      browserSwitchCount: switchCount,
      video_activity: videoActivity,
      status,
      reason,
      logs: logsSnap,
    };

    const result = await onSubmit(answersArray, proctorData);
    setResults({ ...result, studentAnswers: answersArray });

    // Restore normal environment after quiz
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (navigator.keyboard && navigator.keyboard.unlock)
      navigator.keyboard.unlock();
  };

  useEffect(() => {
    if (results) {
      exitTimerRef.current = setInterval(() => {
        setAutoCloseSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(exitTimerRef.current);
            onClose();
            // Force leave meeting to a clean finished page
            window.location.href = "/autoleavemeet";
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (exitTimerRef.current) clearInterval(exitTimerRef.current);
    };
  }, [results, onClose]);

  const currentQuestion = questions[currentIndex];

  // Helper for option letters
  const getOptionLetter = (i) => String.fromCharCode(65 + i);

  return (
    <div
      className="quiz-root"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "radial-gradient(circle at center, #1a1a2e 0%, #0a0a12 100%)",
        zIndex: 99999,
        display: "flex",
        fontFamily: "'Source Sans Pro', 'Noto Sans Tamil', 'Segoe UI', Roboto, Arial, sans-serif",
        color: "#f8fafc",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css?family=Source+Sans+Pro:300,400,400i,700&display=fallback');
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@100..900&family=Roboto:wght@300;400;500;700&display=swap');
        
        .glass-card {
          background: rgba(30, 41, 59, 0.4);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }

        .option-button {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        
        .option-button:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .option-button.selected {
          background: rgba(79, 70, 229, 0.2) !important;
          border: 1px solid rgba(99, 102, 241, 0.6) !important;
          box-shadow: 0 0 15px rgba(99, 102, 241, 0.2);
        }

        .option-letter {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          margin-right: 16px;
          font-weight: 700;
          font-size: 14px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.6);
          transition: all 0.2s;
        }

        .selected .option-letter {
          background: #6366f1;
          color: white;
          border-color: #818cf8;
        }

        .nav-button {
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .nav-button:hover {
          filter: brightness(1.1);
          transform: scale(1.02);
        }

        .nav-button:active {
          transform: scale(0.98);
        }

        .question-dot {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s;
          border: 1px solid rgba(255, 255, 255, 0.05);
          cursor: pointer;
        }

        .question-dot:hover {
          transform: scale(1.1);
          z-index: 10;
        }

        @keyframes pulse-ring {
          0% { transform: scale(0.9); opacity: 0.8; }
          50% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(0.9); opacity: 0.8; }
        }

        .status-pulse {
          position: absolute;
          top: 10px;
          left: 10px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          animation: pulse-ring 2s infinite;
        }
      `}</style>

      {/* 🛡️ Fullscreen Enforcement Overlay */}
      {!isFullscreen && !submitted && !isTerminated && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(10, 10, 18, 0.95)",
            backdropFilter: "blur(20px)",
            zIndex: 12000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          {violationCount === 0 ? (
            <div className="glass-card" style={{
              padding: "40px",
              borderRadius: "32px",
              maxWidth: "600px",
              width: "100%",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
              animation: "handRaiseSlideInRight 0.3s ease-out"
            }}>
              <div>
                <h2 style={{ fontSize: "32px", fontWeight: "700", marginBottom: "8px" }}>
                  Secure Test Mode
                </h2>
                <p style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: "15px" }}>
                  Please read the instructions carefully to avoid disqualification.
                </p>
              </div>

              <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: "12px", background: "rgba(255,255,255,0.02)", padding: "20px", borderRadius: "20px" }}>
                {[
                  { icon: "📷", text: "Camera & microphone will be enabled for secure testing." },
                  { icon: "🚫", text: "Switching tabs or minimizing the window is strictly prohibited." },
                  { icon: "👤", text: "Ensure only you are visible in the frame at all times." },
                  { icon: "⚠️", text: "Suspicious activity will result in automatic termination." }
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <span style={{ fontSize: "20px" }}>{item.icon}</span>
                    <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "14px", lineHeight: "1.4" }}>{item.text}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={enterFullscreen}
                className="nav-button"
                style={{
                  padding: "18px 40px",
                  background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "16px",
                  fontWeight: "700",
                  cursor: "pointer",
                  fontSize: "18px",
                  boxShadow: "0 10px 25px rgba(79, 70, 229, 0.4)",
                  justifyContent: "center"
                }}
              >
                Start Examination
              </button>
            </div>
          ) : (
            <div className="glass-card" style={{
              padding: "48px",
              borderRadius: "32px",
              textAlign: "center",
              maxWidth: "500px",
              width: "100%",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              animation: "handRaiseSlideInRight 0.3s ease-out"
            }}>
              <div style={{
                width: "80px",
                height: "80px",
                background: "rgba(239, 68, 68, 0.1)",
                borderRadius: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "40px",
                margin: "0 auto 24px"
              }}>
                ⚠️
              </div>
              <h2 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "16px", color: "#f8fafc" }}>Security Violation detected</h2>
              <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: "32px", lineHeight: 1.6, fontSize: "15px" }}>
                You have exited the secure mode. This attempt has been logged.
                <br /><br />
                <span style={{ color: "#ef4444", fontWeight: "600" }}>⚠️ Warning:</span> Any further violation (Escape key or Tab switch) will result in <b>immediate termination</b>.
              </p>
              <button
                onClick={enterFullscreen}
                className="nav-button"
                style={{
                  padding: "18px 40px",
                  background: "#ef4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: "16px",
                  fontWeight: "700",
                  cursor: "pointer",
                  fontSize: "16px",
                  justifyContent: "center",
                  width: "100%",
                  boxShadow: "0 10px 20px rgba(239, 68, 68, 0.2)"
                }}
              >
                Resume Secure Mode
              </button>
            </div>
          )}
        </div>
      )}

      {/* ⚠️ Security / Proctoring Alerts */}
      {(showSecurityAlert || showOutOfFrameAlert) && !submitted && (
        <div
          style={{
            position: "fixed",
            top: "32px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 15000, // Higher than the fullscreen enforcement overlay (12000)
            background: "#ef4444",
            color: "#fff",
            padding: "16px 32px",
            borderRadius: "16px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.2)",
            animation: "handRaiseSlideInRight 0.3s ease-out"
          }}
        >
          <div style={{ fontSize: "24px" }}>⚠️</div>
          <div>
            <div style={{ fontWeight: "700", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.8 }}>
              {/* {showSecurityAlert ? "Security Warning" : "Proctoring Alert"} */}
            </div>
            <div style={{ fontWeight: "600", fontSize: "16px" }}>{lastAlertReason || "Action required"}</div>
          </div>
        </div>
      )}

      {/* MAIN LAYOUT */}
      <div style={{ display: "flex", height: "100vh", width: "100%" }}>

        {/* LEFT SIDE - Questions & Workspace */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", padding: "32px" }}>

          {/* Top Bar */}
          <div style={{
            display: "flex",
            justifyContent: "end",
            alignItems: "center",
            marginBottom: "20px",
            marginTop: "20px",
            height: "40px"
          }}>
            <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
              <div className="glass-card" style={{
                padding: "8px 16px",
                borderRadius: "12px",
                fontSize: "15px",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                <span style={{ color: "#6366f1" }}>⏱️</span>
                <span>{minutes}:{seconds.toString().padStart(2, "0")} <span style={{ opacity: 0.5, fontWeight: "400" }}>remaining</span></span>
              </div>

              <div style={{
                height: "6px",
                width: "200px",
                background: "rgba(255,255,255,0.05)",
                borderRadius: "3px",
                position: "relative",
                overflow: "hidden"
              }}>
                <div style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: "100%",
                  width: `${((currentIndex + 1) / questions.length) * 100}%`,
                  background: "linear-gradient(90deg, #6366f1, #a855f7)",
                  borderRadius: "3px",
                  transition: "width 0.3s ease"
                }} />
              </div>
            </div>

            <div style={{ fontSize: "14px", fontWeight: "600", color: "rgba(255,255,255,0.4)" }}>
              Question {currentIndex + 1} of {questions.length}
            </div>
          </div>

          {/* Question View Area */}
          <h2 style={{
            fontSize: "24px",
            fontWeight: "600",
            lineHeight: 1.5,
            marginBottom: "48px",
            maxWidth: "850px",
            marginLeft: "80px"
          }}>
            {currentQuestion?.question}
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px", maxWidth: "800px", marginLeft: "80px" }}>
            {currentQuestion?.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleOptionSelect(i)}
                className={`option-button ${answers[currentIndex] === i ? "selected" : ""}`}
                style={{
                  padding: "18px 24px",
                  borderRadius: "16px",
                  fontSize: "17px",
                  fontWeight: "500",
                  border: "1px solid rgba(255,255,255,0.05)",
                  background: "rgba(255,255,255,0.03)",
                  color: "#f8fafc",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center"
                }}
              >
                <div className="option-letter">{getOptionLetter(i)}</div>
                <div style={{ flex: 1 }}>{opt}</div>
                {answers[currentIndex] === i && (
                  <div style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: "#6366f1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px"
                  }}>✓</div>
                )}
              </button>
            ))}
          </div>
          {/* Bottom Control Bar */}
          <div style={{
            marginTop: "32px",
            display: "flex",
            justifyContent: "end",
            alignItems: "center",
            gap: "10px"
          }}>
            {/* Previous Button - Left Aligned */}
            <button
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="nav-button"
              style={{
                padding: "12px 24px",
                background: "rgba(255,255,255,0.05)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                fontWeight: "600",
                cursor: "pointer",
                opacity: currentIndex === 0 ? 0 : 1, // Keep space even if hidden
                pointerEvents: currentIndex === 0 ? "none" : "auto",
                visibility: currentIndex === 0 ? "hidden" : "visible"
              }}
            >
              ← Previous
            </button>

            {/* Right Group: Flag & Next */}
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>

              <button
                onClick={() => toggleFlag(currentIndex)}
                className="nav-button"
                style={{
                  padding: "12px 24px",
                  background: flaggedQuestions.includes(currentIndex) ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.05)",
                  color: flaggedQuestions.includes(currentIndex) ? "#ef4444" : "rgba(255,255,255,0.6)",
                  border: `1px solid ${flaggedQuestions.includes(currentIndex) ? "rgba(239, 68, 68, 0.3)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                <span>🚩</span> {flaggedQuestions.includes(currentIndex) ? "Flagged" : "Flag Question"}
              </button>

              <button
                onClick={handleNext}
                className="nav-button"
                style={{
                  padding: "12px 32px",
                  background: isLastQuestion ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "12px",
                  fontWeight: "700",
                  cursor: "pointer",
                  boxShadow: isLastQuestion ? "0 4px 15px rgba(16, 185, 129, 0.3)" : "0 4px 15px rgba(99, 102, 241, 0.3)",
                }}
              >
                {isLastQuestion ? "Finish Assessment" : "Next Question →"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR - Monitor & Navigation */}
      <div style={{
        width: "360px",
        background: "rgba(10, 10, 18, 0.4)",
        borderLeft: "1px solid rgba(255,255,255,0.05)",
        padding: "32px",
        display: "flex",
        flexDirection: "column",
        gap: "32px",
        backdropFilter: "blur(20px)",
        marginRight: "30px"
      }}>

        {/* Virtual Proctor View */}
        <div>
          <div style={{
            fontWeight: "700",
            fontSize: "13px",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.4)",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span>Intelligent Monitor</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="status-indicator" style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: proctoringStatus === "violation" ? "#ef4444" : proctoringStatus === "warning" ? "#10b981" : "#10b981",
                boxShadow: `0 0 10px ${proctoringStatus === "violation" ? "#ef4444" : proctoringStatus === "warning" ? "#10b981" : "#10b981"}`
              }} />
              <span style={{ fontSize: "11px", color: proctoringStatus === "violation" ? "#ef4444" : "#f8fafc" }}>
                {proctoringStatus === "violation" ? "Violation" : proctoringStatus === "warning" ? "Secure" : "Secure"}
              </span>
            </div>
          </div>

          <div className="glass-card" style={{
            width: "100%",
            aspectRatio: "1.2/1",
            borderRadius: "24px",
            overflow: "hidden",
            position: "relative",
            border: `2px solid ${proctoringStatus === "violation" ? "rgba(239, 68, 68, 0.4)" : proctoringStatus === "warning" ? "rgba(245, 158, 11, 0.4)" : "rgba(255,255,255,0.05)"}`
          }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "scaleX(-1)",
              }}
            />

            <div style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              padding: "4px 10px",
              background: "rgba(0,0,0,0.5)",
              borderRadius: "20px",
              fontSize: "10px",
              fontWeight: "700",
              color: "white",
              border: "1px solid rgba(255,255,255,0.1)"
            }}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>

            <div style={{
              position: "absolute",
              bottom: "0",
              left: "0",
              right: "0",
              height: "60px",
              background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
              display: "flex",
              alignItems: "flex-end",
              padding: "16px",
              justifyContent: "space-between"
            }}>
              <div style={{ display: "flex", gap: "4px" }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{
                    width: "3px",
                    height: (Math.random() * 15 + 5) + "px",
                    background: "#10b981",
                    borderRadius: "2px",
                    opacity: 0.8
                  }} />
                ))}
              </div>
              {/* <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)", fontWeight: "600" }}>ALGO V2.4</span> */}
            </div>
          </div>

          {/* <div style={{
              marginTop: "16px",
              padding: "12px",
              background: "rgba(255,255,255,0.03)",
              borderRadius: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Environmental Integrity</span>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#10b981" }}>98%</span>
            </div> */}
        </div>

        {/* Question Navigator */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{
            fontWeight: "700",
            fontSize: "13px",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.4)",
            marginBottom: "16px"
          }}>
            Test Roadmap
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "10px",
            padding: "16px",
            background: "rgba(255,255,255,0.02)",
            borderRadius: "20px",
            border: "1px solid rgba(255,255,255,0.05)"
          }}>
            {questions.map((_, index) => {
              const isCurrent = currentIndex === index;
              const isAnswered = answers[index] !== undefined;
              const isFlagged = flaggedQuestions.includes(index);

              let bgColor = "rgba(255,255,255,0.05)";
              let borderColor = "transparent";
              let textColor = "rgba(255,255,255,0.4)";

              if (isCurrent) {
                bgColor = "rgba(99, 102, 241, 0.2)";
                borderColor = "#6366f1";
                textColor = "#fff";
              } else if (isFlagged) {
                bgColor = "rgba(239, 68, 68, 0.2)";
                textColor = "#ef4444";
              } else if (isAnswered) {
                bgColor = "rgba(16, 185, 129, 0.2)";
                textColor = "#10b981";
              }

              return (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className="question-dot"
                  style={{
                    background: bgColor,
                    border: `1px solid ${borderColor}`,
                    color: textColor,
                  }}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{
            marginTop: "24px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px"
          }}>
            {[
              { label: "Answered", color: "#10b981" },
              { label: "Current", color: "#6366f1" },
              { label: "Flagged", color: "#ef4444" },
              { label: "Unvisited", color: "rgba(255,255,255,0.2)" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: item.color }} />
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", fontWeight: "500" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Student Info Footer */}
        <div className="glass-card" style={{
          padding: "16px",
          borderRadius: "16px",
          display: "flex",
          alignItems: "center",
          gap: "12px"
        }}>
          <div style={{
            width: "40px",
            height: "40px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "700",
            fontSize: "14px"
          }}>
            {studentName.charAt(0)}
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: "600" }}>{studentName}</div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>Candidate ID: #82910</div>
          </div>
        </div>
      </div>

      {/* 🏁 Custom Submission Confirmation Modal */}
      {showSubmitConfirm && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(10, 10, 18, 0.9)",
          backdropFilter: "blur(12px)",
          zIndex: 20000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px"
        }}>
          <div className="glass-card" style={{
            width: "100%",
            maxWidth: "500px",
            borderRadius: "32px",
            padding: "40px",
            textAlign: "center",
            animation: "handRaiseSlideInRight 0.3s ease-out",
            border: "1px solid rgba(255, 255, 255, 0.1)"
          }}>
            <div style={{
              width: "80px",
              height: "80px",
              background: "rgba(245, 158, 11, 0.1)",
              borderRadius: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "40px",
              margin: "0 auto 24px"
            }}>
              ⚠️
            </div>

            <h2 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "16px" }}>Finish Test?</h2>

            <div style={{
              background: "rgba(255, 255, 255, 0.03)",
              borderRadius: "20px",
              padding: "20px",
              marginBottom: "32px",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: "12px"
            }}>
              {questions.length - Object.keys(answers).length > 0 && (
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <span style={{ color: "#f59e0b" }}>•</span>
                  <span style={{ fontSize: "15px", color: "rgba(255,255,255,0.8)" }}>
                    You have <b>{questions.length - Object.keys(answers).length} unanswered</b> questions.
                  </span>
                </div>
              )}
              {flaggedQuestions.length > 0 && (
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <span style={{ color: "#ef4444" }}>•</span>
                  <span style={{ fontSize: "15px", color: "rgba(255,255,255,0.8)" }}>
                    You have <b>{flaggedQuestions.length} flagged</b> questions to review.
                  </span>
                </div>
              )}
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", marginTop: "8px", lineHeight: "1.5" }}>
                Once submitted, you will not be able to change your answers or return to the test.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="nav-button"
                style={{
                  padding: "16px",
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "white",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "16px",
                  fontWeight: "600",
                  cursor: "pointer",
                  justifyContent: "center"
                }}
              >
                Back to Test
              </button>
              <button
                onClick={() => handleSubmit(true)}
                className="nav-button"
                style={{
                  padding: "16px",
                  background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "16px",
                  fontWeight: "700",
                  cursor: "pointer",
                  justifyContent: "center",
                  boxShadow: "0 10px 20px rgba(79, 70, 229, 0.3)"
                }}
              >
                Submit Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🏆 Quiz Results View Overlay */}
      {results && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(10, 10, 18, 0.98)",
          zIndex: 30000,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "40px 24px",
          overflowY: "auto"
        }}>
          <div style={{
            maxWidth: "800px",
            width: "100%",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: "24px"
          }}>
            <div className="glass-card" style={{ padding: "40px", borderRadius: "32px", border: "1px solid rgba(16, 185, 129, 0.4)" }}>
              <div style={{ fontSize: "60px", marginBottom: "16px" }}>🎉</div>
              <h1 style={{ fontSize: "36px", fontWeight: "800", marginBottom: "8px", background: "linear-gradient(to right, #10b981, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Assessment Completed!
              </h1>
              <div style={{ fontSize: "24px", fontWeight: "700", color: "#f8fafc", marginBottom: "16px" }}>
                Your Score: <span style={{ color: "#10b981" }}>{results.score}%</span>
              </div>
              <p style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "16px" }}>
                Auto-leaving meeting in <b style={{ color: "#ef4444", fontSize: "20px" }}>{autoCloseSeconds}s</b>
              </p>
            </div>

            <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: "20px" }}>
              <h2 style={{ fontSize: "22px", fontWeight: "700", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "12px" }}>
                Review Questions
              </h2>
              {questions.map((q, idx) => {
                const studentAnsIdx = results.studentAnswers[idx];
                const isCorrect = studentAnsIdx === q.correctAnswer;
                return (
                  <div key={idx} className="glass-card" style={{
                    padding: "24px",
                    borderRadius: "20px",
                    borderLeft: `6px solid ${isCorrect ? "#10b981" : "#ef4444"}`
                  }}>
                    <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px", color: "#f8fafc" }}>
                      {idx + 1}. {q.question}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {q.options.map((opt, optIdx) => {
                        let borderColor = "rgba(255,255,255,0.05)";
                        let bgColor = "transparent";
                        let icon = null;

                        if (optIdx === q.correctAnswer) {
                          borderColor = "#10b981";
                          bgColor = "rgba(16, 185, 129, 0.1)";
                          icon = "✅";
                        } else if (optIdx === studentAnsIdx && !isCorrect) {
                          borderColor = "#ef4444";
                          bgColor = "rgba(239, 68, 68, 0.1)";
                          icon = "❌";
                        }

                        return (
                          <div key={optIdx} style={{
                            padding: "12px 16px",
                            borderRadius: "12px",
                            border: `1px solid ${borderColor}`,
                            background: bgColor,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "14px"
                          }}>
                            <span>{getOptionLetter(optIdx)}. {opt}</span>
                            <span>{icon}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => { window.location.href = "/autoleavemeet"; }}
              className="nav-button"
              style={{
                marginTop: "20px",
                padding: "16px 40px",
                background: "rgba(255,255,255,0.05)",
                color: "white",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "16px",
                fontWeight: "600",
                cursor: "pointer",
                alignSelf: "center"
              }}
            >
              Leave Meeting Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}