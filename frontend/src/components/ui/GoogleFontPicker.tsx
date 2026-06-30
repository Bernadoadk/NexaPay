import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Search, Type } from 'lucide-react';
import { storesApi } from '@/lib/api';
import { loadGoogleFonts } from '@/lib/storeTheme';
import type { GoogleFont } from '@/types';

interface GoogleFontPickerProps {
  value: string;
  onChange: (family: string) => void;
}

export default function GoogleFontPicker({ value, onChange }: GoogleFontPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data = [], isLoading } = useQuery<GoogleFont[]>({
    queryKey: ['google-fonts'],
    queryFn: () => storesApi.fonts().then(response => response.data),
    staleTime: 6 * 60 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = query ? data.filter(font => font.family.toLowerCase().includes(query)) : data;
    return list.slice(0, 80);
  }, [data, search]);

  useEffect(() => {
    loadGoogleFonts([value]);
  }, [value]);

  useEffect(() => {
    if (open) loadGoogleFonts(filtered.map(font => font.family));
  }, [open, filtered]);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function select(family: string) {
    loadGoogleFonts([family]);
    onChange(family);
    setOpen(false);
    setSearch('');
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="mb-1.5 text-[12px] font-semibold text-text-muted">Typographie de la boutique</div>
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-11 w-full items-center gap-3 rounded-sm border border-border-strong bg-surface px-3 text-left"
      >
        <Type size={16} className="text-text-muted" />
        <span className="min-w-0 flex-1 truncate text-[14px]" style={{ fontFamily: `"${value}", sans-serif` }}>{value}</span>
        <ChevronDown size={15} className="text-text-muted" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded border border-border bg-surface shadow-xl">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                className="input h-9 pl-9"
                placeholder="Rechercher une police..."
                autoFocus
              />
            </div>
          </div>
          <div role="listbox" className="max-h-[320px] overflow-auto p-1.5">
            {isLoading && <div className="p-4 text-center text-[12px] text-text-muted">Chargement des polices...</div>}
            {!isLoading && filtered.map(font => (
              <button
                type="button"
                role="option"
                aria-selected={font.family === value}
                key={font.family}
                onClick={() => select(font.family)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-left hover:bg-surface-2 ${font.family === value ? 'bg-primary-soft' : ''}`}
              >
                <span className="min-w-0 flex-1 truncate text-[15px]" style={{ fontFamily: `"${font.family}", ${font.category}` }}>
                  {font.family}
                </span>
                <span className="text-[10px] capitalize text-text-subtle">{font.category}</span>
                {font.family === value && <Check size={14} className="text-primary" />}
              </button>
            ))}
            {!isLoading && filtered.length === 0 && <div className="p-4 text-center text-[12px] text-text-muted">Aucune police trouvée.</div>}
          </div>
          <div className="border-t border-border px-3 py-2 text-[10.5px] text-text-muted">
            {search ? `${filtered.length} résultat(s)` : `${data.length} polices disponibles · utilisez la recherche pour parcourir tout le catalogue`}
          </div>
        </div>
      )}
    </div>
  );
}
