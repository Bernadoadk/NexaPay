export interface Country {
  code: string;
  flag: string;
  name: string;
  dial: string;         // "+229"
  dialDigits: string;   // "229"
  groups: number[];     // grouping local digits e.g. [2,2,2,2,2]
  momoNetworks: MomoNetwork[];
}

export interface MomoNetwork {
  id: string;
  name: string;
  color: string;
}

export const COUNTRIES: Country[] = [
  {
    code: 'bj', flag: '🇧🇯', name: 'Bénin', dial: '+229', dialDigits: '229',
    groups: [2, 2, 2, 2, 2],
    momoNetworks: [
      { id: 'mtn_momo',   name: 'MTN MoMo',    color: '#FFC107' },
      { id: 'moov_flooz', name: 'Moov Flooz',   color: '#0073B7' },
    ],
  },
  {
    code: 'ci', flag: '🇨🇮', name: "Côte d'Ivoire", dial: '+225', dialDigits: '225',
    groups: [2, 2, 2, 2, 2],
    momoNetworks: [
      { id: 'mtn_momo',      name: 'MTN MoMo',      color: '#FFC107' },
      { id: 'orange_money',  name: 'Orange Money',   color: '#FF6600' },
      { id: 'wave',          name: 'Wave',           color: '#1FA0FF' },
    ],
  },
  {
    code: 'sn', flag: '🇸🇳', name: 'Sénégal', dial: '+221', dialDigits: '221',
    groups: [2, 3, 4],
    momoNetworks: [
      { id: 'wave',         name: 'Wave',         color: '#1FA0FF' },
      { id: 'orange_money', name: 'Orange Money', color: '#FF6600' },
      { id: 'free_money',   name: 'Free Money',   color: '#E30613' },
    ],
  },
  {
    code: 'tg', flag: '🇹🇬', name: 'Togo', dial: '+228', dialDigits: '228',
    groups: [2, 2, 2, 2],
    momoNetworks: [
      { id: 'tmoney', name: 'T-Money',     color: '#E30613' },
      { id: 'flooz',  name: 'Flooz (Moov)', color: '#0073B7' },
    ],
  },
  {
    code: 'gn', flag: '🇬🇳', name: 'Guinée', dial: '+224', dialDigits: '224',
    groups: [3, 3, 3],
    momoNetworks: [
      { id: 'mtn_momo',     name: 'MTN MoMo',     color: '#FFC107' },
      { id: 'orange_money', name: 'Orange Money',  color: '#FF6600' },
    ],
  },
  {
    code: 'cm', flag: '🇨🇲', name: 'Cameroun', dial: '+237', dialDigits: '237',
    groups: [3, 2, 2, 2],
    momoNetworks: [
      { id: 'mtn_momo',     name: 'MTN MoMo',     color: '#FFC107' },
      { id: 'orange_money', name: 'Orange Money',  color: '#FF6600' },
    ],
  },
];

export function getCountry(code: string): Country {
  return COUNTRIES.find(c => c.code === code) ?? COUNTRIES[0];
}

export function getPlaceholder(groups: number[]): string {
  return groups.map(g => '0'.repeat(g)).join(' ');
}

/** Format raw digit string into spaced local display */
export function formatLocalDigits(digits: string, groups: number[]): string {
  const maxDigits = groups.reduce((a, b) => a + b, 0);
  const clamped = digits.replace(/\D/g, '').slice(0, maxDigits);
  const parts: string[] = [];
  let pos = 0;
  for (const g of groups) {
    if (pos >= clamped.length) break;
    parts.push(clamped.slice(pos, pos + g));
    pos += g;
  }
  return parts.join(' ');
}

/** Local formatted phone + country code → E.164 ("+22997000000") */
export function toE164(localPhone: string, countryCode: string): string {
  const country = getCountry(countryCode);
  const digits = localPhone.replace(/\D/g, '');
  if (!digits) return '';
  return `${country.dial}${digits}`;
}

/** E.164 → { country, local formatted } — returns null if unrecognised */
export function fromE164(e164: string): { country: Country; local: string } | null {
  if (!e164?.startsWith('+')) return null;
  // Try longest dial prefix first
  const sorted = [...COUNTRIES].sort((a, b) => b.dialDigits.length - a.dialDigits.length);
  for (const country of sorted) {
    if (e164.startsWith(country.dial)) {
      const localDigits = e164.slice(country.dial.length);
      return { country, local: formatLocalDigits(localDigits, country.groups) };
    }
  }
  return null;
}

/**
 * Returns E.164 from whatever format is stored (already E.164 or legacy local).
 * Falls back to local→E.164 conversion using countryCode hint.
 */
export function normaliseToE164(phone: string, countryCode: string): string {
  if (phone?.startsWith('+')) return phone;
  return toE164(phone, countryCode);
}

/** Generate a wa.me link. e164 can be "+22997000000" or "22997000000". */
export function whatsappLink(e164: string, message?: string): string {
  const digits = e164.replace(/\D/g, '');
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** MoMo network names as comma-separated string for a country */
export function momoLabel(countryCode: string): string {
  return getCountry(countryCode).momoNetworks.map(n => n.name).join(', ');
}
