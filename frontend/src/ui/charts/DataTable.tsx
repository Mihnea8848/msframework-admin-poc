/**
 * The table equivalent of a chart, visually hidden: screen reader users read the values here
 * instead of hunting through the marks. The wrapper is hidden rather than the table, because a
 * table grows to fit its content whatever width it is given.
 */
export default function DataTable({ caption, columns, rows }: {
    caption: string;
    columns: readonly string[];
    rows: readonly (readonly string[])[];
}) {
    return (
        <div className="ms-visually-hidden">
            <table>
                <caption>{caption}</caption>
                <thead>
                    <tr>
                        {columns.map((c) => <th key={c} scope="col">{c}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i}>
                            {row.map((cell, j) => (j === 0 ? <th key={j} scope="row">{cell}</th> : <td key={j}>{cell}</td>))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
