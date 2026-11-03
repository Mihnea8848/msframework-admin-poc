/** Accessible on/off switch. */
export default function Toggle({ on, onToggle, disabled = false, label }) {
    return (
        <div
            className={`toggle-switch${on ? " on" : ""}${disabled ? " disabled" : ""}`}
            onClick={disabled ? undefined : onToggle}
            role="switch"
            aria-checked={on}
            aria-disabled={disabled}
            aria-label={label}
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e) => {
                if (!disabled && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onToggle();
                }
            }}
        >
            <div className="toggle-knob" />
        </div>
    );
}
