import { Route, Routes, Navigate } from "react-router-dom";
import { RequireAuth, RedirectIfAuthed } from "./Guards.jsx";
import DashboardLayout from "../layout/DashboardLayout.jsx";

import Dashboard      from "../pages/Dashboard.jsx";
import UserManagement from "../pages/UserManagement.jsx";
import Departments    from "../pages/Departments.jsx";
import Login          from "../pages/Login.jsx";
import Register       from "../pages/Register.jsx";
import HomePage       from "../pages/HomePage.jsx";
import Notifications  from "../pages/Notifications.jsx";
import Appearance     from "../pages/Appearance.jsx";
import DatabasePage   from "../pages/DatabasePage.jsx";
import Documentation  from "../pages/Documentation.jsx";
import AuthSettings   from "../pages/AuthSettings.jsx";
import Security       from "../pages/Security.jsx";
import Payments       from "../pages/Payments.jsx";
import ImportData     from "../pages/ImportData.jsx";
import ExportData     from "../pages/ExportData.jsx";

function Protected({ children }) {
    return (
        <RequireAuth>
            <DashboardLayout>
                {children}
            </DashboardLayout>
        </RequireAuth>
    );
}

export default function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
            <Route path="/register" element={<RedirectIfAuthed><Register /></RedirectIfAuthed>} />

            <Route path="/"             element={<Protected><HomePage /></Protected>} />
            <Route path="/dashboard"    element={<Protected><Dashboard /></Protected>} />
            <Route path="/users"        element={<Protected><UserManagement /></Protected>} />
            <Route path="/departments"  element={<Protected><Departments /></Protected>} />
            <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
            <Route path="/appearance"   element={<Protected><Appearance /></Protected>} />
            <Route path="/database"     element={<Protected><DatabasePage /></Protected>} />
            <Route path="/docs"         element={<Protected><Documentation /></Protected>} />
            <Route path="/auth"         element={<Protected><AuthSettings /></Protected>} />
            <Route path="/security"     element={<Protected><Security /></Protected>} />
            <Route path="/payments"     element={<Protected><Payments /></Protected>} />
            <Route path="/import"       element={<Protected><ImportData /></Protected>} />
            <Route path="/export"       element={<Protected><ExportData /></Protected>} />

            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}
