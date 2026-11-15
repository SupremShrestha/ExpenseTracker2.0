import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from "recharts";
import { db, today } from "./db";

const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];
const tick = { fill: "currentColor", fontSize: 12 };
const round = (n: number) => Math.round(n * 100) / 100;

export default function Yearly() {
    const [year, setYear] = useState(() => Number(today().slice(0, 4)));
    const [open, setOpen] = useState(false);

    const categories =
        useLiveQuery(
            () => db.categories.filter((c) => !c.deleted_at).toArray(),
            [],
        ) ?? [];

    // Only loads data while the section is open
    const expenses =
        useLiveQuery(
            () =>
                open
                    ? db.expenses
                          .where("spent_on")
                          .between(`${year}-01-01`, `${year + 1}-01-01`)
                          .filter((e) => !e.deleted_at)
                          .toArray()
                    : Promise.resolve([]),
            [year, open],
        ) ?? [];

    const monthly = MONTHS.map((label) => ({ label, total: 0 }));
    const cats = new Map<string | null, number>();
    for (const e of expenses) {
        const m = Number(e.spent_on.slice(5, 7)) - 1;
        if (monthly[m]) monthly[m].total += e.amount;
        cats.set(e.category_id, (cats.get(e.category_id) ?? 0) + e.amount);
    }

    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const nowYear = Number(today().slice(0, 4));
    const nowMonth = Number(today().slice(5, 7));
    const monthsCounted = year < nowYear ? 12 : year === nowYear ? nowMonth : 0;
    const average = monthsCounted ? total / monthsCounted : 0;
    const peak = monthly.reduce(
        (a, b) => (b.total > a.total ? b : a),
        monthly[0],
    );

    const catRows = [...cats]
        .map(([id, sum]) => {
            const c = categories.find((x) => x.id === id);
            return {
                name: c?.name ?? "Uncategorized",
                color: c?.color ?? null,
                total: sum,
            };
        })
        .sort((a, b) => b.total - a.total);

    const chartData = monthly.map((m) => ({ ...m, total: round(m.total) }));

    return (
        <details
            style={{ margin: "16px 0" }}
            onToggle={(e) => setOpen(e.currentTarget.open)}
        >
            <summary>
                <b>Yearly overview</b>
            </summary>

            <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button onClick={() => setYear(year - 1)}>‹</button>
                    <b>{year}</b>
                    <button onClick={() => setYear(year + 1)}>›</button>
                </div>

                {total === 0 ? (
                    <p>No expenses in {year}.</p>
                ) : (
                    <>
                        <p style={{ margin: "12px 0 4px" }}>
                            <b>Total: {total.toFixed(2)}</b>
                        </p>
                        <p style={{ margin: "0 0 12px", fontSize: 14 }}>
                            Average per month: {average.toFixed(2)} · Highest
                            month: {peak.label} ({peak.total.toFixed(2)})
                        </p>

                        <div style={{ width: "100%", height: 200 }}>
                            <ResponsiveContainer>
                                <BarChart
                                    data={chartData}
                                    margin={{ left: -16, right: 8 }}
                                >
                                    <CartesianGrid
                                        vertical={false}
                                        stroke="currentColor"
                                        strokeOpacity={0.15}
                                    />
                                    <XAxis
                                        dataKey="label"
                                        tick={tick}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={tick}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        cursor={{
                                            fill: "rgba(128,128,128,0.15)",
                                        }}
                                        contentStyle={{ color: "#111" }}
                                    />
                                    <Bar
                                        dataKey="total"
                                        fill="#38bdf8"
                                        radius={[3, 3, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <h4>By category</h4>
                        <div style={{ display: "grid", gap: 8 }}>
                            {catRows.map((r) => {
                                const pct = (r.total / total) * 100;
                                return (
                                    <div key={r.name}>
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                fontSize: 14,
                                            }}
                                        >
                                            <span>{r.name}</span>
                                            <span>
                                                {r.total.toFixed(2)} ·{" "}
                                                {pct.toFixed(0)}%
                                            </span>
                                        </div>
                                        <div
                                            style={{
                                                height: 6,
                                                borderRadius: 3,
                                                background:
                                                    "rgba(128,128,128,0.25)",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: `${pct}%`,
                                                    height: "100%",
                                                    borderRadius: 3,
                                                    background:
                                                        r.color ?? "#38bdf8",
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </details>
    );
}
