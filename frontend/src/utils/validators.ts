// Keep in sync with backend UserService validation.

/** Result of a validator: `ok` plus each individual rule, for live checklists in forms. */
export interface ValidationResult<K extends string> {
    ok: boolean;
    checks: Record<K, boolean>;
}

type Input = string | null | undefined;

export function onlyDigits(s: Input): string {
    return (s || "").replace(/\D/g, "");
}

/**
 * First and last name, each word starting with a capital letter. Accepts any alphabet
 * (e.g. "Ștefan Ionescu", "Zoë O'Neil", "Anne-Marie McDonald").
 */
export function validateFullName(value: Input): ValidationResult<"nonEmpty" | "twoWords" | "capitalized" | "maxLen"> {
    const v = (value || "").trim();
    const parts = v.split(/\s+/).filter(Boolean);
    const nonEmpty = v.length > 0;
    const twoWords = parts.length >= 2;
    const capWord = (w: string) => /^\p{Lu}[\p{L}\p{M}'’-]*$/u.test(w) && /\p{L}$/u.test(w);
    const capitalized = parts.length > 0 && parts.every(capWord);
    const maxLen = v.length <= 100;
    return { ok: nonEmpty && twoWords && capitalized && maxLen, checks: { nonEmpty, twoWords, capitalized, maxLen } };
}

export function validateEmail(value: Input): ValidationResult<"nonEmpty" | "formatOk"> {
    const v = (value || "").trim();
    const nonEmpty = v.length > 0;
    const formatOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254;
    return { ok: nonEmpty && formatOk, checks: { nonEmpty, formatOk } };
}

export function validatePhone(value: Input): ValidationResult<"nonEmpty" | "formatOk" | "minDigits"> {
    const v = (value || "").trim();
    const nonEmpty = v.length > 0;
    const formatOk = /^\+?[0-9 ()-]*$/.test(v) && v.length <= 32;
    const minDigits = onlyDigits(v).length >= 7;
    return { ok: nonEmpty && formatOk && minDigits, checks: { nonEmpty, formatOk, minDigits } };
}

export type PasswordRule = "minLen" | "hasNumber" | "hasSymbol" | "maxLen";

export function validatePassword(value: Input): ValidationResult<PasswordRule> {
    const v = value || "";
    const minLen = v.length >= 8;
    const hasNumber = /\d/.test(v);
    const hasSymbol = /[^A-Za-z0-9]/.test(v);
    const maxLen = new TextEncoder().encode(v).length <= 72;
    return { ok: minLen && hasNumber && hasSymbol && maxLen, checks: { minLen, hasNumber, hasSymbol, maxLen } };
}

export const PASSWORD_LABELS: Record<PasswordRule, string> = {
    minLen: "At least 8 characters",
    hasNumber: "Include a number",
    hasSymbol: "Include a symbol",
    maxLen: "At most 72 bytes",
};

/** First unmet password rule as a sentence, or null when the password is valid. */
export function passwordProblem(value: Input): string | null {
    const { checks } = validatePassword(value);
    const failed = (Object.keys(checks) as PasswordRule[]).find((rule) => !checks[rule]);
    return failed ? PASSWORD_LABELS[failed] : null;
}
