import { Route, Routes, Navigate } from "react-router-dom";
import { RequireAuth, RedirectIfAuthed } from "./Guards.jsx";
import DashboardLayout from "../layout/DashboardLayout.jsx";
import Dashboard from "../pages/Dashboard.jsx";
import Departments from "../pages/Departments.jsx"; // 1. IMPORT YOUR COMPONENT
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

            {/* User Management (Home) */}
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

            {/* 2. ADD THE DEPARTMENTS ROUTE HERE */}
            <Route
                path="/departments"
                element={
                    <RequireAuth>
                        <DashboardLayout>
                            <Departments />
                        </DashboardLayout>
                    </RequireAuth>
                }
            />

            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}