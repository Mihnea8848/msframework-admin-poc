import { Atom, Compass, Cpu, Globe, Landmark, Scale, Target, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** The eight department seals, in the order the concept lists them (see tokens/seals.css). */
export type SealKey =
    | "administration"
    | "development"
    | "quality-control"
    | "external-affairs"
    | "human-resources"
    | "ethics-regulations"
    | "engineering-innovation"
    | "director";

export interface Seal {
    key: SealKey;
    name: string;
    /** The title on the official seal's ring, as printed on the brand artwork. */
    official: string;
    icon: LucideIcon;
    /**
     * The colour key saved for a department that picks this seal. Departments still store the
     * older `avatar-*` keys (the backend accepts any `avatar-[a-z]+`), so each seal has one.
     */
    color: string;
}

export const SEALS: readonly Seal[] = [
    { key: "administration", name: "Administration", official: "Department of Administration", icon: Landmark, color: "avatar-rose" },
    { key: "development", name: "Development", official: "Department of Development", icon: Cpu, color: "avatar-violet" },
    { key: "quality-control", name: "Quality Control", official: "Department of Quality Control", icon: Target, color: "avatar-azure" },
    { key: "external-affairs", name: "External Affairs", official: "Department of External Affairs", icon: Globe, color: "avatar-jade" },
    { key: "human-resources", name: "Human Resources", official: "Department of Human Resources", icon: UsersRound, color: "avatar-orange" },
    { key: "ethics-regulations", name: "Ethics & Regulations", official: "Department of Ethics & Regulations", icon: Scale, color: "avatar-silver" },
    { key: "engineering-innovation", name: "Engineering & Innovation", official: "Department of Engineering & Innovation", icon: Atom, color: "avatar-snow" },
    { key: "director", name: "Director's office", official: "Bureau of the Director of MSINC", icon: Compass, color: "avatar-gold" },
];

/** Each seal's emblem, by key (a static lookup, so components can render it directly). */
export const SEAL_ICONS = Object.fromEntries(SEALS.map((s) => [s.key, s.icon])) as Record<SealKey, LucideIcon>;

/** The stored legacy colour keys, each mapped to the seal whose colour is closest to it. */
const LEGACY_TO_SEAL: Record<string, SealKey> = {
    "avatar-azure": "quality-control",
    "avatar-cyan": "quality-control",
    "avatar-sky": "quality-control",
    "avatar-rose": "administration",
    "avatar-coral": "administration",
    "avatar-magenta": "development",
    "avatar-violet": "development",
    "avatar-plum": "development",
    "avatar-amber": "human-resources",
    "avatar-orange": "human-resources",
    "avatar-jade": "external-affairs",
    "avatar-gold": "director",
    "avatar-silver": "ethics-regulations",
    "avatar-snow": "engineering-innovation",
};

/** The backend's default colour (DepartmentRules.DEFAULT_COLOR). */
export const DEFAULT_COLOR = "avatar-azure";

/** The seal for a stored department colour. Missing or unknown keys get the default's seal. */
export function sealForColor(color: string | null | undefined): Seal {
    const key = (color && LEGACY_TO_SEAL[color.trim()]) || "quality-control";
    return SEALS.find((s) => s.key === key) as Seal;
}

/** A name reduced to its letters, for a loose comparison ("Dept. of Ethics and Regulations"). */
function simplify(name: string): string {
    return name
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/\b(department|dept|of|the)\b/g, " ")
        .replace(/[^a-z]+/g, "");
}

/**
 * The title on the ring of a department's official seal. A department named after its seal
 * ("Human Resources", "Department of Human Resources") gets its own name; any other department
 * gets the seal's official title, so the HR seal never reads "Department of Marketing". The
 * Director's seal always carries its official title.
 */
export function sealRingTitle(departmentName: string | null | undefined, seal: Seal): string {
    const name = (departmentName ?? "").trim().replace(/\s+/g, " ");
    if (!name || seal.key === "director" || simplify(name) !== simplify(seal.name)) return seal.official;
    return /^department of /i.test(name) ? name : `Department of ${name}`;
}
