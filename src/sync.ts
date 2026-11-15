import { liveQuery, type Table } from 'dexie';
import { supabase } from './supabase';
import { db } from './db';

// ---------- status (read by the UI) ----------
type Status = 'idle' | 'syncing' | 'offline' | 'error';
let status: Status = 'idle';
let lastError = '';
const listeners = new Set<() => void>();
function setStatus(s: Status, err = '') {
    status = s;
    lastError = err;
    listeners.forEach((l) => l());
}
export const subscribeStatus = (cb: () => void) => {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
};
export const getStatus = () => status;
export const getError = () => lastError;

// ---------- what to sync ----------
// Order matters: categories first, because expenses reference them.
const TABLES = [
    {
        name: 'categories',
        table: db.categories as unknown as Table<any, string>,
        cols: ['id', 'name', 'color', 'budget', 'created_at', 'updated_at', 'deleted_at'],
    },
    {
        name: 'expenses',
        table: db.expenses as unknown as Table<any, string>,
        cols: ['id', 'category_id', 'amount', 'note', 'spent_on',
            'created_at', 'updated_at', 'deleted_at'],
    },
];
type Cfg = (typeof TABLES)[number];

// ---------- push: local dirty rows -> Supabase ----------
async function push(t: Cfg) {
    const dirty = await t.table.where('dirty').equals(1).toArray();
    for (let i = 0; i < dirty.length; i += 200) {
        const chunk = dirty.slice(i, i + 200);
        const payload = chunk.map((r) =>
            Object.fromEntries(t.cols.map((c) => [c, r[c] ?? null]))
        );
        const { error } = await supabase.from(t.name).upsert(payload, { onConflict: 'id' });
        if (error) throw error;

        // Mark clean only if the row wasn't edited again while we were pushing
        await db.transaction('rw', t.table, async () => {
            for (const r of chunk) {
                const cur = await t.table.get(r.id);
                if (cur && cur.updated_at === r.updated_at) {
                    await t.table.update(r.id, { dirty: 0 });
                }
            }
        });
    }
}

// ---------- pull: Supabase changes -> local ----------
async function pull(t: Cfg) {
    const key = `cursor:${t.name}`;
    let cursor = (await db.meta.get(key))?.value ?? '1970-01-01T00:00:00Z';

    for (; ;) {
        const { data, error } = await supabase
            .from(t.name)
            .select('*')
            .gte('updated_at', cursor) // gte (not gt) so rows sharing a timestamp are never skipped
            .order('updated_at', { ascending: true })
            .limit(1000);
        if (error) throw error;
        if (!data || data.length === 0) break;

        await db.transaction('rw', t.table, async () => {
            for (const row of data) {
                const local = await t.table.get(row.id);
                if (local?.dirty) continue; // local edit not pushed yet: it wins
                if (local && local.updated_at === row.updated_at) continue; // already have it
                const rest: any = { ...row };
                delete rest.user_id;
                await t.table.put({ ...rest, dirty: 0 });
            }
        });

        const next = data[data.length - 1].updated_at as string;
        await db.meta.put({ key, value: next });
        if (data.length < 1000 || next === cursor) break;
        cursor = next;
    }
}

// ---------- one sync run (never two at once) ----------
let running = false;
let again = false;

export async function syncNow() {
    if (!navigator.onLine) return setStatus('offline');
    if (running) { again = true; return; }
    running = true;
    setStatus('syncing');
    try {
        do {
            again = false;
            for (const t of TABLES) await push(t);
            for (const t of TABLES) await pull(t);
        } while (again);
        setStatus('idle');
    } catch (e: any) {
        setStatus('error', e?.message ?? String(e));
    } finally {
        running = false;
    }
}

// ---------- start/stop (called once per logged-in user) ----------
export async function startSync(userId: string) {
    // If a different account logs in on this device, wipe local data so
    // the previous account's rows never get uploaded into this one.
    const owner = await db.meta.get('user_id');
    if (owner && owner.value !== userId) {
        await db.transaction('rw', db.expenses, db.categories, db.meta, async () => {
            await db.expenses.clear();
            await db.categories.clear();
            await db.meta.clear();
        });
    }
    await db.meta.put({ key: 'user_id', value: userId });

    // Any local change (dirty row) triggers a sync shortly after
    let timer: number | undefined;
    const schedule = () => {
        clearTimeout(timer);
        timer = window.setTimeout(syncNow, 800);
    };
    const sub = liveQuery(
        async () =>
            (await db.expenses.where('dirty').equals(1).count()) +
            (await db.categories.where('dirty').equals(1).count())
    ).subscribe((n) => { if (n > 0) schedule(); });

    const onOnline = () => syncNow();
    const onVisible = () => { if (document.visibilityState === 'visible') syncNow(); };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(syncNow, 60_000);

    syncNow();

    return () => {
        sub.unsubscribe();
        clearTimeout(timer);
        clearInterval(interval);
        window.removeEventListener('online', onOnline);
        document.removeEventListener('visibilitychange', onVisible);
    };
}