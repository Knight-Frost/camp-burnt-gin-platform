/**
 * CamperSearch.tsx
 *
 * Typeahead camper picker used on medical portal pages that operate over the
 * full camper list (global incidents/visits/treatments/follow-ups). Debounces
 * input by ~300ms and calls `getMedicalCampers({ search })` for suggestions.
 *
 * Usage:
 *   const [camper, setCamper] = useState<Camper | null>(null);
 *   <CamperSearch value={camper} onSelect={setCamper} onClear={() => setCamper(null)} />
 */

import { useEffect, useRef, useState } from 'react';
import { Loader2, Search, User, X } from 'lucide-react';

import { getMedicalCampers } from '@/features/medical/api/medical.api';
import type { Camper } from '@/features/admin/types/admin.types';

export function CamperSearch({
  value,
  onSelect,
  onClear,
  placeholder = 'Search camper by name…',
}: {
  value: Camper | null;
  onSelect: (camper: Camper) => void;
  onClear: () => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Camper[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!val.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    timeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await getMedicalCampers({ search: val });
        setSuggestions(res.data.slice(0, 8));
        setOpen(true);
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 300);
  };

  if (value) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm"
        style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
      >
        <User className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
        <span className="flex-1">{value.full_name}</span>
        <button
          type="button"
          onClick={onClear}
          className="p-0.5 rounded hover:bg-[var(--dash-nav-hover-bg)]"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
          style={{ color: 'var(--muted-foreground)' }}
        />
        <input
          type="text"
          className="w-full rounded-lg border pl-8 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40"
          style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
        />
        {searching && (
          <Loader2
            className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin"
            style={{ color: 'var(--muted-foreground)' }}
          />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div
          className="absolute z-20 w-full mt-1 rounded-xl border shadow-lg overflow-hidden"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          {suggestions.map((camper) => (
            <button
              key={camper.id}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
              style={{ color: 'var(--foreground)' }}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(camper);
                setQuery('');
                setSuggestions([]);
                setOpen(false);
              }}
            >
              <User className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
              {camper.full_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
