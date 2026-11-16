import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Expense } from "./db";
import { useCategoryLookup, useMonthExpenses } from "./useData";
import { fmt } from "./format";
import MonthNav from "./MonthNav";
import TransactionList from "./TransactionList";

const LIST_LIMIT = 200;

type Props = {
    month: string;
    setMonth: (m: string) => void;
    onEdit: (e: Expense) => void;
};

export default function Activity({ month, setMonth, onEdit }: Props) {
    const { categories, catName } = useCategoryLookup();
    const monthRows = useMonthExpenses(month);

    const [search, setSearch] = useState("");
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [filterCat, setFilterCat] = useState(""); // '' = all, 'none' = uncategorized, else id
    const [minAmt, setMinAmt] = useState("");
    const [maxAmt, setMaxAmt] = useState("");
    const [allMonths, setAllMonths] = useState(false);

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

    const q = search.trim().toLowerCase();
    const min = parseFloat(minAmt);
    const max = parseFloat(maxAmt);
    const filtersActive =
        !!q || !!filterCat || Number.isFinite(min) || Number.isFinite(max);

    const source: Expense[] = allMonths ? (allRows ?? []) : monthRows;
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

    return (
        <>
            {allMonths ? (
                <div className="monthnav">
                    <span className="label">All months</span>
                </div>
            ) : (
                <MonthNav month={month} onChange={setMonth} />
            )}

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

            <p className="muted small" style={{ margin: "10px 4px 0" }}>
                {visible.length} expense{visible.length === 1 ? "" : "s"} ·{" "}
                {fmt(visibleTotal)}
            </p>

            {shown.length === 0 && (
                <p className="muted center" style={{ marginTop: 24 }}>
                    {filtersActive ? "No matches." : "No expenses to show."}
                </p>
            )}

            <TransactionList expenses={shown} onSelect={onEdit} />

            {visible.length > LIST_LIMIT && (
                <p className="muted small center">
                    Showing the newest {LIST_LIMIT} of {visible.length}. Narrow
                    the search to see the rest.
                </p>
            )}
        </>
    );
}
