import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, addCategory, updateCategory, deleteCategory } from "./db";

export default function Categories() {
    const [name, setName] = useState("");
    const [color, setColor] = useState("#38bdf8");

    const categories =
        useLiveQuery(
            () => db.categories.filter((c) => !c.deleted_at).sortBy("name"),
            [],
        ) ?? [];

    async function add() {
        if (!name.trim()) return;
        await addCategory(name, color);
        setName("");
    }

    async function remove(id: string, label: string) {
        if (
            window.confirm(
                `Delete "${label}"? Its expenses will become Uncategorized.`,
            )
        )
            await deleteCategory(id);
    }

    return (
        <details style={{ margin: "16px 0" }}>
            <summary>
                <b>Manage categories &amp; budgets</b>
            </summary>

            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {categories.map((c) => (
                    <div
                        key={c.id}
                        style={{
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                        }}
                    >
                        <input
                            type="color"
                            defaultValue={c.color ?? "#38bdf8"}
                            onChange={(e) =>
                                updateCategory(c.id, { color: e.target.value })
                            }
                        />
                        <input
                            key={`n-${c.id}-${c.updated_at}`}
                            defaultValue={c.name}
                            style={{ flex: 1, minWidth: 0 }}
                            onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (!v) e.target.value = c.name;
                                else if (v !== c.name)
                                    updateCategory(c.id, { name: v });
                            }}
                        />
                        <input
                            key={`b-${c.id}-${c.updated_at}`}
                            inputMode="decimal"
                            placeholder="Budget"
                            defaultValue={c.budget ?? ""}
                            style={{ width: 80 }}
                            onBlur={(e) => {
                                const raw = e.target.value.trim();
                                const v = raw === "" ? null : parseFloat(raw);
                                if (
                                    v !== null &&
                                    (!Number.isFinite(v) || v < 0)
                                ) {
                                    e.target.value = String(c.budget ?? "");
                                    return;
                                }
                                if (v !== (c.budget ?? null))
                                    updateCategory(c.id, { budget: v });
                            }}
                        />
                        <button onClick={() => remove(c.id, c.name)}>✕</button>
                    </div>
                ))}

                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                    />
                    <input
                        placeholder="New category"
                        value={name}
                        style={{ flex: 1, minWidth: 0 }}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <button onClick={add}>Add</button>
                </div>
            </div>
        </details>
    );
}
