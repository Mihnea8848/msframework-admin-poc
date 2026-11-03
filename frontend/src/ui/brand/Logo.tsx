import { useId } from "react";
import type { SVGProps } from "react";
import "./logo.css";

/** The two halves of the MSFramework mark (from the brand website), in a 694 x 1000 box. */
export const LOGO_UPPER_PATH = "M347 199.95L0 0L0 175.651L347.121 375.527L520 275.975V475.738L693 575.354V0.576L347 199.95Z";
export const LOGO_LOWER_PATH = "M347.077 999.716L0 799.312L0 529.601L174 629.026V724.312L347 823.412L507.958 731.264L0 438.774L0 263.196L694 663.095V799.42L347.077 999.716Z";

type LogoProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
    /** Accessible name. Without it the mark is decorative and hidden from assistive tech. */
    title?: string;
};

/**
 * The MSFramework mark as inline SVG. Its colours come from the --logo-upper and --logo-lower
 * tokens, so it follows the theme. Size it with CSS (width and height, ratio 694:1000).
 */
export default function Logo({ title, className, ...rest }: LogoProps) {
    const titleId = useId();
    const classes = className ? `ms-logo ${className}` : "ms-logo";
    return (
        <svg
            viewBox="0 0 694 1000"
            className={classes}
            focusable="false"
            {...(title
                ? { role: "img", "aria-labelledby": titleId }
                : { "aria-hidden": true })}
            {...rest}
        >
            {title ? <title id={titleId}>{title}</title> : null}
            <path className="ms-logo__upper" d={LOGO_UPPER_PATH} />
            <path className="ms-logo__lower" d={LOGO_LOWER_PATH} />
        </svg>
    );
}
