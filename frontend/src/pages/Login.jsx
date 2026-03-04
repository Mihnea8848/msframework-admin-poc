import { useState } from "react";
import { SiGithub, SiGoogle, SiApple } from '@icons-pack/react-simple-icons';
import { Link } from "react-router-dom";
import logo from "../assets/ms_logo.png";
import WavyBackground from "../ui/WavyBackground.jsx";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    async function onSubmit(e) {
        e.preventDefault();
        // TODO: wire POST /api/auth/login with credentials: "include"
        console.log({ email, password });
    }

    return (
        <div className="auth-bg">
            <div className="auth-circuit">
                <WavyBackground colorA="#28beef" colorB="#2487cb" />
                <div className="auth-card">
                    <div className="auth-brand">
                        <img className="auth-logo" src={logo} alt="MSFramework" />
                    </div>
                    <h1 className="auth-title">Welcome Back</h1>
                    <div className="auth-subtitle">
                        Don’t have an account yet? <Link className="auth-link" to="/register">Sign up</Link>
                    </div>

                    <form className="auth-form" onSubmit={onSubmit}>
                        <div className="auth-field">
                            <label className="auth-label" htmlFor="email">Email address</label>
                            <input
                                id="email"
                                className="auth-input"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="email address"
                                required
                            />
                        </div>

                        <div className="auth-field">
                            <label className="auth-label" htmlFor="password">Password</label>
                            <input
                                id="password"
                                className="auth-input"
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password"
                                required
                            />
                        </div>

                        <button className="auth-primary" type="submit">Login</button>

                        <div className="auth-divider">
                            <span>OR</span>
                        </div>

                        <div className="auth-social">
                            <button type="button" className="auth-social-btn" aria-label="Sign in with Apple">
                                <SiApple size={16} />
                            </button>
                            <button type="button" className="auth-social-btn" aria-label="Sign in with Google">
                                <SiGoogle size={16} />
                            </button>
                            <button type="button" className="auth-social-btn" aria-label="Sign in with GitHub">
                                <SiGithub size={16} />
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}