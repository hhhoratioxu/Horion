export function cn(...classes: (false | null | string | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
