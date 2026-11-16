import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Category, type Expense } from './db';

export function useCategories(): Category[] {
    return (
        useLiveQuery(() => db.categories.filter((c) => !c.deleted_at).sortBy('name'), []) ?? []
    );
}

// Expenses for one month ('YYYY-MM'), newest first
export function useMonthExpenses(month: string): Expense[] {
    return (
        useLiveQuery(
            () =>
                db.expenses
                    .where('spent_on')
                    .between(`${month}-01`, `${month}-32`)
                    .filter((e) => !e.deleted_at)
                    .sortBy('spent_on')
                    .then((rows) => rows.reverse()),
            [month]
        ) ?? []
    );
}

export function useCategoryLookup() {
    const categories = useCategories();
    const catName = (id: string | null) =>
        categories.find((c) => c.id === id)?.name ?? 'Uncategorized';
    const catColor = (id: string | null) =>
        categories.find((c) => c.id === id)?.color ?? null;
    return { categories, catName, catColor };
}