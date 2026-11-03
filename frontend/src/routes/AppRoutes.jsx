import { Route, Routes, Navigate } from "react-router-dom";
import { RequireAuth, RedirectIfAuthed, RequirePermission } from "./Guards.jsx";
import DashboardLayout from "../layout/DashboardLayout.jsx";
import { PAGES } from "./navigation";

import Dashboard from "../pages/Dashboard.jsx";
import UserManagement from "../pages/UserManagement.jsx";
import Departments from "../pages/Departments.jsx";
import Login from "../pages/Login.jsx";
import ForgotPassword from "../pages/ForgotPassword.jsx";
import ResetPassword from "../pages/ResetPassword.jsx";
import Register from "../pages/Register.jsx";
import HomePage from "../pages/HomePage.jsx";
import Notifications from "../pages/Notifications.jsx";
import Appearance from "../pages/Appearance.jsx";
import DatabasePage from "../pages/DatabasePage.jsx";
import Documentation from "../pages/Documentation.jsx";
import AuthSettings from "../pages/AuthSettings.jsx";
import Security from "../pages/Security.jsx";
import Payments from "../pages/Payments.jsx";
import ImportData from "../pages/ImportData.jsx";
import ExportData from "../pages/ExportData.jsx";
import Connections from "../pages/Connections.jsx";
import Timezones from "../pages/Timezones.jsx";

const COMPONENTS = {
    home: HomePage,
    dashboard: Dashboard,
    notifications: Notifications,
    appearance: Appearance,
    database: DatabasePage,
    connections: Connections,
    timezones: Timezones,
    docs: Documentation,
    auth: AuthSettings,
    users: UserManagement,
    departments: Departments,
    security: Security,
    payments: Payments,
    import: ImportData,
    export: ExportData,
};

function ProtectedPage({ permission, children }) {
    return (
        <RequireAuth>
            <RequirePermission permission={permission}>
                <DashboardLayout>{children}</DashboardLayout>
            </RequirePermission>
        </RequireAuth>
    );
}

export default function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
            <Route path="/register" element={<RedirectIfAuthed><Register /></RedirectIfAuthed>} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {PAGES.map((page) => {
                const Page = COMPONENTS[page.key];
                return (
                    <Route
                        key={page.key}
                        path={page.path}
                        element={<ProtectedPage permission={page.permission}><Page /></ProtectedPage>}
                    />
                );
            })}

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
