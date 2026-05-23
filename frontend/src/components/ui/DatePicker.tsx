import { useState, useRef, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAYS_FR = ['Lu','Ma','Me','Je','Ve','Sa','Di'];

interface DatePickerProps {
  value?: string;           // ISO date string YYYY-MM-DD
  onChange?: (iso: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  minDate?: string;
  maxDate?: string;
}

function parseISO(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtDisplay(iso?: string): string {
  const d = parseISO(iso);
  if (!d) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstWeekdayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  // Mon=0 … Sun=6
  return day === 0 ? 6 : day - 1;
}

export default function DatePicker({ value, onChange, label, placeholder = 'Sélectionner une date', className, minDate, maxDate }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const today = new Date();
  const selected = parseISO(value);
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());

  // Fermer au clic extérieur
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function selectDay(day: number) {
    const iso = toISO(new Date(viewYear, viewMonth, day));
    onChange?.(iso);
    setOpen(false);
  }

  const totalDays = daysInMonth(viewYear, viewMonth);
  const firstOffset = firstWeekdayOfMonth(viewYear, viewMonth);
  const minD = parseISO(minDate);
  const maxD = parseISO(maxDate);

  function isDisabled(day: number) {
    const d = new Date(viewYear, viewMonth, day);
    if (minD && d < minD) return true;
    if (maxD && d > maxD) return true;
    return false;
  }

  function isToday(day: number) {
    return viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate();
  }

  function isSelected(day: number) {
    return selected && selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === day;
  }

  return (
    <div className={cn('relative', className)} ref={ref}>
      {label && <label className="block text-[12px] font-semibold text-text-muted mb-1.5">{label}</label>}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'w-full h-10 px-3 flex items-center gap-2 rounded-sm border bg-surface text-[14px] text-left transition-colors',
          open ? 'border-primary ring-3 ring-primary-soft' : 'border-border-strong hover:border-border-strong',
          !value && 'text-text-subtle'
        )}
      >
        <CalendarIcon size={15} className={value ? 'text-primary' : 'text-text-muted'} />
        <span className="flex-1">{value ? fmtDisplay(value) : placeholder}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 bg-surface border border-border rounded shadow-lg p-3 w-[272px]"
          style={{ boxShadow: '0 8px 24px rgba(15,32,28,0.12)' }}>

          {/* Month nav */}
          <div className="flex items-center mb-3">
            <button type="button" onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted transition-colors">
              <ChevronLeftIcon size={16} />
            </button>
            <div className="flex-1 text-center text-[13.5px] font-semibold">
              {MONTHS_FR[viewMonth]} {viewYear}
            </div>
            <button type="button" onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted transition-colors">
              <ChevronRightIcon size={16} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_FR.map(d => (
              <div key={d} className="text-center text-[11px] font-semibold text-text-muted py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {/* empty cells before first day */}
            {Array.from({ length: firstOffset }).map((_, i) => <div key={`e${i}`} />)}

            {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => {
              const sel = isSelected(day);
              const tod = isToday(day);
              const dis = isDisabled(day);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={dis}
                  onClick={() => selectDay(day)}
                  className={cn(
                    'h-8 w-full flex items-center justify-center text-[13px] rounded transition-colors',
                    dis && 'text-text-subtle cursor-not-allowed opacity-40',
                    !dis && !sel && 'hover:bg-primary-soft hover:text-primary-hover',
                    tod && !sel && 'font-semibold text-primary',
                    sel && 'bg-primary text-white font-semibold',
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Quick shortcuts */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-border">
            {[
              { label: "Aujourd'hui", value: toISO(today) },
              { label: 'Dans 30 j', value: toISO(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30)) },
            ].map(s => (
              <button key={s.label} type="button"
                onClick={() => { onChange?.(s.value); setOpen(false); }}
                className="flex-1 h-7 text-[12px] font-medium text-text-muted rounded-sm border border-border hover:bg-surface-2 hover:text-text transition-colors">
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Variante plage de dates
interface DateRangePickerProps {
  from?: string;
  to?: string;
  onFromChange?: (iso: string) => void;
  onToChange?: (iso: string) => void;
  label?: string;
  className?: string;
}

export function DateRangePicker({ from, to, onFromChange, onToChange, label, className }: DateRangePickerProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <div className="text-[12px] font-semibold text-text-muted">{label}</div>}
      <div className="flex items-center gap-2">
        <DatePicker value={from} onChange={onFromChange} placeholder="Du" maxDate={to} />
        <span className="text-text-muted text-[13px] flex-shrink-0">→</span>
        <DatePicker value={to} onChange={onToChange} placeholder="Au" minDate={from} />
      </div>
    </div>
  );
}
