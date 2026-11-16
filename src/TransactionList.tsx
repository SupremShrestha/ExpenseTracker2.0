import type { Expense } from "./db";
import { useCategoryLookup } from "./useData";
import { fmt, dayLabel } from "./format";

type Props = {
    expenses: Expense[]; // already sorted newest first
    onSelect: (e: Expense) => void;
};

export default function TransactionList({ expenses, onSelect }: Props) {
    const { catName, catColor } = useCategoryLookup();

    const groups: { date: string; rows: Expense[]; total: number }[] = [];
    for (const e of expenses) {
        const last = groups[groups.length - 1];
        if (last && last.date === e.spent_on) {
            last.rows.push(e);
            last.total += e.amount;
        } else {
            groups.push({ date: e.spent_on, rows: [e], total: e.amount });
        }
    }

    return (
        <>
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
                                onClick={() => onSelect(e)}
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
        </>
    );
}
