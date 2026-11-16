import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Income as IncomeRow } from "./db";
import IncomeSheet from "./IncomeSheet";

const fmt = (n: number) =>
    n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

function Stat({
    label,
    value,
    color,
}: {
    label: string;
    value: string;
    color?: string;
}) {
    return (
        <div style={{ minWidth: 0 }}>
            <div className="muted small">{label}</div>
            <div style={{ fontWeight: 700, fontSize: "1.05rem", color }}>
                {value}
            </div>
        </div>
    );
}

export default function Income({
    month,
    spent,
}: {
    month: string;
    spent: number;
}) {
    const [sheet, setSheet] = useState<{ editing: IncomeRow | null } | null>(
        null,
    );

    const rows =
        useLiveQuery(
            () =>
                db.income
                    .where("received_on")
                    .between(`${month}-01`, `${month}-32`)
                    .filter((i) => !i.deleted_at)
                    .sortBy("received_on")
                    .then((r) => r.reverse()),
            [month],
        ) ?? [];

    const total = rows.reduce((s, r) => s + r.amount, 0);
    const net = total - spent;
    const rate = total > 0 ? Math.round((net / total) * 100) : null;

    return (
        <section className="card">
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <h3 style={{ margin: 0 }}>Income &amp; savings</h3>
                <button onClick={() => setSheet({ editing: null })}>
                    + Income
                </button>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 8,
                    margin: "12px 0 4px",
                }}
            >
                <Stat label="Income" value={fmt(total)} />
                <Stat label="Spent" value={fmt(spent)} />
                <Stat
                    label="Saved"
                    value={fmt(net)}
                    color={net >= 0 ? "#22c55e" : "#ef4444"}
                />
            </div>
            {rate !== null && (
                <p className="muted small" style={{ margin: "0 0 8px" }}>
                    Savings rate: {rate}%
                </p>
            )}

            {rows.length === 0 ? (
                <p className="muted small" style={{ margin: "8px 0 0" }}>
                    No income logged for this month. Add your salary to see how
                    much you save.
                </p>
            ) : (
                <div className="rows" style={{ marginTop: 8 }}>
                    {rows.map((r) => (
                        <button
                            className="row"
                            key={r.id}
                            onClick={() => setSheet({ editing: r })}
                        >
                            <span className="row-main">
                                <span className="row-title">
                                    {r.note || "Income"}
                                </span>
                                <span className="muted small">
                                    {r.received_on}
                                </span>
                            </span>
                            <span
                                className="row-amt"
                                style={{ color: "#22c55e" }}
                            >
                                +{fmt(r.amount)}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {sheet && (
                <IncomeSheet
                    editing={sheet.editing}
                    onClose={() => setSheet(null)}
                />
            )}
        </section>
    );
}
