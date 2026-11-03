/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as authApi from "./auth";
import { setUnauthorizedHandler } from "../api/client.js";

const AuthContext = createContext(null);

export default function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // Set when the backend rejects the session (expired, deactivated, deleted). Shown on the login page.
    const [sessionExpired, setSessionExpired] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const currentUser = await authApi.fetchMe();
            setUser(currentUser || null);
            return currentUser || null;
        } catch (err) {
            console.warn("[AuthProvider] could not load the current user:", err.message);
            setUser(null);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const userRef = useRef(null);
    useEffect(() => {
        userRef.current = user;
    }, [user]);

    useEffect(() => {
        setUnauthorizedHandler(() => {
            if (userRef.current) setSessionExpired(true);
            setUser(null);
        });
        return () => setUnauthorizedHandler(null);
    }, []);

    const login = useCallback(async (email, password) => {
        const currentUser = await authApi.login(email, password);
        setSessionExpired(false);
        setUser(currentUser);
        return currentUser;
    }, []);

    const logout = useCallback(async () => {
        try {
            await authApi.logout();
        } catch {
            // Clear local state even if the server is unreachable.
        }
        setSessionExpired(false);
        setUser(null);
    }, []);

    const value = useMemo(() => ({
        user,
        loading,
        sessionExpired,
        login,
        logout,
        refresh,
        setUser,
        forgotPassword: authApi.forgotPassword,
        resetPassword: authApi.resetPassword,
    }), [user, loading, sessionExpired, login, logout, refresh]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
};
