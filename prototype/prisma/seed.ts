/**
 * DB bootstrap seed (dev only). Loads a realistic, deterministic dataset so the
 * app has data before real ingestion runs. In production this is replaced by
 * Google Sheets / Jira / Clockify ingestion (Phase 3). NOT a runtime mock.
 *
 * `as any` casts: the generator returns contract-typed objects whose field
 * types (ISO strings for timestamps) are accepted by Prisma at runtime; the cast
 * keeps the seed concise without re-declaring every Prisma create input.
 */
import "dotenv/config";
import { prisma } from "../lib/server/db";
import { hashPassword } from "../lib/server/auth";
import { buildSeed } from "./seed-data";

// Dev password for all seeded app users. Change in any real environment.
const DEV_PASSWORD = "hitopia123";

async function main() {
  const s = buildSeed();
  const password_hash = await hashPassword(DEV_PASSWORD);
  const usersWithPw = s.users.map((u) => ({ ...u, password_hash }));

  // Idempotent wipe. No FK constraints (scalar FKs), so delete order is free.
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.approval.deleteMany(),
    prisma.reportItem.deleteMany(),
    prisma.monthlyReport.deleteMany(),
    prisma.insight.deleteMany(),
    prisma.job.deleteMany(),
    prisma.performanceScore.deleteMany(),
    prisma.scoringConfig.deleteMany(),
    prisma.leadAssessment.deleteMany(),
    prisma.budgetBurn.deleteMany(),
    prisma.costRate.deleteMany(),
    prisma.deliveryTicket.deleteMany(),
    prisma.timeEntry.deleteMany(),
    prisma.deliveryRecord.deleteMany(),
    prisma.utilizationRecord.deleteMany(),
    prisma.dataQualityFlag.deleteMany(),
    prisma.ingestionRun.deleteMany(),
    prisma.talentProject.deleteMany(),
    prisma.identityMapping.deleteMany(),
    prisma.project.deleteMany(),
    prisma.talent.deleteMany(),
    prisma.appUser.deleteMany(),
    prisma.sourceSetting.deleteMany(),
  ]);

  // --- Infrastructure: always seeded (login users, scoring config, source rows) ---
  await prisma.appUser.createMany({ data: usersWithPw as any });
  await prisma.scoringConfig.createMany({ data: s.scoringConfigs as any });
  await prisma.sourceSetting.createMany({
    data: [
      { source: "gsheet", config: {} },
      { source: "jira", config: {} },
      { source: "clockify", config: {} },
      { source: "schedule", config: { work_start: "09:00", work_end: "18:00", timezone: "Asia/Jakarta", workdays: [1, 2, 3, 4, 5] } },
    ] as any,
  });

  // --- Demo operational data: skip with SEED_DEMO=false for a real-data start ---
  const demo = process.env.SEED_DEMO !== "false";
  if (demo) {
    await prisma.project.createMany({ data: s.projects as any });
    await prisma.costRate.createMany({ data: s.costRates as any });
    await prisma.talent.createMany({ data: s.talents as any });
    await prisma.identityMapping.createMany({ data: s.mappings as any });
    await prisma.ingestionRun.createMany({ data: s.ingestionRuns as any });
    await prisma.dataQualityFlag.createMany({ data: s.qualityFlags as any });
    await prisma.utilizationRecord.createMany({ data: s.utilization as any });
    await prisma.deliveryRecord.createMany({ data: s.delivery as any });
    await prisma.deliveryTicket.createMany({ data: s.deliveryTickets as any });
    await prisma.timeEntry.createMany({ data: s.timeEntries as any });
    await prisma.budgetBurn.createMany({ data: s.budgetBurn as any });
    await prisma.leadAssessment.createMany({ data: s.leadAssessments as any });
    await prisma.performanceScore.createMany({ data: s.scores as any });
    await prisma.insight.createMany({ data: s.insights as any });
    await prisma.monthlyReport.createMany({ data: s.reports as any });
    await prisma.reportItem.createMany({ data: s.reportItems as any });
    await prisma.approval.createMany({ data: s.approvals as any });
    await prisma.auditLog.createMany({ data: s.auditLogs as any });
  }

  console.log(
    demo
      ? `Seeded infra + demo: users=${s.users.length} talents=${s.talents.length} scores=${s.scores.length}`
      : `Seeded infra only (SEED_DEMO=false): users=${s.users.length}, scoring configs=${s.scoringConfigs.length}. Import talent CSV + run ingestion to populate real data.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
