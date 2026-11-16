import { useCategoryLookup, useMonthExpenses } from "./useData";
import MonthNav from "./MonthNav";
import Budgets from "./Budgets";
import Charts from "./Charts";
import Yearly from "./Yearly";

export default function Insights({
    month,
    setMonth,
}: {
    month: string;
    setMonth: (m: string) => void;
}) {
    const expenses = useMonthExpenses(month);
    const { categories, catName, catColor } = useCategoryLookup();
    const hasBudgets = categories.some((c) => (c.budget ?? 0) > 0);

    return (
        <>
            <MonthNav month={month} onChange={setMonth} />

            <div className="card">
                <Budgets expenses={expenses} categories={categories} />
            </div>
            {!hasBudgets && (
                <p className="muted small center">
                    Set monthly budgets under Settings → Categories to track
                    them here.
                </p>
            )}

            <div className="card">
                <Charts
                    month={month}
                    expenses={expenses}
                    catName={catName}
                    catColor={catColor}
                />
            </div>

            {expenses.length === 0 && (
                <p className="muted center">
                    No expenses this month, so there's nothing to chart yet.
                </p>
            )}

            <Yearly />
        </>
    );
}
