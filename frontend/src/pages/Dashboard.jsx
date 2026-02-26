export default function Dashboard() {
    return (
        <div className="grid">
            {/* KPI row */}
            <div className="card col-3" style={{ padding: 18 }}>
                <div className="kpi-title">New Employees Joined</div>
                <div className="kpi-value">12</div>
                <div className="kpi-sub">+3 this week</div>
            </div>

            <div className="card col-3" style={{ padding: 18 }}>
                <div className="kpi-title">Departments</div>
                <div className="kpi-value">6</div>
                <div className="kpi-sub">Active org units</div>
            </div>

            <div className="card col-3" style={{ padding: 18 }}>
                <div className="kpi-title">Resources Uploaded</div>
                <div className="kpi-value">48</div>
                <div className="kpi-sub">Last 30 days</div>
            </div>

            <div className="card col-3" style={{ padding: 18 }}>
                <div className="kpi-title">Pending Approvals</div>
                <div className="kpi-value">5</div>
                <div className="kpi-sub">Needs admin action</div>
            </div>

            {/* Main widgets */}
            <div className="card col-8" style={{ padding: 18, minHeight: 320 }}>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>Activity</div>
                <div style={{ color: "var(--muted)", fontSize: 13 }}>
                    Placeholder for charts / recent actions (we’ll add real data later).
                </div>
                <div style={{ marginTop: 14, height: 240, borderRadius: 14, border: "1px dashed var(--border)" }} />
            </div>

            <div className="card col-4" style={{ padding: 18, minHeight: 320 }}>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>Quick Actions</div>
                <div style={{ display: "grid", gap: 10 }}>
                    <button className="btn-brand">Create Department</button>
                    <button className="card" style={{ padding: 12, cursor: "pointer", background: "var(--card-2)" }}>
                        Invite User
                    </button>
                    <button className="card" style={{ padding: 12, cursor: "pointer", background: "var(--card-2)" }}>
                        Upload Resource
                    </button>
                </div>
            </div>

            {/* Table placeholder */}
            <div className="card col-12" style={{ padding: 18 }}>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>Recent Users</div>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                        <tr style={{ color: "var(--muted)", textAlign: "left", fontSize: 12 }}>
                            <th style={{ padding: "10px 8px" }}>Name</th>
                            <th style={{ padding: "10px 8px" }}>Email</th>
                            <th style={{ padding: "10px 8px" }}>Department</th>
                            <th style={{ padding: "10px 8px" }}>Role</th>
                        </tr>
                        </thead>
                        <tbody>
                        {[
                            { name: "Alexandra Stan", email: "alex@mehstudios.com", dep: "Studio Ops", role: "ADMIN" },
                            { name: "Steven Smith", email: "steven@mehstudios.com", dep: "Engineering", role: "USER" },
                            { name: "Alyssa Healy", email: "alyssa@mehstudios.com", dep: "Art", role: "USER" },
                        ].map((r) => (
                            <tr key={r.email} style={{ borderTop: "1px solid var(--border)" }}>
                                <td style={{ padding: "12px 8px", fontWeight: 700 }}>{r.name}</td>
                                <td style={{ padding: "12px 8px", color: "var(--muted)" }}>{r.email}</td>
                                <td style={{ padding: "12px 8px" }}>{r.dep}</td>
                                <td style={{ padding: "12px 8px" }}>{r.role}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}