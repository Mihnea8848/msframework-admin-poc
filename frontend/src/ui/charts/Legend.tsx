export interface LegendItem {
    label: string;
    /** The series colour: `ms-chart-key--<tone>` (1, 2, over, track). */
    tone: string;
    /** "line" for line series; bars and areas get a block key. */
    shape?: "block" | "line";
}

/** The legend above a chart with two or more series: a key in the series colour, then its name. */
export default function Legend({ items }: { items: readonly LegendItem[] }) {
    return (
        <ul className="ms-chart-legend">
            {items.map((item) => (
                <li key={item.label}>
                    <i className={`ms-chart-key ms-chart-key--${item.tone}${item.shape === "line" ? " ms-chart-key--line" : ""}`} aria-hidden="true" />
                    {item.label}
                </li>
            ))}
        </ul>
    );
}
