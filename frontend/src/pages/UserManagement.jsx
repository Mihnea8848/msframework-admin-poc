import { useEffect, useState } from "react";
import { fetchUsers } from "../auth/auth";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../auth/permissions";
import {
    Pencil,
} from "lucide-react";

function initials(name) {
    if (!name) return "??";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function getRoleNames(user) {
    if (!user?.roles?.length) return [];

    return user.roles.map((role) => {
        if (typeof role === "string") return role;
        return role.name;
    });
}

function ModalOverlay({ children }) {
    return (
        <div style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.78)",
            backdropFilter: "blur(10px)",
        }}>
            {children}
        </div>
    );
}

export default function Users() {
    const { user } = useAuth();

    const canEditUsers = hasPermission(user, "USER_UPDATE");
    const currentUserIsAdmin = getRoleNames(user).includes("ADMIN");
    const currentUserIsManager = getRoleNames(user).includes("MANAGER");
    const currentUserDepartmentId = user?.departmentId;
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    const [fullNameInput, setFullNameInput] = useState("");
    const [emailInput, setEmailInput] = useState("");
    const [roleInput, setRoleInput] = useState("MEMBER");
    const [statusInput, setStatusInput] = useState("Active");

    const [departments, setDepartments] = useState([]);
    const [departmentIdInput, setDepartmentIdInput] = useState("");

    async function loadUsers() {
        try {
            setLoading(true);

            const [usersData, departmentsRes] = await Promise.all([
                fetchUsers(),
                fetch("/api/departments", { credentials: "include" }),
            ]);

            const departmentsData = await departmentsRes.json();

            const sortedUsers = [...usersData].sort((a, b) => a.id - b.id);
            const sortedDepartments = [...departmentsData].sort((a, b) => a.id - b.id);

            setMembers(sortedUsers);
            setDepartments(sortedDepartments);
            setError(null);
        } catch (err) {
            console.error("Fetch error:", err);
            setError("Failed to load users from database.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadUsers();
    }, []);

    function openEditModal(user) {
        setEditingUser(user);
        setFullNameInput(user.fullName || user.name || "");
        setEmailInput(user.email || "");
        setRoleInput(user.roles?.[0]?.name || "MEMBER");
        setStatusInput(user.status || "Active");
        setDepartmentIdInput(user.department?.id ? String(user.department.id) : "");
        setIsModalOpen(true);
    }

    function closeModal() {
        setIsModalOpen(false);
        setEditingUser(null);
        setFullNameInput("");
        setEmailInput("");
        setRoleInput("MEMBER");
        setStatusInput("Active");
        setDepartmentIdInput("");
    }

    async function handleSubmit(e) {
        e.preventDefault();

        if (!editingUser) return;

        const res = await fetch(`/api/users/${editingUser.id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                fullName: fullNameInput,
                email: emailInput,
                role: roleInput,
                status: statusInput,
                departmentId: departmentIdInput || null,
            }),
        });

        if (res.ok) {
            closeModal();
            await loadUsers();
        } else {
            const text = await res.text();
            setError(text || "Failed to update user.");
        }
    }

    if (loading) return <div className="workspace"><h1>Loading team...</h1></div>;
    if (error) return <div className="workspace"><h1>{error}</h1></div>;

    return (
        <section className="workspace">
            <div className="workspace-hero">
                <div>
                    <div className="workspace-breadcrumb">Ventures / User management</div>
                    <div className="workspace-title-row">
                        <h1>User management</h1>
                        <span className="workspace-count">{members.length}</span>
                    </div>
                </div>
            </div>

            <div className="workspace-panel">
                <div className="data-table-shell">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Full name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Department</th>
                                {canEditUsers && <th style={{ width: 160, paddingLeft: 24 }}>Actions</th>}
                            </tr>
                        </thead>

                        <tbody>
                            {members.map((member) => {
                                const memberRoles = getRoleNames(member);
                                const memberIsAdmin = memberRoles.includes("ADMIN");
                                const memberIsManager = memberRoles.includes("MANAGER");
                                const sameDepartment =
                                    String(member.department?.id) === String(currentUserDepartmentId);

                                const canEditThisUser =
                                    canEditUsers &&
                                    (
                                        currentUserIsAdmin ||
                                        (
                                            currentUserIsManager &&
                                            sameDepartment &&
                                            !memberIsAdmin &&
                                            !memberIsManager
                                        )
                                    );

                                return (
                                    <tr key={member.id || member.email}>

                                        <td>
                                            <div className="member-cell">
                                                <div className="avatar avatar-azure">
                                                    {initials(member.fullName || member.name || "User")}
                                                </div>
                                                <span>{member.fullName || member.name || "Unnamed User"}</span>
                                            </div>
                                        </td>

                                        <td>{member.email}</td>
                                        <td>{member.roles?.map((role) => role.name).join(", ") || "MEMBER"}</td>

                                        <td>
                                            <span className={`status-pill ${(member.status || "active").toLowerCase()}`}>
                                                {member.status || "Active"}
                                            </span>
                                        </td>

                                        <td>{member.department?.name || "None"}</td>

                                        {canEditUsers && (
                                            <td style={{ paddingLeft: 24 }}>
                                                {canEditThisUser ? (
                                                    <button
                                                        onClick={() => openEditModal(member)}
                                                        className="topbar-icon-button"
                                                        aria-label="Edit user"
                                                        style={{
                                                            width: "auto",
                                                            padding: "0 12px",
                                                            gap: 6,
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        <Pencil size={13} /> Edit
                                                    </button>
                                                ) : (
                                                    <span style={{ color: "var(--muted)", fontSize: 12 }}>
                                                        Locked
                                                    </span>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {
                isModalOpen && (
                    <ModalOverlay>
                        <div
                            style={{
                                background: "var(--panel)",
                                border: "1px solid var(--line-strong)",
                                borderRadius: 20,
                                padding: "36px 32px",
                                width: "90%",
                                maxWidth: 440,
                            }}
                        >
                            <h2
                                style={{
                                    margin: "0 0 6px",
                                    fontSize: 26,
                                    fontWeight: 800,
                                    letterSpacing: "-0.03em",
                                }}
                            >
                                Edit User
                            </h2>

                            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 28 }}>
                                Update this user&apos;s account details.
                            </p>

                            <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: 0 }}>
                                <div className="auth-field">
                                    <label className="auth-label">Full name</label>
                                    <input
                                        autoFocus
                                        className="auth-input"
                                        placeholder="Full name"
                                        value={fullNameInput}
                                        onChange={(e) => setFullNameInput(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="auth-field">
                                    <label className="auth-label">Email</label>
                                    <input
                                        className="auth-input"
                                        type="email"
                                        placeholder="Email"
                                        value={emailInput}
                                        onChange={(e) => setEmailInput(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="auth-field">
                                    <label className="auth-label">Role</label>
                                    <select
                                        className="auth-input"
                                        value={roleInput}
                                        onChange={(e) => setRoleInput(e.target.value)}
                                    >
                                        {currentUserIsAdmin && <option value="ADMIN">ADMIN</option>}
                                        {currentUserIsAdmin && <option value="MANAGER">MANAGER</option>}
                                        <option value="MEMBER">MEMBER</option>
                                        <option value="VIEWER">VIEWER</option>
                                    </select>
                                </div>

                                <div className="auth-field">
                                    <label className="auth-label">Department</label>
                                    <select
                                        className="auth-input"
                                        value={departmentIdInput}
                                        onChange={(e) => setDepartmentIdInput(e.target.value)}
                                    >
                                        {currentUserIsAdmin && <option value="">No department</option>}

                                        {departments
                                            .filter((dept) => currentUserIsAdmin || String(dept.id) === String(currentUserDepartmentId))
                                            .map((dept) => (
                                                <option key={dept.id} value={dept.id}>
                                                    {dept.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>

                                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="auth-primary"
                                        style={{
                                            flex: 1,
                                            background: "none",
                                            border: "1px solid var(--line-strong)",
                                        }}
                                    >
                                        Cancel
                                    </button>

                                    <button type="submit" className="auth-primary" style={{ flex: 1 }}>
                                        Save
                                    </button>
                                </div>
                            </form>
                        </div>
                    </ModalOverlay>
                )
            }
        </section >
    );
}