import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
    db,
    addExpense,
    updateExpense,
    deleteExpense,
    today,
    type Expense,
} from "./db";
import Charts from "./Charts";
import Budgets from "./Budgets";
import Categories from "./Categories";
import Recurring from "./Recurring";
import DataTools from "./DataTools";
import Yearly from "./Yearly";

const LIST_LIMIT = 200;

export default function Tracker() {
    const [month, setMonth] = useState(() => today().slice(0, 7)); // 'YYYY-MM'
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const [categoryId, setCategoryId] = useState("");

    // search / filter state (these only affect the list at the bottom)
    const [search, setSearch] = useState("");
    const [filterCat, setFilterCat] = useState(""); // '' = all, 'none' = uncategorized, else id
    const [minAmt, setMinAmt] = useState("");
    const [maxAmt, setMaxAmt] = useState("");
    const [allMonths, setAllMonths] = useState(false);

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
            () => db.categories.filter((c) => !c.deleted_at).sortBy("name"),
            [],
        ) ?? [];

    // The selected month: used for totals, budgets and charts
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

    // Every expense, newest first: only loaded when "all months" is ticked
    const allRows = useLiveQuery(
        () =>
            allMonths
                ? db.expenses
                      .orderBy("spent_on")
                      .reverse()
                      .filter((e) => !e.deleted_at)
                      .toArray()
                : Promise.resolve([] as Expense[]),
        [allMonths],
    );

    const catName = (id: string | null) =>
        categories.find((c) => c.id === id)?.name ?? "Uncategorized";
    const catColor = (id: string | null) =>
        categories.find((c) => c.id === id)?.color ?? null;

    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const byCategory = new Map<string, number>();
    for (const e of expenses) {
        const k = catName(e.category_id);
        byCategory.set(k, (byCategory.get(k) ?? 0) + e.amount);
    }

    // ---------- filtering the list ----------
    const q = search.trim().toLowerCase();
    const min = parseFloat(minAmt);
    const max = parseFloat(maxAmt);
    const filtersActive =
        !!q || !!filterCat || Number.isFinite(min) || Number.isFinite(max);

    const source = allMonths ? (allRows ?? []) : expenses;
    const visible = source.filter((e) => {
        if (
            q &&
            !(
                e.note.toLowerCase().includes(q) ||
                catName(e.category_id).toLowerCase().includes(q)
            )
        )
            return false;
        if (filterCat === "none" && e.category_id !== null) return false;
        if (filterCat && filterCat !== "none" && e.category_id !== filterCat)
            return false;
        if (Number.isFinite(min) && e.amount < min) return false;
        if (Number.isFinite(max) && e.amount > max) return false;
        return true;
    });
    const visibleTotal = visible.reduce((s, e) => s + e.amount, 0);
    const shown = visible.slice(0, LIST_LIMIT);

    function clearFilters() {
        setSearch("");
        setFilterCat("");
        setMinAmt("");
        setMaxAmt("");
    }

    // ---------- add / edit / delete ----------
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

            <Budgets expenses={expenses} categories={categories} />

            <Charts
                month={month}
                expenses={expenses}
                catName={catName}
                catColor={catColor}
            />

            <Yearly />

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

            <Categories />
            <Recurring />
            <DataTools />

            <h3>{allMonths ? "All months" : "This month"}</h3>

            <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
                <input
                    type="search"
                    placeholder="Search notes or categories"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <div style={{ display: "flex", gap: 6 }}>
                    <select
                        value={filterCat}
                        onChange={(e) => setFilterCat(e.target.value)}
                        style={{ flex: 1, minWidth: 0 }}
                    >
                        <option value="">All categories</option>
                        <option value="none">Uncategorized</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                    <input
                        inputMode="decimal"
                        placeholder="Min"
                        value={minAmt}
                        style={{ width: 70 }}
                        onChange={(e) => setMinAmt(e.target.value)}
                    />
                    <input
                        inputMode="decimal"
                        placeholder="Max"
                        value={maxAmt}
                        style={{ width: 70 }}
                        onChange={(e) => setMaxAmt(e.target.value)}
                    />
                </div>
                <label
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                >
                    <input
                        type="checkbox"
                        checked={allMonths}
                        onChange={(e) => setAllMonths(e.target.checked)}
                    />
                    Search all months
                </label>
                {(filtersActive || allMonths) && (
                    <div
                        style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                        }}
                    >
                        <small>
                            {visible.length} expense
                            {visible.length === 1 ? "" : "s"} ·{" "}
                            {visibleTotal.toFixed(2)}
                        </small>
                        {filtersActive && (
                            <button onClick={clearFilters}>
                                Clear filters
                            </button>
                        )}
                    </div>
                )}
            </div>

            {shown.length === 0 && <p>No expenses to show.</p>}

            <ul
                style={{
                    listStyle: "none",
                    padding: 0,
                    display: "grid",
                    gap: 12,
                }}
            >
                {shown.map((e) =>
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

            {visible.length > LIST_LIMIT && (
                <p>
                    <small>
                        Showing the newest {LIST_LIMIT} of {visible.length}.
                        Narrow the search to see the rest.
                    </small>
                </p>
            )}
        </main>
    );
}
