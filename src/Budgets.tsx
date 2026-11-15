import type { Category, Expense } from "./db";

const barColor = (spent: number, budget: number) =>
    spent > budget ? "#ef4444" : spent >= budget * 0.8 ? "#f59e0b" : "#22c55e";

function Bar({
    label,
    spent,
    budget,
}: {
    label: string;
    spent: number;
    budget: number;
}) {
    const pct = Math.min(100, (spent / budget) * 100);
    const diff = budget - spent;
    return (
        <div style={{ marginBottom: 10 }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 14,
                }}
            >
                <span>{label}</span>
                <span>
                    {spent.toFixed(2)} / {budget.toFixed(2)} ·{" "}
                    <b style={{ color: barColor(spent, budget) }}>
                        {diff >= 0
                            ? `${diff.toFixed(2)} left`
                            : `${(-diff).toFixed(2)} over`}
                    </b>
                </span>
            </div>
            <div
                style={{
                    height: 8,
                    borderRadius: 4,
                    background: "rgba(128,128,128,0.25)",
                }}
            >
                <div
                    style={{
                        width: `${pct}%`,
                        height: "100%",
                        borderRadius: 4,
                        background: barColor(spent, budget),
                    }}
                />
            </div>
        </div>
    );
}

export default function Budgets({
    expenses,
    categories,
}: {
    expenses: Expense[];
    categories: Category[];
}) {
    const budgeted = categories.filter((c) => (c.budget ?? 0) > 0);
    if (budgeted.length === 0) return null;

    const spentBy = new Map<string, number>();
    for (const e of expenses) {
        if (e.category_id)
            spentBy.set(
                e.category_id,
                (spentBy.get(e.category_id) ?? 0) + e.amount,
            );
    }

    const rows = budgeted
        .map((c) => ({
            id: c.id,
            name: c.name,
            budget: c.budget as number,
            spent: spentBy.get(c.id) ?? 0,
        }))
        .sort((a, b) => b.spent / b.budget - a.spent / a.budget);

    const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
    const totalSpent = rows.reduce((s, r) => s + r.spent, 0);

    return (
        <section>
            <h3>Budgets</h3>
            <Bar
                label="All budgeted categories"
                spent={totalSpent}
                budget={totalBudget}
            />
            {rows.map((r) => (
                <Bar
                    key={r.id}
                    label={r.name}
                    spent={r.spent}
                    budget={r.budget}
                />
            ))}
        </section>
    );
}
