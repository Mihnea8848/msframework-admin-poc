import { useEffect, useState } from "react";
import { fetchUsers } from "../auth/auth";
import {
    BadgeCheck,
    Circle,
    ListFilter,
    Search,
    ShieldCheck,
    TableProperties,
    UsersRound,
} from "lucide-react";

function initials(name) {
    if (!name) return "??";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function Users() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchUsers()
            .then((data) => {
                console.log("Users received from DB:", data);
                setMembers(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Fetch error:", err);
                setError("Failed to load users from database.");
                setLoading(false);
            });
    }, []);

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
                                <th className="checkbox-col"><span className="checkbox" /></th>
                                <th>Full name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Department</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map((member) => (
                                <tr key={member.id || member.email}>
                                    <td className="checkbox-col"><span className="checkbox" /></td>
                                    <td>
                                        <div className="member-cell">
                                            <div className="avatar avatar-azure">
                                                {initials(member.fullName || member.name || "User")}
                                            </div>
                                            <span>{member.fullName || member.name || "Unnamed User"}</span>
                                        </div>
                                    </td>
                                    <td>{member.email}</td>
                                    <td>{member.role || "USER"}</td>
                                    <td>
                                        <span className={`status-pill ${(member.status || "active").toLowerCase()}`}>
                                            {member.status || "Active"}
                                        </span>
                                    </td>
                                    <td>{member.department?.name || "None"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}