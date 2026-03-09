'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TbBrandZoom } from "react-icons/tb";
import '../../styles/page.css'; // Reuse existing styles

export default function Register() {
    const router = useRouter();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async (e) => {
        e.preventDefault();

        if (!email || !password || !name.trim()) {
            alert('Please fill in all fields (Name, Email, Password)');
            return;
        }

        setLoading(true);

        try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
            const response = await fetch(`${backendUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();
            if (data.success) {
                alert('Registration successful! Please login.');
                router.push('/');
            } else {
                alert(data.error || 'Registration failed');
            }
        } catch (err) {
            console.error(err);
            alert('Registration failed. Ensure backend is running.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="landingPage">
            {/* Top bar */}
            <header className="topbar">
                <div className="brand" style={{ cursor: 'pointer' }} onClick={() => router.push('/')}>
                    <TbBrandZoom className="brandIcon" aria-hidden />
                    <span className="brandName">SkyMeet</span>
                </div>
            </header>

            {/* Main */}
            <main className="landingMain">
                {/* Left hero */}
                <section className="hero">
                    <h1 className="heroTitle">
                        Join the Smart <span className="heroAccent">Learning Platform</span>
                    </h1>

                    <p className="heroSub">
                        Register as a teacher to conduct structured virtual sessions with clarity, reliability, and seamless
                        collaboration tools built for academic excellence.
                    </p>
                </section>

                {/* Right card */}
                <section className="rightCard">
                    <div className="cardInner">
                        <div className="tabs tabsSingle">
                            <h1 style={{ textAlign: 'center', color: 'var(--blue)', marginBottom: '10px' }}>
                                Teacher Registration
                            </h1>
                        </div>

                        <form onSubmit={handleRegister} className="authForm authFormTight">
                            <input
                                type="text"
                                placeholder="Full Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="input inputBig"
                            />

                            <input
                                type="email"
                                placeholder="Gmail / Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input inputBig"
                            />

                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input inputBig"
                            />

                            <button type="submit" className="ctaBtn" disabled={loading}>
                                {loading ? 'Registering...' : 'Register'} <span className="arrow"></span>
                            </button>

                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                <span style={{ color: 'var(--muted)', fontSize: '14px' }}>Already have an account? </span>
                                <button
                                    type="button"
                                    onClick={() => router.push('/')}
                                    style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}
                                >
                                    Login
                                </button>
                            </div>
                        </form>
                    </div>
                </section>
            </main>
        </div>
    );
}
