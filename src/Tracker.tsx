import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
    db,
    addExpense,
    addCategory,
    updateExpense,
    deleteExpense,
    today,
    type Expense,
} from "./db";
import Charts from './Charts';

export default function Tracker() {
    const [month, setMonth] = useState(() => today().slice(0, 7)); // 'YYYY-MM'
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [newCat, setNewCat] = useState("");

    // editing state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState({
        amount: "",
        note: "",
        category_id: "",
        spent_on: "",
    });

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
                    .between(`${month}-01`, `${month}-32`)
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

    function startEdit(e: Expense) {
        setEditingId(e.id);
        setDraft({
            amount: String(e.amount),
            note: e.note,
            category_id: e.category_id ?? "",
            spent_on: e.spent_on,
        });
    }

    async function saveEdit() {
        if (!editingId) return;
        const value = parseFloat(draft.amount);
        if (!Number.isFinite(value) || value <= 0 || !draft.spent_on) return;
        await updateExpense(editingId, {
            amount: Math.round(value * 100) / 100,
            note: draft.note,
            category_id: draft.category_id || null,
            spent_on: draft.spent_on,
        });
        setEditingId(null);
    }

    async function remove(id: string) {
        if (window.confirm("Delete this expense?")) await deleteExpense(id);
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
            <Charts month={month} expenses={expenses} catName={catName} />

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
            <ul
                style={{
                    listStyle: "none",
                    padding: 0,
                    display: "grid",
                    gap: 12,
                }}
            >
                {expenses.map((e) =>
                    editingId === e.id ? (
                        <li
                            key={e.id}
                            style={{
                                display: "grid",
                                gap: 6,
                                padding: 8,
                                border: "1px solid #888",
                                borderRadius: 8,
                            }}
                        >
                            <input
                                inputMode="decimal"
                                value={draft.amount}
                                onChange={(ev) =>
                                    setDraft({
                                        ...draft,
                                        amount: ev.target.value,
                                    })
                                }
                            />
                            <input
                                value={draft.note}
                                placeholder="Note"
                                onChange={(ev) =>
                                    setDraft({
                                        ...draft,
                                        note: ev.target.value,
                                    })
                                }
                            />
                            <select
                                value={draft.category_id}
                                onChange={(ev) =>
                                    setDraft({
                                        ...draft,
                                        category_id: ev.target.value,
                                    })
                                }
                            >
                                <option value="">Uncategorized</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="date"
                                value={draft.spent_on}
                                onChange={(ev) =>
                                    setDraft({
                                        ...draft,
                                        spent_on: ev.target.value,
                                    })
                                }
                            />
                            <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={saveEdit}>Save</button>
                                <button onClick={() => setEditingId(null)}>
                                    Cancel
                                </button>
                            </div>
                        </li>
                    ) : (
                        <li key={e.id}>
                            {e.spent_on} · {e.amount.toFixed(2)} ·{" "}
                            {catName(e.category_id)}
                            {e.note && ` · ${e.note}`}{" "}
                            <button onClick={() => startEdit(e)}>✎</button>{" "}
                            <button onClick={() => remove(e.id)}>✕</button>
                        </li>
                    ),
                )}
            </ul>
        </main>
    );
}
