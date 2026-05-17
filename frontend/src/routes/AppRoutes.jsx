import { Route, Routes, Navigate } from "react-router-dom";
import { RequireAuth, RedirectIfAuthed, RequirePermission } from "./Guards.jsx";
import DashboardLayout from "../layout/DashboardLayout.jsx";

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

function Protected({ children }) {
    return (
        <RequireAuth>
            <DashboardLayout>
                {children}
            </DashboardLayout>
        </RequireAuth>
    );
}

function ProtectedPermission({ permission, children }) {
    return (
        <RequireAuth>
            <RequirePermission permission={permission}>
                <DashboardLayout>
                    {children}
                </DashboardLayout>
            </RequirePermission>
        </RequireAuth>
    );
}

export default function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/register" element={<RedirectIfAuthed><Register /></RedirectIfAuthed>} />

            <Route path="/" element={<Protected><HomePage /></Protected>} />

            <Route path="/dashboard" element={
                <ProtectedPermission permission="DASHBOARD_READ">
                    <Dashboard />
                </ProtectedPermission>
            } />

            <Route path="/users" element={
                <ProtectedPermission permission="USER_READ">
                    <UserManagement />
                </ProtectedPermission>
            } />

            <Route path="/departments" element={
                <ProtectedPermission permission="DEPARTMENT_READ">
                    <Departments />
                </ProtectedPermission>
            } />

            <Route path="/notifications" element={
                <ProtectedPermission permission="AUDIT_READ">
                    <Notifications />
                </ProtectedPermission>
            } />

            <Route path="/appearance" element={
                <ProtectedPermission permission="APPEARANCE_UPDATE">
                    <Appearance />
                </ProtectedPermission>
            } />

            <Route path="/database" element={
                <ProtectedPermission permission="DATABASE_READ">
                    <DatabasePage />
                </ProtectedPermission>
            } />

            <Route path="/docs" element={
                <ProtectedPermission permission="DOCUMENTATION_READ">
                    <Documentation />
                </ProtectedPermission>
            } />

            <Route path="/auth" element={
                <ProtectedPermission permission="AUTH_SETTINGS_READ">
                    <AuthSettings />
                </ProtectedPermission>
            } />

            <Route path="/security" element={
                <ProtectedPermission permission="SECURITY_READ">
                    <Security />
                </ProtectedPermission>
            } />

            <Route path="/payments" element={
                <ProtectedPermission permission="PAYMENTS_READ">
                    <Payments />
                </ProtectedPermission>
            } />

            <Route path="/import" element={
                <ProtectedPermission permission="IMPORT_DATA">
                    <ImportData />
                </ProtectedPermission>
            } />

            <Route path="/export" element={
                <ProtectedPermission permission="EXPORT_DATA">
                    <ExportData />
                </ProtectedPermission>
            } />

            <Route path="/connections" element={
                <ProtectedPermission permission="CONNECTIONS_READ">
                    <Connections />
                </ProtectedPermission>
            } />

            <Route path="/timezones" element={
                <ProtectedPermission permission="TIMEZONES_READ">
                    <Timezones />
                </ProtectedPermission>
            } />

            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}
