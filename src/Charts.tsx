import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Cell,
} from "recharts";
import type { Expense } from "./db";

const COLORS = [
    "#38bdf8",
    "#34d399",
    "#fbbf24",
    "#f87171",
    "#a78bfa",
    "#fb923c",
    "#f472b6",
    "#2dd4bf",
];
const round = (n: number) => Math.round(n * 100) / 100;
const tick = { fill: "currentColor", fontSize: 12 };

type Props = {
    month: string; // 'YYYY-MM'
    expenses: Expense[];
    catName: (id: string | null) => string;
    catColor: (id: string | null) => string | null;
};

export default function Charts({ month, expenses, catName, catColor }: Props) {
    if (expenses.length === 0) return null;

    const [y, m] = month.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const daily = Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        total: 0,
    }));
    const cats = new Map<string | null, number>();

    for (const e of expenses) {
        const d = Number(e.spent_on.slice(8, 10));
        if (daily[d - 1]) daily[d - 1].total += e.amount;
        cats.set(e.category_id, (cats.get(e.category_id) ?? 0) + e.amount);
    }

    const byCat = [...cats]
        .map(([id, total]) => ({
            name: catName(id),
            total: round(total),
            color: catColor(id),
        }))
        .sort((a, b) => b.total - a.total);
    const byDay = daily.map((d) => ({ ...d, total: round(d.total) }));

    return (
        <section>
            <h3>By category</h3>
            <div
                style={{
                    width: "100%",
                    height: Math.max(120, byCat.length * 36),
                }}
            >
                <ResponsiveContainer>
                    <BarChart
                        data={byCat}
                        layout="vertical"
                        margin={{ left: 0, right: 16 }}
                    >
                        <XAxis type="number" hide />
                        <YAxis
                            type="category"
                            dataKey="name"
                            width={90}
                            tick={tick}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            cursor={{ fill: "rgba(128,128,128,0.15)" }}
                            contentStyle={{ color: "#111" }}
                        />
                        <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                            {byCat.map((d, i) => (
                                <Cell
                                    key={i}
                                    fill={d.color ?? COLORS[i % COLORS.length]}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <h3>By day</h3>
            <div style={{ width: "100%", height: 180 }}>
                <ResponsiveContainer>
                    <BarChart data={byDay} margin={{ left: -16, right: 8 }}>
                        <CartesianGrid
                            vertical={false}
                            stroke="currentColor"
                            strokeOpacity={0.15}
                        />
                        <XAxis
                            dataKey="day"
                            tick={tick}
                            interval={2}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis tick={tick} axisLine={false} tickLine={false} />
                        <Tooltip
                            cursor={{ fill: "rgba(128,128,128,0.15)" }}
                            contentStyle={{ color: "#111" }}
                            labelFormatter={(d) => `Day ${d}`}
                        />
                        <Bar
                            dataKey="total"
                            fill="#38bdf8"
                            radius={[3, 3, 0, 0]}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </section>
    );
}
