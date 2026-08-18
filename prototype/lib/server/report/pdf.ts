/**
 * Render an approved monthly report to a client-ready PDF (HTML → Puppeteer).
 * Shares the landscape deck markup with the HTML export (lib/server/report/html.ts).
 * Only the items passed in are rendered — callers pass client_visible items only,
 * so the export gate is enforced before this is reached (D8).
 */
import puppeteer from "puppeteer";
import { buildReportHtml } from "./html";

interface ReportLike {
  period: string;
  scope: { clients?: string[] } | any;
  exec_summary?: string | null;
}
interface ItemLike {
  section: string;
  content: any;
}

export async function renderReportPdf(report: ReportLike, items: ItemLike[]): Promise<Buffer> {
  const html = buildReportHtml(report, items);
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
