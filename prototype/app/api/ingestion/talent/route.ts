/**
 * Talent master CSV upload → upserts the canonical talent registry.
 * Accepts multipart/form-data (field "file") or a raw text/csv body.
 * Admin/analyst only; writes an INGESTION_RUN + quality flags + audit.
 */
import { NextRequest, NextResponse } from "next/server";
import { actorFromToken, SESSION_COOKIE } from "@/lib/server/session";
import { err } from "@/lib/server/http";
import { importTalentCsv } from "@/lib/server/ingest/talent-csv";
import { prisma } from "@/lib/server/db";
import { logAudit } from "@/lib/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const actor = await actorFromToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!actor) return NextResponse.json(err("UNAUTHENTICATED", "Sign in required."), { status: 401 });
  if (!["admin", "analyst"].includes(actor.role)) {
    return NextResponse.json(err("FORBIDDEN", "Only admin or analyst can import talent."), { status: 403 });
  }

  let csvText = "";
  const ctype = req.headers.get("content-type") || "";
  try {
    if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (file && typeof file !== "string") csvText = await file.text();
    } else {
      csvText = await req.text();
    }
  } catch {
    return NextResponse.json(err("BAD_REQUEST", "Could not read the uploaded file."), { status: 400 });
  }
  if (!csvText.trim()) return NextResponse.json(err("VALIDATION", "Empty CSV upload."), { status: 422 });

  const period = new URL(req.url).searchParams.get("period") || new Date().toISOString().slice(0, 7);
  const run = await prisma.ingestionRun.create({ data: { source: "gsheet", period, status: "running" } });
  try {
    const result = await importTalentCsv(csvText);
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finished_at: new Date(),
        records_ingested: result.created + result.updated,
        quality_summary: { info: 0, warn: result.flags.length, block: 0, note: `${result.created} created, ${result.updated} updated, ${result.skipped} skipped` } as any,
      },
    });
    for (const f of result.flags.slice(0, 300)) {
      await prisma.dataQualityFlag.create({
        data: { ingestion_run_id: run.id, severity: "warn", code: f.code, message: f.message },
      });
    }
    await logAudit(actor, "ingestion.talent_csv", "ingestion_run", run.id, {
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
    });
    return NextResponse.json({ run_id: run.id, ...result });
  } catch (e) {
    await prisma.ingestionRun.update({ where: { id: run.id }, data: { status: "failed", finished_at: new Date() } });
    console.error("talent CSV import failed:", e);
    return NextResponse.json(err("IMPORT_FAILED", "Import failed while processing the CSV."), { status: 500 });
  }
}
