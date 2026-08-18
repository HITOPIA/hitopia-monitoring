/**
 * Render an approved monthly report to a client-ready PPTX deck (#12) via
 * pptxgenjs — landscape (LAYOUT_WIDE, 13.33×7.5in), one slide per client-visible
 * section with metric cards + tables. Callers pass client_visible items only (D8).
 */
import PptxGenJS from "pptxgenjs";
import type { ReportContent } from "../../contract/types";

interface ReportLike {
  period: string;
  scope: { clients?: string[] } | any;
}
interface ItemLike {
  section: string;
  content: ReportContent;
}

const TEAL = "0F766E";

export async function renderReportPptx(report: ReportLike, items: ItemLike[]): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 × 7.5in landscape
  pptx.author = "Hitopia Monitoring";
  pptx.company = "Hitopia";

  const cover = pptx.addSlide();
  cover.addText("HITOPIA · MONTHLY REPORT", { x: 0.6, y: 2.4, fontSize: 14, color: TEAL, bold: true, charSpacing: 2 });
  cover.addText(`Performance — ${report.period}`, { x: 0.6, y: 2.95, fontSize: 40, bold: true, color: "1C2024" });
  cover.addText((report.scope?.clients ?? []).join(", ") || "Client", { x: 0.6, y: 4.05, fontSize: 18, color: "5B6670" });
  cover.addText("Approved · client-safe", { x: 0.6, y: 4.8, fontSize: 12, color: TEAL, italic: true });

  for (const it of items) {
    const s = pptx.addSlide();
    s.addText(it.section.toUpperCase(), { x: 0.6, y: 0.4, fontSize: 11, color: "8B95A1", bold: true, charSpacing: 1.5 });
    s.addText(it.content.title, { x: 0.6, y: 0.72, fontSize: 26, bold: true, color: "1C2024" });
    s.addText(it.content.body, { x: 0.6, y: 1.5, w: 12.1, h: 1.0, fontSize: 13, color: "36404A", valign: "top" });

    let y = 2.7;
    const metrics = it.content.metrics;
    if (metrics?.length) {
      const cardW = 2.3;
      const gap = 0.25;
      const h = 1.3;
      metrics.slice(0, 5).forEach((m, idx) => {
        const x = 0.6 + idx * (cardW + gap);
        s.addShape(pptx.ShapeType.roundRect, { x, y, w: cardW, h, fill: { color: "FBFDFC" }, line: { color: "E6E8EB", width: 1 }, rectRadius: 0.08 });
        s.addText(m.value, { x, y: y + 0.12, w: cardW, h: 0.55, align: "center", fontSize: 24, bold: true, color: TEAL });
        s.addText(m.label + (m.sub ? `  ·  ${m.sub}` : ""), { x: x + 0.05, y: y + 0.72, w: cardW - 0.1, h: 0.45, align: "center", fontSize: 10, color: "36404A" });
      });
      y += h + 0.35;
    }
    const tbl = it.content.table;
    if (tbl?.rows?.length) {
      const header = tbl.columns.map((c) => ({ text: c, options: { bold: true, color: "5B6670", fill: { color: "F6F8F8" } } }));
      const rows = tbl.rows.map((r) => r.map((c) => ({ text: String(c), options: { color: "1C2024" } })));
      s.addTable([header, ...rows], { x: 0.6, y, w: 12.1, fontSize: 11, border: { type: "solid", color: "E6E8EB", pt: 1 }, valign: "middle" });
    }
  }

  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return out;
}
