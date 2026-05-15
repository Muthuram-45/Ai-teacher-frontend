"use client";
import {
    Component,
    useEffect,
    useState,
    useMemo,
    useRef,
    useCallback,
} from "react";
import { useSearchParams } from "next/navigation";
import { BACKEND_URL } from "../../lib/config";
import {
    startClassRecording,
    stopClassRecording,
    pauseClassRecording,
    resumeClassRecording,
} from "@/lib/recording";
import {
    LiveKitRoom,
    VideoConference,
    RoomAudioRenderer,
    useLocalParticipant,
    useParticipants,
    useRoomContext,
    ControlBar,
    DisconnectButton,
    ParticipantLoop,
    ParticipantTile,
    ParticipantContext,
    TrackRefContext,
    useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
// @livekit/krisp-noise-filter is dynamically imported inside NoiseFilterActivator (SSR-safe)
import "@livekit/components-styles";
/* ---- Error boundary to swallow LiveKit pagination race ---- */
class GridErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(error) {
        // Only catch the known LiveKit pagination placeholder error
        if (error?.message?.includes("not part of the array")) {
            return { hasError: true };
        }
        throw error; // re-throw anything else
    }
    componentDidCatch(error, info) {
        console.warn(
            "[GridErrorBoundary] Caught LiveKit pagination race — recovering…",
            error.message,
        );
    }
    componentDidUpdate(prevProps, prevState) {
        // Auto-recover on next render cycle
        if (this.state.hasError) {
            this.setState({ hasError: false });
        }
    }
    render() {
        if (this.state.hasError) return this.props.children; // re-render children immediately
        return this.props.children;
    }
}

import QuizSidebar from "./QuizSidebar";
import StudentQuizView from "./StudentQuizView";
import StudentHandRaise from "./StudentHandRaise";
import StudentTextDoubt from "./StudentTextDoubt";
import TeacherHandPanel from "./TeacherHandPanel";
import TeacherVideoController from "./TeacherVideoController";
import StudentVideoViewer from "./StudentVideoViewer";
import AISidebar from "./AISidebar";
import { GiNotebook } from "react-icons/gi";
import ParticipantList from "./ParticipantList";
import { speakText, stopSpeaking, initAudioContext } from "@/app/lib/aiTTS";
import HistorySidebar from "./HistorySidebar";
import AttendanceSidebar from "./AttendanceSidebar";
import VoiceDoubt from "./VoiceDoubt";
import { HiOutlineHandRaised } from "react-icons/hi2";
import { IoIosPeople } from "react-icons/io";
import { LuLogs } from "react-icons/lu";
import { LuPanelLeftClose } from "react-icons/lu";
import {
    FaRobot,
    FaLink,
    FaArrowRightToBracket,
    FaArrowRightFromBracket,
    FaWhatsapp,
} from "react-icons/fa6";
import {
    MdLogout,
    MdDeleteForever,
    MdEmail,
    MdOutlineQuiz,
    MdClose,
} from "react-icons/md";
import { FiExternalLink } from "react-icons/fi";
import {
    BsQuestionSquareFill,
    BsRecordCircle,
    BsStopCircle,
    BsPauseCircle,
    BsPlayCircle,
    BsCloudUpload,
    BsFileText,
    BsCameraVideoFill,
    BsCameraVideoOffFill,
    BsMicFill,
    BsMicMuteFill,
} from "react-icons/bs";
import { FaAngleDown, FaAngleUp } from "react-icons/fa";

/* ---------------- MEETING ENDED OVERLAY ---------------- */
function MeetingEndedOverlay() {
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 99999,
                background: "rgba(0, 0, 0, 0.88)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(6px)",
            }}
        >
            <div
                style={{
                    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
                    border: "1px solid rgba(244, 67, 54, 0.4)",
                    borderRadius: "20px",
                    padding: "52px 60px",
                    textAlign: "center",
                    boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
                    maxWidth: "440px",
                    width: "90%",
                    animation: "popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
            >
                <div style={{ fontSize: "4rem", marginBottom: "16px" }}>🚫</div>
                <h2
                    style={{
                        color: "#fff",
                        fontSize: "1.6rem",
                        fontWeight: 700,
                        margin: "0 0 12px",
                        fontFamily: "Inter, sans-serif",
                        letterSpacing: "-0.5px",
                    }}
                >
                    Meeting Ended
                </h2>
                <p
                    style={{
                        color: "rgba(255,255,255,0.7)",
                        fontSize: "1rem",
                        margin: "0 0 24px",
                        fontFamily: "Inter, sans-serif",
                        lineHeight: 1.6,
                    }}
                >
                    Teacher has closed the meeting.
                </p>
            </div>
            <style>{`
                @keyframes popIn {
                    from { opacity: 0; transform: scale(0.85); }
                    to   { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
}

/* ---------------- WAITING ROOM UI (TEACHER) ---------------- */
function WaitingRoom({ waitingStudents, onAdmit, onReject }) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (waitingStudents.length === 0) return null;

    const showSummaryHeader =
        waitingStudents.length > 2 || (isExpanded && waitingStudents.length > 0);

    const handleAdmitAll = () => {
        waitingStudents.forEach((s) => onAdmit(s.id));
    };

    const handleRejectAll = () => {
        waitingStudents.forEach((s) => onReject(s.id));
    };

    return (
        <div
            className="waiting-room-container"
            style={{
                position: "absolute",
                top: 24,
                right: 24,
                zIndex: 10000,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                pointerEvents: "none",
                alignItems: "flex-end",
            }}
        >
            {/* 📋 Summary View (Admit All / Decline All) */}
            {showSummaryHeader && (
                <div
                    className="waiting-room-summary"
                    style={{
                        background: "rgba(15, 23, 42, 0.95)",
                        backdropFilter: "blur(16px)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        borderRadius: "16px",
                        padding: "10px 24px",
                        color: "#fff",
                        boxShadow: "0 15px 45px rgba(0,0,0,0.6)",
                        display: "flex",
                        alignItems: "center",
                        gap: "24px",
                        animation:
                            "slideInVertical 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                        pointerEvents: "auto",
                        minWidth: "420px",
                    }}
                >
                    <div
                        style={{
                            flex: 1,
                            fontWeight: "700",
                            fontSize: "15px",
                            fontFamily: "Inter, sans-serif",
                            letterSpacing: "-0.2px",
                        }}
                    >
                        {waitingStudents.length}{" "}
                        {waitingStudents.length === 1 ? "Student is" : "Students are"}{" "}
                        waiting to join
                    </div>
                    <div className="waiting-room-actions" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <button
                            onClick={handleAdmitAll}
                            style={{
                                padding: "8px 18px",
                                background: "#2196F3",
                                border: "none",
                                color: "#fff",
                                borderRadius: "10px",
                                cursor: "pointer",
                                fontSize: "14px",
                                fontWeight: "700",
                                transition: "all 0.2s ease",
                                boxShadow: "0 4px 12px rgba(33, 150, 243, 0.3)",
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = "#1E88E5";
                                e.currentTarget.style.transform = "translateY(-1px)";
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = "#2196F3";
                                e.currentTarget.style.transform = "translateY(0)";
                            }}
                        >
                            Admit All
                        </button>
                        <button
                            onClick={handleRejectAll}
                            style={{
                                padding: "8px 18px",
                                background: "rgba(255, 255, 255, 0.08)",
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                color: "#fff",
                                borderRadius: "10px",
                                cursor: "pointer",
                                fontSize: "14px",
                                fontWeight: "600",
                                transition: "all 0.2s ease",
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
                                e.currentTarget.style.transform = "translateY(-1px)";
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                                e.currentTarget.style.transform = "translateY(0)";
                            }}
                        >
                            Decline
                        </button>
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            title="more"
                            style={{
                                background: "none",
                                border: "none",
                                color: "#fff",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "4px",
                                fontSize: "18px",
                                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                opacity: 0.8,
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
                            onMouseOut={(e) => (e.currentTarget.style.opacity = "0.8")}
                        >
                            <FaAngleDown />
                        </button>
                    </div>
                </div>
            )}

            {/* Individual Student Controls */}
            {(!showSummaryHeader || isExpanded) &&
                waitingStudents.map((s) => (
                    <div
                        key={s.id}
                        className="waiting-room-student-card"
                        style={{
                            background: "rgba(15, 23, 42, 0.92)",
                            backdropFilter: "blur(12px)",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            borderRadius: "14px",
                            padding: "8px 20px",
                            color: "#fff",
                            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                            display: "flex",
                            alignItems: "center",
                            gap: "24px",
                            animation:
                                "slideInVertical 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                            pointerEvents: "auto",
                            minWidth: "340px",
                        }}
                    >
                        <div
                            style={{
                                flex: 1,
                                fontWeight: "600",
                                fontSize: "15px",
                                fontFamily: "Inter, sans-serif",
                                letterSpacing: "-0.2px",
                            }}
                        >
                            {s.name}
                        </div>
                        <div className="waiting-room-actions" style={{ display: "flex", gap: "10px" }}>
                            <button
                                onClick={() => onAdmit(s.id)}
                                style={{
                                    padding: "8px 18px",
                                    background: "#2196F3",
                                    border: "none",
                                    color: "#fff",
                                    borderRadius: "10px",
                                    cursor: "pointer",
                                    fontSize: "14px",
                                    fontWeight: "700",
                                    transition: "all 0.2s ease",
                                    boxShadow: "0 4px 12px rgba(33, 150, 243, 0.3)",
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.background = "#1E88E5";
                                    e.currentTarget.style.transform = "translateY(-1px)";
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.background = "#2196F3";
                                    e.currentTarget.style.transform = "translateY(0)";
                                }}
                            >
                                Admit
                            </button>
                            <button
                                onClick={() => onReject(s.id)}
                                style={{
                                    padding: "8px 18px",
                                    background: "rgba(255, 255, 255, 0.08)",
                                    border: "1px solid rgba(255, 255, 255, 0.1)",
                                    color: "#fff",
                                    borderRadius: "10px",
                                    cursor: "pointer",
                                    fontSize: "14px",
                                    fontWeight: "600",
                                    transition: "all 0.2s ease",
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.background =
                                        "rgba(255, 255, 255, 0.12)";
                                    e.currentTarget.style.transform = "translateY(-1px)";
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.background =
                                        "rgba(255, 255, 255, 0.08)";
                                    e.currentTarget.style.transform = "translateY(0)";
                                }}
                            >
                                Decline
                            </button>
                        </div>
                    </div>
                ))}
            <style>{`
                @keyframes slideInVertical {
                    from { opacity: 0; transform: translateY(-20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}
function TeacherOnlyUI({
    doubts,
    onShowDoubts,
    onShowHistory,
    onShowAttendance,
    onShowQuiz,
    onGenerateQuiz,
    onEndMeeting,
    onLeaveMeeting,
    waitingStudents,
    onAdmit,
    onReject,
    onClassStatusChange,
    isRecording,
    isPaused,
    showRecordMenu,
    setShowRecordMenu,
    handleStartRecording,
    handleStopRecording,
    handlePauseRecording,
    handleResumeRecording,
    handleSaveRecording,
    recordingDuration,
}) {
    const { localParticipant } = useLocalParticipant();
    const room = useRoomContext();
    const [showExitMenu, setShowExitMenu] = useState(false);
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [showMobileNavMenu, setShowMobileNavMenu] = useState(false);
    const [copied, setCopied] = useState(false);
    const mobileNavRef = useRef(null);
    const mobileNavToggleRef = useRef(null);

    // Close mobile nav panel when clicking outside
    useEffect(() => {
        if (!showMobileNavMenu) return;
        const handleOutsideClick = (e) => {
            if (
                mobileNavRef.current &&
                !mobileNavRef.current.contains(e.target) &&
                mobileNavToggleRef.current &&
                !mobileNavToggleRef.current.contains(e.target)
            ) {
                setShowMobileNavMenu(false);
            }
        };
        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("touchstart", handleOutsideClick);
        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("touchstart", handleOutsideClick);
        };
    }, [showMobileNavMenu]);

    const shareLink = `${window.location.origin}/join/${room.name}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(shareLink).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleWhatsApp = () => {
        const text = `Join my meeting on Meet Ai: ${shareLink}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    };

    const handleEmail = () => {
        const subject = `Meeting Invitation: ${room.name}`;
        const body = `Hello,\n\nYou are invited to join a meeting on Meet Ai.\n\nRoom Name: ${room.name}\nJoin Link: ${shareLink}`;
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(gmailUrl, "_blank");
    };

    const shareOptionStyle = {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 12px",
        background: "none",
        border: "none",
        color: "#fff",
        borderRadius: "10px",
        cursor: "pointer",
        transition: "all 0.2s",
        fontSize: "14px",
        width: "100%",
        textAlign: "left",
    };

    const iconBoxStyle = {
        width: "32px",
        height: "32px",
        borderRadius: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    };

    let role = "";
    try {
        role = localParticipant?.metadata
            ? JSON.parse(localParticipant.metadata).role
            : "";
    } catch {
        role = localParticipant?.metadata || "";
    }

    if (role !== "teacher") return null;

    const unreadCount = doubts.filter((d) => !d.answer).length;

    return (
        <>
            {/* 🕒 Waiting Room for Teacher */}
            <WaitingRoom
                waitingStudents={waitingStudents}
                onAdmit={onAdmit}
                onReject={onReject}
            />

            {/* 📁 Teacher Upload/Class tool */}
            <div className="teacher-tool-container">
                <TeacherVideoController
                    onGenerateQuiz={onGenerateQuiz}
                    onClassStatusChange={onClassStatusChange}
                    isRecording={isRecording}
                    isPaused={isPaused}
                    showRecordMenu={showRecordMenu}
                    setShowRecordMenu={setShowRecordMenu}
                    handleStartRecording={handleStartRecording}
                    handleStopRecording={handleStopRecording}
                    handlePauseRecording={handlePauseRecording}
                    handleResumeRecording={handleResumeRecording}
                    handleSaveRecording={handleSaveRecording}
                    recordingDuration={recordingDuration}
                />
            </div>

            {/* 🔔 Notifications & History (Near Leave button) */}
            <div className="teacher-nav-container">
                <button
                    ref={mobileNavToggleRef}
                    className="mobile-nav-toggle-btn"
                    onClick={() => setShowMobileNavMenu(!showMobileNavMenu)}
                >
                    {showMobileNavMenu ? <FaAngleDown size={22} /> : <FaAngleUp size={22} />}
                </button>
                <div ref={mobileNavRef} className={`nav-buttons-wrapper ${showMobileNavMenu ? "open" : ""}`}>
                    {/* 📜 History Button */}
                    <button
                        onClick={onShowHistory}
                        title="Activity Log"
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            fontSize: "1.2rem",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                            transition: "all 0.2s",
                            borderRadius: "8px",
                        }}
                        onMouseOver={(e) =>
                            (e.currentTarget.style.background = "rgba(255,255,255,0.2)")
                        }
                        onMouseOut={(e) =>
                            (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
                        }
                    >
                        <LuLogs />
                    </button>

                    {/* 📋 Attendance Button */}
                    <button
                        onClick={() => onShowAttendance && onShowAttendance()}
                        title="Attendance List"
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: "8px",
                            background: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            fontSize: "1.2rem",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                            transition: "all 0.2s",
                        }}
                        onMouseOver={(e) =>
                            (e.currentTarget.style.background = "rgba(33, 150, 243, 0.4)")
                        }
                        onMouseOut={(e) =>
                            (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
                        }
                    >
                        <GiNotebook />
                    </button>

                    {/* 📝 Quiz Results Button */}
                    <button
                        onClick={() => onShowQuiz && onShowQuiz()}
                        title="View Quiz Results"
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: "8px",
                            background: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            fontSize: "1.2rem",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                            transition: "all 0.2s",
                        }}
                        onMouseOver={(e) =>
                            (e.currentTarget.style.background = "rgba(76, 175, 80, 0.4)")
                        }
                        onMouseOut={(e) =>
                            (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
                        }
                    >
                        <MdOutlineQuiz />
                    </button>

                    {/* 🔗 Share Meeting Link Button */}
                    <div style={{ position: "relative" }}>
                        {showShareMenu && (
                            <div
                                style={{
                                    position: "absolute",
                                    bottom: "60px",
                                    right: "0",
                                    background: "rgba(15, 23, 42, 0.95)",
                                    backdropFilter: "blur(12px)",
                                    border: "1px solid rgba(255, 255, 255, 0.1)",
                                    borderRadius: "12px",
                                    padding: "8px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
                                    animation: "slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                                    zIndex: 1000,
                                }}
                            >
                                {/* Copy Option */}
                                <button
                                    onClick={() => {
                                        handleCopy();
                                        setShowShareMenu(false);
                                    }}
                                    style={{ ...shareOptionStyle, width: "auto", padding: "8px" }}
                                    title={copied ? "Copied!" : "Copy Link"}
                                    onMouseOver={(e) =>
                                        (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
                                    }
                                    onMouseOut={(e) => (e.currentTarget.style.background = "none")}
                                >
                                    <div
                                        style={{
                                            ...iconBoxStyle,
                                            background: "rgba(255,255,255,0.1)",
                                            color: "#fff",
                                        }}
                                    >
                                        <FaLink size={14} />
                                    </div>
                                </button>

                                <div
                                    style={{
                                        width: "1px",
                                        height: "20px",
                                        background: "rgba(255,255,255,0.1)",
                                    }}
                                />

                                {/* WhatsApp Option */}
                                <button
                                    onClick={() => {
                                        handleWhatsApp();
                                        setShowShareMenu(false);
                                    }}
                                    style={{ ...shareOptionStyle, width: "auto", padding: "8px" }}
                                    title="Share via WhatsApp"
                                    onMouseOver={(e) =>
                                        (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
                                    }
                                    onMouseOut={(e) => (e.currentTarget.style.background = "none")}
                                >
                                    <div
                                        style={{
                                            ...iconBoxStyle,
                                            background: "rgba(255,255,255,0.1)",
                                            color: "#fff",
                                        }}
                                    >
                                        <FaWhatsapp size={16} />
                                    </div>
                                </button>

                                <div
                                    style={{
                                        width: "1px",
                                        height: "20px",
                                        background: "rgba(255,255,255,0.1)",
                                    }}
                                />

                                {/* Email Option */}
                                <button
                                    onClick={() => {
                                        handleEmail();
                                        setShowShareMenu(false);
                                    }}
                                    style={{ ...shareOptionStyle, width: "auto", padding: "8px" }}
                                    title="Share via Email"
                                    onMouseOver={(e) =>
                                        (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
                                    }
                                    onMouseOut={(e) => (e.currentTarget.style.background = "none")}
                                >
                                    <div
                                        style={{
                                            ...iconBoxStyle,
                                            background: "rgba(255,255,255,0.1)",
                                            color: "#fff",
                                        }}
                                    >
                                        <MdEmail size={16} />
                                    </div>
                                </button>
                            </div>
                        )}

                        <button
                            onClick={() => setShowShareMenu(!showShareMenu)}
                            title="Share Meeting Link"
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: "8px",
                                background: showShareMenu ? "#2196F3" : "rgba(255,255,255,0.1)",
                                border: "1px solid rgba(255,255,255,0.2)",
                                color: "#fff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                fontSize: "1.2rem",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                                transition: "all 0.3s",
                            }}
                            onMouseOver={(e) =>
                                !showShareMenu &&
                                (e.currentTarget.style.background = "rgba(255,255,255,0.2)")
                            }
                            onMouseOut={(e) =>
                                !showShareMenu &&
                                (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
                            }
                        >
                            <FiExternalLink />
                        </button>
                    </div>

                    {/* 💬 AI Assistant / Doubt Notification */}
                    <button
                        onClick={onShowDoubts}
                        title="AI Support"
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: "8px",
                            background: unreadCount > 0 ? "#f44336" : "rgba(33, 150, 243, 0.2)",
                            border:
                                unreadCount > 0 ? "none" : "1px solid rgba(33, 150, 243, 0.4)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            fontSize: "1.2rem",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                            position: "relative",
                            transition: "all 0.2s",
                        }}
                        onMouseOver={(e) =>
                        (e.currentTarget.style.background =
                            unreadCount > 0 ? "#d32f2f" : "rgba(33, 150, 243, 0.4)")
                        }
                        onMouseOut={(e) =>
                        (e.currentTarget.style.background =
                            unreadCount > 0 ? "#f44336" : "rgba(33, 150, 243, 0.2)")
                        }
                    >
                        {unreadCount > 0 ? <BsQuestionSquareFill /> : <FaRobot />}
                        {unreadCount > 0 && (
                            <span
                                style={{
                                    position: "absolute",
                                    top: -5,
                                    right: -5,
                                    background: "#fff",
                                    color: "#f44336",
                                    borderRadius: "50%",
                                    width: 20,
                                    height: 20,
                                    fontSize: "0.75rem",
                                    fontWeight: "bold",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                {unreadCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* ❌ Unified Exit Menu (Right Corner) */}
            <div className="teacher-exit-container">
                {/* Expandable Menu */}
                {showExitMenu && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            background: "rgba(0,0,0,0.85)",
                            backdropFilter: "blur(12px)",
                            padding: "12px",
                            borderRadius: "16px",
                            border: "1px solid rgba(255,255,255,0.15)",
                            boxShadow: "0 15px 40px rgba(0,0,0,0.6)",
                            animation: "slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                        }}
                    >
                        {/* 🚫 Leave Button (Premium Dark Style) */}
                        <button
                            onClick={() => {
                                if (
                                    window.confirm(
                                        "Are you sure you want to leave? Students will remain in the room.",
                                    )
                                ) {
                                    onLeaveMeeting && onLeaveMeeting();
                                }
                            }}
                            className="lk-disconnect-button"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                padding: "12px 20px",
                                background: "linear-gradient(to right, #2c2c2c, #1a1a1a)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                color: "#e0e0e0",
                                borderRadius: "12px",
                                cursor: "pointer",
                                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                fontSize: "14px",
                                fontWeight: "600",
                                width: "200px",
                                justifyContent: "flex-start",
                                letterSpacing: "0.3px",
                                boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background =
                                    "linear-gradient(to right, #3d3d3d, #2a2a2a)";
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                                e.currentTarget.style.transform = "translateX(-5px)";
                                e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.4)";
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background =
                                    "linear-gradient(to right, #2c2c2c, #1a1a1a)";
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                                e.currentTarget.style.transform = "translateX(0)";
                                e.currentTarget.style.boxShadow = "0 4px 15px rgba(0,0,0,0.3)";
                            }}
                        >
                            <div
                                style={{
                                    width: "32px",
                                    height: "32px",
                                    background: "rgba(255,255,255,0.1)",
                                    borderRadius: "8px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <FaArrowRightFromBracket size={16} />
                            </div>
                            <span>Leave Meeting</span>
                        </button>

                        {/* 🛑 End Button (Vibrant Danger Style) */}
                        <button
                            onClick={() => {
                                if (
                                    window.confirm(
                                        "Are you sure you want to end the meeting for everyone?",
                                    )
                                ) {
                                    onEndMeeting && onEndMeeting();
                                }
                            }}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                padding: "12px 20px",
                                background: "linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)",
                                border: "none",
                                color: "#fff",
                                borderRadius: "12px",
                                cursor: "pointer",
                                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                fontSize: "14px",
                                fontWeight: "700",
                                width: "200px",
                                justifyContent: "flex-start",
                                letterSpacing: "0.3px",
                                boxShadow: "0 4px 15px rgba(255, 75, 43, 0.3)",
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = "translateX(-5px)";
                                e.currentTarget.style.boxShadow =
                                    "0 8px 25px rgba(255, 75, 43, 0.5)";
                                e.currentTarget.style.filter = "brightness(1.1)";
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = "translateX(0)";
                                e.currentTarget.style.boxShadow =
                                    "0 4px 15px rgba(255, 75, 43, 0.3)";
                                e.currentTarget.style.filter = "brightness(1)";
                            }}
                        >
                            <div
                                style={{
                                    width: "32px",
                                    height: "32px",
                                    background: "rgba(255,255,255,0.2)",
                                    borderRadius: "8px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <MdDeleteForever size={20} />
                            </div>
                            <span>End Meeting</span>
                        </button>
                    </div>
                )}

                {/* Main Toggle Button */}
                <button
                    onClick={() => setShowExitMenu(!showExitMenu)}
                    title="Exit Options"
                    style={{
                        width: "44px",
                        height: "44px",
                        background: showExitMenu ? "#f44336" : "#242323ff",
                        border: showExitMenu ? "none" : "1px solid rgba(255,255,255,0.2)",
                        color: "#fff",
                        borderRadius: "10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        fontSize: "22px",
                        boxShadow: "0 4px 15px rgba(0,0,0,0.4)",
                        transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                        transform: showExitMenu ? "rotate(90deg)" : "rotate(0)",
                    }}
                >
                    {showExitMenu ? <MdLogout /> : <FaArrowRightToBracket />}
                </button>

                <style>{`
                    .teacher-tool-container {
                        position: absolute;
                        bottom: 14px;
                        right: calc(50% + 365px);
                        z-index: 1000;
                    }
                    .teacher-nav-container {
                        position: absolute;
                        bottom: 14px;
                        left: calc(50% + 365px);
                        z-index: 1000;
                        display: flex;
                        gap: 12px;
                    }
                    .teacher-exit-container {
                        position: absolute;
                        bottom: 14px;
                        right: 20px;
                        z-index: 1000;
                        display: flex;
                        flex-direction: column;
                        align-items: flex-end;
                        gap: 10px;
                    }

                    @media (max-width: 1100px) {
                        .teacher-tool-container {
                            right: auto;
                            left: 16px;
                            bottom: 84px;
                        }
                        .teacher-nav-container {
                            left: auto;
                            right: 50%;
                            transform: translateX(50%);
                            bottom: 84px;
                            background: rgba(15, 23, 42, 0.85);
                            padding: 8px 12px;
                            border-radius: 12px;
                            backdrop-filter: blur(10px);
                            border: 1px solid rgba(255, 255, 255, 0.1);
                        }
                        .teacher-exit-container {
                            bottom: 84px;
                            right: 16px;
                        }
                    }

                    @media (max-width: 768px) {
                        .teacher-nav-container {
                            flex-wrap: wrap;
                            justify-content: center;
                            max-width: 85vw;
                            width: max-content;
                            gap: 8px;
                            bottom: 84px; /* moved higher to prevent overlapping with bottom left/right tools */
                        }
                        .teacher-tool-container {
                            bottom: 78px;
                            left: 10px;
                        }
                        .teacher-exit-container {
                            bottom: 84px;
                            right: 12px;
                        }
                        /* Optional: Make nav buttons a bit smaller on mobile */
                        .teacher-nav-container button, .nav-buttons-wrapper button {
                            width: 38px !important;
                            height: 38px !important;
                            font-size: 1rem !important;
                        }
                    }

                    @media (max-width: 768px) {
                        .mobile-nav-toggle-btn {
                            display: flex !important;
                            align-items: center;
                            justify-content: center;
                            width: 38px;
                            height: 38px;
                            border-radius: 8px;
                            background: rgba(15, 23, 42, 0.85);
                            color: #fff;
                            border: 1px solid rgba(255, 255, 255, 0.2);
                            z-index: 1002;
                            cursor: pointer;
                        }
                        .teacher-nav-container {
                            background: transparent !important;
                            border: none !important;
                            padding: 0 !important;
                            backdrop-filter: none !important;
                            left: 95px;
                            bottom: 79px;
                        }
                        .nav-buttons-wrapper {
                            position: absolute;
                            bottom: 50px; 
                            left: 50%;
                            transform: translateX(-50%) translateY(20px) scale(0.95);
                            display: flex;
                            flex-direction: column;
                            gap: 8px;
                            background: rgba(15, 23, 42, 0.95);
                            padding: 10px;
                            border-radius: 12px;
                            border: 1px solid rgba(255, 255, 255, 0.1);
                            backdrop-filter: blur(10px);
                            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                            transition: all 0.3s ease;
                            opacity: 0;
                            pointer-events: none;
                        }
                        .nav-buttons-wrapper.open {
                            opacity: 1;
                            pointer-events: auto;
                            transform: translateX(-50%) translateY(0) scale(1);
                            display: -webkit-inline-box;         
                            left: 30px;
                        }
                    }

                    .mobile-nav-toggle-btn {
                        display: none;
                    }
                    .nav-buttons-wrapper {
                        display: flex;
                        gap: 12px;
                    }

                    @keyframes slideUp {
                        from { opacity: 0; transform: translateY(15px) scale(0.9); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                    /* Ensure inbuilt leave button is hidden for teacher */
                    .lk-control-bar button.lk-disconnect-button {
                        display: none !important;
                    }
                `}</style>
            </div>
        </>
    );
}

/* ---------------- STUDENT ONLY UI ---------------- */
function StudentOnlyUI({
    participants,
    showAI,
    setShowAI,
    doubtsWithAnswers,
    isHandRaised,
    onToggleHand,
    activeQuiz,
    onQuizSubmit,
    onCloseQuiz,
    quizStarting,
}) {
    const { localParticipant } = useLocalParticipant();
    const [showPeople, setShowPeople] = useState(false);
    const [countdown, setCountdown] = useState(3);

    // Reset countdown whenever quizStarting becomes true
    useEffect(() => {
        if (!quizStarting) return;
        setCountdown(3);
        const t1 = setTimeout(() => setCountdown(2), 1000);
        const t2 = setTimeout(() => setCountdown(1), 2000);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [quizStarting]);

    let role = "";
    try {
        role = localParticipant?.metadata
            ? JSON.parse(localParticipant.metadata).role
            : "";
    } catch {
        role = localParticipant?.metadata || "";
    }

    if (role !== "student") return null;

    return (
        <>
            {/* 📺 Student video viewer (Full Screen Background) */}
            <StudentVideoViewer />
            <VoiceDoubt setShowAI={setShowAI} />

            {/* 🚀 Quiz Starting Pop-in for students */}
            {quizStarting && !activeQuiz && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0,0,0,0.88)",
                        zIndex: 99998,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        animation: "sqFadeIn 0.3s ease-out",
                    }}
                >
                    <div
                        style={{
                            textAlign: "center",
                            animation: "sqPopIn 0.4s cubic-bezier(0.34,1.56,0.64,1)",
                        }}
                    >
                        {/* Countdown circle */}
                        <div
                            style={{
                                width: "120px",
                                height: "120px",
                                borderRadius: "50%",
                                background: "linear-gradient(135deg, #43a047, #1e88e5)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 28px",
                                fontSize: "56px",
                                fontWeight: "900",
                                color: "#fff",
                                boxShadow:
                                    "0 0 0 12px rgba(33,150,243,0.15), 0 0 0 24px rgba(33,150,243,0.07)",
                                animation: "sqPulseRing 0.6s ease-out",
                                fontFamily: "Inter, sans-serif",
                            }}
                        >
                            {countdown}
                        </div>

                        <div
                            style={{
                                fontSize: "42px",
                                marginBottom: "16px",
                                animation: "sqBounce 0.7s ease infinite alternate",
                                display: "inline-block",
                            }}
                        >
                            🎯
                        </div>

                        <h2
                            style={{
                                color: "#fff",
                                fontSize: "28px",
                                fontWeight: "800",
                                margin: "0 0 8px",
                                fontFamily: "Inter, Google Sans, sans-serif",
                                letterSpacing: "-0.5px",
                            }}
                        >
                            Quiz is Starting!
                        </h2>
                        <p
                            style={{
                                color: "rgba(255,255,255,0.6)",
                                fontSize: "15px",
                                margin: 0,
                                fontFamily: "Inter, sans-serif",
                            }}
                        >
                            Get ready to answer the questions 💪
                        </p>
                    </div>

                    <style>{`
                        @keyframes sqFadeIn  { from { opacity:0 } to { opacity:1 } }
                        @keyframes sqPopIn   { from { opacity:0; transform:scale(0.8) } to { opacity:1; transform:scale(1) } }
                        @keyframes sqBounce  { from { transform:translateY(0) } to { transform:translateY(-10px) } }
                        @keyframes sqPulseRing { 0% { box-shadow:0 0 0 0 rgba(33,150,243,0.5),0 0 0 0 rgba(33,150,243,0.3) } 100% { box-shadow:0 0 0 14px rgba(33,150,243,0.12),0 0 0 28px rgba(33,150,243,0.05) } }
                    `}</style>
                </div>
            )}

            <div className="student-tool-container">
                <StudentHandRaise isHandRaised={isHandRaised} onToggle={onToggleHand} />
            </div>

            <div className="student-nav-container">
                {isHandRaised && <StudentTextDoubt />}

                {/* 👥 People Button */}
                <button
                    onClick={() => setShowPeople(!showPeople)}
                    style={{
                        padding: "0 16px",
                        height: "44px",
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "none",
                        color: "#fff",
                        borderRadius: "8px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "16px",
                        fontWeight: 500,
                        fontFamily: "Inter, sans-serif",
                        transition: "background 0.2s",
                    }}
                    onMouseOver={(e) =>
                        (e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)")
                    }
                    onMouseOut={(e) =>
                        (e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)")
                    }
                >
                    <IoIosPeople size={22} style={{ fontSize: "18px" }}></IoIosPeople>
                    <span className="hide-on-mobile">Participants</span>
                    <span
                        style={{
                            background: "#2196F3",
                            color: "#fff",
                            borderRadius: "10px",
                            minWidth: "20px",
                            height: "20px",
                            padding: "0 6px",
                            fontSize: "12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: "bold",
                        }}
                    >
                        {participants.length}
                    </span>
                </button>
            </div>

            {activeQuiz && (
                <StudentQuizView
                    quiz={activeQuiz}
                    onSubmit={onQuizSubmit}
                    onClose={onCloseQuiz}
                    studentName={localParticipant?.identity || "Student"}
                />
            )}
            {showPeople && <ParticipantList onClose={() => setShowPeople(false)} />}

            <style>{`
                .student-tool-container {
                    position: absolute;
                    bottom: 14px;
                    left: calc(50% - 465px);
                    z-index: 100;
                }
                .student-nav-container {
                    position: absolute;
                    bottom: 14px;
                    right: 20px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    z-index: 100;
                }

                @media (max-width: 1024px) {
                    .student-tool-container {
                        left: 16px;
                        bottom: 84px;
                    }
                    .student-nav-container {
                        right: 16px;
                        bottom: 84px;
                    }
                }
                
                @media (max-width: 768px) {
                    .student-tool-container {
                        left: 16px;
                        bottom: 84px;
                    }
                    .student-nav-container {
                        right: 10px;
                        bottom: 84px;
                        flex-direction: column;
                        align-items: flex-end;
                    }
                    .hide-on-mobile {
                        display: none !important;
                    }
                }
            `}</style>
        </>
    );
}

export function useAutoAskAI({ role, askAI, setDoubts }) {
    // { [doubtId]: timeoutId }
    const autoAskTimersRef = useRef({});
    // { [doubtId]: true/false }  true => editing (freeze)
    const editFreezeRef = useRef({});

    const clearAutoAskTimer = useCallback((doubtId) => {
        const t = autoAskTimersRef.current[doubtId];
        if (t) clearTimeout(t);
        delete autoAskTimersRef.current[doubtId];
    }, []);

    const scheduleAutoAsk = useCallback(
        (doubtObj, delayMs = 10000) => {
            if (!doubtObj?.id) return;
            if (role !== "teacher") return;

            clearAutoAskTimer(doubtObj.id);

            autoAskTimersRef.current[doubtObj.id] = setTimeout(() => {
                // ✅ if editing => do nothing (stay frozen until SAVE)
                if (editFreezeRef.current[doubtObj.id]) return;

                // ✅ only ask if still exists + not answered + not broadcasting
                setDoubts((prev) => {
                    const current = prev.find((d) => d.id === doubtObj.id);
                    if (!current) return prev;
                    if (current.answer) return prev;
                    if (current.isBroadcasting) return prev;

                    askAI(current);
                    return prev;
                });

                clearAutoAskTimer(doubtObj.id);
            }, delayMs);
        },
        [role, askAI, setDoubts, clearAutoAskTimer],
    );

    const markEditStart = useCallback(
        (doubtId) => {
            editFreezeRef.current[doubtId] = true;
            clearAutoAskTimer(doubtId);
        },
        [clearAutoAskTimer],
    );

    const markSaved = useCallback(
        (doubtObj, delayMs = 5000) => {
            if (!doubtObj?.id) return;
            editFreezeRef.current[doubtObj.id] = false; // ✅ unfreeze
            scheduleAutoAsk(doubtObj, delayMs);
        },
        [scheduleAutoAsk],
    );

    const markNewDoubt = useCallback((doubtId) => {
        if (!doubtId) return;
        editFreezeRef.current[doubtId] = false;
    }, []);

    const cleanupDoubt = useCallback(
        (doubtId) => {
            clearAutoAskTimer(doubtId);
            delete editFreezeRef.current[doubtId];
        },
        [clearAutoAskTimer],
    );

    useEffect(() => {
        return () => {
            Object.values(autoAskTimersRef.current).forEach((t) => clearTimeout(t));
            autoAskTimersRef.current = {};
            editFreezeRef.current = {};
        };
    }, []);

    return {
        scheduleAutoAsk,
        clearAutoAskTimer,
        markEditStart,
        markSaved,
        markNewDoubt,
        cleanupDoubt,
    };
}

/* ---------------- PAGE CLIENT ---------------- */
/* ---------------- MAIN ROOM CONTENT ---------------- */
function RoomContent() {
    const { localParticipant } = useLocalParticipant();
    const participants = useParticipants();

    // 🔊 Global audio context initialization
    useEffect(() => {
        const unlockAudio = () => {
            initAudioContext();
            document.removeEventListener("click", unlockAudio);
            document.removeEventListener("touchstart", unlockAudio);
        };
        document.addEventListener("click", unlockAudio);
        document.addEventListener("touchstart", unlockAudio);
        return () => {
            document.removeEventListener("click", unlockAudio);
            document.removeEventListener("touchstart", unlockAudio);
        };
    }, []);

    const [doubts, setDoubts] = useState([]);
    const [doubtsWithAnswers, setDoubtsWithAnswers] = useState([]);
    const [showAI, setShowAI] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showAttendance, setShowAttendance] = useState(false);
    const [showParticipants, setShowParticipants] = useState(false);
    const [attendance, setAttendance] = useState({}); // { identity: { identity, role, firstJoined, lastJoined, lastLeft, totalStayTime, joinCount, status } }
    const [loadingAI, setLoadingAI] = useState(null);
    const [isHandRaised, setIsHandRaised] = useState(false);
    const [activeQuiz, setActiveQuiz] = useState(null);
    const [showQuizResults, setShowQuizResults] = useState(false);
    const [classSummary, setClassSummary] = useState(null);
    const [meetingEnded, setMeetingEnded] = useState(false); // 🚫 Meeting ended state
    const [handRaiseQueue, setHandRaiseQueue] = useState([]); // ✋ Sequential Queue for Hand Raises
    const [waitingStudents, setWaitingStudents] = useState([]); // 🕒 Admission Requests
    const room = useRoomContext();
    const [teacherClassStarted, setTeacherClassStarted] = useState(false);
    const [notifications, setNotifications] = useState([]); // Google Meet-style join/leave toasts
    const [quizStarting, setQuizStarting] = useState(false); // ✅ student pop-in countdown
    const [showFullStudentGrid, setShowFullStudentGrid] = useState(false); // 🧑‍🎓 Full screen grid
    // 🎙️ Dynamic Audio Recording Refs
    const recordingAudioContext = useRef(null);
    const recordingDestNode = useRef(null);
    const audioSourceNodes = useRef(new Map()); // Map<trackSid, AudioSourceNode>
    const recordingRef = useRef({ isRecording: false }); // Sync ref

    let role = "";
    let meetingTopic = "";
    try {
        const metadata = localParticipant?.metadata
            ? JSON.parse(localParticipant.metadata)
            : {};
        role = metadata.role || "";
        meetingTopic = metadata.topic || "";
        console.log(
            `👤 RoomContent: identity="${localParticipant?.identity}" role="${role}" topic="${meetingTopic}"`,
        );
    } catch {
        role = localParticipant?.metadata || "";
    }

    // Polling for Waiting Students (Teacher Only)
    useEffect(() => {
        if (role !== "teacher" || !room?.name) return;

        const interval = setInterval(() => {
            fetch(`${BACKEND_URL}/waiting-students/${room.name}`)
                .then((r) => r.json())
                .then((data) => {
                    setWaitingStudents(data.waiting || []);
                })
                .catch((err) => console.error("Error fetching waiting students:", err));
        }, 5000);

        return () => clearInterval(interval);
    }, [role, room?.name]);

    const handleAdmit = async (requestId) => {
        try {
            const res = await fetch(`${BACKEND_URL}/admit-student`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId }),
            });
            if (res.ok) {
                setWaitingStudents((prev) => prev.filter((s) => s.id !== requestId));
            }
        } catch (err) {
            console.error("Admit error:", err);
        }
    };

    const handleReject = async (requestId) => {
        try {
            const res = await fetch(`${BACKEND_URL}/reject-student`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId }),
            });
            if (res.ok) {
                setWaitingStudents((prev) => prev.filter((s) => s.id !== requestId));
            }
        } catch (err) {
            console.error("Reject error:", err);
        }
    };

    // ✅ timers map
    const autoAskTimersRef = useRef({});
    // ✅ freeze map (EDIT mode)
    const editFreezeRef = useRef({}); // { [id]: true/false }

    const clearAutoAskTimer = (doubtId) => {
        const t = autoAskTimersRef.current[doubtId];
        if (t) clearTimeout(t);
        delete autoAskTimersRef.current[doubtId];
    };

    const scheduleAutoAsk = (doubtObj, delayMs = 10000) => {
        console.log(
            `🕒 scheduleAutoAsk: doubt="${doubtObj?.text}" role="${role}" delay=${delayMs}ms`,
        );
        if (!doubtObj?.id) return;
        if (role !== "teacher") return;

        clearAutoAskTimer(doubtObj.id);

        autoAskTimersRef.current[doubtObj.id] = setTimeout(() => {
            // ✅ IMPORTANT: if currently editing => DON'T auto send
            if (editFreezeRef.current[doubtObj.id]) {
                return; // stay frozen until SAVE
            }

            setDoubts((prev) => {
                const current = prev.find((d) => d.id === doubtObj.id);
                if (!current) return prev;
                if (current.answer) return prev;
                if (current.isBroadcasting) return prev;

                askAI(current);
                return prev;
            });

            clearAutoAskTimer(doubtObj.id);
        }, delayMs);
    };

    useEffect(() => {
        return () => {
            Object.values(autoAskTimersRef.current).forEach((t) => clearTimeout(t));
            autoAskTimersRef.current = {};
            editFreezeRef.current = {};
        };
    }, []);

    /* ---------------- RECORDING LOGIC ---------------- */
    const searchParams = useSearchParams();
    const classNameFromURL = searchParams.get("className");
    const className = classNameFromURL || room?.name || "DefaultRoom";

    useEffect(() => {
        console.log("🏫 Classroom Name detected:", {
            fromURL: classNameFromURL,
            roomName: room?.name,
            final: className,
        });
    }, [classNameFromURL, room?.name]);

    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0); // in seconds
    const [showRecordMenu, setShowRecordMenu] = useState(false);

    // Timer effect
    useEffect(() => {
        let timer;
        if (isRecording && !isPaused) {
            timer = setInterval(() => {
                setRecordingDuration((prev) => prev + 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [isRecording, isPaused]);

    const formatTime = (totalSeconds) => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    // 🎤 Dynamic Audio mixing logic
    const addTrackToMix = (track) => {
        if (
            !recordingRef.current.isRecording ||
            !recordingAudioContext.current ||
            !recordingDestNode.current
        )
            return;
        if (!track || track.kind !== "audio" || !track.mediaStreamTrack) return;
        if (audioSourceNodes.current.has(track.sid)) return;

        try {
            const stream = new MediaStream([track.mediaStreamTrack.clone()]);
            const source =
                recordingAudioContext.current.createMediaStreamSource(stream);
            const gainNode = recordingAudioContext.current.createGain();

            // Boost teacher (local) a bit, others normal
            gainNode.gain.value = 1.2;

            source.connect(gainNode).connect(recordingDestNode.current);
            audioSourceNodes.current.set(track.sid, { source, gainNode });
            console.log(`🎙️ Added track ${track.sid} to recording mix`);
        } catch (err) {
            console.warn(`⚠️ Failed to add track ${track.sid} to mix:`, err);
        }
    };

    const removeTrackFromMix = (trackSid) => {
        const node = audioSourceNodes.current.get(trackSid);
        if (node) {
            try {
                node.source.disconnect();
                node.gainNode.disconnect();
            } catch (e) { }
            audioSourceNodes.current.delete(trackSid);
            console.log(`🎙️ Removed track ${trackSid} from recording mix`);
        }
    };

    // Auto-manage tracks while recording
    useEffect(() => {
        if (!room || !isRecording) return;

        const onTrackSubscribed = (track) => addTrackToMix(track);
        const onTrackUnsubscribed = (track) => removeTrackFromMix(track.sid);

        room.on("trackSubscribed", onTrackSubscribed);
        room.on("trackUnsubscribed", onTrackUnsubscribed);

        return () => {
            room.off("trackSubscribed", onTrackSubscribed);
            room.off("trackUnsubscribed", onTrackUnsubscribed);
        };
    }, [room, isRecording]);

    // Keep track of current screen stream to clean up listeners
    const [currentScreenStream, setCurrentScreenStream] = useState(null);
    const handleStartRecording = async (transcribe = false) => {
        console.log(
            "🔴 handleStartRecording triggered. Role:",
            role,
            "Transcribe:",
            transcribe,
        );
        if (!room || role !== "teacher") return;
        setShowRecordMenu(false);

        try {
            // 1. Setup AudioContext for mixing
            recordingAudioContext.current = new (
                window.AudioContext || window.webkitAudioContext
            )();

            // ✅ FIX: Resume AudioContext immediately — browsers suspend it by default
            // due to autoplay policy. If suspended, speakText() checks state === 'running'
            // and will skip recording injection entirely.
            if (recordingAudioContext.current.state === "suspended") {
                await recordingAudioContext.current.resume();
                console.log("▶ AudioContext resumed from suspended state");
            }

            recordingDestNode.current =
                recordingAudioContext.current.createMediaStreamDestination();
            recordingRef.current.isRecording = true;

            // 2. Request Screen Share
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: 1920,
                    height: 1080,
                    frameRate: 30,
                    displaySurface: "window",
                },
                audio: true,
                preferCurrentTab: false,
                selfBrowserSurface: "include",
            });
            setCurrentScreenStream(screenStream);

            // 3. Connect Tab/System Audio to mix
            if (screenStream.getAudioTracks().length > 0) {
                const sysSource =
                    recordingAudioContext.current.createMediaStreamSource(screenStream);
                sysSource.connect(recordingDestNode.current);
                console.log("🔊 Added Screen/Tab Audio to mix");
            }

            // 4. Connect Local Mic(teacher)
            room.localParticipant.audioTrackPublications.forEach((pub) => {
                if (pub.track) addTrackToMix(pub.track);
            });

            // ✅ FIX: Also listen for local mic track if it gets published AFTER recording starts
            // (e.g., teacher enables mic mid-session)
            const onLocalTrackPublished = (pub) => {
                if (pub.track?.kind === "audio") {
                    console.log(
                        "🎙️ Local mic track published after recording start — adding to mix",
                    );
                    addTrackToMix(pub.track);
                }
            };
            room.localParticipant.on("localTrackPublished", onLocalTrackPublished);
            // Store cleanup ref so we can remove it on stop
            recordingRef.current.localTrackCleanup = () => {
                room.localParticipant.off("localTrackPublished", onLocalTrackPublished);
            };

            // 5. Connect all existing Remote Participants (students)
            room.remoteParticipants.forEach((p) => {
                p.audioTrackPublications.forEach((pub) => {
                    if (pub.track && pub.track.mediaStreamTrack) {
                        addTrackToMix(pub.track);
                    }
                });
            });

            // 6. Create Final Stream
            const mixedAudioTrack =
                recordingDestNode.current.stream.getAudioTracks()[0];
            const finalStream = new MediaStream();
            screenStream
                .getVideoTracks()
                .forEach((track) => finalStream.addTrack(track));
            if (mixedAudioTrack) finalStream.addTrack(mixedAudioTrack);

            startClassRecording(finalStream, room.name, className, false, transcribe);
            setIsRecording(true);
            setIsPaused(false);
            setRecordingDuration(0);

            screenStream.getVideoTracks()[0].onended = () => {
                handleStopRecording();
            };
        } catch (e) {
            console.error("❌ Error starting recording:", e);
            if (e.name === "NotAllowedError") {
                alert(
                    "Permission denied. You must select a screen and allow audio sharing.",
                );
            } else {
                alert(`Failed to start recording: ${e.message}`);
            }
            // Cleanup on fail
            recordingRef.current.isRecording = false;
        }
    };

    const handleStopRecording = () => {
        console.log("⏹ handleStopRecording triggered");
        try {
            // Pass chat history for the final summary
            const chatHistory = JSON.stringify(doubtsWithAnswers);
            stopClassRecording(chatHistory);

            setIsRecording(false);
            setIsPaused(false);
            setRecordingDuration(0);
            recordingRef.current.isRecording = false;

            // ✅ FIX: Clean up the local track listener
            if (recordingRef.current.localTrackCleanup) {
                recordingRef.current.localTrackCleanup();
                recordingRef.current.localTrackCleanup = null;
            }

            // Cleanup Audio mixing
            audioSourceNodes.current.forEach((node) => {
                try {
                    node.source.disconnect();
                    node.gainNode.disconnect();
                } catch (e) { }
            });
            audioSourceNodes.current.clear();

            if (
                recordingAudioContext.current &&
                recordingAudioContext.current.state !== "closed"
            ) {
                recordingAudioContext.current.close().catch(() => { });
                recordingAudioContext.current = null;
            }

            if (currentScreenStream) {
                currentScreenStream.getTracks().forEach((track) => {
                    track.onended = null;
                    track.stop();
                });
                setCurrentScreenStream(null);
            }
        } catch (e) {
            console.error("❌ Error stopping recording:", e);
        }
    };

    const handlePauseRecording = () => {
        pauseClassRecording();
        setIsPaused(true);
    };

    const handleResumeRecording = () => {
        resumeClassRecording();
        setIsPaused(false);
    };

    const handleSaveRecording = () => {
        const ok = window.confirm("Do you want to stop and save the recording?");
        if (ok) {
            handleStopRecording();
        }
    };

    // Memoize custom layout components to prevent unmount/remount on every render
    const NoComponent = useMemo(() => () => null, []);
    const TeacherControlBar = useMemo(
        () => () => <ControlBar controls={{ leave: false }} />,
        [],
    );

    const customComponents = useMemo(
        () => ({
            Chat: NoComponent,
            ParticipantGrid: role === "teacher" ? undefined : NoComponent,
            ControlBar: role === "teacher" ? TeacherControlBar : undefined,
            DisconnectButton: role === "teacher" ? NoComponent : undefined,
        }),
        [role, TeacherControlBar, NoComponent],
    );

    // Attendance Tracker
    useEffect(() => {
        if (!room || role !== "teacher") return;

        const updateParticipantStatus = (participant, eventType) => {
            const identity = participant.identity;
            let pRole = "student";
            let pDevice = "Laptop";
            try {
                const meta = JSON.parse(participant.metadata || "{}");
                pRole = meta.role || "student";
                pDevice = meta.device || "Laptop";
            } catch { }

            setAttendance((prev) => {
                const now = Date.now();
                const existing = prev[identity] || {
                    identity,
                    role: pRole,
                    device: pDevice,
                    firstJoined: now,
                    lastJoined: now,
                    lastLeft: null,
                    totalStayTime: 0,
                    joinCount: 0,
                    status: "online",
                    sessions: [],
                };

                if (eventType === "connected") {
                    // Prevent adding redundant sessions if already online
                    if (
                        existing.status === "online" &&
                        existing.sessions?.length > 0 &&
                        !existing.sessions[existing.sessions.length - 1].leftAt
                    ) {
                        return prev;
                    }

                    return {
                        ...prev,
                        [identity]: {
                            ...existing,
                            lastJoined: now,
                            joinCount: (existing.joinCount || 0) + 1,
                            status: "online",
                            role: pRole, // update role in case it changed
                            device: pDevice, // update device if sent
                            sessions: [
                                ...(existing.sessions || []),
                                { joinedAt: now, leftAt: null },
                            ],
                        },
                    };
                } else if (eventType === "disconnected") {
                    // Prevent updating leave time if already offline
                    if (existing.status === "offline") return prev;

                    const stayDuration =
                        now - (existing.lastJoined || existing.firstJoined || now);
                    const updatedSessions = [...(existing.sessions || [])];
                    if (updatedSessions.length > 0) {
                        updatedSessions[updatedSessions.length - 1].leftAt = now;
                    }

                    return {
                        ...prev,
                        [identity]: {
                            ...existing,
                            lastLeft: now,
                            totalStayTime: (existing.totalStayTime || 0) + stayDuration,
                            status: "offline",
                            sessions: updatedSessions,
                        },
                    };
                }
                return prev;
            });
        };

        // Track existing participants
        room.remoteParticipants.forEach((p) => {
            updateParticipantStatus(p, "connected");
        });
        if (room.localParticipant) {
            updateParticipantStatus(room.localParticipant, "connected");
        }

        const onConnected = (p) => updateParticipantStatus(p, "connected");
        const onDisconnected = (p) => updateParticipantStatus(p, "disconnected");

        room.on("participantConnected", onConnected);
        room.on("participantDisconnected", onDisconnected);

        return () => {
            room.off("participantConnected", onConnected);
            room.off("participantDisconnected", onDisconnected);
        };
    }, [room, role]);

    // 🎧 Main Data Handler (Unified)
    useEffect(() => {
        if (!room) return;

        const handleData = (payload) => {
            try {
                const msg = JSON.parse(new TextDecoder().decode(payload));

                // 📝 Live Captions (Teacher Only)
                if (msg.action === "LIVE_TRANSCRIPT" && role === "teacher") {
                    setLiveCaptions((prev) => ({
                        ...prev,
                        [msg.name]: {
                            text: msg.text,
                            expires: Date.now() + 3000,
                        },
                    }));
                }

                // 👋 Greeting (Teacher Only)
                if (msg.action === "STUDENT_GREETING" && role === "teacher") {
                    const studentName = msg.name || "Student";
                    const text = (msg.text || "").toLowerCase();

                    let reply = `Hi ${studentName}! Please tell me your doubt.`;
                    if (text.includes("good morning"))
                        reply = `Good morning ${studentName}! Please tell me your doubt.`;
                    else if (text.includes("good afternoon"))
                        reply = `Good afternoon ${studentName}! Please tell me your doubt.`;
                    else if (text.includes("good evening"))
                        reply = `Good evening ${studentName}! Please tell me your doubt.`;

                    speakText(reply, {
                        audioContext: recordingAudioContext.current,
                        destinationNode: recordingDestNode.current,
                    }).catch((err) => console.error("Greeting TTS error:", err));

                    room.localParticipant.publishData(
                        new TextEncoder().encode(
                            JSON.stringify({ action: "AI_SPEAK_BROADCAST", text: reply }),
                        ),
                        { reliable: true },
                    );
                    return;
                }

                // 📥 Receive New Doubt
                if (msg.action === "STUDENT_DOUBT") {
                    console.log("📥 Received STUDENT_DOUBT:", msg);
                    const doubtId = msg.id || Date.now();
                    const newDoubt = { ...msg, id: doubtId };

                    // Add to list for everyone
                    setDoubts((prev) => {
                        if (prev.some((d) => d.id === doubtId)) return prev;
                        return [...prev, newDoubt];
                    });

                    setDoubtsWithAnswers((prevAnswers) => {
                        if (prevAnswers.some((d) => d.id === doubtId)) return prevAnswers;
                        return [
                            ...prevAnswers,
                            { id: doubtId, name: msg.name, text: msg.text, answer: null },
                        ];
                    });

                    setShowAI(true);

                    // Teacher only: logic for auto-AI
                    if (role === "teacher") {
                        editFreezeRef.current[doubtId] = false;
                        const delay = msg.voiceGenerated ? 3000 : 10000;
                        scheduleAutoAsk(newDoubt, delay);
                    }
                }

                // ✋ Hand Raise (Teacher Processing)
                if (msg.action === "HAND_RAISE" && role === "teacher") {
                    setHandRaiseQueue((prev) => {
                        let nextQueue = [...prev];
                        if (msg.raised) {
                            if (!nextQueue.includes(msg.name)) nextQueue.push(msg.name);
                        } else {
                            nextQueue = nextQueue.filter((name) => name !== msg.name);
                        }
                        return nextQueue;
                    });
                }

                // ✋ Hand Raise (Student Side Reaction)
                if (
                    msg.action === "HAND_RAISE" &&
                    role === "student" &&
                    msg.name === localParticipant?.identity
                ) {
                    setIsHandRaised(msg.raised);
                }

                // 📢 AI General Speak Broadcast (Student Side & Other Teachers)
                if (msg.action === "AI_SPEAK_BROADCAST" && msg.text) {
                    speakText(msg.text, {
                        audioContext: recordingAudioContext.current,
                        destinationNode: recordingDestNode.current,
                    }).catch((err) => console.error("Broadcast TTS error:", err));
                }

                // 🤖 AI Answer Broadcast (Student Side & Other Teachers)
                if (msg.action === "AI_ANSWER_BROADCAST") {
                    setDoubtsWithAnswers((prev) => {
                        const exists = prev.find((d) => d.id === msg.id);
                        if (exists)
                            return prev.map((d) =>
                                d.id === msg.id ? { ...d, answer: msg.answer } : d,
                            );
                        return [...prev, msg];
                    });

                    if (role === "teacher") setShowAI(true);

                    // 🔊 Play audio for both teacher AND student via the broadcast echo
                    if (msg.answer) {
                        const audioString = `${msg.name} asked: ${msg.text}. ${msg.answer}`;
                        speakText(audioString, {
                            audioContext: recordingAudioContext.current,
                            destinationNode: recordingDestNode.current,
                        }).catch((err) => console.error("Broadcast TTS error:", err));
                    }
                }

                // ⏹ Global Stop Audio
                if (msg.action === "STOP_AUDIO") {
                    stopSpeaking();
                }

                // 🚫 Quiz Start (Student Side Only)
                if (msg.action === "QUIZ_START" && role === "student") {
                    setQuizStarting(true);
                    setTimeout(() => {
                        setQuizStarting(false);
                        setActiveQuiz(msg.quiz);
                    }, 3000);
                }

                // 🏁 Meeting Ended (Student Side Only)
                if (msg.action === "MEETING_ENDED" && role === "student") {
                    setMeetingEnded(true);
                }
            } catch (err) {
                console.error("Data packet error:", err);
            }
        };

        room.on("dataReceived", handleData);
        return () => room.off("dataReceived", handleData);
    }, [room, role, localParticipant?.identity, scheduleAutoAsk]);

    /* 👩‍🏫 Teacher Handlers (Centralized) */
    const askAI = async (doubt) => {
        console.log(`🤖 askAI triggered for: "${doubt?.text}"`);
        if (!doubt) return;

        clearAutoAskTimer(doubt.id);

        setLoadingAI(doubt.id);
        try {
            const res = await fetch(`${BACKEND_URL}/ask-ai`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: doubt.text,
                    studentName: doubt.name,
                    topic: meetingTopic, // Pass the class topic from metadata
                }),
            });
            const data = await res.json();
            const answer = data.answer || "No answer received.";

            setDoubts((prev) =>
                prev.map((d) => (d.id === doubt.id ? { ...d, answer } : d)),
            );

            const answeredDoubt = { ...doubt, answer };
            setTimeout(() => sendToStudent(answeredDoubt), 500);
        } catch (e) {
            console.error("AI error", e);
        } finally {
            setLoadingAI(null);
        }
    };

    const sendToStudent = (doubt) => {
        console.log(
            `📤 sendToStudent: Broadcasting answer for doubtId=${doubt.id}`,
        );
        if (!doubt?.answer || !room) {
            console.warn(
                "⚠️ sendToStudent: Missing answer or room skipping broadcast",
            );
            return;
        }

        clearAutoAskTimer(doubt.id);

        room.localParticipant.publishData(
            new TextEncoder().encode(
                JSON.stringify({
                    action: "AI_ANSWER_BROADCAST",
                    id: doubt.id,
                    text: doubt.text,
                    answer: doubt.answer,
                    name: doubt.name,
                }),
            ),
            { reliable: true },
        );
        console.log("✅ sendToStudent: Published AI_ANSWER_BROADCAST");

        // Also play locally for the Teacher
        const audioString = `${doubt.name} asked: ${doubt.text}. ${doubt.answer}`;
        speakText(audioString, {
            audioContext: recordingAudioContext.current,
            destinationNode: recordingDestNode.current,
        }).catch((err) => console.error("Teacher local TTS error:", err));

        setDoubts((prev) =>
            prev.map((d) => (d.id === doubt.id ? { ...d, isBroadcasting: true } : d)),
        );
    };

    const stopAIAudio = () => {
        if (!room) return;
        room.localParticipant.publishData(
            new TextEncoder().encode(JSON.stringify({ action: "STOP_AUDIO" })),
            {
                reliable: true,
            },
        );
        stopSpeaking();
    };

    const resolveDoubt = (id) => {
        const doubt = doubts.find((d) => d.id === id);
        clearAutoAskTimer(id);
        delete editFreezeRef.current[id];

        if (doubt) {
            setDoubtsWithAnswers((prev) => {
                const exists = prev.find((h) => h.id === doubt.id);
                if (exists)
                    return prev.map((h) =>
                        h.id === doubt.id ? { ...h, answer: doubt.answer || h.answer } : h,
                    );
                return [
                    ...prev,
                    {
                        id: doubt.id,
                        name: doubt.name,
                        text: doubt.text,
                        answer: doubt.answer,
                    },
                ];
            });
        }
        setDoubts((prev) => prev.filter((d) => d.id !== id));
    };

    // ✅ EDIT CLICK => freeze + stop timer
    const handleEditStart = (id) => {
        editFreezeRef.current[id] = true;
        clearAutoAskTimer(id);
    };

    // ✅ SAVE => unfreeze + start 5 sec timer
    const handleSaveDoubt = (id, newText) => {
        setDoubts((prev) =>
            prev.map((d) => (d.id === id ? { ...d, text: newText } : d)),
        );
        setDoubtsWithAnswers((prev) =>
            prev.map((h) => (h.id === id ? { ...h, text: newText } : h)),
        );

        editFreezeRef.current[id] = false; // ✅ unfreeze

        const updated = doubts.find((d) => d.id === id);
        const doubtObj = updated
            ? { ...updated, text: newText }
            : { id, text: newText };

        scheduleAutoAsk(doubtObj, 5000); // ✅ save אחרי 5 sec auto ask
    };

    // old prop => treat as SAVE
    const updateDoubtText = (id, newText) => handleSaveDoubt(id, newText);

    /* QUIZ handlers (unchanged) */
    const handleGenerateQuiz = async () => {
        if (!room) return;

        const studentQuestions = doubtsWithAnswers.map((d) => d.text);
        const finalTopic = meetingTopic || "General Class";

        try {
            const res = await fetch(`${BACKEND_URL}/generate-quiz`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    topic: finalTopic,
                    studentQuestions,
                    roomName: room.name,
                }),
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error("Backend error message:", errorText);
                throw new Error(
                    `Server returned ${res.status}: ${errorText.substring(0, 100)}`,
                );
            }

            const data = await res.json();

            if (data.quizId) {
                // Broadcast quiz to all students
                room.localParticipant.publishData(
                    new TextEncoder().encode(
                        JSON.stringify({
                            action: "QUIZ_START",
                            quiz: {
                                id: data.quizId,
                                topic: finalTopic,
                                questions: data.questions,
                            },
                        }),
                    ),
                    { reliable: true },
                );

                // Teacher: Open quiz results sidebar
                setActiveQuiz({ ...data, topic: finalTopic });
                setShowQuizResults(true);

                // ⭐ GENERATE CLASS SUMMARY
                try {
                    const summaryRes = await fetch(`${BACKEND_URL}/generate-summary`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ topic: finalTopic, studentQuestions }),
                    });
                    const summaryData = await summaryRes.json();
                    if (summaryData.summary) {
                        if (summaryData.summary) setClassSummary(summaryData.summary);
                    }
                } catch (summaryErr) {
                    console.error("Summary generation error", summaryErr);
                }

                alert("✅ Quiz generated and broadcast to all students!");
            }
        } catch (e) {
            console.error("Quiz generation error", e);
            alert("❌ Failed to generate quiz.");
        }
    };

    const handleQuizSubmit = async (answers, proctorData) => {
        if (!activeQuiz || !localParticipant) return;

        try {
            const res = await fetch(`${BACKEND_URL}/submit-quiz`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    quizId: activeQuiz.id,
                    studentName: localParticipant.identity,
                    answers,
                    ...proctorData,
                }),
            });
            return await res.json();
        } catch (e) {
            console.error("Quiz submission error", e);
            return null;
        }
    };

    const handleEndMeeting = async () => {
        if (!room) return;
        try {
            // 1️⃣ Broadcast MEETING_ENDED to all participants FIRST
            await room.localParticipant.publishData(
                new TextEncoder().encode(JSON.stringify({ action: "MEETING_ENDED" })),
                { reliable: true },
            );

            // Small delay so data message is delivered before room is deleted
            await new Promise((resolve) => setTimeout(resolve, 800));

            // 2️⃣ Tell backend to delete room & mark it as ended
            await fetch(`${BACKEND_URL}/end-room`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ roomName: room.name }),
            });

            // 3️⃣ Disconnect teacher
            if (room.state !== "disconnected") {
                await room.disconnect();
            }

            // 4️⃣ Redirect teacher
            window.location.href = "/";
        } catch (e) {
            console.error("Failed to end meeting properly", e);
            window.location.href = "/";
        }
    };

    const handleLeaveMeeting = async () => {
        if (!room) return;
        try {
            // Just disconnect without ending for others
            if (room.state !== "disconnected") {
                await room.disconnect();
            }
            window.location.href = "/";
        } catch (e) {
            console.error("Failed to leave meeting", e);
            window.location.href = "/";
        }
    };

    const [liveCaptions, setLiveCaptions] = useState({}); // { studentName: { text, expires } }

    useEffect(() => {
        const timer = setInterval(() => {
            setLiveCaptions((prev) => {
                const now = Date.now();
                let changed = false;
                const next = { ...prev };
                for (const name in next) {
                    if (next[name].expires < now) {
                        delete next[name];
                        changed = true;
                    }
                }
                return changed ? next : prev;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <>
            {/* 🚫 Meeting Ended Overlay (Students only) */}
            {meetingEnded && <MeetingEndedOverlay />}
            {/* 🔊 REQUIRED: hear others */}
            <RoomAudioRenderer />

            {/* 👥 Teacher Participants Sidebar */}
            {role === "teacher" && showParticipants && (
                <ParticipantList onClose={() => setShowParticipants(false)} />
            )}

            <style>{`
                @keyframes pulseDot {
                    0% { opacity: 1; }
                    50% { opacity: 0.4; }
                    100% { opacity: 1; }
                }
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(229, 57, 53, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(229, 57, 53, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(229, 57, 53, 0); }
                }
            `}</style>

            {/* 🎥 Full screen Teacher Video renders here when active */}
            <StudentOnlyUI
                participants={participants}
                showAI={showAI}
                setShowAI={setShowAI}
                doubtsWithAnswers={doubtsWithAnswers}
                isHandRaised={isHandRaised}
                onToggleHand={() => setIsHandRaised(!isHandRaised)}
                activeQuiz={role === "student" ? activeQuiz : null}
                onQuizSubmit={handleQuizSubmit}
                onCloseQuiz={() => {
                    setActiveQuiz(null);
                    const exitFS = () => {
                        if (document.exitFullscreen)
                            document.exitFullscreen().catch(() => { });
                        else if (document.webkitExitFullscreen)
                            document.webkitExitFullscreen().catch(() => { });
                        else if (document.msExitFullscreen)
                            document.msExitFullscreen().catch(() => { });
                    };
                    exitFS();
                }}
                quizStarting={role === "student" ? quizStarting : false}
            />

            {/* 📜 Dedicated History Sidebar (Teacher Only) - Now on FAR RIGHT */}
            {role === "teacher" && showHistory && (
                <HistorySidebar
                    doubtsWithAnswers={doubtsWithAnswers}
                    right={0}
                    onClose={() => setShowHistory(false)}
                />
            )}

            {/* 🤖 Centralized AI Sidebar (Teacher Only) - Shifting left if History is open */}
            {role === "teacher" && showAI && (
                <AISidebar
                    role={role}
                    doubts={doubts}
                    loadingAI={loadingAI}
                    onAskAI={askAI}
                    onSendToStudent={sendToStudent}
                    onStopAudio={stopAIAudio}
                    onEditStart={handleEditStart} // ✅ EDIT -> freeze
                    onSaveDoubt={handleSaveDoubt} // ✅ SAVE -> 5 sec auto
                    onUpdateDoubt={updateDoubtText} // backup
                    onResolve={resolveDoubt}
                    onClose={() => setShowAI(false)}
                    right={showHistory ? 380 : 0}
                />
            )}

            {/* 📋 Attendance Sidebar (Teacher Only) */}
            {role === "teacher" && showAttendance && (
                <AttendanceSidebar
                    attendance={attendance}
                    doubtsWithAnswers={doubtsWithAnswers}
                    classSummary={classSummary}
                    topic={meetingTopic}
                    onClose={() => setShowAttendance(false)}
                    right={showHistory || showAI ? 380 : 0}
                />
            )}

            {/* 📊 Quiz Results Sidebar (Teacher Only) */}
            {role === "teacher" && showQuizResults && activeQuiz && (
                <QuizSidebar
                    quizId={activeQuiz.id || activeQuiz.quizId}
                    topic={activeQuiz.topic}
                    onClose={() => setShowQuizResults(false)}
                    right={showHistory || showAI || showAttendance ? 380 : 0}
                />
            )}

            {role === "teacher" && teacherClassStarted ? (
                <>
                    <div
                        style={{
                            display: "flex",
                            width: "100%",
                            height: "90vh", // 90% height to leave room for bottom controls
                            position: "relative",
                        }}
                    >
                        {/* 🔹 Left Panel (80%) - Video container is handled by TeacherVideoController,
                         but we ensure the space is allocated here.
                         Actually, TeacherVideoController renders its own fixed/absolute video.
                         We'll make it 80% in its own file. Here we just render the sidebar. */}
                        <div style={{ width: "80%", height: "100%" }} />

                        {/* 🔹 Right Panel (20%) - Student videos */}
                        <div
                            className="custom-scrollbar-hide"
                            style={{
                                width: "20%",
                                height: "100%",
                                background: "rgba(10, 15, 30, 0.65)",
                                backdropFilter: "blur(16px)",
                                borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
                                overflowY: "auto",
                                padding: "8px 9px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "16px",
                                boxShadow: "-10px 0 40px rgba(0, 0, 0, 0.4)",
                                zIndex: 10,
                            }}
                        >
                            {/* 🔹 Explicit Track Mapping for Students to avoid TrackRef context errors */}
                            <StudentVideoThumbs
                                participants={participants.filter((p) => {
                                    try {
                                        return JSON.parse(p.metadata || "{}").role !== "teacher";
                                    } catch {
                                        return true;
                                    }
                                })}
                                onShowFullGrid={() => setShowFullStudentGrid(true)}
                            />
                        </div>
                    </div>
                    {/* 🎛 Restoring bottom control bar for teacher layout */}
                    <div
                        style={{
                            position: "fixed",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: "10vh",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 1000,
                        }}
                    >
                        <ControlBar
                            controls={{
                                microphone: true,
                                camera: true,
                                screenShare: true,
                                chat: false,
                                leave: false,
                            }}
                        />
                    </div>
                </>
            ) : (
                <GridErrorBoundary>
                    <VideoConference components={customComponents} />
                </GridErrorBoundary>
            )}

            {/* 🧑‍🎓 Full Screen Student Grid (Teacher Only) */}
            {role === "teacher" && showFullStudentGrid && (
                <FullStudentGridOverlay
                    participants={participants.filter((p) => {
                        try {
                            return JSON.parse(p.metadata || "{}").role !== "teacher";
                        } catch {
                            return true;
                        }
                    })}
                    onClose={() => setShowFullStudentGrid(false)}
                />
            )}

            {/* 👩‍🏫 Teacher hand raise list */}
            <TeacherHandPanel />

            {/* 👩‍🏫 Teacher-only controls & notifications */}
            <TeacherOnlyUI
                doubts={doubts}
                onShowDoubts={() => setShowAI(!showAI)}
                onShowHistory={() => setShowHistory(!showHistory)}
                onShowAttendance={() => setShowAttendance(!showAttendance)}
                onShowQuiz={() => setShowQuizResults((prev) => !prev)}
                onGenerateQuiz={handleGenerateQuiz}
                onShowParticipants={() => setShowParticipants(!showParticipants)}
                showParticipants={showParticipants}
                recordingAudioContext={recordingAudioContext}
                recordingDestNode={recordingDestNode}
                onEndMeeting={handleEndMeeting}
                onLeaveMeeting={handleLeaveMeeting}
                waitingStudents={waitingStudents}
                onAdmit={handleAdmit}
                onReject={handleReject}
                onClassStatusChange={setTeacherClassStarted}
                isRecording={isRecording}
                isPaused={isPaused}
                showRecordMenu={showRecordMenu}
                setShowRecordMenu={setShowRecordMenu}
                handleStartRecording={handleStartRecording}
                handleStopRecording={handleStopRecording}
                handlePauseRecording={handlePauseRecording}
                handleResumeRecording={handleResumeRecording}
                handleSaveRecording={handleSaveRecording}
                recordingDuration={recordingDuration}
            />

            {/* Sequential Hand Raise Audio Notification Trigger */}
            <HandRaiseAudioNotifier queue={handRaiseQueue} role={role} />
        </>
    );
}

/* 🎥 COMPONENT: Renders student thumbnails with explicit track refs to avoid context errors */
function StudentVideoThumbs({ participants, onShowFullGrid }) {
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false },
    );

    // Filter tracks to only include those from the provided student participants
    // Filter tracks to only include those from the provided student participants
    // 1. Sort participants
    const sortedParticipants = [...participants].sort((a, b) => {
        // Camera on gets highest priority
        if (a.isCameraEnabled && !b.isCameraEnabled) return -1;
        if (!a.isCameraEnabled && b.isCameraEnabled) return 1;

        // Mic on gets second priority
        if (a.isMicrophoneEnabled && !b.isMicrophoneEnabled) return -1;
        if (!a.isMicrophoneEnabled && b.isMicrophoneEnabled) return 1;

        // Otherwise sort alphabetically
        return a.identity.localeCompare(b.identity);
    });

    // 2. Limit to top 3
    const top3Participants = sortedParticipants.slice(0, 3);
    const extraCount = Math.max(0, participants.length - 3);

    const studentIdentities = new Set(top3Participants.map((p) => p.identity));
    const studentTracks = tracks.filter((tr) =>
        studentIdentities.has(tr.participant.identity),
    );

    return (
        <>
            <style>{`
                .custom-student-grid .lk-participant-metadata,
                .custom-student-grid .lk-participant-name,
                .custom-student-grid .lk-track-muted-indicator-camera,
                .custom-student-grid .lk-track-muted-indicator-microphone,
                .custom-student-grid .lk-connection-quality {
                    display: none !important;
                }
                /* Hide scrollbar for Chrome, Safari and Opera */
                .custom-scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                /* Hide scrollbar for IE, Edge and Firefox */
                .custom-scrollbar-hide {
                    -ms-overflow-style: none;  /* IE and Edge */
                    scrollbar-width: none;  /* Firefox */
                }
            `}</style>
            {studentTracks.map((trackRef) => {
                const isSpeaking = trackRef.participant.isSpeaking;
                return (
                    <div
                        className="custom-student-grid"
                        key={`${trackRef.participant.identity}_${trackRef.source}`}
                        style={{
                            height: 'min-content',
                            minHeight: 'min-content',
                            position: "relative",
                            borderRadius: "16px",
                            overflow: "hidden",
                            border: isSpeaking
                                ? "2px solid #2196F3"
                                : "1px solid rgba(255, 255, 255, 0.12)",
                            boxShadow: isSpeaking
                                ? "0 0 20px rgba(33, 150, 243, 0.4), inset 0 0 0 1px rgba(33,150,243,0.2)"
                                : "0 8px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
                            transform: isSpeaking
                                ? "scale(1.02) translateY(-2px)"
                                : "scale(1) translateY(0)",
                            transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
                            background:
                                "linear-gradient(180deg, rgba(20,25,35,0.6) 0%, rgba(10,15,25,0.9) 100%)",
                        }}
                    >
                        {/* Custom Name Badge */}
                        <div
                            style={{
                                position: "absolute",
                                bottom: "9px",
                                left: "12px",
                                background: "rgba(0, 0, 0, 0.6)",
                                backdropFilter: "blur(8px)",
                                padding: "6px 12px",
                                borderRadius: "8px",
                                color: "#fff",
                                fontSize: "13px",
                                fontWeight: "600",
                                fontFamily: "Inter, sans-serif",
                                zIndex: 10,
                                border: "1px solid rgba(255, 255, 255, 0.05)",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                            }}
                        >
                            <span
                                style={{
                                    width: "8px",
                                    height: "8px",
                                    borderRadius: "50%",
                                    background:
                                        trackRef.participant.isMicrophoneEnabled ||
                                            trackRef.participant.isCameraEnabled
                                            ? "#2196F3"
                                            : "#f44336",
                                    boxShadow:
                                        trackRef.participant.isMicrophoneEnabled ||
                                            trackRef.participant.isCameraEnabled
                                            ? "0 0 8px rgba(33, 150, 243, 0.8)"
                                            : "none",
                                }}
                            />
                            {trackRef.participant.identity}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    marginLeft: "4px",
                                    color: "rgba(255,255,255,0.8)",
                                }}
                            >
                                {trackRef.participant.isMicrophoneEnabled ? (
                                    <BsMicFill size={12} color="#2196F3" />
                                ) : (
                                    <BsMicMuteFill size={12} color="#f44336" />
                                )}
                                {trackRef.participant.isCameraEnabled ? (
                                    <BsCameraVideoFill size={12} color="#2196F3" />
                                ) : (
                                    <BsCameraVideoOffFill size={12} color="#f44336" />
                                )}
                            </div>
                        </div>
                        <TrackRefContext.Provider value={trackRef}>
                            <ParticipantTile />
                        </TrackRefContext.Provider>
                    </div>
                );
            })}
            {extraCount > 0 && (
                <div
                    onClick={onShowFullGrid}
                    style={{
                        height: "160px",
                        minHeight: "160px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        background:
                            "linear-gradient(145deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.8))",
                        backdropFilter: "blur(16px)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "16px",
                        color: "#fff",
                        fontFamily: "Inter, sans-serif",
                        boxShadow:
                            "0 8px 25px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
                        transition: "all 0.3s ease",
                        cursor: "pointer",
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.background =
                            "linear-gradient(145deg, rgba(40, 51, 70, 0.7), rgba(20, 30, 50, 0.9))";
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow =
                            "0 12px 30px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)";
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.background =
                            "linear-gradient(145deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.8))";
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow =
                            "0 8px 25px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)";
                    }}
                >
                    <div
                        style={{
                            fontSize: "2.5rem",
                            fontWeight: "800",
                            background: "linear-gradient(135deg, #ffffff, #94a3b8)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            textShadow: "0 2px 10px rgba(255,255,255,0.1)",
                        }}
                    >
                        +{extraCount}
                    </div>
                    <div
                        style={{
                            fontSize: "0.85rem",
                            color: "rgba(255,255,255,0.5)",
                            marginTop: "6px",
                            fontWeight: "600",
                            letterSpacing: "0.5px",
                            textTransform: "uppercase",
                        }}
                    >
                        More Students
                    </div>
                </div>
            )}
        </>
    );
}

/* 🔊 COMPONENT: Handles sequential audio so it doesn't re-trigger on every render of RoomContent */
function HandRaiseAudioNotifier({ queue, role }) {
    const notifiedIdentities = useRef(new Set());
    const delayTimerRef = useRef(null);
    const hasSpokenBatchMsg = useRef(false);

    useEffect(() => {
        if (role !== "teacher") return;

        // If queue is empty, we don't clear the 'notified' set immediately
        // to prevent repeats if someone spam clicks. We only clear it if the queue stays empty
        if (queue.length === 0) {
            if (!delayTimerRef.current) {
                delayTimerRef.current = setTimeout(() => {
                    notifiedIdentities.current.clear();
                }, 10000); // Clear history after 10s of silence
            }
            return;
        }

        // Clear the cleanup timer if a new hand is raised
        if (delayTimerRef.current) {
            clearTimeout(delayTimerRef.current);
            delayTimerRef.current = null;
        }

        // ⭐ Special Case: 5+ Students (Batch Announcement)
        if (queue.length >= 5 && !hasSpokenBatchMsg.current) {
            hasSpokenBatchMsg.current = true;
            const txt =
                "As several students have raised doubts, I will now conclude the session and proceed to clarify each of your questions.";
            speakText(txt).catch((err) => console.error("TTS Error:", err));
            if (room) {
                room.localParticipant.publishData(
                    new TextEncoder().encode(
                        JSON.stringify({ action: "AI_SPEAK_BROADCAST", text: txt }),
                    ),
                    { reliable: true },
                );
            }
            return;
        }

        // Regular individual notifications
        if (queue.length < 5) {
            const currentLead = queue[0];

            // Only notify if we haven't notified this person in this "session"
            if (!notifiedIdentities.current.has(currentLead)) {
                notifiedIdentities.current.add(currentLead);

                // Small delay to ensure previous audio (like a greeting) finished
                setTimeout(() => {
                    const txt = `${currentLead}, you raised your hand. Do you have any doubts? If so, please click the ‘Ask a Doubt’ button to submit your question.`;
                    speakText(txt).catch((err) => console.error("TTS Error:", err));
                    if (room) {
                        room.localParticipant.publishData(
                            new TextEncoder().encode(
                                JSON.stringify({ action: "AI_SPEAK_BROADCAST", text: txt }),
                            ),
                            { reliable: true },
                        );
                    }
                }, 2000);
            }
        }
    }, [queue, role]);

    return null;
}

/* ---------------- KRISP NOISE FILTER ACTIVATOR ---------------- */
function NoiseFilterActivator() {
    const { localParticipant } = useLocalParticipant();
    const filterRef = useRef(null);

    useEffect(() => {
        let cancelled = false;

        async function applyFilter() {
            // Dynamic import to avoid SSR "Worker is not defined" error
            const { KrispNoiseFilter, isKrispNoiseFilterSupported } =
                await import("@livekit/krisp-noise-filter");

            if (!isKrispNoiseFilterSupported()) {
                console.warn("[KrispNoiseFilter] Not supported in this browser.");
                return;
            }

            if (cancelled) return;

            // Wait for the microphone track to become available
            const getMicTrack = () => {
                const pub = localParticipant?.getTrackPublication(
                    Track.Source.Microphone,
                );
                return pub?.track ?? null;
            };

            let micTrack = getMicTrack();
            if (!micTrack) {
                // Retry up to 5s until track is published
                for (let i = 0; i < 50; i++) {
                    await new Promise((r) => setTimeout(r, 100));
                    if (cancelled) return;
                    micTrack = getMicTrack();
                    if (micTrack) break;
                }
            }

            if (!micTrack || cancelled) return;

            try {
                const filter = KrispNoiseFilter();
                filterRef.current = filter;
                await micTrack.setProcessor(filter);
                console.log("✅ [KrispNoiseFilter] Noise cancellation active.");
            } catch (err) {
                console.error("[KrispNoiseFilter] Failed to apply:", err);
            }
        }

        applyFilter();

        return () => {
            cancelled = true;
            const mic = localParticipant?.getTrackPublication(
                Track.Source.Microphone,
            )?.track;
            if (mic && filterRef.current) {
                mic.stopProcessor().catch(() => { });
                filterRef.current = null;
                console.log("🔇 [KrispNoiseFilter] Noise cancellation removed.");
            }
        };
    }, [localParticipant]);

    return null;
}
/* ---------------- FULL SCREEN STUDENT GRID (TEACHER) ---------------- */
function FullStudentGridOverlay({ participants, onClose }) {
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false },
    );

    const studentIdentities = new Set(participants.map((p) => p.identity));
    const studentTracks = tracks.filter((tr) =>
        studentIdentities.has(tr.participant.identity),
    );

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 99998,
                background: "rgba(10, 15, 30, 0.95)",
                backdropFilter: "blur(20px)",
                display: "flex",
                flexDirection: "column",
                padding: "24px",
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "20px",
                }}
            >
                <h2
                    style={{
                        color: "#fff",
                        margin: 0,
                        fontFamily: "Inter, sans-serif",
                        fontWeight: 700,
                        fontSize: "1.5rem",
                    }}
                >
                    Participants ({participants.length})
                </h2>
                <button
                    onClick={onClose}
                    style={{
                        background: "rgba(255,255,255,0.1)",
                        border: "none",
                        color: "#fff",
                        width: "44px",
                        height: "44px",
                        borderRadius: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        transition: "all 0.2s",
                    }}
                    onMouseOver={(e) =>
                        (e.currentTarget.style.background = "rgba(244, 67, 54, 0.8)")
                    }
                    onMouseOut={(e) =>
                        (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
                    }
                >
                    <MdClose size={24} />
                </button>
            </div>

            <div
                className="custom-scrollbar-hide"
                style={{
                    flex: 1,
                    overflowY: "auto",
                    display: "grid",
                    gap: "20px",
                    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                    alignContent: "start",
                }}
            >
                <style>{`
                    .custom-student-grid .lk-participant-metadata,
                    .custom-student-grid .lk-participant-name,
                    .custom-student-grid .lk-track-muted-indicator-camera,
                    .custom-student-grid .lk-track-muted-indicator-microphone,
                    .custom-student-grid .lk-connection-quality {
                        display: none !important;
                    }
                    /* Hide scrollbar for Chrome, Safari and Opera */
                    .custom-scrollbar-hide::-webkit-scrollbar {
                        display: none;
                    }
                    /* Hide scrollbar for IE, Edge and Firefox */
                    .custom-scrollbar-hide {
                        -ms-overflow-style: none;  /* IE and Edge */
                        scrollbar-width: none;  /* Firefox */
                    }
                `}</style>
                {studentTracks.map((trackRef) => {
                    const isSpeaking = trackRef.participant.isSpeaking;
                    return (
                        <div
                            className="custom-student-grid"
                            key={`${trackRef.participant.identity}_${trackRef.source}`}
                            style={{
                                height: "240px",
                                borderRadius: "16px",
                                overflow: "hidden",
                                position: "relative",
                                border: isSpeaking
                                    ? "2px solid #2196F3"
                                    : "1px solid rgba(255, 255, 255, 0.1)",
                                boxShadow: isSpeaking
                                    ? "0 0 24px rgba(33, 150, 243, 0.3)"
                                    : "0 10px 30px rgba(0, 0, 0, 0.4)",
                                background:
                                    "linear-gradient(180deg, rgba(20,25,35,0.6) 0%, rgba(10,15,25,0.9) 100%)",
                            }}
                        >
                            <div
                                style={{
                                    position: "absolute",
                                    bottom: "12px",
                                    left: "12px",
                                    background: "rgba(0, 0, 0, 0.6)",
                                    backdropFilter: "blur(8px)",
                                    padding: "6px 12px",
                                    borderRadius: "8px",
                                    color: "#fff",
                                    fontSize: "14px",
                                    fontWeight: "600",
                                    fontFamily: "Inter, sans-serif",
                                    zIndex: 10,
                                    border: "1px solid rgba(255, 255, 255, 0.05)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                }}
                            >
                                <span
                                    style={{
                                        width: "8px",
                                        height: "8px",
                                        borderRadius: "50%",
                                        background:
                                            trackRef.participant.isMicrophoneEnabled ||
                                                trackRef.participant.isCameraEnabled
                                                ? "#2196F3"
                                                : "#f44336",
                                        boxShadow:
                                            trackRef.participant.isMicrophoneEnabled ||
                                                trackRef.participant.isCameraEnabled
                                                ? "0 0 8px rgba(33, 150, 243, 0.8)"
                                                : "none",
                                    }}
                                />
                                {trackRef.participant.identity}
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        marginLeft: "6px",
                                        color: "rgba(255,255,255,0.8)",
                                    }}
                                >
                                    {trackRef.participant.isMicrophoneEnabled ? (
                                        <BsMicFill size={14} color="#2196F3" />
                                    ) : (
                                        <BsMicMuteFill size={14} color="#f44336" />
                                    )}
                                    {trackRef.participant.isCameraEnabled ? (
                                        <BsCameraVideoFill size={14} color="#2196F3" />
                                    ) : (
                                        <BsCameraVideoOffFill size={14} color="#f44336" />
                                    )}
                                </div>
                            </div>
                            <TrackRefContext.Provider value={trackRef}>
                                <ParticipantTile />
                            </TrackRefContext.Provider>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
/* ---------------- PAGE CLIENT ---------------- */
export function PageClientImpl({ token, url }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted)
        return <p style={{ color: "white", padding: 20 }}>Joining room…</p>;

    return (
        <LiveKitRoom
            token={token}
            serverUrl={url}
            connect={true}
            video={{ enabled: true }}
            audio={{
                enabled: true,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            }}
            data-lk-theme="default"
            style={{ height: "100dvh", position: "relative", background: "#000" }}
            onError={(error) => {
                console.error("LiveKit Room Error:", error);
                alert(`Connection Error: ${error.message}`);
            }}
        >
            <NoiseFilterActivator />
            <RoomAudioRenderer />
            <RoomContent />
        </LiveKitRoom>
    );
}
