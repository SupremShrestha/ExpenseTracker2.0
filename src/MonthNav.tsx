import { shiftMonth, monthLabel } from "./format";

export default function MonthNav({
    month,
    onChange,
}: {
    month: string;
    onChange: (m: string) => void;
}) {
    return (
        <div className="monthnav">
            <button
                onClick={() => onChange(shiftMonth(month, -1))}
                aria-label="Previous month"
            >
                ‹
            </button>
            <span className="label">{monthLabel(month)}</span>
            <button
                onClick={() => onChange(shiftMonth(month, 1))}
                aria-label="Next month"
            >
                ›
            </button>
        </div>
    );
}
