import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readStorage, writeStorage } from "./storage";
import { getLastSeenAuditId, markAuditSeen, onAuditSeen } from "./auditSeen";

function throwingStorage(): Storage {
    const fail = () => {
        throw new DOMException("The operation is insecure.", "SecurityError");
    };
    return {
        length: 0,
        clear: fail,
        getItem: fail,
        key: fail,
        removeItem: fail,
        setItem: fail,
    };
}

describe("storage", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it("reads back what it wrote", () => {
        writeStorage("k", "v");
        expect(readStorage("k")).toBe("v");
        expect(window.localStorage.getItem("k")).toBe("v");
    });

    it("returns the fallback for a missing key", () => {
        expect(readStorage("missing")).toBeNull();
        expect(readStorage("missing", "dflt")).toBe("dflt");
    });

    it("returns a stored empty string instead of the fallback", () => {
        writeStorage("empty", "");
        expect(readStorage("empty", "dflt")).toBe("");
    });

    describe("when localStorage throws", () => {
        beforeEach(() => {
            vi.spyOn(window, "localStorage", "get").mockReturnValue(throwingStorage());
        });

        it("reads return the fallback", () => {
            expect(readStorage("k", "dflt")).toBe("dflt");
            expect(readStorage("k")).toBeNull();
        });

        it("writes are ignored", () => {
            expect(() => writeStorage("k", "v")).not.toThrow();
        });
    });

    describe("when the localStorage getter itself throws", () => {
        beforeEach(() => {
            vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
                throw new DOMException("Access is denied", "SecurityError");
            });
        });

        it("reads and writes still do not throw", () => {
            expect(readStorage("k", "dflt")).toBe("dflt");
            expect(() => writeStorage("k", "v")).not.toThrow();
        });
    });
});

describe("auditSeen", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("starts at 0 and stores the newest id per user", () => {
        const ana = { id: 1 };
        const ion = { id: 2 };
        expect(getLastSeenAuditId(ana)).toBe(0);
        markAuditSeen(ana, 10);
        expect(getLastSeenAuditId(ana)).toBe(10);
        expect(getLastSeenAuditId(ion)).toBe(0);
    });

    it("never moves backwards and notifies listeners only on a change", () => {
        const user = { id: 3 };
        const listener = vi.fn();
        const unsubscribe = onAuditSeen(listener);

        markAuditSeen(user, 5);
        markAuditSeen(user, 4);
        markAuditSeen(user, 5);
        markAuditSeen(user, null);
        expect(getLastSeenAuditId(user)).toBe(5);
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        markAuditSeen(user, 6);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("treats a corrupt stored value as 0", () => {
        window.localStorage.setItem("auditSeen:anon", "garbage");
        expect(getLastSeenAuditId(null)).toBe(0);
    });
});
