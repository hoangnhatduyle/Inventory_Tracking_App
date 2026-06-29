// Convert between the database snake_case shape and the API/Angular camelCase
// shape. Keeps the rest of the codebase free of casing concerns and gives us
// one place to add field renames or computed properties in the future.

type Row = Record<string, unknown>;

function camel(key: string): string {
  return key.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());
}

function snake(key: string): string {
  return key.replace(/[A-Z]/g, (ch) => '_' + ch.toLowerCase());
}

export function toCamel<T extends Row>(row: T | null | undefined): Row | null {
  if (!row) return null;
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    out[camel(k)] = v;
  }
  return out;
}

export function toCamelList<T extends Row>(rows: T[] | null | undefined): Row[] {
  if (!rows) return [];
  return rows.map((r) => toCamel(r) as Row);
}

export function toSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[snake(k)] = v;
  }
  return out;
}

// item_images rows store `storage_path` in Postgres. The Angular client still
// reads `imagePath`, so expose both keys on every image payload.
export function mapItemImage(row: Row | null | undefined): Row | null {
  const mapped = toCamel(row);
  if (!mapped) return null;
  const path = mapped['storagePath'] ?? mapped['imagePath'];
  if (path) {
    mapped['imagePath'] = path;
    mapped['storagePath'] = path;
  }
  return mapped;
}

export function mapItemImageList(rows: Row[] | null | undefined): Row[] {
  if (!rows) return [];
  return rows.map((r) => mapItemImage(r) as Row);
}
