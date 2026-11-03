import { describe, expect, it } from "vitest";
import { parseCSV, toCSV } from "./csv";
import type { CSVColumn } from "./csv";

describe("parseCSV", () => {
    it("lower-cases and trims headers and trims values", () => {
        const { headers, rows } = parseCSV(" Full Name ,EMAIL\n Ana Pop , ana@test.com \n");
        expect(headers).toEqual(["full name", "email"]);
        expect(rows).toEqual([{ "full name": "Ana Pop", email: "ana@test.com" }]);
    });

    it("handles quoted fields with commas", () => {
        const { rows } = parseCSV('name,city\n"Pop, Ana","Cluj-Napoca"');
        expect(rows).toEqual([{ name: "Pop, Ana", city: "Cluj-Napoca" }]);
    });

    it("unescapes doubled quotes", () => {
        const { rows } = parseCSV('name\n"Ana ""the boss"" Pop"');
        expect(rows[0]?.name).toBe('Ana "the boss" Pop');
    });

    it("keeps newlines inside quoted fields", () => {
        const { rows } = parseCSV('name,notes\nAna,"line one\nline two"\nIon,x');
        expect(rows).toHaveLength(2);
        expect(rows[0]?.notes).toBe("line one\nline two");
        expect(rows[1]).toEqual({ name: "Ion", notes: "x" });
    });

    it("accepts CRLF and lone CR line endings", () => {
        expect(parseCSV("a,b\r\n1,2\r\n3,4\r\n").rows).toEqual([{ a: "1", b: "2" }, { a: "3", b: "4" }]);
        expect(parseCSV("a\r1\r2").rows).toEqual([{ a: "1" }, { a: "2" }]);
    });

    it("strips a UTF-8 BOM and keeps diacritics", () => {
        const { headers, rows } = parseCSV("\uFEFFname\nȘtefan Ionescu");
        expect(headers).toEqual(["name"]);
        expect(rows[0]?.name).toBe("Ștefan Ionescu");
    });

    it("skips blank lines and fills missing cells with an empty string", () => {
        const { rows } = parseCSV("a,b,c\n\n1\n , \n2,3,4");
        expect(rows).toEqual([{ a: "1", b: "", c: "" }, { a: "2", b: "3", c: "4" }]);
    });

    it("returns nothing for empty input", () => {
        expect(parseCSV("")).toEqual({ headers: [], rows: [] });
        expect(parseCSV(null)).toEqual({ headers: [], rows: [] });
        expect(parseCSV("\n\n")).toEqual({ headers: [], rows: [] });
    });
});

interface Person {
    name: string;
    phone: string | null;
    note: unknown;
}

const columns: CSVColumn<Person>[] = [
    { key: "name", label: "Name" },
    { key: "phone", label: "Phone" },
    { key: "note", label: "Note" },
];

function cells(csv: string): string[] {
    const [, line] = csv.split("\r\n");
    return (line ?? "").split(",");
}

describe("toCSV", () => {
    it("writes a header and CRLF-separated rows", () => {
        const csv = toCSV([{ name: "Ana", phone: "1", note: "x" }, { name: "Ion", phone: "2", note: "y" }], columns);
        expect(csv).toBe("Name,Phone,Note\r\nAna,1,x\r\nIon,2,y");
    });

    it("uses get() when a column has one", () => {
        const csv = toCSV([{ name: "Ana", phone: null, note: null }], [
            { key: "name", label: "Upper", get: (p: Person) => p.name.toUpperCase() },
        ]);
        expect(csv).toBe("Upper\r\nANA");
    });

    it("writes null and undefined as empty cells", () => {
        expect(cells(toCSV([{ name: "Ana", phone: null, note: undefined }], columns))).toEqual(["Ana", "", ""]);
    });

    it("quotes cells with commas, quotes and newlines", () => {
        const csv = toCSV([{ name: 'Pop, "Ana"', phone: "1", note: "a\nb" }], columns);
        expect(csv).toBe('Name,Phone,Note\r\n"Pop, ""Ana""",1,"a\nb"');
    });

    it.each([
        ["=SUM(A1:A2)", "'=SUM(A1:A2)"],
        ["@cmd", "'@cmd"],
        ["+HYPERLINK(\"x\")", "'+HYPERLINK(\"x\")"],
        ["-A1", "'-A1"],
        ["\tTAB", "'\tTAB"],
    ])("escapes the formula-like value %j", (value, expected) => {
        const csv = toCSV([{ name: "Ana", phone: null, note: value }], columns);
        expect(parseCSV(csv).rows[0]?.note).toBe(expected);
    });

    it.each(["+40 712 345 678", "-5", "+5", "-", "+ 1"])("keeps the ordinary value %j unchanged", (value) => {
        const csv = toCSV([{ name: "Ana", phone: value, note: null }], columns);
        expect(cells(csv)[1]).toBe(value);
    });

    it("round-trips through parseCSV", () => {
        const people: Person[] = [
            { name: "Ștefan Ionescu", phone: "+40 712 345 678", note: 'He said "hi", then left\non time' },
            { name: "Anne-Marie McDonald", phone: "-5", note: 42 },
        ];
        const { headers, rows } = parseCSV(toCSV(people, columns));
        expect(headers).toEqual(["name", "phone", "note"]);
        expect(rows).toEqual([
            { name: "Ștefan Ionescu", phone: "+40 712 345 678", note: 'He said "hi", then left\non time' },
            { name: "Anne-Marie McDonald", phone: "-5", note: "42" },
        ]);
    });
});
