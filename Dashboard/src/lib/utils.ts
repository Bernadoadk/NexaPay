export function clientInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}