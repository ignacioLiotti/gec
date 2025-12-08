/**
 * Parses a date-only string (YYYY-MM-DD) as a local date at midnight,
 * avoiding UTC interpretation issues.
 * 
 * When you do `new Date("2025-11-05")`, JavaScript interprets it as UTC midnight,
 * which can cause issues when displayed in local timezones (e.g., GMT-0300 shows Nov 4).
 * 
 * This function ensures the date is interpreted as local midnight.
 * 
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date object representing local midnight of that date, or null if invalid
 */
export function parseLocalDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  
  // If it's already a full ISO string with time, parse it normally
  if (dateStr.includes('T') || dateStr.includes(' ')) {
    return new Date(dateStr);
  }
  
  // For date-only strings (YYYY-MM-DD), parse as local date
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    // Fallback to standard parsing if format is unexpected
    return new Date(dateStr);
  }
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const day = parseInt(parts[2], 10);
  
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return null;
  }
  
  // Create date at local midnight
  return new Date(year, month, day, 0, 0, 0, 0);
}

/**
 * Creates a date-only string (YYYY-MM-DD) from a Date object in local timezone.
 * This ensures we get the local date, not the UTC date.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}








