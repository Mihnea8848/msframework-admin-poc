import { useId, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { matchTimeZones, timeZoneIds } from "./orgSettingsForm";

interface TimezonePickerProps {
    id: string;
    value: string;
    onChange: (zone: string) => void;
    disabled?: boolean;
    invalid?: boolean;
    describedBy?: string;
}

const readable = (zone: string) => zone.replace(/_/g, " ");

/**
 * A searchable timezone field: a combobox over every IANA zone the browser knows. Type a city
 * or region ("tokyo", "europe/"), then use the arrow keys and Enter, or click a match. The
 * value only changes when a zone is picked; leaving the field restores the chosen one.
 */
export default function TimezonePicker({ id, value, onChange, disabled = false, invalid = false, describedBy }: TimezonePickerProps) {
    const listId = useId();
    const zones = useMemo(() => timeZoneIds(), []);
    const [query, setQuery] = useState<string | null>(null);
    const [active, setActive] = useState(0);
    const open = query !== null && !disabled;
    const matches = useMemo(() => (open ? matchTimeZones(zones, query ?? "", 50) : []), [open, zones, query]);
    const current = matches[Math.min(active, matches.length - 1)];
    const optionId = (zone: string) => `${listId}-${zone.replace(/[^A-Za-z0-9]/g, "-")}`;

    function pick(zone: string) {
        onChange(zone);
        setQuery(null);
    }

    function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) {
                setQuery("");
                setActive(0);
                return;
            }
            const step = e.key === "ArrowDown" ? 1 : -1;
            setActive((i) => (matches.length === 0 ? 0 : (Math.min(i, matches.length - 1) + step + matches.length) % matches.length));
        } else if (e.key === "Enter" && open) {
            e.preventDefault();
            if (current) pick(current);
        } else if (e.key === "Escape" && open) {
            e.preventDefault();
            e.stopPropagation();
            setQuery(null);
        }
    }

    return (
        <div className="ms-tz-picker">
            <input
                id={id}
                className="ms-input"
                type="text"
                role="combobox"
                autoComplete="off"
                spellCheck={false}
                placeholder={disabled ? "Not set" : "Search for a city or region"}
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={open && current ? optionId(current) : undefined}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                disabled={disabled}
                value={query ?? readable(value)}
                onFocus={() => { setQuery(""); setActive(0); }}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onBlur={() => setQuery(null)}
                onKeyDown={onKeyDown}
            />
            <ul className="ms-tz-picker__list" id={listId} role="listbox" aria-label="Timezones" hidden={!open}>
                {open && matches.length === 0 && <li className="ms-tz-picker__empty" role="presentation">No timezone matches “{query}”.</li>}
                {matches.map((zone) => (
                    <li
                        key={zone}
                        id={optionId(zone)}
                        role="option"
                        aria-selected={zone === current}
                        className="ms-tz-picker__option"
                        // mousedown, not click: the input's blur would close the list first.
                        onMouseDown={(e) => { e.preventDefault(); pick(zone); }}
                        onMouseEnter={() => setActive(matches.indexOf(zone))}
                    >
                        {readable(zone)}
                    </li>
                ))}
            </ul>
        </div>
    );
}
