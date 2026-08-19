// One-off data migration script: local Postgres dump -> Supabase.
// Run with: npx tsx scripts/migrate-data.ts
import { readFileSync } from "node:fs";
import { Client } from "pg";

async function main() {
  const sql = readFileSync("C:/tmp/hitopia_inserts.sql", "utf8");
  const c = new Client({
    connectionString:
      "postgresql://postgres.vtynjoolyodqacqotzye:hAIz2RHe8Qkgzr1X@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false },
  });

  try {
    await c.connect();
    console.log("Connected to Supabase");

    // Clean slate first
    await c.query(
      `TRUNCATE TABLE performance_score, delivery_record, delivery_ticket, time_entry,
       utilization_record, budget_burn, lead_assessment, identity_mapping,
       talent_project, insight, approval, audit_log, report_item,
       monthly_report, data_quality_flag, ingestion_run, job, cost_rate,
       source_setting, project, talent, app_user, scoring_config
       RESTART IDENTITY CASCADE`,
    );
    console.log("Truncated existing data");

    // Wrap in transaction with FK disabled
    await c.query("BEGIN");
    await c.query("SET session_replication_role = 'replica'");
    await c.query(sql);
    await c.query("SET session_replication_role = 'origin'");
    await c.query("COMMIT");
    console.log("Inserted all data");
  } catch (e: any) {
    console.error("ERROR:", e.message);
    console.error("FULL:", JSON.stringify(e, null, 2));
    process.exit(1);
  } finally {
    await c.end();
  }
}

main();
