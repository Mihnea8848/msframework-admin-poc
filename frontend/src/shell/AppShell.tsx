import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { prefetchWhenIdle } from "../app/pages";
import { lastNavigationWasViewTransition } from "../app/transitions";
import { SETTINGS_PATH, crumbFor, mobileTabs, morePages, visiblePages } from "../routes/navigation";
import QuickActions from "../ui/QuickActions";
import BottomNav from "./BottomNav";
import MoreSheet from "./MoreSheet";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { isQuickActionsShortcut } from "./shortcuts";
import { useUnreadAudit } from "./useUnreadAudit";
import "./app-shell.css";
import "./view-transitions.css";

const ENTER_CLASS = "ms-shell__main--enter";

/**
 * The signed-in layout, mounted once as the layout route (src/app/routes.tsx): the sidebar or
 * rail, the top bar, <main> with the current page, and on phones the bottom bar and More sheet.
 * Because it stays mounted, navigating only swaps the <Outlet />: the sidebar keeps its scroll
 * position and the unread-activity poll keeps running.
 */
export default function AppShell() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const badge = useUnreadAudit(user);
    const [quickActionsOpen, setQuickActionsOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const mainRef = useRef<HTMLElement>(null);
    const moreButtonRef = useRef<HTMLButtonElement>(null);

    const pages = useMemo(() => visiblePages(user), [user]);
    const tabs = useMemo(() => mobileTabs(user), [user]);
    const more = useMemo(() => morePages(user), [user]);
    const crumb = crumbFor(location.pathname);
    const inSettings = location.pathname.startsWith(SETTINGS_PATH);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (!isQuickActionsShortcut(e)) return;
            e.preventDefault();
            setMoreOpen(false);
            setQuickActionsOpen(true);
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    // Prefetch every page this user may open, then Settings, one per idle period.
    useEffect(() => prefetchWhenIdle([...pages.map((p) => p.key), "settings"]), [pages]);

    // The page enter animation, for navigations that did not run as a view transition. Moving
    // between Settings tabs stays on the same page, so only the tab's panel changes.
    const previousPath = useRef<string | null>(null);
    useLayoutEffect(() => {
        const main = mainRef.current;
        const previous = previousPath.current;
        previousPath.current = location.pathname;
        if (previous === null) return;
        const betweenTabs = previous.startsWith(SETTINGS_PATH) && location.pathname.startsWith(SETTINGS_PATH);
        if (!main || betweenTabs || lastNavigationWasViewTransition()) return;
        main.classList.remove(ENTER_CLASS);
        void main.offsetWidth; // restart the animation
        main.classList.add(ENTER_CLASS);
    }, [location.pathname]);

    const closeMore = useCallback(() => setMoreOpen(false), []);
    const handleLogout = useCallback(async () => {
        await logout();
        navigate("/login", { replace: true });
    }, [logout, navigate]);

    if (!user) return null;

    return (
        <div className="ms-shell" data-shell="mounted">
            <a className="ms-shell__skip" href="#main">Skip to main content</a>

            <Sidebar
                pages={pages}
                pathname={location.pathname}
                badge={badge}
                onOpenQuickActions={() => setQuickActionsOpen(true)}
            />

            <div className="ms-shell__column">
                <Topbar user={user} crumb={crumb} inSettings={inSettings} onLogout={handleLogout} />

                <main
                    id="main"
                    ref={mainRef}
                    className="ms-shell__main"
                    tabIndex={-1}
                    onAnimationEnd={(e) => e.currentTarget.classList.remove(ENTER_CLASS)}
                >
                    <div className="ms-shell__content">
                        <Outlet />
                    </div>
                </main>

                <BottomNav
                    tabs={tabs}
                    more={more}
                    pathname={location.pathname}
                    badge={badge}
                    moreOpen={moreOpen}
                    onOpenMore={() => setMoreOpen(true)}
                    moreButtonRef={moreButtonRef}
                />
            </div>

            <MoreSheet
                open={moreOpen}
                onClose={closeMore}
                pages={more}
                pathname={location.pathname}
                badge={badge}
                onLogout={handleLogout}
                inSettings={inSettings}
                returnFocusRef={moreButtonRef}
            />
            <QuickActions open={quickActionsOpen} onClose={() => setQuickActionsOpen(false)} />
        </div>
    );
}
