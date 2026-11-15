import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addRecurring, deleteRecurring, today } from './db';

export default function Recurring() {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [day, setDay] = useState('1');
  const [startsOn, setStartsOn] = useState(today());

  const categories =
    useLiveQuery(() => db.categories.filter((c) => !c.deleted_at).sortBy('name'), []) ?? [];
  const rules =
    useLiveQuery(() => db.recurring.filter((r) => !r.deleted_at).sortBy('day_of_month'), []) ?? [];

  const catName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? 'Uncategorized';

  async function add() {
    const value = parseFloat(amount);
    const d = parseInt(day, 10);
    if (!Number.isFinite(value) || value <= 0) return;
    if (!Number.isInteger(d) || d < 1 || d > 31) return;
    if (!startsOn) return;
    await addRecurring({
      amount: value,
      note: note.trim(),
      category_id: categoryId || null,
      day_of_month: d,
      starts_on: startsOn,
    });
    setAmount('');
    setNote('');
  }

  async function remove(id: string, label: string) {
    if (window.confirm(`Stop "${label}"? Entries already created will stay.`))
      await deleteRecurring(id);
  }

  return (
    <details style={{ margin: '16px 0' }}>
      <summary><b>Recurring expenses</b></summary>

      <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
        {rules.map((r) => (
          <div key={r.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              {r.amount.toFixed(2)} · {r.note || 'No note'} · {catName(r.category_id)} ·
              day {r.day_of_month}
            </span>
            <button onClick={() => remove(r.id, r.note || String(r.amount))}>✕</button>
          </div>
        ))}

        <div style={{ display: 'grid', gap: 6, paddingTop: 8 }}>
          <input inputMode="decimal" placeholder="Amount" value={amount}
                 onChange={(e) => setAmount(e.target.value)} />
          <input placeholder="Note (e.g. Rent)" value={note}
                 onChange={(e) => setNote(e.target.value)} />
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Uncategorized</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            Day of month
            <input type="number" min={1} max={31} value={day} style={{ width: 70 }}
                   onChange={(e) => setDay(e.target.value)} />
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            Starts on
            <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          </label>
          <button onClick={add}>Add recurring expense</button>
          <small>
            Entries appear automatically after the next sync. A day like 31 becomes
            the last day of shorter months.
          </small>
        </div>
      </div>
    </details>
  );
}
