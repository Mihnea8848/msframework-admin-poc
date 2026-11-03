import { useEffect } from "react";
import { Outlet, ScrollRestoration } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { hideSplash } from "./splash";

/**
 * The top route: renders the matched branch, restores the scroll position per history entry
 * (a newly opened page starts at the top), and removes the splash once the session is known.
 */
export default function RootLayout() {
    const { loading } = useAuth();

    useEffect(() => {
        if (!loading) hideSplash();
    }, [loading]);

    return (
        <>
            <Outlet />
            <ScrollRestoration />
        </>
    );
}
