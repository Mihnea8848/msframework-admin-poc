import { useEffect, useState } from "react";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";

export default function DashboardLayout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Close sidebar on Escape
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === "Escape") setSidebarOpen(false);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    return (
        <div className="app">
            {sidebarOpen && <div className="backdrop" onClick={() => setSidebarOpen(false)} />}

            <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
                <Sidebar onNavigate={() => setSidebarOpen(false)} />
            </aside>

            <div className="main">
                <header className="topbar">
                    <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
                </header>

                <main className="content">{children}</main>
            </div>
        </div>
    );
}