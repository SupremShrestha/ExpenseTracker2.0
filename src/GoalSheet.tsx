import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { addGoal, updateGoal, deleteGoal, adjustGoal, type Goal } from "./db";

type Props = {
    goal: Goal | null; // null = creating a new goal
    mode: "edit" | "money";
    onClose: () => void;
};

const fmt = (n: number) =>
    n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

export default function GoalSheet({ goal, mode, onClose }: Props) {
    const [name, setName] = useState(goal?.name ?? "");
    const [target, setTarget] = useState(goal ? String(goal.target) : "");
    const [saved, setSaved] = useState(goal ? String(goal.saved) : "0");
    const [deadline, setDeadline] = useState(goal?.deadline ?? "");
    const [amount, setAmount] = useState("");
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

    const num = (s: string) => parseFloat(s.replace(/,/g, ""));

    async function saveGoal(e: FormEvent) {
        e.preventDefault();
        const t = num(target);
        const s = num(saved || "0");
        if (!name.trim()) return setError("Give the goal a name.");
        if (!Number.isFinite(t) || t <= 0)
            return setError("Target must be above 0.");
        if (!Number.isFinite(s) || s < 0)
            return setError("Saved so far can’t be negative.");

        const data = {
            name: name.trim(),
            target: Math.round(t * 100) / 100,
            saved: Math.round(s * 100) / 100,
            deadline: deadline || null,
        };
        if (goal) await updateGoal(goal.id, data);
        else await addGoal(data);
        onClose();
    }

    async function removeGoal() {
        if (goal && window.confirm(`Delete the goal "${goal.name}"?`)) {
            await deleteGoal(goal.id);
            onClose();
        }
    }

    async function move(sign: 1 | -1) {
        const v = num(amount);
        if (!goal) return;
        if (!Number.isFinite(v) || v <= 0)
            return setError("Enter an amount above 0.");
        await adjustGoal(goal.id, sign * v);
        onClose();
    }

    // ---------- add / take out money ----------
    if (mode === "money" && goal) {
        return (
            <div className="sheet-backdrop" onClick={onClose}>
                <form
                    className="sheet"
                    onClick={(e) => e.stopPropagation()}
                    onSubmit={(e) => {
                        e.preventDefault();
                        move(1);
                    }}
                >
                    <div className="sheet-handle" />
                    <div className="sheet-title">{goal.name}</div>
                    <p className="muted small center" style={{ margin: 0 }}>
                        Saved {fmt(goal.saved)} of {fmt(goal.target)}
                    </p>
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
                    {error && (
                        <p className="error" style={{ margin: 0 }}>
                            {error}
                        </p>
                    )}
                    <div className="sheet-actions">
                        <button type="button" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="button" onClick={() => move(-1)}>
                            Take out
                        </button>
                        <button className="primary">Add</button>
                    </div>
                </form>
            </div>
        );
    }

    // ---------- create / edit goal ----------
    return (
        <div className="sheet-backdrop" onClick={onClose}>
            <form
                className="sheet"
                onClick={(e) => e.stopPropagation()}
                onSubmit={saveGoal}
            >
                <div className="sheet-handle" />
                <div className="sheet-title">
                    {goal ? "Edit goal" : "New savings goal"}
                </div>

                <input
                    placeholder="Goal name (e.g. Laptop)"
                    autoFocus
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        setError("");
                    }}
                />
                <input
                    inputMode="decimal"
                    placeholder="Target amount"
                    value={target}
                    onChange={(e) => {
                        setTarget(e.target.value);
                        setError("");
                    }}
                />
                <label className="muted small">Saved so far</label>
                <input
                    inputMode="decimal"
                    placeholder="0"
                    value={saved}
                    onChange={(e) => {
                        setSaved(e.target.value);
                        setError("");
                    }}
                />
                <label className="muted small">Deadline (optional)</label>
                <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                />

                {error && (
                    <p className="error" style={{ margin: 0 }}>
                        {error}
                    </p>
                )}

                <div className="sheet-actions">
                    {goal && (
                        <button
                            type="button"
                            className="danger"
                            onClick={removeGoal}
                        >
                            Delete
                        </button>
                    )}
                    <button type="button" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="primary">
                        {goal ? "Save" : "Create"}
                    </button>
                </div>
            </form>
        </div>
    );
}
