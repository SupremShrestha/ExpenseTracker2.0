import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, addExpense, addCategory, deleteExpense, today } from "./db";

export default function Tracker() {
    const [month, setMonth] = useState(() => today().slice(0, 7)); // 'YYYY-MM'
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [newCat, setNewCat] = useState("");

    const categories =
        useLiveQuery(
            () => db.categories.filter((c) => !c.deleted_at).toArray(),
            [],
        ) ?? [];

    const expenses =
        useLiveQuery(
            () =>
                db.expenses
                    .where("spent_on")
                    .between(`${month}-01`, `${month}-32`) // upper bound is exclusive; '-32' safely covers the month
                    .filter((e) => !e.deleted_at)
                    .sortBy("spent_on")
                    .then((rows) => rows.reverse()),
            [month],
        ) ?? [];

    const catName = (id: string | null) =>
        categories.find((c) => c.id === id)?.name ?? "Uncategorized";

    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const byCategory = new Map<string, number>();
    for (const e of expenses) {
        const k = catName(e.category_id);
        byCategory.set(k, (byCategory.get(k) ?? 0) + e.amount);
    }

    async function submit() {
        const value = parseFloat(amount);
        if (!Number.isFinite(value) || value <= 0) return;
        await addExpense({
            amount: value,
            note,
            category_id: categoryId || null,
        });
        setAmount("");
        setNote("");
    }

    return (
        <main
            style={{
                maxWidth: 480,
                margin: "0 auto",
                padding: 16,
                fontFamily: "system-ui",
            }}
        >
            <h1>Expenses</h1>

            <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
            />
            <h2>Total: {total.toFixed(2)}</h2>
            <ul>
                {[...byCategory].map(([name, sum]) => (
                    <li key={name}>
                        {name}: {sum.toFixed(2)}
                    </li>
                ))}
            </ul>

            <h3>Add expense</h3>
            <div style={{ display: "grid", gap: 8 }}>
                <input
                    inputMode="decimal"
                    placeholder="Amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                />
                <input
                    placeholder="Note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                />
                <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>
                <button onClick={submit}>Add</button>
            </div>

            <h3>Add category</h3>
            <input
                placeholder="e.g. Food"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
            />
            <button
                onClick={async () => {
                    if (newCat.trim()) {
                        await addCategory(newCat);
                        setNewCat("");
                    }
                }}
            >
                Add
            </button>

            <h3>This month</h3>
            <ul>
                {expenses.map((e) => (
                    <li key={e.id}>
                        {e.spent_on} · {e.amount.toFixed(2)} ·{" "}
                        {catName(e.category_id)} {e.note && `· ${e.note}`}{" "}
                        <button onClick={() => deleteExpense(e.id)}>✕</button>
                    </li>
                ))}
            </ul>
        </main>
    );
}
