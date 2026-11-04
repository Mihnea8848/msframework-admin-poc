import { utilisationTone } from "../../utils/people";
import "./figures.css";

/**
 * Budget utilisation as a thin bar with a status colour. The percentage is always printed next to
 * it by the caller, so the colour is never the only signal. Over 100% fills the bar.
 */
export default function BudgetBar({ percent, className }: { percent: number | null; className?: string }) {
    const tone = utilisationTone(percent);
    const fill = Math.max(0, Math.min(100, percent ?? 0));
    return (
        <svg
            className={`ms-budget-bar ms-budget-bar--${tone}${className ? ` ${className}` : ""}`}
            viewBox="0 0 100 4"
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <rect className="ms-budget-bar__track" width="100" height="4" />
            <rect className="ms-budget-bar__fill" width={fill} height="4" />
        </svg>
    );
}
