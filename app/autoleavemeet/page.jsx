"use client";

import { useEffect, useState } from "react";
import { TbBrandZoom } from "react-icons/tb";
import '../../styles/page.css'

export default function AutoLeaveMeetPage() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <div style={{
            minHeight: "100vh",
            background: "radial-gradient(circle at center, #1a1a2e 0%, #0a0a12 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Inter', sans-serif",
            color: "#f8fafc",
            padding: "24px"
        }}>
            <div style={{
                maxWidth: "500px",
                width: "100%",
                background: "rgba(30, 41, 59, 0.4)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "32px",
                padding: "60px 40px",
                textAlign: "center",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                display: "flex",
                flexDirection: "column",
                gap: "32px",
                animation: "popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)"
            }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                    <div style={{
                        width: "80px",
                        height: "80px",
                        background: "rgba(16, 185, 129, 0.1)",
                        borderRadius: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "40px"
                    }}>
                        ✅
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <TbBrandZoom style={{ fontSize: "24px", color: "#6366f1" }} />
                        <span style={{ fontWeight: "700", fontSize: "14px", letterSpacing: "1px", textTransform: "uppercase", opacity: 0.6 }}>SkyMeet</span>
                    </div>
                </div>

                <div>
                    <h1 style={{ fontSize: "32px", fontWeight: "800", marginBottom: "12px" }}>
                        Session Finished
                    </h1>
                    <p style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: "16px", lineHeight: "1.6" }}>
                        Your assessment has been successfully submitted. You have been disconnected from the classroom.
                    </p>
                </div>

                <div style={{
                    padding: "20px",
                    background: "rgba(255, 255, 255, 0.02)",
                    borderRadius: "20px",
                    border: "1px dashed rgba(255, 255, 255, 0.1)"
                }}>
                    <p style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.4)", margin: 0 }}>
                        Thank you for your participation. <br /> You may now close this browser window.
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes popIn {
                    from { opacity: 0; transform: scale(0.9) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </div>
    );
}
