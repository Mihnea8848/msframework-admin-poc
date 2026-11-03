import { api, get, post } from "../api/client";
import type { CurrentUserDto, UserDto } from "../api/types";

export async function fetchMe(): Promise<CurrentUserDto | null> {
    return await get<CurrentUserDto | null>("/api/auth/me", { authRedirect: false });
}

export async function login(email: string, password: string): Promise<CurrentUserDto> {
    return await post<CurrentUserDto>("/api/auth/login", { email, password }, { authRedirect: false });
}

export async function logout(): Promise<unknown> {
    return await post("/api/auth/logout", undefined, { authRedirect: false });
}

export async function forgotPassword(email: string): Promise<true> {
    await post("/api/auth/forgot-password", { email }, { authRedirect: false });
    return true;
}

export async function resetPassword(token: string, newPassword: string): Promise<true> {
    await post("/api/auth/reset-password", { token, newPassword }, { authRedirect: false });
    return true;
}

export async function fetchUsers(): Promise<UserDto[]> {
    const data = await api<unknown>("/api/users");
    return Array.isArray(data) ? (data as UserDto[]) : [];
}
