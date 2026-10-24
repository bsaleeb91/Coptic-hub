// lib/csv.ts
// CSV export for the admin dashboard (web only).

export type CsvValue = string | number | boolean | null | undefined;

// Quote every field and double any quotes inside it. A field starting with
// = + - @ (or a tab or carriage return) is prefixed with ' so a spreadsheet
// shows member-written text as text instead of running it as a formula.
export function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return '""';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  return [header, ...rows].map(r => r.map(csvField).join(',')).join('\r\n');
}

// Starts the file download in the browser. The leading BOM makes Excel read
// the file as UTF-8, so Arabic and Coptic text is not garbled.
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
