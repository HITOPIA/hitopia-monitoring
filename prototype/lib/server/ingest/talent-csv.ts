/**
 * Talent master CSV import. The master roster is maintained as a spreadsheet
 * export (master_data_talent.csv). We import only what the monitoring product
 * needs — name, work email (the cross-system join key, D2), role, status,
 * employment type, client/project, and the per-talent hourly cost rate ("Man
 * Hours" column). Sensitive PII in the sheet (NPWP, bank account, tax, PrivyID)
 * is deliberately NOT imported (data minimization, R8/PDP).
 */
import Papa from "papaparse";
import { prisma } from "../db";

export interface TalentImportResult {
  created: number;
  updated: number;
  skipped: number;
  cost_rates: number;
  projects: number;
  flags: { code: string; message: string }[];
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

function divisionForRole(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("qa")) return "QA";
  if (r.includes("design") || r.includes("ui") || r.includes("ux")) return "Design";
  if (r.includes("data")) return "Data";
  if (r.includes("pm") || r.includes("product man") || r.includes("project man")) return "Product";
  if (r.includes("helpdesk") || r.startsWith("it ")) return "IT Support";
  if (r.includes("analyst")) return "Engineering";
  return "Engineering";
}

function parseRupiah(s?: string): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function importTalentCsv(csvText: string): Promise<TalentImportResult> {
  const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: false });
  const rows = parsed.data;

  // Locate the real header row (multi-row header in the export).
  const headerIdx = rows.findIndex(
    (r) => r.some((c) => norm(c) === "nama") && r.some((c) => norm(c) === "email"),
  );
  if (headerIdx < 0) {
    return { created: 0, updated: 0, skipped: 0, cost_rates: 0, projects: 0, flags: [{ code: "NO_HEADER", message: "Could not find a header row with 'Nama' and 'Email'." }] };
  }
  const header = rows[headerIdx].map(norm);
  const col = (name: string) => header.indexOf(norm(name));
  const ix = {
    no: col("No"),
    nama: col("Nama"),
    role: col("Role"),
    status: col("Status"),
    type: col("Type"),
    source: col("Source"),
    email: col("Email"),
    project: col("Project"),
    manHours: col("Man Hours"),
    contractStart: col("Contract Start"),
  };

  const result: TalentImportResult = { created: 0, updated: 0, skipped: 0, cost_rates: 0, projects: 0, flags: [] };
  const projectCache = new Map<string, string>(); // client name -> project id

  async function projectIdFor(clientName: string): Promise<string | null> {
    const key = clientName.trim();
    if (!key) return null;
    if (projectCache.has(key)) return projectCache.get(key)!;
    let p = await prisma.project.findFirst({ where: { name: key } });
    if (!p) {
      p = await prisma.project.create({ data: { name: key, client_name: key, currency: "IDR" } });
      result.projects++;
    }
    projectCache.set(key, p.id);
    return p.id;
  }

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const get = (idx: number) => (idx >= 0 && idx < row.length ? (row[idx] ?? "").trim() : "");
    const full_name = get(ix.nama);
    const email = get(ix.email).toLowerCase();
    if (!full_name || !email || !email.includes("@")) {
      if (full_name && !email) result.flags.push({ code: "NO_EMAIL", message: `Row for "${full_name}" has no email — cannot map to Jira/Clockify; skipped.` });
      result.skipped++;
      continue;
    }
    const role = get(ix.role) || "Unknown";
    const statusRaw = norm(get(ix.status));
    const status = statusRaw.startsWith("active") ? "active" : "inactive";
    const employment_type = get(ix.type) || "—";
    const project_id = await projectIdFor(get(ix.project));

    const existing = await prisma.talent.findUnique({ where: { email } });
    const talent = await prisma.talent.upsert({
      where: { email },
      create: {
        full_name,
        email,
        division: divisionForRole(role),
        role,
        employment_type,
        status,
        primary_project_id: project_id,
      },
      update: {
        full_name,
        division: divisionForRole(role),
        role,
        employment_type,
        status,
        primary_project_id: project_id,
      },
    });
    if (existing) result.updated++;
    else result.created++;

    // Master-registry identity mapping (the CSV is the canonical source, D2).
    await prisma.identityMapping.deleteMany({ where: { talent_id: talent.id, system: "gsheet" } });
    await prisma.identityMapping.create({
      data: {
        talent_id: talent.id,
        system: "gsheet",
        external_id: email,
        external_display_name: full_name,
        confidence: "high",
        verified: true,
        verified_at: new Date(),
      },
    });

    // Per-talent hourly cost rate (D1 override). "Man Hours" column = hourly IDR.
    const rate = parseRupiah(get(ix.manHours));
    await prisma.costRate.deleteMany({ where: { scope: "talent", ref_id: talent.id } });
    if (rate) {
      await prisma.costRate.create({
        data: {
          scope: "talent",
          ref_id: talent.id,
          rate_amount: rate,
          currency: "IDR",
          effective_from: get(ix.contractStart) || "2025-01-01",
          source: "CSV master import",
        },
      });
      result.cost_rates++;
    } else {
      result.flags.push({ code: "NO_RATE", message: `No cost rate (Man Hours) for "${full_name}" — budget burn will show as not available.` });
    }
  }

  return result;
}
