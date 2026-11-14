import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "./supabase";
import {
    startSync,
    syncNow,
    subscribeStatus,
    getStatus,
    getError,
} from "./sync";
import Login from "./Login";
import Tracker from "./Tracker";

const LABEL = {
    idle: "Synced",
    syncing: "Syncing…",
    offline: "Offline",
    error: "Sync error",
};

export default function App() {
    const { loading, signedIn, session } = useAuth();
    const status = useSyncExternalStore(subscribeStatus, getStatus);
    const userId = session?.user.id;

    useEffect(() => {
        if (!userId) return;
        let stop: (() => void) | undefined;
        let cancelled = false;
        startSync(userId).then((s) => (cancelled ? s() : (stop = s)));
        return () => {
            cancelled = true;
            stop?.();
        };
    }, [userId]);

    if (loading) return <p style={{ padding: 16 }}>Loading…</p>;
    if (!signedIn) return <Login />;

    return (
        <>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "8px 16px",
                    fontFamily: "system-ui",
                }}
            >
                <small>{session?.user.email ?? "Offline"}</small>
                <small title={status === "error" ? getError() : ""}>
                    {LABEL[status]} <button onClick={syncNow}>↻</button>
                </small>
                <button onClick={() => supabase.auth.signOut()}>
                    Sign out
                </button>
            </div>
            <Tracker />
        </>
    );
}
