"use client";

import { useState, useEffect, useRef } from "react";
import { speakText } from "@/app/lib/aiTTS";

export default function StudentPopupQuestion({ questionData, onClose }) {
    const [selectedOption, setSelectedOption] = useState(null);
    const [timeLeft, setTimeLeft] = useState(30);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [isCorrect, setIsCorrect] = useState(null);
    const timerRef = useRef(null);

    // 1. Run 30s countdown timer
    useEffect(() => {
        if (hasSubmitted) return;

        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    handleTimeout();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [hasSubmitted]);

    // 2. Handle when timer runs out
    const handleTimeout = () => {
        setHasSubmitted(true);
        setIsCorrect(false);
        speakText("Time's up! Please pay close attention to the class.").catch(() => {});
        setTimeout(() => {
            onClose();
        }, 3000);
    };

    // 3. Handle option selection
    const selectOption = (index) => {
        if (hasSubmitted) return;
        clearInterval(timerRef.current);

        setSelectedOption(index);
        setHasSubmitted(true);
        const correct = index === questionData.correctAnswer;
        setIsCorrect(correct);

        if (correct) {
            speakText("Great job! Keep paying attention.").catch(() => {});
        } else {
            speakText("Incorrect! Please pay close attention to the class.").catch(() => {});
        }

        setTimeout(() => {
            onClose();
        }, 3000);
    };

    const progressPercent = (timeLeft / 30) * 100;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(10, 12, 22, 0.85)",
                backdropFilter: "blur(12px)",
                zIndex: 99999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "apFadeIn 0.3s ease-out",
            }}
        >
            <div
                style={{
                    width: "480px",
                    maxWidth: "90%",
                    background: "linear-gradient(135deg, #1e293b, #0f172a)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "24px",
                    padding: "32px",
                    boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(33, 150, 243, 0.15)",
                    fontFamily: "Inter, sans-serif",
                    color: "#fff",
                    position: "relative",
                    animation: "apPopIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
            >
                {/* Header & Icon */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                    <span style={{ fontSize: "28px", animation: "apPulse 1.5s infinite" }}>🎯</span>
                    <div>
                        <h3
                            style={{
                                margin: 0,
                                fontSize: "20px",
                                fontWeight: "800",
                                background: "linear-gradient(135deg, #64b5f6, #2196f3)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                letterSpacing: "-0.5px",
                            }}
                        >
                            Attention Check!
                        </h3>
                        <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                            Verify you are active in the classroom
                        </p>
                    </div>
                </div>

                {/* Progress bar */}
                {!hasSubmitted && (
                    <div style={{ marginBottom: "24px" }}>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "12px",
                                color: "rgba(255,255,255,0.6)",
                                marginBottom: "6px",
                                fontWeight: "600",
                            }}
                        >
                            <span>Time remaining</span>
                            <span style={{ color: timeLeft <= 10 ? "#ef5350" : "#64b5f6" }}>
                                {timeLeft}s
                            </span>
                        </div>
                        <div
                            style={{
                                height: "6px",
                                width: "100%",
                                background: "rgba(255,255,255,0.08)",
                                borderRadius: "3px",
                                overflow: "hidden",
                            }}
                        >
                            <div
                                style={{
                                    height: "100%",
                                    width: `${progressPercent}%`,
                                    background: timeLeft <= 10 ? "linear-gradient(90deg, #ef5350, #e53935)" : "linear-gradient(90deg, #64b5f6, #2196f3)",
                                    borderRadius: "3px",
                                    transition: "width 1s linear",
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Question */}
                <div
                    style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        lineHeight: "1.5",
                        marginBottom: "24px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.05)",
                        borderRadius: "16px",
                        padding: "16px",
                    }}
                >
                    {questionData.question}
                </div>

                {/* Options List */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {questionData.options.map((option, idx) => {
                        let btnStyle = {
                            width: "100%",
                            padding: "14px 20px",
                            borderRadius: "14px",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            background: "rgba(255, 255, 255, 0.04)",
                            color: "#fff",
                            fontSize: "14px",
                            fontWeight: "500",
                            textAlign: "left",
                            cursor: hasSubmitted ? "default" : "pointer",
                            transition: "all 0.25s ease",
                            outline: "none",
                        };

                        if (!hasSubmitted) {
                            // Normal interactive styles
                            return (
                                <button
                                    key={idx}
                                    onClick={() => selectOption(idx)}
                                    style={btnStyle}
                                    className="ap-option-btn"
                                    onMouseOver={(e) => {
                                        e.currentTarget.style.background = "rgba(33, 150, 243, 0.1)";
                                        e.currentTarget.style.borderColor = "rgba(33, 150, 243, 0.4)";
                                        e.currentTarget.style.transform = "translateX(4px)";
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                                        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                                        e.currentTarget.style.transform = "translateX(0)";
                                    }}
                                >
                                    {option}
                                </button>
                            );
                        } else {
                            // Submitting / Result styles
                            if (idx === questionData.correctAnswer) {
                                // Highlight correct answer
                                btnStyle.background = "rgba(76, 175, 80, 0.2)";
                                btnStyle.borderColor = "#4caf50";
                                btnStyle.color = "#81c784";
                                btnStyle.fontWeight = "700";
                            } else if (idx === selectedOption) {
                                // Selected wrong option
                                btnStyle.background = "rgba(244, 67, 54, 0.2)";
                                btnStyle.borderColor = "#f44336";
                                btnStyle.color = "#e57373";
                            } else {
                                btnStyle.opacity = "0.5";
                            }

                            return (
                                <button key={idx} disabled style={btnStyle}>
                                    {option}
                                </button>
                            );
                        }
                    })}
                </div>

                {/* Submitting / Feedback Toast */}
                {hasSubmitted && (
                    <div
                        style={{
                            marginTop: "24px",
                            padding: "12px",
                            borderRadius: "12px",
                            textAlign: "center",
                            fontSize: "14px",
                            fontWeight: "600",
                            background: isCorrect ? "rgba(76, 175, 80, 0.15)" : "rgba(244, 67, 54, 0.15)",
                            color: isCorrect ? "#81c784" : "#e57373",
                            animation: "apFadeIn 0.3s ease-out",
                        }}
                    >
                        {isCorrect ? "✅ Awesome! Correct Answer." : "❌ Pay attention! Incorrect Answer."}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes apFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes apPopIn {
                    from { opacity: 0; transform: scale(0.9); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes apPulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.15); }
                    100% { transform: scale(1); }
                }
            `}</style>
        </div>
    );
}
