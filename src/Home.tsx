import type { Expense } from "./db";
import { useCategoryLookup, useMonthExpenses } from "./useData";
import { fmt } from "./format";
import MonthNav from "./MonthNav";
import Income from "./Income";
import TransactionList from "./TransactionList";

const RECENT = 6;

type Props = {
    month: string;
    setMonth: (m: string) => void;
    onEdit: (e: Expense) => void;
    onSeeAll: () => void;
};

export default function Home({ month, setMonth, onEdit, onSeeAll }: Props) {
    const expenses = useMonthExpenses(month);
    const { catName, catColor } = useCategoryLookup();

    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const byCategory = new Map<string | null, number>();
    for (const e of expenses) {
        byCategory.set(
            e.category_id,
            (byCategory.get(e.category_id) ?? 0) + e.amount,
        );
    }

    return (
        <>
            <MonthNav month={month} onChange={setMonth} />

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

            {expenses.length > 0 && (
                <>
                    <h3 style={{ marginTop: 20 }}>Recent</h3>
                    <TransactionList
                        expenses={expenses.slice(0, RECENT)}
                        onSelect={onEdit}
                    />
                    {expenses.length > RECENT && (
                        <p className="center" style={{ marginTop: 12 }}>
                            <button onClick={onSeeAll}>
                                See all {expenses.length} expenses
                            </button>
                        </p>
                    )}
                </>
            )}
        </>
    );
}
