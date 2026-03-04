import { useEffect, useMemo, useState } from "react";
import { AuthContext } from "./authContext.js";
import { fetchMe } from "./auth.js";

export default function AuthProvider({ children }) {
    const [me, setMe] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bootError, setBootError] = useState(null);

    async function refresh() {
        setLoading(true);
        setBootError(null);

        try {
            const user = await fetchMe();
            setMe(user);
        } catch (err) {
            console.error("[AuthProvider] fetchMe failed:", err);
            setMe(null);
            setBootError(err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
    }, []);

    const value = useMemo(
        () => ({ me, loading, refresh, setMe, bootError }),
        [me, loading, bootError]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}