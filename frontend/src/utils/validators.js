export function onlyDigits(s) {
    return (s || "").replace(/\D/g, "");
}

export function validateFullName(value) {
    const v = value.trim();
    if (!v) return { ok: false, checks: { nonEmpty: false, twoWords: false, capitalized: false } };

    const parts = v.split(/\s+/).filter(Boolean);
    const nonEmpty = v.length > 0;
    const twoWords = parts.length >= 2;

    const capWord = (w) => w.split("-").every(seg => /^[A-Z][a-z]+$/.test(seg));
    const capitalized = parts.length > 0 && parts.every(capWord);

    return { ok: nonEmpty && twoWords && capitalized, checks: { nonEmpty, twoWords, capitalized } };
}

export function validateEmail(value) {
    const v = value.trim();
    const nonEmpty = v.length > 0;
    const formatOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    const ok = nonEmpty && formatOk;
    return { ok, checks: { nonEmpty, formatOk } };
}

export function validatePhone(value) {
    const v = value.trim();
    const nonEmpty = v.length > 0;
    const formatOk = /^\+?\d*$/.test(v);
    const digits = onlyDigits(v);
    const minDigits = digits.length >= 7;
    const ok = nonEmpty && formatOk && minDigits;
    return { ok, checks: { nonEmpty, formatOk, minDigits } };
}

export function validatePassword(value) {
    const v = value || "";
    const minLen = v.length >= 8;
    const hasNumber = /\d/.test(v);
    const hasSymbol = /[^A-Za-z0-9]/.test(v);
    const ok = minLen && hasNumber && hasSymbol;
    return { ok, checks: { minLen, hasNumber, hasSymbol } };
}