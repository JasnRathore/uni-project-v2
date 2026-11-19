export function escapeCsvValue(value: unknown): string {
  const text = String(value ?? '');
  const safeText = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export function createCsv(rows: unknown[][]): string {
  return rows
    .map(row => row.map(escapeCsvValue).join(','))
    .join('\r\n');
}

export function downloadCsv(filename: string, rows: unknown[][]): void {
  const csv = createCsv(rows);
  const url = URL.createObjectURL(
    new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
