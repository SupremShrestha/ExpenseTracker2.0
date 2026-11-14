import Dexie, { type EntityTable } from 'dexie';

export interface Category {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  dirty: 0 | 1; // 1 = has local changes not yet pushed to Supabase
}

export interface Expense {
  id: string;
  category_id: string | null;
  amount: number;
  note: string;
  spent_on: string; // 'YYYY-MM-DD', local date
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  dirty: 0 | 1;
}

export const db = new Dexie('expense-tracker') as Dexie & {
  expenses: EntityTable<Expense, 'id'>;
  categories: EntityTable<Category, 'id'>;
  meta: EntityTable<{ key: string; value: string }, 'key'>; // for last-sync timestamp later
};

db.version(1).stores({
  expenses: 'id, spent_on, category_id, updated_at, dirty',
  categories: 'id, updated_at, dirty',
  meta: 'key',
});

const now = () => new Date().toISOString();
export const today = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD

export async function addExpense(input: {
  amount: number;
  note?: string;
  category_id?: string | null;
  spent_on?: string;
}) {
  const t = now();
  await db.expenses.add({
    id: crypto.randomUUID(),
    category_id: input.category_id ?? null,
    amount: Math.round(input.amount * 100) / 100,
    note: input.note ?? '',
    spent_on: input.spent_on ?? today(),
    created_at: t,
    updated_at: t,
    deleted_at: null,
    dirty: 1,
  });
}

export async function updateExpense(
  id: string,
  patch: Partial<Pick<Expense, 'amount' | 'note' | 'category_id' | 'spent_on'>>
) {
  await db.expenses.update(id, { ...patch, updated_at: now(), dirty: 1 });
}

// Soft delete, so the deletion can sync to other devices
export async function deleteExpense(id: string) {
  const t = now();
  await db.expenses.update(id, { deleted_at: t, updated_at: t, dirty: 1 });
}

export async function addCategory(name: string, color: string | null = null) {
  const t = now();
  await db.categories.add({
    id: crypto.randomUUID(),
    name: name.trim(),
    color,
    created_at: t,
    updated_at: t,
    deleted_at: null,
    dirty: 1,
  });
}