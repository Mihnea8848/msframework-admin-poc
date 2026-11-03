import { createBrowserRouter } from "react-router-dom";
import { routes } from "./routes";
import { recordNavigation } from "./transitions";

/** The app's data router. Routes are defined in routes.tsx; App.tsx renders it. */
export const router = createBrowserRouter(routes);

// Subscribed before RouterProvider, so the flag is set before the shell renders the new page.
router.subscribe((state, { viewTransitionOpts }) => {
    if (state.navigation.state === "idle") recordNavigation(Boolean(viewTransitionOpts));
});
