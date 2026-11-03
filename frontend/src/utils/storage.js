/** localStorage helpers that never throw (private mode, disabled storage, …). */
export function readStorage(key, fallback = null) {
    try {
        const value = window.localStorage.getItem(key);
        return value === null ? fallback : value;
    } catch {
        return fallback;
    }
}

export function writeStorage(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // ignore
    }
}
