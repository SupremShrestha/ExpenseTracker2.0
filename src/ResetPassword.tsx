import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "./supabase";

export default function ResetPassword({ onDone }: { onDone: () => void }) {
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    async function submit(e: FormEvent) {
        e.preventDefault();
        if (password.length < 6) return setError("Use at least 6 characters.");
        if (password !== confirm)
            return setError("The passwords do not match.");

        setBusy(true);
        setError("");
        const { error: err } = await supabase.auth.updateUser({ password });
        setBusy(false);
        if (err) setError(err.message);
        else onDone();
    }

    async function cancel() {
        await supabase.auth.signOut();
        onDone();
    }

    return (
        <main className="auth">
            <div className="card auth-card">
                <h1>Set a new password</h1>
                <p className="muted">
                    Choose a password you'll use to sign in on your devices.
                </p>
                <form onSubmit={submit}>
                    <input
                        type="password"
                        placeholder="New password"
                        autoComplete="new-password"
                        minLength={6}
                        required
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            setError("");
                        }}
                    />
                    <input
                        type="password"
                        placeholder="Repeat new password"
                        autoComplete="new-password"
                        minLength={6}
                        required
                        value={confirm}
                        onChange={(e) => {
                            setConfirm(e.target.value);
                            setError("");
                        }}
                    />
                    <button className="primary" disabled={busy}>
                        Save password
                    </button>
                    {error && <p className="error">{error}</p>}
                    <button type="button" className="link" onClick={cancel}>
                        Link expired or not you? Back to sign in
                    </button>
                </form>
            </div>
        </main>
    );
}
