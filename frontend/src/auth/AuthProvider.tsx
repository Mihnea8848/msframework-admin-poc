/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import * as authApi from "./auth";
import { setUnauthorizedHandler } from "../api/client";
import type { CurrentUserDto } from "../api/types";

export interface AuthContextValue {
    user: CurrentUserDto | null;
    /** True until the first /api/auth/me call has answered. */
    loading: boolean;
    /** Set when the backend rejects the session (expired, deactivated, deleted). Shown on the login page. */
    sessionExpired: boolean;
    login: (email: string, password: string) => Promise<CurrentUserDto>;
    logout: () => Promise<void>;
    refresh: () => Promise<CurrentUserDto | null>;
    setUser: Dispatch<SetStateAction<CurrentUserDto | null>>;
    forgotPassword: typeof authApi.forgotPassword;
    resetPassword: typeof authApi.resetPassword;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export default function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<CurrentUserDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [sessionExpired, setSessionExpired] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const currentUser = await authApi.fetchMe();
            setUser(currentUser || null);
            return currentUser || null;
        } catch (err) {
            console.warn("[AuthProvider] could not load the current user:", err instanceof Error ? err.message : err);
            setUser(null);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const userRef = useRef<CurrentUserDto | null>(null);
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

    const login = useCallback(async (email: string, password: string) => {
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

    const value = useMemo<AuthContextValue>(() => ({
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

export const useAuth = (): AuthContextValue => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
};
