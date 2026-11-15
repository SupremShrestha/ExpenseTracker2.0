import { useRef, useState } from "react";
import { db, today, type Category, type Expense } from "./db";

// ---------- CSV helpers ----------
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

// ---------- export ----------
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
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
        type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${today()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return exps.length;
}

// ---------- import ----------
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

        // Duplicates are checked against what's already in the app (not within the file),
        // so importing the same file twice doesn't double everything.
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

// ---------- UI ----------
export default function DataTools() {
    const fileRef = useRef<HTMLInputElement>(null);
    const [msg, setMsg] = useState("");

    async function onExport() {
        try {
            const n = await exportCsv();
            setMsg(`Exported ${n} expenses.`);
        } catch (e: any) {
            setMsg(`Export failed: ${e?.message ?? e}`);
        }
    }

    async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        try {
            const r = await importCsv(await file.text());
            setMsg(
                `Imported ${r.added} expenses` +
                    (r.dupes ? `, skipped ${r.dupes} duplicates` : "") +
                    (r.invalid ? `, ${r.invalid} invalid rows ignored` : "") +
                    (r.newCats ? `, created ${r.newCats} new categories` : "") +
                    ".",
            );
        } catch (err: any) {
            setMsg(`Import failed: ${err?.message ?? err}`);
        }
    }

    return (
        <details style={{ margin: "16px 0" }}>
            <summary>
                <b>Backup (CSV)</b>
            </summary>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={onExport}>Export CSV</button>
                    <button onClick={() => fileRef.current?.click()}>
                        Import CSV
                    </button>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".csv,text/csv"
                        hidden
                        onChange={onFile}
                    />
                </div>
                <small>
                    Columns: date (YYYY-MM-DD), amount, category, note. Unknown
                    categories are created automatically.
                </small>
                {msg && <small>{msg}</small>}
            </div>
        </details>
    );
}
