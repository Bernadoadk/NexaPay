import { COUNTRIES, cleanCountryCode, formatLocalDigits, getCountry, getPlaceholder, parsePhoneInput } from '@/lib/phone';

// Re-export for consumers that previously imported FEDAPAY_COUNTRIES from here
export { COUNTRIES as FEDAPAY_COUNTRIES } from '@/lib/phone';

interface Props {
  label?: React.ReactNode;
  phone: string;          // local formatted value e.g. "97 00 00 00"
  country: string;        // country code e.g. "bj"
  onPhoneChange: (v: string) => void;
  onCountryChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function PhoneCountryInput({
  label,
  phone,
  country,
  onPhoneChange,
  onCountryChange,
  disabled,
}: Props) {
  const selected = getCountry(cleanCountryCode(country));

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const parsed = parsePhoneInput(e.target.value, selected.code);
    if (parsed.country.code !== selected.code) onCountryChange(parsed.country.code);
    onPhoneChange(parsed.local);
  }

  function handleCountryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    onCountryChange(e.target.value);
    const newCountry = getCountry(e.target.value);
    onPhoneChange(formatLocalDigits(phone, newCountry.groups));
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[12px] font-semibold text-text-muted tracking-[0.01em]">
          {label}
        </label>
      )}
      <div className="flex h-10 rounded-sm border border-border-strong bg-surface overflow-hidden focus-within:border-primary focus-within:ring-3 focus-within:ring-primary-soft transition-colors">
        <div className="relative flex-shrink-0">
          <select
            value={selected.code}
            onChange={handleCountryChange}
            disabled={disabled}
            className="h-full appearance-none bg-surface-2 border-r border-border-strong pl-2 pr-6 text-[13px] text-text cursor-pointer focus:outline-none"
          >
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code} title={c.name}>
                {c.flag} {c.dial} · {c.name}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-text-muted">▾</span>
        </div>
        <input
          type="tel"
          value={phone}
          onChange={handlePhoneChange}
          disabled={disabled}
          placeholder={getPlaceholder(selected.groups)}
          className="flex-1 min-w-0 px-3 bg-transparent text-[14px] text-text placeholder:text-text-subtle focus:outline-none font-mono tracking-wide"
        />
      </div>
    </div>
  );
}
