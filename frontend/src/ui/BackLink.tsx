import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import "./back-link.css";

/** The small "← Users" link at the top of a child page, back to the page it belongs to. */
export default function BackLink({ to, label }: { to: string; label: string }) {
    return (
        <Link className="ms-back" to={to}>
            <ArrowLeft aria-hidden="true" />
            {label}
        </Link>
    );
}
