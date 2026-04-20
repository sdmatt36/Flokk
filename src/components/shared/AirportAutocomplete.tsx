"use client";

import { useState, useRef, useEffect, useMemo, KeyboardEvent, ChangeEvent } from "react";
import { ChevronDown } from "lucide-react";
import { searchAirports, getAirportByCode, type Airport } from "@/lib/airports";

interface AirportAutocompleteProps {
  value: string;
  onChange: (iata: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function AirportAutocomplete({
  value,
  onChange,
  placeholder = "Airport or city",
  disabled = false,
  ariaLabel,
}: AirportAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useMemo(() => `airport-listbox-${Math.random().toString(36).slice(2, 9)}`, []);

  const selectedAirport = useMemo(
    () => (value ? getAirportByCode(value) : null),
    [value]
  );

  const closedLabel = selectedAirport
    ? `${selectedAirport.iata} · ${selectedAirport.city}`
    : "";

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), 100);
    return () => clearTimeout(handle);
  }, [query]);

  const results = useMemo<Airport[]>(
    () => (open ? searchAirports(debouncedQuery, 8) : []),
    [open, debouncedQuery]
  );

  useEffect(() => {
    setHighlight(0);
  }, [debouncedQuery, open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const row = listRef.current.querySelector<HTMLLIElement>(
      `li[data-index="${highlight}"]`
    );
    if (row) row.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function commitSelection(airport: Airport) {
    onChange(airport.iata);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    if (!open) setOpen(true);
  }

  function handleFocus() {
    setOpen(true);
    setQuery("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHighlight(h => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && results[highlight]) {
        e.preventDefault();
        commitSelection(results[highlight]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    } else if (e.key === "Tab") {
      setOpen(false);
      setQuery("");
    }
  }

  const displayValue = open ? query : closedLabel;

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          disabled={disabled}
          value={displayValue}
          placeholder={placeholder}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          className="w-full rounded-md border border-[#1B3A5C]/40 bg-white px-3 py-2.5 pr-9 text-sm text-[#1B3A5C] placeholder:text-gray-400 focus:border-[#C4664A] focus:outline-none focus:ring-2 focus:ring-[#C4664A]/40 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
        />
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
      </div>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm italic text-gray-500">
              {debouncedQuery
                ? `No airports match "${debouncedQuery}"`
                : "Start typing to search"}
            </li>
          ) : (
            results.map((a, i) => {
              const isHighlighted = i === highlight;
              return (
                <li
                  key={a.iata}
                  data-index={i}
                  role="option"
                  aria-selected={isHighlighted}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={e => {
                    e.preventDefault();
                    commitSelection(a);
                  }}
                  className={`flex h-12 cursor-pointer items-center gap-3 px-3 ${
                    isHighlighted ? "bg-[#C4664A]/10" : "hover:bg-gray-50"
                  }`}
                >
                  <span className="w-10 shrink-0 font-semibold text-[13px] text-[#1B3A5C]">
                    {a.iata}
                  </span>
                  <span className="min-w-0 flex-1 overflow-hidden">
                    <span className="block truncate text-sm text-[#1B3A5C]">
                      {a.city}
                    </span>
                    <span className="block truncate text-[12px] text-gray-500">
                      {a.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] uppercase tracking-wide text-gray-400">
                    {a.countryCode}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
