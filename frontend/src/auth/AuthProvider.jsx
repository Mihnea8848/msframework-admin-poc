/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import * as authApi from "./auth";

const AuthContext = createContext(null);

export default function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const refresh = async () => {
        try {
            const currentUser = await authApi.fetchMe();
            setUser(currentUser);
        } catch (err) {
            console.error("[AuthProvider] fetchMe failed:", err);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {

        refresh().catch(console.error);
    }, []);

    const login = async (email, password) => {
        const loggedInUser = await authApi.login(email, password);
        if (loggedInUser) {
            setUser(loggedInUser);
            return loggedInUser;
        }
        throw new Error("Login failed");
    };

    const forgotPassword = async (email) => {
        return await authApi.forgotPassword(email);
    };

    const resetPassword = async (token, newPassword) => {
        return await authApi.resetPassword(token, newPassword);
    };

    const logout = () => {
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, refresh, forgotPassword, resetPassword }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
};