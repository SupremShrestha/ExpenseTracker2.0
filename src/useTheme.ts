import { useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';
const KEY = 'theme';

function read(): Theme {
    try {
        const v = localStorage.getItem(KEY);
        return v === 'light' || v === 'dark' ? v : 'system';
    } catch {
        return 'system';
    }
}

function apply(t: Theme) {
    const el = document.documentElement;
    if (t === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', t);
}

// Apply as early as possible so the page doesn't flash the wrong theme
if (typeof document !== 'undefined') apply(read());

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(read);

    useEffect(() => {
        apply(theme);
        try {
            localStorage.setItem(KEY, theme);
        } catch {
            /* storage can be unavailable; the theme just won't persist */
        }
    }, [theme]);

    const cycle = () =>
        setTheme((t) => (t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system'));

    return { theme, cycle };
}