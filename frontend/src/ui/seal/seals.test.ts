import { describe, expect, it } from "vitest";
import { SEALS, sealForColor } from "./seals";

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
