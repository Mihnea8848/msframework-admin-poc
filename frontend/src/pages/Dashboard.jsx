import {
    BadgeCheck,
    Circle,
    ListFilter,
    Search,
    ShieldCheck,
    TableProperties,
    UsersRound,
} from "lucide-react";

const tabs = [
    { label: "Table", active: true, icon: TableProperties },
    { label: "Board", active: false, icon: BadgeCheck },
    { label: "List", active: false, icon: Circle },
];

const filters = ["Role", "2FA Auth", "Department"];

const members = [
    { name: "Liam Smith", email: "smith@example.com", role: "Project Manager", status: "Active", joined: "24 Jun 2023", accent: "rose" },
    { name: "Noah Anderson", email: "anderson@example.com", role: "UX Designer", status: "Active", joined: "15 Mar 2023", accent: "cyan" },
    { name: "Isabella Garcia", email: "garcia@example.com", role: "Front-End Developer", status: "Inactive", joined: "10 Apr 2024", accent: "magenta" },
    { name: "William Clark", email: "clark@example.com", role: "Product Owner", status: "Active", joined: "28 Feb 2024", accent: "azure" },
    { name: "James Hall", email: "hall@example.com", role: "Business Analyst", status: "Active", joined: "19 May 2023", accent: "amber" },
    { name: "Benjamin Lewis", email: "lewis@example.com", role: "Data Analyst", status: "Active", joined: "03 Jan 2024", accent: "gold" },
    { name: "Amelia Davis", email: "davis@example.com", role: "UX Designer", status: "Inactive", joined: "21 Jul 2023", accent: "violet" },
    { name: "Emma Johnson", email: "johnson@example.com", role: "UX Designer", status: "Active", joined: "16 Sep 2023", accent: "jade" },
    { name: "Olivia Brown", email: "brown@example.com", role: "Marketing Specialist", status: "Active", joined: "04 Nov 2023", accent: "sky" },
    { name: "Ava Williams", email: "williams@example.com", role: "Software Engineer", status: "Active", joined: "30 Dec 2023", accent: "coral" },
    { name: "Sophia Jones", email: "jones@example.com", role: "Front-End Developer", status: "Active", joined: "05 Jun 2024", accent: "orange" },
    { name: "Mia Miller", email: "moller@example.com", role: "Security Analyst", status: "Inactive", joined: "12 Aug 2023", accent: "plum" },
];

function initials(name) {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

export default function Dashboard() {
    return (
        <section className="workspace">
            <div className="workspace-hero">
                <div>
                    <div className="workspace-breadcrumb">Ventures / User management</div>
                    <div className="workspace-title-row">
                        <h1>User management</h1>
                        <span className="workspace-count">74</span>
                    </div>
                    <p className="workspace-subtitle">
                        Manage your team members and their account permissions here.
                    </p>
                </div>

                <div className="workspace-summary">
                    <div className="summary-card">
                        <UsersRound size={16} />
                        <span>14 online</span>
                    </div>
                    <div className="summary-card">
                        <ShieldCheck size={16} />
                        <span>6 pending reviews</span>
                    </div>
                </div>
            </div>

            <div className="workspace-panel">
                <div className="workspace-toolbar">
                    <div className="view-tabs" role="tablist" aria-label="View tabs">
                        {tabs.map(({ label, active, icon: Icon }) => (
                            <button
                                key={label}
                                className={`view-tab ${active ? "active" : ""}`}
                                type="button"
                                role="tab"
                                aria-selected={active}
                            >
                                <Icon size={14} />
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>

                    <button className="table-search" type="button">
                        <Search size={15} />
                        <span>Search</span>
                    </button>
                </div>

                <div className="workspace-filters">
                    <div className="filter-row">
                        {filters.map((filter) => (
                            <button key={filter} className="filter-chip" type="button">
                                <ListFilter size={14} />
                                <span>{filter}</span>
                            </button>
                        ))}
                        <button className="filter-link" type="button">+ Add filter</button>
                    </div>
                </div>

                <div className="data-table-shell">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th className="checkbox-col">
                                    <span className="checkbox" aria-hidden="true" />
                                </th>
                                <th>Full name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map((member) => (
                                <tr key={member.email}>
                                    <td className="checkbox-col">
                                        <span className="checkbox" aria-hidden="true" />
                                    </td>
                                    <td>
                                        <div className="member-cell">
                                            <div className={`avatar avatar-${member.accent}`}>
                                                {initials(member.name)}
                                            </div>
                                            <span>{member.name}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <a href={`mailto:${member.email}`} className="email-link">
                                            {member.email}
                                        </a>
                                    </td>
                                    <td>{member.role}</td>
                                    <td>
                                        <span className={`status-pill ${member.status.toLowerCase()}`}>
                                            {member.status}
                                        </span>
                                    </td>
                                    <td>{member.joined}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
