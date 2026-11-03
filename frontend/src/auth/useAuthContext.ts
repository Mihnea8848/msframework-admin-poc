import { useAuth } from "./AuthProvider";
import type { CurrentUserDto } from "../api/types";

/** What AuthProvider puts in its context (AuthProvider.jsx is not type checked yet). */
export interface AuthContextValue {
    user: CurrentUserDto | null;
    loading: boolean;
    /** The backend rejected the session (expired, deactivated or deleted). */
    sessionExpired: boolean;
    login: (email: string, password: string) => Promise<CurrentUserDto>;
    logout: () => Promise<void>;
    refresh: () => Promise<CurrentUserDto | null>;
    setUser: (user: CurrentUserDto | null) => void;
    forgotPassword: (email: string) => Promise<true>;
    resetPassword: (token: string, newPassword: string) => Promise<true>;
}

/**
 * Typed access to the auth context for TypeScript components. Drop it (and use useAuth directly)
 * once AuthProvider is converted to TypeScript.
 */
export function useAuthContext(): AuthContextValue {
    return useAuth() as unknown as AuthContextValue;
}
