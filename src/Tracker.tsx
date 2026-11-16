import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, today, type Expense } from "./db";
import Charts from "./Charts";
import Budgets from "./Budgets";
import Categories from "./Categories";
import Recurring from "./Recurring";
import DataTools from "./DataTools";
import Yearly from "./Yearly";
import Income from "./Income";
import Goals from "./Goals";
import ExpenseSheet from "./ExpenseSheet";

const LIST_LIMIT = 200;

const fmt = (n: number) =>
    n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

function shiftMonth(month: string, delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
    });
}

function dayLabel(date: string) {
    const t = today();
    const [ty, tm, td] = t.split("-").map(Number);
    const yesterday = new Date(ty, tm - 1, td - 1).toLocaleDateString("en-CA");
    if (date === t) return "Today";
    if (date === yesterday) return "Yesterday";
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
    });
}

export default function Tracker() {
    const [month, setMonth] = useState(() => today().slice(0, 7)); // 'YYYY-MM'
    const [sheet, setSheet] = useState<{ editing: Expense | null } | null>(
        null,
    );

    // search / filter state (these only affect the list at the bottom)
    const [search, setSearch] = useState("");
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [filterCat, setFilterCat] = useState(""); // '' = all, 'none' = uncategorized, else id
    const [minAmt, setMinAmt] = useState("");
    const [maxAmt, setMaxAmt] = useState("");
    const [allMonths, setAllMonths] = useState(false);

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
    const byCategory = new Map<string | null, number>();
    for (const e of expenses) {
        byCategory.set(
            e.category_id,
            (byCategory.get(e.category_id) ?? 0) + e.amount,
        );
    }

    // ---------- filtering the list ----------
    const q = search.trim().toLowerCase();
    const min = parseFloat(minAmt);
    const max = parseFloat(maxAmt);
    const filtersActive =
        !!q || !!filterCat || Number.isFinite(min) || Number.isFinite(max);

    const source: Expense[] = allMonths ? (allRows ?? []) : expenses;
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

    // group the list by day
    const groups: { date: string; rows: Expense[]; total: number }[] = [];
    for (const e of shown) {
        const last = groups[groups.length - 1];
        if (last && last.date === e.spent_on) {
            last.rows.push(e);
            last.total += e.amount;
        } else {
            groups.push({ date: e.spent_on, rows: [e], total: e.amount });
        }
    }

    function clearFilters() {
        setSearch("");
        setFilterCat("");
        setMinAmt("");
        setMaxAmt("");
    }

    return (
        <main className="container">
            <div className="monthnav">
                <button
                    onClick={() => setMonth(shiftMonth(month, -1))}
                    aria-label="Previous month"
                >
                    ‹
                </button>
                <span className="label">{monthLabel(month)}</span>
                <button
                    onClick={() => setMonth(shiftMonth(month, 1))}
                    aria-label="Next month"
                >
                    ›
                </button>
            </div>

            <section className="card summary">
                <div className="muted small">Spent this month</div>
                <div className="big">{fmt(total)}</div>
                <div className="chips">
                    {[...byCategory]
                        .sort((a, b) => b[1] - a[1])
                        .map(([id, sum]) => (
                            <span className="chip static" key={id ?? "none"}>
                                <i
                                    className="swatch"
                                    style={{
                                        background: catColor(id) ?? "#9ca3af",
                                    }}
                                />
                                {catName(id)} {fmt(sum)}
                            </span>
                        ))}
                </div>
                {expenses.length === 0 && (
                    <p className="muted small" style={{ margin: 0 }}>
                        Nothing here yet. Tap + to add an expense.
                    </p>
                )}
            </section>

            <Income month={month} spent={total} />

            <div className="card">
                <Budgets expenses={expenses} categories={categories} />
            </div>
            <div className="card">
                <Charts
                    month={month}
                    expenses={expenses}
                    catName={catName}
                    catColor={catColor}
                />
            </div>

            {/* ---------- search + list ---------- */}
            <div className="searchbar">
                <input
                    type="search"
                    placeholder="Search notes or categories"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button
                    className={
                        filtersOpen || filtersActive || allMonths
                            ? "active"
                            : ""
                    }
                    onClick={() => setFiltersOpen(!filtersOpen)}
                >
                    Filters
                </button>
            </div>

            {filtersOpen && (
                <div className="card filters">
                    <div className="frow">
                        <select
                            value={filterCat}
                            onChange={(e) => setFilterCat(e.target.value)}
                            style={{ flex: 1 }}
                        >
                            <option value="">All categories</option>
                            <option value="none">Uncategorized</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="frow">
                        <input
                            inputMode="decimal"
                            placeholder="Min amount"
                            value={minAmt}
                            style={{ flex: 1 }}
                            onChange={(e) => setMinAmt(e.target.value)}
                        />
                        <input
                            inputMode="decimal"
                            placeholder="Max amount"
                            value={maxAmt}
                            style={{ flex: 1 }}
                            onChange={(e) => setMaxAmt(e.target.value)}
                        />
                    </div>
                    <label
                        style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={allMonths}
                            onChange={(e) => setAllMonths(e.target.checked)}
                        />
                        Search all months
                    </label>
                    {filtersActive && (
                        <button onClick={clearFilters}>Clear filters</button>
                    )}
                </div>
            )}

            {(filtersActive || allMonths) && (
                <p className="muted small" style={{ margin: "10px 4px 0" }}>
                    {visible.length} expense{visible.length === 1 ? "" : "s"} ·{" "}
                    {fmt(visibleTotal)}
                    {allMonths ? " · all months" : ""}
                </p>
            )}

            {groups.length === 0 && (
                <p className="muted center" style={{ marginTop: 24 }}>
                    {filtersActive ? "No matches." : "No expenses to show."}
                </p>
            )}

            {groups.map((g) => (
                <div className="daygroup" key={g.date}>
                    <div className="dayhead">
                        <span>{dayLabel(g.date)}</span>
                        <span>{fmt(g.total)}</span>
                    </div>
                    <div className="rows">
                        {g.rows.map((e) => (
                            <button
                                className="row"
                                key={e.id}
                                onClick={() => setSheet({ editing: e })}
                            >
                                <i
                                    className="swatch big"
                                    style={{
                                        background:
                                            catColor(e.category_id) ??
                                            "#9ca3af",
                                    }}
                                />
                                <span className="row-main">
                                    <span className="row-title">
                                        {e.note || catName(e.category_id)}
                                    </span>
                                    {e.note && (
                                        <span className="muted small">
                                            {catName(e.category_id)}
                                        </span>
                                    )}
                                </span>
                                <span className="row-amt">{fmt(e.amount)}</span>
                            </button>
                        ))}
                    </div>
                </div>
            ))}

            {visible.length > LIST_LIMIT && (
                <p className="muted small center">
                    Showing the newest {LIST_LIMIT} of {visible.length}. Narrow
                    the search to see the rest.
                </p>
            )}

            <div style={{ marginTop: 20 }}>
                <Goals />
            </div>

            {/* ---------- tools ---------- */}
            <h3 style={{ marginTop: 28 }}>Tools</h3>
            <Yearly />
            <Recurring />
            <Categories />
            <DataTools />

            {/* ---------- quick add ---------- */}
            <button
                className="fab"
                aria-label="Add expense"
                onClick={() => setSheet({ editing: null })}
            >
                +
            </button>

            {sheet && (
                <ExpenseSheet
                    editing={sheet.editing}
                    onClose={() => setSheet(null)}
                />
            )}
        </main>
    );
}
