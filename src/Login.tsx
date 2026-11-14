import { useState } from "react";
import { supabase } from "./supabase";

export default function Login() {
    const [mode, setMode] = useState<"signin" | "signup">("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [msg, setMsg] = useState("");
    const [busy, setBusy] = useState(false);

    async function submit() {
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
        <main
            style={{
                maxWidth: 360,
                margin: "80px auto",
                padding: 16,
                fontFamily: "system-ui",
            }}
        >
            <h1>{mode === "signin" ? "Sign in" : "Create account"}</h1>
            <div style={{ display: "grid", gap: 8 }}>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <input
                    type="password"
                    placeholder="Password (min 6 chars)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <button onClick={submit} disabled={busy}>
                    {mode === "signin" ? "Sign in" : "Sign up"}
                </button>
                {msg && <p style={{ color: "crimson" }}>{msg}</p>}
                <button
                    onClick={() =>
                        setMode(mode === "signin" ? "signup" : "signin")
                    }
                >
                    {mode === "signin"
                        ? "Need an account? Sign up"
                        : "Have an account? Sign in"}
                </button>
            </div>
        </main>
    );
}
