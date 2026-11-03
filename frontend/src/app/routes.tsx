import { Navigate } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import { PAGES } from "../routes/navigation";
import { PAGE_LOADERS } from "./pages";
import { RedirectIfAuthed, RequireAuth, RequirePermission } from "./guards";
import RootLayout from "./RootLayout";
import AppShell from "../shell/AppShell";

/**
 * The route table, shared by the browser router (router.tsx) and the tests (createMemoryRouter).
 *
 *   /                       RootLayout: removes the splash once the session is known
 *     /login, /register     outside the shell; a signed-in user is sent home
 *     /forgot-password, /reset-password   outside the shell, open to everyone
 *     (layout)              RequireAuth + AppShell, mounted once for every page below
 *       one route per PAGES entry, lazy-loaded, behind RequirePermission
 *     *                     back to /
 *
 * Every page is its own chunk (`lazy`). The router loads it before it commits the navigation,
 * so the current page stays on screen until the next one is ready.
 */
export const routes: RouteObject[] = [
    {
        id: "root",
        element: <RootLayout />,
        // Rendered while the first page's chunk loads. The splash in index.html covers it.
        HydrateFallback: () => null,
        children: [
            {
                path: "/login",
                lazy: async () => {
                    const { default: Login } = await import("../pages/Login");
                    return { element: <RedirectIfAuthed><Login /></RedirectIfAuthed> };
                },
            },
            {
                path: "/register",
                lazy: async () => {
                    const { default: Register } = await import("../pages/Register");
                    return { element: <RedirectIfAuthed><Register /></RedirectIfAuthed> };
                },
            },
            {
                path: "/forgot-password",
                lazy: async () => ({ Component: (await import("../pages/ForgotPassword")).default }),
            },
            {
                path: "/reset-password",
                lazy: async () => ({ Component: (await import("../pages/ResetPassword")).default }),
            },
            {
                id: "shell",
                element: <RequireAuth><AppShell /></RequireAuth>,
                children: PAGES.map((page): RouteObject => ({
                    id: page.key,
                    path: page.path,
                    handle: { pageKey: page.key },
                    lazy: async () => {
                        const { default: Page } = await PAGE_LOADERS[page.key]();
                        return { element: <RequirePermission permission={page.permission}><Page /></RequirePermission> };
                    },
                })),
            },
            { path: "*", element: <Navigate to="/" replace /> },
        ],
    },
];
