import { useEffect, useState } from "react";
import { get } from "../api/client";
import type { DepartmentResponse } from "../api/types";
import { sealForColor } from "./seal/seals";
import type { SealKey } from "./seal/seals";

/** The departments (GET /api/departments, open to every signed-in user), sorted by name. */
export function useDepartments(): DepartmentResponse[] {
    const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
    useEffect(() => {
        let alive = true;
        get<DepartmentResponse[]>("/api/departments")
            .then((list) => {
                if (alive) setDepartments(Array.isArray(list) ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : []);
            })
            .catch(() => undefined);
        return () => { alive = false; };
    }, []);
    return departments;
}

/** The seal of a department colour key, or null when there is no department. */
export function sealOf(color: string | null | undefined, hasDepartment = true): SealKey | null {
    return hasDepartment ? sealForColor(color).key : null;
}
