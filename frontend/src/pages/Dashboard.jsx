import { useEffect, useState } from "react";
import { fetchUsers } from "../auth/auth";
import { useNavigate } from "react-router-dom";
import {
    BadgeCheck,
    Circle,
    Search,
    ShieldCheck,
    TableProperties,
    UsersRound,
} from "lucide-react";


export default function Dashboard() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [departments, setDepartments] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetchUsers()
            .then((data) => {
                setMembers(data);
            })
            .catch((err) => {
                console.error("Fetch users error:", err);
                setError("Failed to load users.");
            });

        fetch("/api/departments")
            .then((res) => res.json())
            .then((data) => {
                setDepartments(data);
            })
            .catch((err) => {
                console.error("Fetch departments error:", err);
            })
            .finally(() => setLoading(false));
    }, []);

    // ===== KPIs =====
    const totalUsers = members.length;

    const activeUsers = members.filter(
        (u) => (u.status || "").toLowerCase() === "active"
    ).length;

    const admins = members.filter((u) => u.role === "ADMIN").length;

    const departmentCount = departments.length;

    if (loading) {
        return (
            <div className="workspace">
                <h1>Loading dashboard...</h1>
            </div>
        );
    }

    if (error) {
        return (
            <div className="workspace">
                <h1>{error}</h1>
            </div>
        );
    }

    return (
        <section className="workspace">
            {/* ===== Header ===== */}
            <div className="workspace-hero">
                <div>
                    <div className="workspace-breadcrumb">
                        Ventures / Dashboard
                    </div>

                    <div className="workspace-title-row">
                        <h1>Dashboard</h1>
                    </div>
                </div>

                <div className="dashboard-status">
                    <Circle size={10} className="status-dot green" />
                    <span>System operational</span>
                </div>
            </div>

            {/* ===== KPI CARDS ===== */}
            <div className="dashboard-cards">

                <div className="card accent" onClick={() => navigate("/users")}>
                    <div className="card-icon">
                        <UsersRound size={18} />
                    </div>
                    <div className="card-content">
                        <div className="card-value">{totalUsers}</div>
                        <div className="card-label">Total Users</div>
                        <div className="card-sub">All registered accounts</div>
                    </div>
                </div>

                <div className="card success" onClick={() => navigate("/users")}>
                    <div className="card-icon">
                        <BadgeCheck size={18} />
                    </div>
                    <div className="card-content">
                        <div className="card-value">{activeUsers}</div>
                        <div className="card-label">Active Users</div>
                        <div className="card-sub">Currently enabled</div>
                    </div>
                </div>

                <div className="card" onClick={() => navigate("/users")}>
                    <div className="card-icon">
                        <ShieldCheck size={18} />
                    </div>
                    <div className="card-content">
                        <div className="card-value">{admins}</div>
                        <div className="card-label">Admins</div>
                        <div className="card-sub">Privileged accounts</div>
                    </div>
                </div>

                <div className="card" onClick={() => navigate("/departments")}>
                    <div className="card-icon">
                        <TableProperties size={18} />
                    </div>
                    <div className="card-content">
                        <div className="card-value">{departmentCount}</div>
                        <div className="card-label">Departments</div>
                        <div className="card-sub">Organizational units</div>
                    </div>
                </div>

            </div>
        </section >
    );
}