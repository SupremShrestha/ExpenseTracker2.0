import { useEffect, useState } from 'react';

export type Route = 'home' | 'activity' | 'insights' | 'plan' | 'settings';
const ROUTES: string[] = ['home', 'activity', 'insights', 'plan', 'settings'];

function read(): Route {
    const h = window.location.hash.replace(/^#\/?/, '');
    return ROUTES.includes(h) ? (h as Route) : 'home';
}

export function useRoute() {
    const [route, setRoute] = useState<Route>(read);

    useEffect(() => {
        const onChange = () => {
            setRoute(read());
            window.scrollTo(0, 0);
        };
        window.addEventListener('hashchange', onChange);
        return () => window.removeEventListener('hashchange', onChange);
    }, []);

    const go = (r: Route) => {
        window.location.hash = `/${r}`;
    };

    return { route, go };
}