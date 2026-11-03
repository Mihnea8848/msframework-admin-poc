/** localStorage helpers that never throw (private mode, disabled storage, ...). */
export function readStorage(key: string): string | null;
export function readStorage<F>(key: string, fallback: F): string | F;
export function readStorage<F>(key: string, fallback: F | null = null): string | F | null {
    try {
        const value = window.localStorage.getItem(key);
        return value === null ? fallback : value;
    } catch {
        return fallback;
    }
}

export function writeStorage(key: string, value: string): void {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // ignore
    }
}
