export interface IngestFlag {
  severity: "info" | "warn" | "block";
  code: string;
  message: string;
  talent_id?: string | null;
}

export interface IngestSummary {
  upserts: number;
  unmatched: number;
  flags: IngestFlag[];
  note?: string;
}

/** Normalize a display name for fuzzy talent matching. */
export const normName = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
