import { Route, Routes, Navigate } from "react-router-dom";
import { RequireAuth, RedirectIfAuthed } from "./Guards.jsx"; // Import RedirectIfAuthed
import DashboardLayout from "../layout/DashboardLayout.jsx";
import Dashboard from "../pages/Dashboard.jsx";
import Login from "../pages/Login.jsx";
import Register from "../pages/Register.jsx";

export default function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={
                <RedirectIfAuthed>
                    <Login />
                </RedirectIfAuthed>
            } />
            <Route path="/register" element={
                <RedirectIfAuthed>
                    <Register />
                </RedirectIfAuthed>
            } />
            <Route
                path="/"
                element={
                    <RequireAuth>
                        <DashboardLayout>
                            <Dashboard />
                        </DashboardLayout>
                    </RequireAuth>
                }
            />
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}