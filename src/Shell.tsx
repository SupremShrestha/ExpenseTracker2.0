import { useState, useSyncExternalStore } from "react";
import { today, type Expense } from "./db";
import { useRoute, type Route } from "./useRoute";
import { syncNow, subscribeStatus, getStatus, getError } from "./sync";
import ExpenseSheet from "./ExpenseSheet";
import Home from "./Home";
import Activity from "./Activity";
import Insights from "./Insights";
import Plan from "./Plan";
import Settings from "./Settings";

const STATUS_LABEL = {
    idle: "Synced",
    syncing: "Syncing…",
    offline: "Offline",
    error: "Sync error",
};

const TABS: { route: Route; label: string }[] = [
    { route: "home", label: "Home" },
    { route: "activity", label: "Activity" },
    { route: "insights", label: "Insights" },
    { route: "plan", label: "Plan" },
    { route: "settings", label: "Settings" },
];

const TITLES: Record<Route, string> = {
    home: "Home",
    activity: "Activity",
    insights: "Insights",
    plan: "Plan",
    settings: "Settings",
};

function Icon({ route }: { route: Route }) {
    const p = {
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
    } as const;
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
            {route === "home" && (
                <path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
            )}
            {route === "activity" && (
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            )}
            {route === "insights" && <path d="M6 20V11M12 20V4M18 20v-6" />}
            {route === "plan" && (
                <>
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="4" />
                </>
            )}
            {route === "settings" && (
                <>
                    <path d="M4 6h16M4 12h16M4 18h16" />
                    <circle cx="9" cy="6" r="2" fill="var(--surface)" />
                    <circle cx="15" cy="12" r="2" fill="var(--surface)" />
                    <circle cx="7" cy="18" r="2" fill="var(--surface)" />
                </>
            )}
        </svg>
    );
}

export default function Shell({
    email,
    onSignOut,
}: {
    email: string | null;
    onSignOut: () => void;
}) {
    const { route, go } = useRoute();
    const status = useSyncExternalStore(subscribeStatus, getStatus);
    const [month, setMonth] = useState(() => today().slice(0, 7)); // 'YYYY-MM'
    const [sheet, setSheet] = useState<{ editing: Expense | null } | null>(
        null,
    );

    const edit = (e: Expense) => setSheet({ editing: e });

    return (
        <>
            <header className="topbar">
                <div className="topbar-inner">
                    <span className="brand">{TITLES[route]}</span>
                    <button
                        className="pill"
                        onClick={syncNow}
                        title={
                            status === "error" ? getError() : "Tap to sync now"
                        }
                    >
                        <span className={`dot dot-${status}`} />
                        {STATUS_LABEL[status]}
                    </button>
                </div>
            </header>

            <main className="container">
                {route === "home" && (
                    <Home
                        month={month}
                        setMonth={setMonth}
                        onEdit={edit}
                        onSeeAll={() => go("activity")}
                    />
                )}
                {route === "activity" && (
                    <Activity month={month} setMonth={setMonth} onEdit={edit} />
                )}
                {route === "insights" && (
                    <Insights month={month} setMonth={setMonth} />
                )}
                {route === "plan" && <Plan />}
                {route === "settings" && (
                    <Settings email={email} onSignOut={onSignOut} />
                )}
            </main>

            {(route === "home" || route === "activity") && (
                <button
                    className="fab"
                    aria-label="Add expense"
                    onClick={() => setSheet({ editing: null })}
                >
                    +
                </button>
            )}

            <nav className="tabbar">
                <div className="tabbar-inner">
                    {TABS.map((t) => (
                        <button
                            key={t.route}
                            className={`tab ${route === t.route ? "on" : ""}`}
                            onClick={() => go(t.route)}
                        >
                            <Icon route={t.route} />
                            {t.label}
                        </button>
                    ))}
                </div>
            </nav>

            {sheet && (
                <ExpenseSheet
                    editing={sheet.editing}
                    onClose={() => setSheet(null)}
                />
            )}
        </>
    );
}
