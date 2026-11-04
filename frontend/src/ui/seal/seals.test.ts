import { describe, expect, it } from "vitest";
import { SEALS, sealForColor, sealRingTitle } from "./seals";
import type { Seal, SealKey } from "./seals";

describe("sealForColor", () => {
    it("maps the legacy colour keys to the nearest seal", () => {
        expect(sealForColor("avatar-azure").key).toBe("quality-control");
        expect(sealForColor("avatar-sky").key).toBe("quality-control");
        expect(sealForColor("avatar-rose").key).toBe("administration");
        expect(sealForColor("avatar-coral").key).toBe("administration");
        expect(sealForColor("avatar-plum").key).toBe("development");
        expect(sealForColor("avatar-amber").key).toBe("human-resources");
        expect(sealForColor("avatar-jade").key).toBe("external-affairs");
        expect(sealForColor("avatar-gold").key).toBe("director");
    });

    it("falls back to the default colour's seal", () => {
        expect(sealForColor(null).key).toBe("quality-control");
        expect(sealForColor("avatar-unknown").key).toBe("quality-control");
    });

    it("saves a backend-valid colour for each seal that maps back to it", () => {
        for (const seal of SEALS) {
            expect(seal.color).toMatch(/^avatar-[a-z]{2,20}$/);
            expect(sealForColor(seal.color).key).toBe(seal.key);
        }
    });
});

describe("sealRingTitle", () => {
    const seal = (key: SealKey) => SEALS.find((s) => s.key === key) as Seal;

    it("uses the department's own name when it is named after its seal", () => {
        expect(sealRingTitle("Human Resources", seal("human-resources"))).toBe("Department of Human Resources");
        expect(sealRingTitle("Ethics and Regulations", seal("ethics-regulations"))).toBe("Department of Ethics and Regulations");
        expect(sealRingTitle("Department of Development", seal("development"))).toBe("Department of Development");
    });

    it("uses the seal's official title for any other department", () => {
        expect(sealRingTitle("Marketing", seal("human-resources"))).toBe("Department of Human Resources");
        expect(sealRingTitle("", seal("quality-control"))).toBe("Department of Quality Control");
        expect(sealRingTitle(null, seal("administration"))).toBe("Department of Administration");
    });

    it("always gives the Director's seal its official title", () => {
        expect(sealRingTitle("Director's office", seal("director"))).toBe("Bureau of the Director of MSINC");
    });
});
