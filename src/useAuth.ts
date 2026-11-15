import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

const CACHE_KEY = 'last-user-id';

// Read the URL once, before the Supabase client clears it, so we reliably
// notice that the user arrived from a password-reset email.
const startedInRecovery =
    typeof window !== 'undefined' &&
    /type=recovery/.test(window.location.hash + window.location.search);

export function useAuth() {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [recovering, setRecovering] = useState(startedInRecovery);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            if (data.session) localStorage.setItem(CACHE_KEY, data.session.user.id);
            setLoading(false);
        });

        const { data } = supabase.auth.onAuthStateChange((event, s) => {
            setSession(s);
            if (event === 'PASSWORD_RECOVERY') setRecovering(true);
            if (s) localStorage.setItem(CACHE_KEY, s.user.id);
            if (event === 'SIGNED_OUT') {
                localStorage.removeItem(CACHE_KEY);
                setRecovering(false);
            }
        });
        return () => data.subscription.unsubscribe();
    }, []);

    // Offline with an expired token: the session can't refresh, but you
    // should still be able to open the app and log expenses.
    const offlineUser =
        !session && !navigator.onLine && !!localStorage.getItem(CACHE_KEY);

    return {
        session,
        loading,
        signedIn: !!session || offlineUser,
        recovering,
        finishRecovery: () => setRecovering(false),
    };
}