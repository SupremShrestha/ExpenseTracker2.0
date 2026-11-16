import { db, today } from './db';

const pad = (n: number) => String(n).padStart(2, '0');

// Same rule + same month always gives the same ID, on every device.
async function occurrenceId(ruleId: string, month: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${ruleId}:${month}`)
  );
  const b = new Uint8Array(buf).slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function dueDate(month: string, day: number): string {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${month}-${pad(Math.min(day, lastDay))}`;
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m, 1); // JS months are 0-based, so this is the next month
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// Creates any missing entries whose due date has arrived. Safe to run often.
// Expense rules create expenses, income rules create income entries.
// Returns how many entries were created.
export async function generateRecurring(): Promise<number> {
  const rules = await db.recurring.filter((r) => !r.deleted_at).toArray();
  if (rules.length === 0) return 0;

  const todayStr = today();
  const thisMonth = todayStr.slice(0, 7);
  let created = 0;

  for (const r of rules) {
    const isIncome = r.kind === 'income';
    const startMonth = r.starts_on.slice(0, 7);
    const lastKey = `rec-last:${r.id}`;
    const saved = (await db.meta.get(lastKey))?.value;
    let month = saved && saved > startMonth ? saved : startMonth;
    let lastDone: string | null = null;
    let guard = 0;

    while (month <= thisMonth && guard++ < 120) {
      const due = dueDate(month, r.day_of_month);
      if (due <= todayStr && due >= r.starts_on) {
        const id = await occurrenceId(r.id, month);
        const t = new Date().toISOString();

        // Soft-deleted rows still exist, so entries you deleted on purpose don't come back
        if (isIncome) {
          if (!(await db.income.get(id))) {
            await db.income.add({
              id,
              amount: r.amount,
              note: r.note,
              received_on: due,
              created_at: t,
              updated_at: t,
              deleted_at: null,
              dirty: 1,
            });
            created++;
          }
        } else if (!(await db.expenses.get(id))) {
          await db.expenses.add({
            id,
            category_id: r.category_id,
            amount: r.amount,
            note: r.note,
            spent_on: due,
            created_at: t,
            updated_at: t,
            deleted_at: null,
            dirty: 1,
          });
          created++;
        }
        lastDone = month;
      }
      month = nextMonth(month);
    }

    if (lastDone) await db.meta.put({ key: lastKey, value: lastDone });
  }
  return created;
}