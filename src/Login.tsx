import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "./supabase";

type Mode = "signin" | "signup" | "forgot";

export default function Login() {
    const [mode, setMode] = useState<Mode>("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");
    const [busy, setBusy] = useState(false);

    function switchMode(m: Mode) {
        setMode(m);
        setError("");
        setInfo("");
    }

    async function submit(e: FormEvent) {
        e.preventDefault();
        setBusy(true);
        setError("");
        setInfo("");

        if (mode === "signin") {
            const { error: err } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (err) setError(err.message);
        } else if (mode === "signup") {
            const { data, error: err } = await supabase.auth.signUp({
                email,
                password,
            });
            if (err) setError(err.message);
            else if (!data.session)
                setError(
                    "Account created, but email confirmation is still enabled. Turn it off in Supabase or confirm the user.",
                );
        } else {
            const { error: err } = await supabase.auth.resetPasswordForEmail(
                email,
                {
                    redirectTo: window.location.origin,
                },
            );
            if (err) setError(err.message);
            else
                setInfo(
                    "If that email has an account, a reset link is on its way. Check your inbox and spam folder.",
                );
        }
        setBusy(false);
    }

    async function google() {
        setBusy(true);
        setError("");
        const { error: err } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: window.location.origin },
        });
        // On success the browser leaves for Google, so there's nothing more to do here
        if (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    const title =
        mode === "signin"
            ? "Sign in"
            : mode === "signup"
              ? "Create account"
              : "Reset password";
    const subtitle =
        mode === "signin"
            ? "Sign in to sync your data."
            : mode === "signup"
              ? "Create an account to get started."
              : "Enter your email and we'll send you a link to set a new password.";

    return (
        <main className="auth">
            <div className="card auth-card">
                <h1>{title}</h1>
                <p className="muted">{subtitle}</p>

                {mode !== "forgot" && (
                    <>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={google}
                            style={{ width: "100%", padding: 11, marginTop: 8 }}
                        >
                            Continue with Google
                        </button>
                        <div
                            className="muted small center"
                            style={{
                                margin: "12px 0 0",
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                            }}
                        >
                            <span
                                style={{
                                    flex: 1,
                                    height: 1,
                                    background: "var(--border)",
                                }}
                            />
                            or use email
                            <span
                                style={{
                                    flex: 1,
                                    height: 1,
                                    background: "var(--border)",
                                }}
                            />
                        </div>
                    </>
                )}

                <form onSubmit={submit}>
                    <input
                        type="email"
                        placeholder="Email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    {mode !== "forgot" && (
                        <input
                            type="password"
                            placeholder="Password (min 6 characters)"
                            autoComplete={
                                mode === "signin"
                                    ? "current-password"
                                    : "new-password"
                            }
                            minLength={6}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    )}
                    <button className="primary" disabled={busy}>
                        {mode === "signin"
                            ? "Sign in"
                            : mode === "signup"
                              ? "Sign up"
                              : "Send reset link"}
                    </button>

                    {error && <p className="error">{error}</p>}
                    {info && <p className="muted small">{info}</p>}

                    {mode === "signin" && (
                        <button
                            type="button"
                            className="link"
                            onClick={() => switchMode("forgot")}
                        >
                            Forgot password?
                        </button>
                    )}
                    <button
                        type="button"
                        className="link"
                        onClick={() =>
                            switchMode(
                                mode === "signup"
                                    ? "signin"
                                    : mode === "signin"
                                      ? "signup"
                                      : "signin",
                            )
                        }
                    >
                        {mode === "signin"
                            ? "Need an account? Sign up"
                            : mode === "signup"
                              ? "Have an account? Sign in"
                              : "Back to sign in"}
                    </button>
                </form>
            </div>
        </main>
    );
}
