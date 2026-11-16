import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
    db,
    addExpense,
    updateExpense,
    deleteExpense,
    addCategory,
    today,
    type Expense,
} from "./db";

const PALETTE = [
    "#38bdf8",
    "#34d399",
    "#fbbf24",
    "#f87171",
    "#a78bfa",
    "#fb923c",
    "#f472b6",
    "#2dd4bf",
];

type Props = {
    editing: Expense | null; // null = adding a new expense
    onClose: () => void;
};

export default function ExpenseSheet({ editing, onClose }: Props) {
    const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
    const [note, setNote] = useState(editing?.note ?? "");
    const [categoryId, setCategoryId] = useState(editing?.category_id ?? "");
    const [date, setDate] = useState(editing?.spent_on ?? today());
    const [error, setError] = useState("");
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState("");

    const categories =
        useLiveQuery(
            () => db.categories.filter((c) => !c.deleted_at).sortBy("name"),
            [],
        ) ?? [];

    // Category ids ordered by how often they appear in your recent expenses
    const topIds =
        useLiveQuery(async () => {
            const recent = await db.expenses
                .orderBy("spent_on")
                .reverse()
                .filter((e) => !e.deleted_at && e.category_id !== null)
                .limit(300)
                .toArray();
            const counts = new Map<string, number>();
            for (const e of recent) {
                const id = e.category_id as string;
                counts.set(id, (counts.get(id) ?? 0) + 1);
            }
            return [...counts].sort((a, b) => b[1] - a[1]).map(([id]) => id);
        }, []) ?? [];

    // Lock page scroll and close on Escape while the sheet is open
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener("keydown", onKey);
        };
    }, [onClose]);

    const byId = new Map(categories.map((c) => [c.id, c]));
    const ordered = [
        ...topIds.filter((id) => byId.has(id)),
        ...categories.map((c) => c.id).filter((id) => !topIds.includes(id)),
    ];
    const chipIds = ordered.slice(0, 6);
    if (categoryId && byId.has(categoryId) && !chipIds.includes(categoryId))
        chipIds.push(categoryId);
    const extraIds = ordered.slice(6).filter((id) => !chipIds.includes(id));

    async function createCategory() {
        const name = newName.trim();
        if (!name) return;
        const existing = categories.find(
            (c) => c.name.toLowerCase() === name.toLowerCase(),
        );
        if (existing) {
            setCategoryId(existing.id);
        } else {
            const id = await addCategory(
                name,
                PALETTE[categories.length % PALETTE.length],
            );
            setCategoryId(id);
        }
        setNewName("");
        setAdding(false);
    }

    async function save(e: FormEvent) {
        e.preventDefault();
        const value = parseFloat(amount.replace(/,/g, ""));
        if (!Number.isFinite(value) || value <= 0) {
            setError("Enter an amount above 0.");
            return;
        }
        if (!date) {
            setError("Pick a date.");
            return;
        }
        const data = {
            amount: Math.round(value * 100) / 100,
            note: note.trim(),
            category_id: categoryId || null,
            spent_on: date,
        };
        if (editing) await updateExpense(editing.id, data);
        else await addExpense(data);
        onClose();
    }

    async function remove() {
        if (!editing) return;
        if (window.confirm("Delete this expense?")) {
            await deleteExpense(editing.id);
            onClose();
        }
    }

    return (
        <div className="sheet-backdrop" onClick={onClose}>
            <form
                className="sheet"
                onClick={(e) => e.stopPropagation()}
                onSubmit={save}
            >
                <div className="sheet-handle" />
                <div className="sheet-title">
                    {editing ? "Edit expense" : "Add expense"}
                </div>

                <input
                    className="amount-input"
                    inputMode="decimal"
                    placeholder="0.00"
                    autoFocus
                    value={amount}
                    onChange={(e) => {
                        setAmount(e.target.value);
                        setError("");
                    }}
                />

                {/* Category row: always visible, so you can pick or create one */}
                <div className="chips">
                    {chipIds.map((id) => {
                        const c = byId.get(id);
                        if (!c) return null;
                        return (
                            <button
                                type="button"
                                key={id}
                                className={`chip ${categoryId === id ? "on" : ""}`}
                                onClick={() =>
                                    setCategoryId(categoryId === id ? "" : id)
                                }
                            >
                                <i
                                    className="swatch"
                                    style={{ background: c.color ?? "#9ca3af" }}
                                />
                                {c.name}
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        className="chip"
                        onClick={() => setAdding(!adding)}
                    >
                        + New
                    </button>
                </div>

                {categories.length === 0 && !adding && (
                    <p className="muted small" style={{ margin: 0 }}>
                        No categories yet. Tap “+ New” to create your first one.
                    </p>
                )}

                {adding && (
                    <div style={{ display: "flex", gap: 6 }}>
                        <input
                            autoFocus
                            placeholder="New category name"
                            value={newName}
                            style={{ flex: 1 }}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault(); // don't submit the expense form
                                    createCategory();
                                }
                            }}
                        />
                        <button
                            type="button"
                            className="primary"
                            onClick={createCategory}
                        >
                            Create
                        </button>
                    </div>
                )}

                {extraIds.length > 0 && (
                    <select
                        value=""
                        onChange={(e) => {
                            if (e.target.value) setCategoryId(e.target.value);
                        }}
                    >
                        <option value="">More categories…</option>
                        {extraIds.map((id) => (
                            <option key={id} value={id}>
                                {byId.get(id)?.name}
                            </option>
                        ))}
                    </select>
                )}

                <input
                    placeholder="Note (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                />
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                />

                {error && (
                    <p className="error" style={{ margin: 0 }}>
                        {error}
                    </p>
                )}

                <div className="sheet-actions">
                    {editing && (
                        <button
                            type="button"
                            className="danger"
                            onClick={remove}
                        >
                            Delete
                        </button>
                    )}
                    <button type="button" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="primary">
                        {editing ? "Save" : "Add"}
                    </button>
                </div>
            </form>
        </div>
    );
}
