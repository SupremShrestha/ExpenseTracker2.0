import Dexie, { type EntityTable } from 'dexie';

export interface Category {
  id: string;
  name: string;
  color: string | null;
  budget: number | null; // monthly limit, null = no budget
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

export interface Recurring {
  id: string;
  category_id: string | null;
  amount: number;
  note: string;
  day_of_month: number; // 1-31 (clamped to the month's last day)
  starts_on: string; // 'YYYY-MM-DD'
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  dirty: 0 | 1;
}

export interface Income {
  id: string;
  amount: number;
  note: string;
  received_on: string; // 'YYYY-MM-DD'
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  dirty: 0 | 1;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  deadline: string | null; // 'YYYY-MM-DD'
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  dirty: 0 | 1;
}

export const db = new Dexie('expense-tracker') as Dexie & {
  expenses: EntityTable<Expense, 'id'>;
  categories: EntityTable<Category, 'id'>;
  recurring: EntityTable<Recurring, 'id'>;
  income: EntityTable<Income, 'id'>;
  goals: EntityTable<Goal, 'id'>;
  meta: EntityTable<{ key: string; value: string }, 'key'>;
};

db.version(1).stores({
  expenses: 'id, spent_on, category_id, updated_at, dirty',
  categories: 'id, updated_at, dirty',
  meta: 'key',
});

db.version(2).stores({
  expenses: 'id, spent_on, category_id, updated_at, dirty',
  categories: 'id, updated_at, dirty',
  recurring: 'id, category_id, updated_at, dirty',
  meta: 'key',
});

db.version(3).stores({
  expenses: 'id, spent_on, category_id, updated_at, dirty',
  categories: 'id, updated_at, dirty',
  recurring: 'id, category_id, updated_at, dirty',
  income: 'id, received_on, updated_at, dirty',
  goals: 'id, updated_at, dirty',
  meta: 'key',
});

const now = () => new Date().toISOString();
export const today = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD
const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------- expenses ----------
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
    amount: round2(input.amount),
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

// ---------- categories ----------
// Returns the new category's id so callers can select it straight away.
export async function addCategory(name: string, color: string | null = null) {
  const t = now();
  const id = crypto.randomUUID();
  await db.categories.add({
    id,
    name: name.trim(),
    color,
    budget: null,
    created_at: t,
    updated_at: t,
    deleted_at: null,
    dirty: 1,
  });
  return id;
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'color' | 'budget'>>
) {
  await db.categories.update(id, { ...patch, updated_at: now(), dirty: 1 });
}

// Soft delete. Expenses and recurring rules in this category become
// Uncategorized, and are marked dirty so that change syncs everywhere.
export async function deleteCategory(id: string) {
  const t = now();
  await db.transaction('rw', db.categories, db.expenses, db.recurring, async () => {
    await db.expenses
      .where('category_id')
      .equals(id)
      .modify({ category_id: null, updated_at: t, dirty: 1 });
    await db.recurring
      .where('category_id')
      .equals(id)
      .modify({ category_id: null, updated_at: t, dirty: 1 });
    await db.categories.update(id, { deleted_at: t, updated_at: t, dirty: 1 });
  });
}

// ---------- recurring rules ----------
export async function addRecurring(input: {
  amount: number;
  note: string;
  category_id: string | null;
  day_of_month: number;
  starts_on: string;
}) {
  const t = now();
  await db.recurring.add({
    id: crypto.randomUUID(),
    category_id: input.category_id,
    amount: round2(input.amount),
    note: input.note,
    day_of_month: input.day_of_month,
    starts_on: input.starts_on,
    created_at: t,
    updated_at: t,
    deleted_at: null,
    dirty: 1,
  });
}

// Changes apply to entries created from now on. Entries already created stay as they are.
export async function updateRecurring(
  id: string,
  patch: Partial<
    Pick<Recurring, 'amount' | 'note' | 'category_id' | 'day_of_month' | 'starts_on'>
  >
) {
  await db.transaction('rw', db.recurring, db.meta, async () => {
    await db.recurring.update(id, { ...patch, updated_at: now(), dirty: 1 });
    // If the start date moved, re-scan from it next time. This can't create
    // duplicates, because every entry has a fixed ID per rule and month.
    if (patch.starts_on !== undefined) await db.meta.delete(`rec-last:${id}`);
  });
}

// Stops future entries. Entries already created stay.
export async function deleteRecurring(id: string) {
  const t = now();
  await db.recurring.update(id, { deleted_at: t, updated_at: t, dirty: 1 });
}

// ---------- income ----------
export async function addIncome(input: { amount: number; note: string; received_on: string }) {
  const t = now();
  await db.income.add({
    id: crypto.randomUUID(),
    amount: round2(input.amount),
    note: input.note,
    received_on: input.received_on,
    created_at: t,
    updated_at: t,
    deleted_at: null,
    dirty: 1,
  });
}

export async function updateIncome(
  id: string,
  patch: Partial<Pick<Income, 'amount' | 'note' | 'received_on'>>
) {
  await db.income.update(id, { ...patch, updated_at: now(), dirty: 1 });
}

export async function deleteIncome(id: string) {
  const t = now();
  await db.income.update(id, { deleted_at: t, updated_at: t, dirty: 1 });
}

// ---------- savings goals ----------
export async function addGoal(input: {
  name: string;
  target: number;
  saved: number;
  deadline: string | null;
}) {
  const t = now();
  await db.goals.add({
    id: crypto.randomUUID(),
    name: input.name.trim(),
    target: round2(input.target),
    saved: round2(input.saved),
    deadline: input.deadline,
    created_at: t,
    updated_at: t,
    deleted_at: null,
    dirty: 1,
  });
}

export async function updateGoal(
  id: string,
  patch: Partial<Pick<Goal, 'name' | 'target' | 'saved' | 'deadline'>>
) {
  await db.goals.update(id, { ...patch, updated_at: now(), dirty: 1 });
}

// Add (positive) or take out (negative) money. Never goes below 0.
export async function adjustGoal(id: string, delta: number) {
  await db.transaction('rw', db.goals, async () => {
    const g = await db.goals.get(id);
    if (!g) return;
    await db.goals.update(id, {
      saved: Math.max(0, round2(g.saved + delta)),
      updated_at: now(),
      dirty: 1,
    });
  });
}

export async function deleteGoal(id: string) {
  const t = now();
  await db.goals.update(id, { deleted_at: t, updated_at: t, dirty: 1 });
}