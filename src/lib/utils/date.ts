/** Returns the local date in YYYY-MM-DD format (not UTC). */
export function localIsoDate(date: Date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
