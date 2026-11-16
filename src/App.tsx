import { useEffect } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "./supabase";
import { startSync } from "./sync";
import Login from "./Login";
import ResetPassword from "./ResetPassword";
import Shell from "./Shell";

export default function App() {
    const { loading, signedIn, session, recovering, finishRecovery } =
        useAuth();
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
    if (recovering) return <ResetPassword onDone={finishRecovery} />;
    if (!signedIn) return <Login />;

    return (
        <Shell
            email={session?.user.email ?? null}
            onSignOut={() => supabase.auth.signOut()}
        />
    );
}
