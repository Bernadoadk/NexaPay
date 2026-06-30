const DIAL_MAP: Record<string, string> = {
  bj: '+229',
  ci: '+225',
  sn: '+221',
  tg: '+228',
  gn: '+224',
  cm: '+237',
};

export function cleanCountryCode(countryCode?: string | null): string {
  const code = String(countryCode ?? '').trim().toLowerCase();
  return DIAL_MAP[code] ? code : 'bj';
}

function normaliseInternationalPrefix(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('00')) return `+${trimmed.slice(2)}`;
  return trimmed;
}

export function countryFromPhone(phone: string | null | undefined, hint = 'bj'): string {
  const normalised = normaliseInternationalPrefix(String(phone ?? '')).replace(/[^\d+]/g, '');
  if (normalised.startsWith('+')) {
    const match = Object.entries(DIAL_MAP)
      .sort((a, b) => b[1].length - a[1].length)
      .find(([, dial]) => normalised.startsWith(dial));
    if (match) return match[0];
  }
  return cleanCountryCode(hint);
}

/** Convert local phone + country code → E.164. Idempotent if already E.164. */
export function toE164(phone: string, countryCode: string): string {
  if (!phone) return '';
  const trimmed = normaliseInternationalPrefix(phone);
  if (trimmed.startsWith('+')) return `+${trimmed.replace(/\D/g, '')}`;
  const dial = DIAL_MAP[cleanCountryCode(countryCode)] ?? DIAL_MAP['bj'];
  return `${dial}${trimmed.replace(/\D/g, '')}`;
}

/** Strip E.164 to bare digits for FedaPay phone_number.number field */
export function e164ToLocalDigits(e164: string, countryCode: string): string {
  if (!e164) return '';
  const normalised = normaliseInternationalPrefix(e164);
  const dial = DIAL_MAP[cleanCountryCode(countryCode)] ?? DIAL_MAP['bj'];
  if (normalised.startsWith(dial)) return normalised.slice(dial.length).replace(/\D/g, '');
  return normalised.replace(/\D/g, '');
}
