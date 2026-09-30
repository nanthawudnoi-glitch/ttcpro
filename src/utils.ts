/**
 * Utility functions for browser cross-compatibility (Safari / WebKit, Chrome, Firefox)
 */

/**
 * Safely parses response body as JSON.
 * In Safari/WebKit, calling res.json() on an empty body, 204 No Content, or HTML error page
 * throws "The string did not match the expected pattern" DOMException.
 * Using res.text() + JSON.parse() prevents this exception completely.
 */
export async function safeParseJson<T = any>(res: Response): Promise<T | null> {
  try {
    if (!res) return null;
    const text = await res.text();
    if (!text || !text.trim()) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Parses date strings reliably in Safari.
 * SQLite timestamps like "2026-09-22 02:44:02" (space-separated) cause Safari to throw or produce Invalid Date.
 * Converting the space to 'T' makes it a standard ISO-8601 string.
 */
export function safeDate(dateInput: string | number | Date | null | undefined): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  if (typeof dateInput === 'string') {
    // If it's a space-separated SQLite datetime like "YYYY-MM-DD HH:mm:ss"
    const normalized = dateInput.includes(' ') && !dateInput.includes('T')
      ? dateInput.replace(' ', 'T')
      : dateInput;
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(dateInput);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats date into Thai locale string safely
 */
export function formatThaiDate(
  dateInput: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = safeDate(dateInput);
  if (!d) return '-';
  try {
    return d.toLocaleDateString('th-TH', options);
  } catch {
    return '-';
  }
}

/**
 * Formats datetime into Thai locale string safely
 */
export function formatThaiDateTime(
  dateInput: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = safeDate(dateInput);
  if (!d) return '-';
  try {
    return d.toLocaleString('th-TH', options);
  } catch {
    return '-';
  }
}
