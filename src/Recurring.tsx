import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
    db,
    addRecurring,
    updateRecurring,
    deleteRecurring,
    today,
    type Recurring as Rule,
} from "./db";

export default function Recurring() {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [day, setDay] = useState("1");
    const [startsOn, setStartsOn] = useState(today());
    const [error, setError] = useState("");
    const formRef = useRef<HTMLDivElement>(null);

    const categories =
        useLiveQuery(
            () => db.categories.filter((c) => !c.deleted_at).sortBy("name"),
            [],
        ) ?? [];
    const rules =
        useLiveQuery(
            () =>
                db.recurring
                    .filter((r) => !r.deleted_at)
                    .sortBy("day_of_month"),
            [],
        ) ?? [];

    const catName = (id: string | null) =>
        categories.find((c) => c.id === id)?.name ?? "Uncategorized";

    function reset() {
        setEditingId(null);
        setAmount("");
        setNote("");
        setCategoryId("");
        setDay("1");
        setStartsOn(today());
        setError("");
    }

    function startEdit(r: Rule) {
        setEditingId(r.id);
        setAmount(String(r.amount));
        setNote(r.note);
        setCategoryId(r.category_id ?? "");
        setDay(String(r.day_of_month));
        setStartsOn(r.starts_on);
        setError("");
        formRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
    }

    async function save() {
        const value = parseFloat(amount.replace(/,/g, ""));
        const d = parseInt(day, 10);
        if (!Number.isFinite(value) || value <= 0)
            return setError("Enter an amount above 0.");
        if (!Number.isInteger(d) || d < 1 || d > 31)
            return setError("Day must be between 1 and 31.");
        if (!startsOn) return setError("Pick a start date.");

        const data = {
            amount: Math.round(value * 100) / 100,
            note: note.trim(),
            category_id: categoryId || null,
            day_of_month: d,
            starts_on: startsOn,
        };
        if (editingId) await updateRecurring(editingId, data);
        else await addRecurring(data);
        reset();
    }

    async function remove(r: Rule) {
        if (
            window.confirm(
                `Stop "${r.note || r.amount}"? Entries already created will stay.`,
            )
        ) {
            await deleteRecurring(r.id);
            if (editingId === r.id) reset();
        }
    }

    return (
        <details style={{ margin: "16px 0" }}>
            <summary>
                <b>Recurring expenses</b>
            </summary>

            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {rules.length === 0 && (
                    <small>No recurring expenses yet.</small>
                )}

                {rules.map((r) => (
                    <div
                        key={r.id}
                        style={{
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                            padding: "6px 8px",
                            borderRadius: 10,
                            border: `1px solid ${editingId === r.id ? "var(--accent)" : "transparent"}`,
                        }}
                    >
                        <span style={{ flex: 1, minWidth: 0 }}>
                            {r.amount.toFixed(2)} · {r.note || "No note"} ·{" "}
                            {catName(r.category_id)} · day {r.day_of_month}
                        </span>
                        <button onClick={() => startEdit(r)}>Edit</button>
                        <button className="danger" onClick={() => remove(r)}>
                            ✕
                        </button>
                    </div>
                ))}

                <div
                    ref={formRef}
                    style={{ display: "grid", gap: 6, paddingTop: 8 }}
                >
                    <b>
                        {editingId
                            ? "Edit recurring expense"
                            : "Add recurring expense"}
                    </b>
                    <input
                        inputMode="decimal"
                        placeholder="Amount"
                        value={amount}
                        onChange={(e) => {
                            setAmount(e.target.value);
                            setError("");
                        }}
                    />
                    <input
                        placeholder="Note (e.g. Rent)"
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
                    <label
                        style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                        }}
                    >
                        Day of month
                        <input
                            type="number"
                            min={1}
                            max={31}
                            value={day}
                            style={{ width: 70 }}
                            onChange={(e) => setDay(e.target.value)}
                        />
                    </label>
                    <label
                        style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                        }}
                    >
                        Starts on
                        <input
                            type="date"
                            value={startsOn}
                            onChange={(e) => setStartsOn(e.target.value)}
                        />
                    </label>

                    {error && (
                        <p className="error" style={{ margin: 0 }}>
                            {error}
                        </p>
                    )}

                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            className="primary"
                            style={{ flex: 1 }}
                            onClick={save}
                        >
                            {editingId
                                ? "Save changes"
                                : "Add recurring expense"}
                        </button>
                        {editingId && <button onClick={reset}>Cancel</button>}
                    </div>

                    <small>
                        {editingId
                            ? "Changes apply to entries created from now on. Entries already created keep their old values (edit those from the list)."
                            : "Entries appear automatically after the next sync. A day like 31 becomes the last day of shorter months."}
                    </small>
                </div>
            </div>
        </details>
    );
}
