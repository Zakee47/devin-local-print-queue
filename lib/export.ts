// Pure helpers for the admin submissions export (CSV + zip naming).

export type ExportRow = {
  id: string;
  downloadName: string;
  printCode: string;
  title: string;
  username: string;
  name: string;
  email: string;
  colour: string;
  status: string;
  printer: string;
  printRequested: boolean;
  designEntry: boolean;
  designRemoved: boolean;
  likes: number;
  votes: number;
  rejectionReason: string;
  createdAt: number;
};

export const EXPORT_CSV_HEADERS = [
  "printCode",
  "title",
  "username",
  "name",
  "email",
  "colour",
  "status",
  "printer",
  "printRequested",
  "designEntry",
  "designRemoved",
  "likes",
  "votes",
  "rejectionReason",
  "createdAt",
];

export function exportCsvRows(rows: ExportRow[]): string[][] {
  return [
    EXPORT_CSV_HEADERS,
    ...rows.map((row) => [
      row.printCode,
      row.title,
      row.username,
      row.name,
      row.email,
      row.colour,
      row.status,
      row.printer,
      String(row.printRequested),
      String(row.designEntry),
      String(row.designRemoved),
      String(row.likes),
      String(row.votes),
      row.rejectionReason,
      new Date(row.createdAt).toISOString(),
    ]),
  ];
}

// Local-time stamp, e.g. 2026-10-01-1935.
export function exportFileStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(
    date.getHours()
  )}${pad(date.getMinutes())}`;
}

export function exportZipName(date: Date): string {
  return `keychain-submissions-${exportFileStamp(date)}.zip`;
}

export function exportCsvName(date: Date): string {
  return `keychain-submissions-${exportFileStamp(date)}.csv`;
}
