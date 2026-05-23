const DIAL_MAP: Record<string, string> = {
  bj: '+229',
  ci: '+225',
  sn: '+221',
  tg: '+228',
  gn: '+224',
  cm: '+237',
};

/** Convert local phone + country code → E.164. Idempotent if already E.164. */
export function toE164(phone: string, countryCode: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) return trimmed.replace(/\s/g, '');
  const dial = DIAL_MAP[countryCode] ?? DIAL_MAP['bj'];
  return `${dial}${trimmed.replace(/\D/g, '')}`;
}

/** Strip E.164 to bare digits for FedaPay phone_number.number field */
export function e164ToLocalDigits(e164: string, countryCode: string): string {
  if (!e164) return '';
  const dial = DIAL_MAP[countryCode] ?? DIAL_MAP['bj'];
  if (e164.startsWith(dial)) return e164.slice(dial.length);
  return e164.replace(/\D/g, '');
}
