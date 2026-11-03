import { describe, expect, it } from "vitest";
import {
    onlyDigits, passwordProblem, validateEmail, validateFullName, validatePassword, validatePhone,
} from "./validators";

describe("validateFullName", () => {
    it.each(["Ștefan Ionescu", "Anne-Marie McDonald", "Zoë O'Neil", "Jean-Luc Picard Junior"])(
        "accepts %s",
        (name) => {
            expect(validateFullName(name).ok).toBe(true);
        },
    );

    it("rejects lower-case words", () => {
        const result = validateFullName("john doe");
        expect(result.ok).toBe(false);
        expect(result.checks).toMatchObject({ nonEmpty: true, twoWords: true, capitalized: false });
    });

    it("needs at least two words", () => {
        const result = validateFullName("Madonna");
        expect(result.ok).toBe(false);
        expect(result.checks.twoWords).toBe(false);
    });

    it("rejects empty and blank input", () => {
        expect(validateFullName("").checks.nonEmpty).toBe(false);
        expect(validateFullName("   ").ok).toBe(false);
        expect(validateFullName(null).ok).toBe(false);
        expect(validateFullName(undefined).ok).toBe(false);
    });

    it("rejects words that end in a hyphen or apostrophe, and digits", () => {
        expect(validateFullName("Anne- Smith").ok).toBe(false);
        expect(validateFullName("John O'").ok).toBe(false);
        expect(validateFullName("John Doe2").ok).toBe(false);
    });

    it("trims and collapses whitespace", () => {
        expect(validateFullName("  Ana   Pop  ").ok).toBe(true);
    });

    it("limits the length to 100 characters", () => {
        const long = `Ana ${"P".repeat(97)}`;
        expect(long.length).toBe(101);
        expect(validateFullName(long).checks.maxLen).toBe(false);
        expect(validateFullName(long.slice(0, 100)).checks.maxLen).toBe(true);
    });
});

describe("validateEmail", () => {
    it("accepts a normal address and trims it", () => {
        expect(validateEmail("  admin@test.com ").ok).toBe(true);
    });

    it.each(["", "admin", "admin@test", "admin@test.c", "a b@test.com", "admin@@test.com"])(
        "rejects %j",
        (email) => {
            expect(validateEmail(email).ok).toBe(false);
        },
    );

    it("limits the length to 254 characters", () => {
        const local = "a".repeat(250);
        expect(validateEmail(`${local}@x.io`).ok).toBe(false);
    });
});

describe("validatePhone", () => {
    it.each(["+40 712 345 678", "0712345678", "(021) 123-4567"])("accepts %s", (phone) => {
        expect(validatePhone(phone).ok).toBe(true);
    });

    it("needs at least 7 digits", () => {
        const result = validatePhone("123 45");
        expect(result.ok).toBe(false);
        expect(result.checks).toEqual({ nonEmpty: true, formatOk: true, minDigits: false });
    });

    it("rejects letters and a plus sign that is not leading", () => {
        expect(validatePhone("0712 ABC 678").checks.formatOk).toBe(false);
        expect(validatePhone("0712+345678").checks.formatOk).toBe(false);
    });

    it("limits the length to 32 characters", () => {
        expect(validatePhone("1".repeat(33)).checks.formatOk).toBe(false);
    });

    it("reports empty input", () => {
        expect(validatePhone("").checks.nonEmpty).toBe(false);
    });
});

describe("onlyDigits", () => {
    it("strips everything but digits", () => {
        expect(onlyDigits("+40 (712) 345-678")).toBe("40712345678");
        expect(onlyDigits(null)).toBe("");
    });
});

describe("validatePassword", () => {
    it("accepts a password that meets every rule", () => {
        expect(validatePassword("s3cure!pw").ok).toBe(true);
    });

    it("reports each failed rule", () => {
        expect(validatePassword("short1!").checks.minLen).toBe(false);
        expect(validatePassword("no-number-here").checks.hasNumber).toBe(false);
        expect(validatePassword("nosymbol123").checks.hasSymbol).toBe(false);
    });

    it("measures the 72 limit in UTF-8 bytes, like BCrypt", () => {
        // "ș" is 2 bytes in UTF-8, so 35 of them plus "1!" are exactly 72 bytes (37 characters).
        expect(validatePassword(`${"ș".repeat(35)}1!`).checks.maxLen).toBe(true);
        expect(validatePassword(`${"ș".repeat(36)}1!`).checks.maxLen).toBe(false);
        expect(validatePassword(`${"a".repeat(70)}1!`).checks.maxLen).toBe(true);
        expect(validatePassword(`${"a".repeat(71)}1!`).checks.maxLen).toBe(false);
    });
});

describe("passwordProblem", () => {
    it("returns null for a valid password", () => {
        expect(passwordProblem("s3cure!pw")).toBeNull();
    });

    it("returns the first unmet rule in order", () => {
        expect(passwordProblem("")).toBe("At least 8 characters");
        expect(passwordProblem("abcdefgh")).toBe("Include a number");
        expect(passwordProblem("abcdefg1")).toBe("Include a symbol");
        expect(passwordProblem(`${"a".repeat(80)}1!`)).toBe("At most 72 bytes");
    });
});
