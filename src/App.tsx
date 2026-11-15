import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "./useAuth";
import { useTheme } from "./useTheme";
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
const THEME_LABEL = { system: "◐ Auto", light: "☀ Light", dark: "☾ Dark" };

export default function App() {
    const { loading, signedIn, session } = useAuth();
    const status = useSyncExternalStore(subscribeStatus, getStatus);
    const { theme, cycle } = useTheme();
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

    if (loading)
        return (
            <p className="muted center" style={{ marginTop: 80 }}>
                Loading…
            </p>
        );
    if (!signedIn) return <Login />;

    return (
        <>
            <header className="topbar">
                <div className="topbar-inner">
                    <span className="brand">Expenses</span>
                    <div className="topbar-actions">
                        <button
                            className="pill"
                            onClick={syncNow}
                            title={
                                status === "error"
                                    ? getError()
                                    : "Tap to sync now"
                            }
                        >
                            <span className={`dot dot-${status}`} />
                            {LABEL[status]}
                        </button>
                        <button className="ghost" onClick={cycle}>
                            {THEME_LABEL[theme]}
                        </button>
                        <button
                            className="ghost"
                            title={session?.user.email ?? "Offline"}
                            onClick={() => supabase.auth.signOut()}
                        >
                            Sign out
                        </button>
                    </div>
                </div>
            </header>
            <Tracker />
        </>
    );
}
