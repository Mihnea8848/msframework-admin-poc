import { Route, Routes, Navigate } from "react-router-dom";
import { RequireAuth } from "./Guards.jsx";
import DashboardLayout from "../layout/DashboardLayout.jsx";
import Dashboard from "../pages/Dashboard.jsx";
import Login from "../pages/Login.jsx";
import Register from "../pages/Register.jsx";

export default function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

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

            {/* catch-all */}
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}