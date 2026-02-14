"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface RegionItem {
  name: string;
  lat: number;
  lng: number;
  count: number;
}

interface RegionSearchProps {
  onSelect: (region: { name: string; lat: number; lng: number }) => void;
}

export default function RegionSearch({ onSelect }: RegionSearchProps) {
  const [input, setInput] = useState("");
  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fetch regions once on mount
  useEffect(() => {
    fetch("/api/regions")
      .then((r) => r.json())
      .then((data: RegionItem[]) => setRegions(data))
      .catch(() => {});
  }, []);

  // Filter suggestions
  const filtered = input.trim()
    ? regions.filter((r) => r.name.includes(input.trim())).slice(0, 8)
    : [];

  const showDropdown = focused && filtered.length > 0;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = useCallback(
    (region: RegionItem) => {
      setInput("");
      setOpen(false);
      setFocused(false);
      onSelect({ name: region.name, lat: region.lat, lng: region.lng });
    },
    [onSelect]
  );

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center bg-white/95 backdrop-blur-sm rounded-lg shadow border border-gray-200">
        <span className="pl-2.5 text-gray-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </span>
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setFocused(true)}
          placeholder="지역 이동"
          className="w-[6.5rem] px-2 py-2 text-xs bg-transparent outline-none
            placeholder-gray-400 text-gray-900"
        />
      </div>

      {/* Autocomplete dropdown */}
      {showDropdown && open && (
        <ul className="absolute left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-60 overflow-y-auto">
          {filtered.map((r) => (
            <li key={r.name}>
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 text-sm text-gray-800
                  hover:bg-indigo-50 transition-colors flex items-center justify-between"
                onClick={() => handleSelect(r)}
              >
                <span>{r.name}</span>
                {r.count > 0 && (
                  <span className="text-xs text-gray-400">{r.count}곳</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
