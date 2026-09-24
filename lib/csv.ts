import { downloadFile } from "./utils";

export function toCsv(header: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.map(esc).join(",")];
  for (const row of rows) {
    lines.push(row.map(esc).join(","));
  }
  return "\uFEFF" + lines.join("\r\n");
}

export function downloadCsv(header: string[], rows: (string | number)[][], filename: string): void {
  const blob = new Blob([toCsv(header, rows)], { type: "text/csv;charset=utf-8;" });
  downloadFile(blob, filename);
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8;" });
  downloadFile(blob, filename);
}