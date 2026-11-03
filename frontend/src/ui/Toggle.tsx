import "./toggle.css";

type ToggleProps = {
    on: boolean;
    onToggle: () => void;
    disabled?: boolean;
    /** The accessible name, when no visible label points at the switch. */
    label?: string;
};

/** An on/off switch: a native button with role="switch", so Enter and Space work. */
export default function Toggle({ on, onToggle, disabled = false, label }: ToggleProps) {
    return (
        <button
            type="button"
            role="switch"
            className="ms-toggle"
            aria-checked={on}
            aria-label={label}
            disabled={disabled}
            onClick={onToggle}
        >
            <span className="ms-toggle__knob" aria-hidden="true" />
        </button>
    );
}
