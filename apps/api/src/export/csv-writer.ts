/**
 * Minimal RFC-4180 CSV writer (EXP-01). No dependency — the format is trivial and a
 * library would be unjustified (Principle V). Produces a UTF-8 BOM-prefixed, comma-
 * delimited, CRLF-terminated document; a field is quoted iff it contains a comma,
 * double quote, CR or LF, with inner quotes doubled. Spreadsheets read the BOM as
 * UTF-8, preserving accents/ñ.
 */

/** Byte-order mark so Excel/Sheets decode UTF-8 (tildes, ñ) correctly. */
const BOM = '﻿';

/** Quotes a single field per RFC-4180 when it contains a delimiter/quote/newline. */
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Builds a CSV document from a header row and data rows. Always emits the header;
 * zero data rows yields a valid header-only file. Each record ends with CRLF.
 */
export function buildCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(','));
  return BOM + lines.join('\r\n') + '\r\n';
}
