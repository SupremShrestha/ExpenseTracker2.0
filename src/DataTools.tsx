import { useRef, useState } from "react";
import type { Table } from "dexie";
import { db, today, type Category, type Expense } from "./db";

// ======================= shared helpers =======================
function download(filename: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ======================= CSV (expenses only) =======================
const esc = (v: string | number) => {
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function parseCsv(input: string): string[][] {
    const text = input.replace(/^\uFEFF/, "");
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else inQuotes = false;
            } else field += ch;
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ",") {
            row.push(field);
            field = "";
        } else if (ch === "\n" || ch === "\r") {
            if (ch === "\r" && text[i + 1] === "\n") i++;
            row.push(field);
            field = "";
            rows.push(row);
            row = [];
        } else field += ch;
    }
    if (field !== "" || row.length) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const dupKey = (
    date: string,
    amount: number,
    catId: string | null,
    note: string,
) => `${date}|${amount.toFixed(2)}|${catId ?? ""}|${note}`;

async function exportCsv() {
    const [cats, exps] = await Promise.all([
        db.categories.filter((c) => !c.deleted_at).toArray(),
        db.expenses.filter((e) => !e.deleted_at).sortBy("spent_on"),
    ]);
    const name = (id: string | null) =>
        cats.find((c) => c.id === id)?.name ?? "";
    const lines = ["date,amount,category,note"];
    for (const e of exps) {
        lines.push(
            [
                esc(e.spent_on),
                esc(e.amount.toFixed(2)),
                esc(name(e.category_id)),
                esc(e.note),
            ].join(","),
        );
    }
    // BOM so Excel opens it as UTF-8
    download(
        `expenses-${today()}.csv`,
        new Blob(["\uFEFF" + lines.join("\r\n")], {
            type: "text/csv;charset=utf-8",
        }),
    );
    return exps.length;
}

async function importCsv(text: string) {
    const rows = parseCsv(text);
    if (rows.length < 2) throw new Error("The file has no data rows.");

    const head = rows[0].map((h) => h.trim().toLowerCase());
    const iDate = head.indexOf("date");
    const iAmt = head.indexOf("amount");
    const iCat = head.indexOf("category");
    const iNote = head.indexOf("note");
    if (iDate < 0 || iAmt < 0)
        throw new Error(
            'The first row must be a header with at least "date" and "amount".',
        );

    let added = 0,
        dupes = 0,
        invalid = 0,
        newCats = 0;

    await db.transaction("rw", db.expenses, db.categories, async () => {
        const t = new Date().toISOString();
        const cats = await db.categories.filter((c) => !c.deleted_at).toArray();
        const byName = new Map(
            cats.map((c) => [c.name.trim().toLowerCase(), c.id]),
        );

        // Duplicates are checked against what's already in the app, so
        // importing the same file twice doesn't double everything.
        const existing = await db.expenses
            .filter((e) => !e.deleted_at)
            .toArray();
        const seen = new Set(
            existing.map((e) =>
                dupKey(e.spent_on, e.amount, e.category_id, e.note),
            ),
        );

        const catsToAdd: Category[] = [];
        const expsToAdd: Expense[] = [];

        for (const r of rows.slice(1)) {
            const date = (r[iDate] ?? "").trim();
            const amount = parseFloat((r[iAmt] ?? "").replace(/,/g, "").trim());
            if (
                !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
                !Number.isFinite(amount) ||
                amount <= 0
            ) {
                invalid++;
                continue;
            }

            const catName = iCat >= 0 ? (r[iCat] ?? "").trim() : "";
            const lower = catName.toLowerCase();
            let catId: string | null = null;
            if (catName && lower !== "uncategorized") {
                catId = byName.get(lower) ?? null;
                if (!catId) {
                    catId = crypto.randomUUID();
                    byName.set(lower, catId);
                    catsToAdd.push({
                        id: catId,
                        name: catName,
                        color: null,
                        budget: null,
                        created_at: t,
                        updated_at: t,
                        deleted_at: null,
                        dirty: 1,
                    });
                    newCats++;
                }
            }

            const note = iNote >= 0 ? (r[iNote] ?? "").trim() : "";
            const rounded = Math.round(amount * 100) / 100;
            if (seen.has(dupKey(date, rounded, catId, note))) {
                dupes++;
                continue;
            }

            expsToAdd.push({
                id: crypto.randomUUID(),
                category_id: catId,
                amount: rounded,
                note,
                spent_on: date,
                created_at: t,
                updated_at: t,
                deleted_at: null,
                dirty: 1,
            });
            added++;
        }

        if (catsToAdd.length) await db.categories.bulkAdd(catsToAdd);
        if (expsToAdd.length) await db.expenses.bulkAdd(expsToAdd);
    });

    return { added, dupes, invalid, newCats };
}

// ======================= full backup (JSON) =======================
const isStr = (s: unknown) => typeof s === "string";
const isNum = (n: unknown) => typeof n === "number" && Number.isFinite(n);
const isDate = (s: unknown) =>
    typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

type SetDef = {
    key: string;
    table: Table<any, string>;
    valid: (r: any) => boolean;
    fix: (r: any) => any;
};

const SETS: SetDef[] = [
    {
        key: "categories",
        table: db.categories as unknown as Table<any, string>,
        valid: (r) => isStr(r.name),
        fix: (r) => ({
            ...r,
            color: r.color ?? null,
            budget: isNum(r.budget) ? r.budget : null,
        }),
    },
    {
        key: "recurring",
        table: db.recurring as unknown as Table<any, string>,
        valid: (r) =>
            isNum(r.amount) &&
            r.amount >= 0 &&
            Number.isInteger(r.day_of_month) &&
            r.day_of_month >= 1 &&
            r.day_of_month <= 31 &&
            isDate(r.starts_on),
        fix: (r) => ({
            ...r,
            note: r.note ?? "",
            category_id: r.category_id ?? null,
            kind: r.kind === "income" ? "income" : "expense",
        }),
    },
    {
        key: "income",
        table: db.income as unknown as Table<any, string>,
        valid: (r) => isNum(r.amount) && r.amount >= 0 && isDate(r.received_on),
        fix: (r) => ({ ...r, note: r.note ?? "" }),
    },
    {
        key: "goals",
        table: db.goals as unknown as Table<any, string>,
        valid: (r) =>
            isStr(r.name) &&
            isNum(r.target) &&
            r.target > 0 &&
            isNum(r.saved) &&
            r.saved >= 0,
        fix: (r) => ({ ...r, deadline: r.deadline ?? null }),
    },
    {
        key: "expenses",
        table: db.expenses as unknown as Table<any, string>,
        valid: (r) => isNum(r.amount) && r.amount >= 0 && isDate(r.spent_on),
        fix: (r) => ({
            ...r,
            note: r.note ?? "",
            category_id: r.category_id ?? null,
        }),
    },
];

const strip = (rows: any[]) =>
    rows.map((r) => {
        const o = { ...r };
        delete o.dirty;
        return o;
    });

async function exportJson() {
    const out: Record<string, unknown> = {
        app: "expense-tracker",
        version: 1,
        exported_at: new Date().toISOString(),
    };
    let count = 0;
    for (const s of SETS) {
        const rows = await s.table.filter((r: any) => !r.deleted_at).toArray();
        out[s.key] = strip(rows);
        count += rows.length;
    }
    download(
        `expense-tracker-backup-${today()}.json`,
        new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }),
    );
    return count;
}

async function importJson(text: string) {
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error("That file is not valid JSON.");
    }
    if (!data || data.app !== "expense-tracker" || data.version !== 1)
        throw new Error("This is not an Expense Tracker backup file.");

    let added = 0,
        updated = 0,
        current = 0,
        invalid = 0;

    await db.transaction("rw", db.tables, async () => {
        for (const s of SETS) {
            const rows: any[] = Array.isArray(data[s.key]) ? data[s.key] : [];
            for (const raw of rows) {
                if (
                    !raw ||
                    !isStr(raw.id) ||
                    !isStr(raw.updated_at) ||
                    !s.valid(raw)
                ) {
                    invalid++;
                    continue;
                }
                const local: any = await s.table.get(raw.id);
                // Keep whichever version is newer, so a restore never overwrites newer edits
                if (
                    local &&
                    Date.parse(local.updated_at) >= Date.parse(raw.updated_at)
                ) {
                    current++;
                    continue;
                }
                const row = s.fix({
                    ...raw,
                    created_at: raw.created_at ?? raw.updated_at,
                    deleted_at: null,
                    dirty: 1, // marks it for upload on the next sync
                });
                await s.table.put(row);
                if (local) updated++;
                else added++;
            }
        }
    });

    return { added, updated, current, invalid };
}

// ======================= UI =======================
export default function DataTools() {
    const csvRef = useRef<HTMLInputElement>(null);
    const jsonRef = useRef<HTMLInputElement>(null);
    const [msg, setMsg] = useState("");

    async function run(fn: () => Promise<string>) {
        try {
            setMsg(await fn());
        } catch (e: any) {
            setMsg(`Failed: ${e?.message ?? e}`);
        }
    }

    async function onCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        await run(async () => {
            const r = await importCsv(await file.text());
            return (
                `Imported ${r.added} expenses` +
                (r.dupes ? `, skipped ${r.dupes} duplicates` : "") +
                (r.invalid ? `, ${r.invalid} invalid rows ignored` : "") +
                (r.newCats ? `, created ${r.newCats} new categories` : "") +
                "."
            );
        });
    }

    async function onJsonFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        await run(async () => {
            const r = await importJson(await file.text());
            return (
                `Restored ${r.added} new and ${r.updated} updated items` +
                (r.current ? `, ${r.current} were already up to date` : "") +
                (r.invalid ? `, ${r.invalid} invalid items ignored` : "") +
                ". They will sync shortly."
            );
        });
    }

    return (
        <details style={{ margin: "16px 0" }}>
            <summary>
                <b>Backup &amp; restore</b>
            </summary>

            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                <b>Full backup (recommended)</b>
                <small>
                    Everything in one file: expenses, income, categories,
                    budgets, recurring items and goals. Restore it into the same
                    account.
                </small>
                <div style={{ display: "flex", gap: 8 }}>
                    <button
                        className="primary"
                        onClick={() =>
                            run(
                                async () =>
                                    `Backed up ${await exportJson()} items.`,
                            )
                        }
                    >
                        Download backup
                    </button>
                    <button onClick={() => jsonRef.current?.click()}>
                        Restore
                    </button>
                    <input
                        ref={jsonRef}
                        type="file"
                        accept=".json,application/json"
                        hidden
                        onChange={onJsonFile}
                    />
                </div>

                <b style={{ marginTop: 8 }}>Expenses as CSV</b>
                <small>
                    For spreadsheets. Columns: date (YYYY-MM-DD), amount,
                    category, note. Unknown categories are created
                    automatically.
                </small>
                <div style={{ display: "flex", gap: 8 }}>
                    <button
                        onClick={() =>
                            run(
                                async () =>
                                    `Exported ${await exportCsv()} expenses.`,
                            )
                        }
                    >
                        Export CSV
                    </button>
                    <button onClick={() => csvRef.current?.click()}>
                        Import CSV
                    </button>
                    <input
                        ref={csvRef}
                        type="file"
                        accept=".csv,text/csv"
                        hidden
                        onChange={onCsvFile}
                    />
                </div>

                {msg && <small>{msg}</small>}
            </div>
        </details>
    );
}
