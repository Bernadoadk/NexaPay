export function fmtXOF(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' F';
}

export function fmtXOFLong(n: number): string {
  return fmtXOF(n) + ' CFA';
}

export function fmtDateFR(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateShort(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function validUntil(issuedAt: string, validDays: number): string {
  const d = new Date(issuedAt);
  d.setDate(d.getDate() + validDays);
  return fmtDateFR(d);
}

export function clientInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
