/**
 * Client-ready PPTX deck export for an approved report (#12). Same approval gate
 * + client_visible filter as the PDF/HTML routes; streams a landscape .pptx.
 */
import { NextRequest, NextResponse } from "next/server";
import { actorFromToken, SESSION_COOKIE } from "@/lib/server/session";
import { err } from "@/lib/server/http";
import { prisma } from "@/lib/server/db";
import { logAudit } from "@/lib/server/audit";
import { renderReportPptx } from "@/lib/server/report/pptx";
import type { AppUser } from "@/lib/contract/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await actorFromToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!actor) return NextResponse.json(err("UNAUTHENTICATED", "Sign in required."), { status: 401 });

  const { id } = await ctx.params;
  const report = await prisma.monthlyReport.findUnique({ where: { id } });
  if (!report) return NextResponse.json(err("NOT_FOUND", "Report not found."), { status: 404 });
  if (report.status !== "approved" && report.status !== "published") {
    return NextResponse.json(err("REPORT_NOT_APPROVED", "Export blocked — report must be approved first (approval-workflow gate)."), { status: 409 });
  }

  const items = await prisma.reportItem.findMany({ where: { monthly_report_id: id, client_visible: true } });
  const pptx = await renderReportPptx(report as any, items as any);

  await prisma.monthlyReport.update({
    where: { id },
    data: { status: "published", audience: "client", file_ref: `reports/${report.period}-client-deck.pptx` },
  });
  await logAudit(actor as unknown as AppUser, "report.export_pptx", "monthly_report", id, { slides: items.length });

  return new NextResponse(new Uint8Array(pptx), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "content-disposition": `attachment; filename="hitopia-${report.period}.pptx"`,
    },
  });
}
