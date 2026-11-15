import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "./supabase";

export default function Login() {
    const [mode, setMode] = useState<"signin" | "signup">("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [msg, setMsg] = useState("");
    const [busy, setBusy] = useState(false);

    async function submit(e: FormEvent) {
        e.preventDefault();
        setBusy(true);
        setMsg("");
        const creds = { email, password };

        if (mode === "signin") {
            const { error } = await supabase.auth.signInWithPassword(creds);
            if (error) setMsg(error.message);
        } else {
            const { data, error } = await supabase.auth.signUp(creds);
            if (error) setMsg(error.message);
            else if (!data.session)
                setMsg(
                    "Account created, but email confirmation is still enabled. Turn it off in Supabase or confirm the user.",
                );
        }
        setBusy(false);
    }

    return (
        <main className="auth">
            <div className="card auth-card">
                <h1>Expense Tracker</h1>
                <p className="muted">
                    {mode === "signin"
                        ? "Sign in to sync your data."
                        : "Create an account to get started."}
                </p>
                <form onSubmit={submit}>
                    <input
                        type="email"
                        placeholder="Email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
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
                    <button className="primary" disabled={busy}>
                        {mode === "signin" ? "Sign in" : "Sign up"}
                    </button>
                    {msg && <p className="error">{msg}</p>}
                    <button
                        type="button"
                        className="link"
                        onClick={() =>
                            setMode(mode === "signin" ? "signup" : "signin")
                        }
                    >
                        {mode === "signin"
                            ? "Need an account? Sign up"
                            : "Have an account? Sign in"}
                    </button>
                </form>
            </div>
        </main>
    );
}
