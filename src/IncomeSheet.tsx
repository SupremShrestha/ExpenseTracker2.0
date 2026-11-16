import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
    addIncome,
    updateIncome,
    deleteIncome,
    today,
    type Income,
} from "./db";

type Props = {
    editing: Income | null; // null = adding new income
    onClose: () => void;
};

export default function IncomeSheet({ editing, onClose }: Props) {
    const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
    const [note, setNote] = useState(editing?.note ?? "");
    const [date, setDate] = useState(editing?.received_on ?? today());
    const [error, setError] = useState("");

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

    async function save(e: FormEvent) {
        e.preventDefault();
        const value = parseFloat(amount.replace(/,/g, ""));
        if (!Number.isFinite(value) || value <= 0)
            return setError("Enter an amount above 0.");
        if (!date) return setError("Pick a date.");

        const data = {
            amount: Math.round(value * 100) / 100,
            note: note.trim(),
            received_on: date,
        };
        if (editing) await updateIncome(editing.id, data);
        else await addIncome(data);
        onClose();
    }

    async function remove() {
        if (!editing) return;
        if (window.confirm("Delete this income entry?")) {
            await deleteIncome(editing.id);
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
                    {editing ? "Edit income" : "Add income"}
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
                <input
                    placeholder="Source (e.g. Salary, Freelance)"
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
