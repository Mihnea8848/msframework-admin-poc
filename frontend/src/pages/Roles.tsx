import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Minus } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";
import { get } from "../api/client";
import type { RoleDto } from "../api/people";
import { groupPermissions, permissionMatrix } from "../utils/permissionGroups";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import PageHeader from "../ui/PageHeader";
import { useReveal } from "../ui/useReveal";
import "../ui/list.css";
import "../ui/surface.css";
import "./roles.css";

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** The built-in roles first, in their usual order, then any others by name. */
const ORDER = ["ADMIN", "MANAGER", "MEMBER", "VIEWER"];
function byRoleOrder(a: RoleDto, b: RoleDto): number {
    const ia = ORDER.indexOf(a.name);
    const ib = ORDER.indexOf(b.name);
    return (ia < 0 ? ORDER.length : ia) - (ib < 0 ? ORDER.length : ib) || a.name.localeCompare(b.name);
}

export default function Roles() {
    const { user } = useAuth();
    const canReadUsers = hasPermission(user, "USER_READ");
    const [roles, setRoles] = useState<RoleDto[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const reveal = useReveal(roles !== null);

    const load = useCallback(() => {
        get<RoleDto[]>("/api/roles")
            .then((data) => {
                setRoles(Array.isArray(data) ? [...data].sort(byRoleOrder) : []);
                setError(null);
            })
            .catch((err: unknown) => setError(messageOf(err)));
    }, []);

    useEffect(() => { load(); }, [load]);

    const matrix = useMemo(() => permissionMatrix(roles ?? []), [roles]);

    return (
        <section className="ms-roles">
            <PageHeader
                eyebrow="People"
                title="Roles"
                count={roles ? roles.length : null}
                description="What each role may do. Roles are built in: change a person's role on the Users page."
            />

            {error && (
                <Alert tone="danger" role="alert" className="ms-notice">
                    <span>Could not load the roles: {error}</span>
                    <Button size="sm" onClick={load}>Retry</Button>
                </Alert>
            )}

            {!roles ? (
                !error && <div className="ms-empty"><p>Loading roles…</p></div>
            ) : roles.length === 0 ? (
                <div className="ms-empty"><p className="ms-empty__title">No roles are defined.</p></div>
            ) : (
                <>
                    <ul className="ms-roles__cards">
                        {roles.map((role, i) => (
                            <li key={role.name} {...reveal(i, "ms-cut ms-roles__card")}>
                                <div className="ms-roles__card-head">
                                    <h2 className="ms-roles__name">{role.name}</h2>
                                    {role.builtIn && <span className="ms-tag">Built in</span>}
                                </div>
                                <p className="ms-roles__desc">{role.description || "No description."}</p>
                                <dl className="ms-roles__stats">
                                    <div><dt>Members</dt><dd>{role.memberCount}</dd></div>
                                    <div><dt>Active</dt><dd>{role.activeMemberCount}</dd></div>
                                    <div><dt>Permissions</dt><dd>{role.permissions.length}</dd></div>
                                </dl>
                                {canReadUsers && role.memberCount > 0 && (
                                    <Link className="ms-link ms-roles__people" to={`/users?role=${encodeURIComponent(role.name)}`}>
                                        See the {role.memberCount === 1 ? "member" : `${role.memberCount} members`}
                                        <ArrowRight aria-hidden="true" />
                                    </Link>
                                )}
                            </li>
                        ))}
                    </ul>

                    <section className="ms-panel ms-roles__matrix" aria-labelledby="roles-matrix">
                        <div className="ms-panel__head">
                            <h2 className="ms-panel__title" id="roles-matrix">Permissions</h2>
                            <span className="ms-panel__meta">By area</span>
                        </div>

                        {/* Wide screens: one table, a column per role */}
                        <div className="ms-roles__table-wrap">
                            <table className="ms-table ms-roles__table">
                                <thead>
                                    <tr>
                                        <th scope="col">Permission</th>
                                        {roles.map((r) => <th key={r.name} scope="col" className="ms-roles__col">{r.name}</th>)}
                                    </tr>
                                </thead>
                                {matrix.map((group) => (
                                    <tbody key={group.area}>
                                        <tr className="ms-roles__area">
                                            <th scope="colgroup" colSpan={roles.length + 1}>{group.area}</th>
                                        </tr>
                                        {group.rows.map((row) => (
                                            <tr key={row.key}>
                                                <th scope="row" className="ms-roles__perm">
                                                    {row.label}
                                                    <span className="ms-roles__key">{row.key}</span>
                                                </th>
                                                {row.granted.map((granted, i) => (
                                                    <td key={roles[i]?.name ?? i} className="ms-roles__cell">
                                                        {granted ? (
                                                            <><Check className="ms-roles__yes" aria-hidden="true" /><span className="ms-visually-hidden">Yes</span></>
                                                        ) : (
                                                            <><Minus className="ms-roles__no" aria-hidden="true" /><span className="ms-visually-hidden">No</span></>
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                ))}
                            </table>
                        </div>

                        {/* Phones: a list per role, only what it may do */}
                        <div className="ms-roles__lists">
                            {roles.map((role) => {
                                const groups = groupPermissions(role.permissions);
                                return (
                                    <details key={role.name} className="ms-roles__role">
                                        <summary className="ms-roles__summary">
                                            <span className="ms-roles__summary-name">{role.name}</span>
                                            <span className="ms-roles__summary-count">{role.permissions.length} permissions</span>
                                        </summary>
                                        {groups.length === 0 ? (
                                            <p className="ms-roles__none">No permissions.</p>
                                        ) : groups.map((g) => (
                                            <div key={g.area} className="ms-roles__group">
                                                <h3 className="ms-roles__group-title">{g.area}</h3>
                                                <ul className="ms-roles__group-list">
                                                    {g.items.map((item) => (
                                                        <li key={item.key}><Check aria-hidden="true" />{item.label}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </details>
                                );
                            })}
                        </div>
                    </section>
                </>
            )}
        </section>
    );
}
