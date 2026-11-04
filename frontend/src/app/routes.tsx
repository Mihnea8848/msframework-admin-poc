import { Navigate } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import { CHILD_PAGES, LEGACY_PATHS, PAGES, SETTINGS_PATH } from "../routes/navigation";
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
 *       one route per CHILD_PAGES entry (/users/:id, /departments/:id), behind all its permissions
 *       /settings/:tab      Settings, with a tab per path; /settings opens the first tab
 *       /notifications, /auth, /appearance   old paths, redirected (LEGACY_PATHS)
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
                    const { default: Login } = await import("../pages/auth/Login");
                    return { element: <RedirectIfAuthed><Login /></RedirectIfAuthed> };
                },
            },
            {
                path: "/register",
                lazy: async () => {
                    const { default: Register } = await import("../pages/auth/Register");
                    return { element: <RedirectIfAuthed><Register /></RedirectIfAuthed> };
                },
            },
            {
                path: "/forgot-password",
                lazy: async () => ({ Component: (await import("../pages/auth/ForgotPassword")).default }),
            },
            {
                path: "/reset-password",
                lazy: async () => ({ Component: (await import("../pages/auth/ResetPassword")).default }),
            },
            {
                id: "shell",
                element: <RequireAuth><AppShell /></RequireAuth>,
                children: [
                    ...PAGES.map((page): RouteObject => ({
                        id: page.key,
                        path: page.path,
                        handle: { pageKey: page.key },
                        lazy: async () => {
                            const { default: Page } = await PAGE_LOADERS[page.key]();
                            return { element: <RequirePermission permission={page.permission}><Page /></RequirePermission> };
                        },
                    })),
                    ...CHILD_PAGES.map((page): RouteObject => ({
                        id: page.key,
                        path: page.path,
                        handle: { pageKey: page.key },
                        lazy: async () => {
                            const { default: Page } = await PAGE_LOADERS[page.key]();
                            return { element: <RequirePermission allOf={page.permissions}><Page /></RequirePermission> };
                        },
                    })),
                    {
                        id: "settings",
                        // The tab is optional: without it (or with an unknown one) Settings opens Account.
                        path: `${SETTINGS_PATH}/:tab?`,
                        handle: { pageKey: "settings" },
                        lazy: async () => ({ Component: (await PAGE_LOADERS.settings()).default }),
                    },
                    ...Object.entries(LEGACY_PATHS).map(([from, to]): RouteObject => ({
                        path: from,
                        element: <Navigate to={to} replace />,
                    })),
                ],
            },
            { path: "*", element: <Navigate to="/" replace /> },
        ],
    },
];
