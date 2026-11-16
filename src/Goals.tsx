import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, today, type Goal } from "./db";
import GoalSheet from "./GoalSheet";

const fmt = (n: number) =>
    n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

function monthsLeft(deadline: string): number | null {
    const [ty, tm, td] = today().split("-").map(Number);
    const [y, m, d] = deadline.split("-").map(Number);
    const days =
        (new Date(y, m - 1, d).getTime() - new Date(ty, tm - 1, td).getTime()) /
        86_400_000;
    if (days <= 0) return null; // deadline passed
    return Math.max(1, Math.ceil(days / 30.44));
}

export default function Goals() {
    const [sheet, setSheet] = useState<{
        goal: Goal | null;
        mode: "edit" | "money";
    } | null>(null);

    const goals =
        useLiveQuery(
            () => db.goals.filter((g) => !g.deleted_at).sortBy("created_at"),
            [],
        ) ?? [];

    return (
        <section className="card">
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <h3 style={{ margin: 0 }}>Savings goals</h3>
                <button onClick={() => setSheet({ goal: null, mode: "edit" })}>
                    + Goal
                </button>
            </div>

            {goals.length === 0 && (
                <p className="muted small" style={{ margin: "8px 0 0" }}>
                    Saving for something? Add a goal with a target to track your
                    progress.
                </p>
            )}

            <div
                style={{
                    display: "grid",
                    gap: 16,
                    marginTop: goals.length ? 12 : 0,
                }}
            >
                {goals.map((g) => {
                    const pct = Math.min(100, (g.saved / g.target) * 100);
                    const remaining = Math.max(0, g.target - g.saved);
                    const reached = g.saved >= g.target;
                    const left = g.deadline ? monthsLeft(g.deadline) : null;

                    let hint = "";
                    if (reached) hint = "Goal reached";
                    else if (g.deadline && left === null)
                        hint = `Deadline passed · ${fmt(remaining)} to go`;
                    else if (g.deadline && left !== null)
                        hint = `${fmt(remaining)} to go · about ${fmt(remaining / left)} per month until ${g.deadline}`;
                    else hint = `${fmt(remaining)} to go`;

                    return (
                        <div key={g.id}>
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 8,
                                }}
                            >
                                <b
                                    style={{
                                        minWidth: 0,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                    }}
                                >
                                    {g.name}
                                </b>
                                <span
                                    className="muted small"
                                    style={{ whiteSpace: "nowrap" }}
                                >
                                    {fmt(g.saved)} / {fmt(g.target)} ·{" "}
                                    {pct.toFixed(0)}%
                                </span>
                            </div>
                            <div
                                style={{
                                    height: 8,
                                    borderRadius: 4,
                                    background: "rgba(128,128,128,0.25)",
                                    margin: "8px 0 6px",
                                }}
                            >
                                <div
                                    style={{
                                        width: `${pct}%`,
                                        height: "100%",
                                        borderRadius: 4,
                                        background: reached
                                            ? "#22c55e"
                                            : "var(--accent)",
                                    }}
                                />
                            </div>
                            <div className="muted small">{hint}</div>
                            <div
                                style={{
                                    display: "flex",
                                    gap: 8,
                                    marginTop: 8,
                                }}
                            >
                                <button
                                    onClick={() =>
                                        setSheet({ goal: g, mode: "money" })
                                    }
                                >
                                    Add / take out
                                </button>
                                <button
                                    className="ghost"
                                    onClick={() =>
                                        setSheet({ goal: g, mode: "edit" })
                                    }
                                >
                                    Edit
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {sheet && (
                <GoalSheet
                    goal={sheet.goal}
                    mode={sheet.mode}
                    onClose={() => setSheet(null)}
                />
            )}
        </section>
    );
}
