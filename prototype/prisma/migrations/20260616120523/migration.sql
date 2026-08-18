-- AlterTable
ALTER TABLE "delivery_record" ADD COLUMN     "avg_cycle_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "bugs_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status_transitions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tickets_verified" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "delivery_ticket" ADD COLUMN     "credit" TEXT,
ADD COLUMN     "is_bug" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "issue_type" TEXT,
ADD COLUMN     "reopen_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "transitions" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "insight" ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "severity" TEXT,
ADD COLUMN     "summary" TEXT;

-- AlterTable
ALTER TABLE "scoring_config" ADD COLUMN     "profiles" JSONB,
ADD COLUMN     "role_groups" JSONB;

-- AlterTable
ALTER TABLE "time_entry" ADD COLUMN     "clockify_entry_id" TEXT,
ADD COLUMN     "end_at" TEXT,
ADD COLUMN     "offhours_kind" TEXT,
ADD COLUMN     "start_at" TEXT;

-- AlterTable
ALTER TABLE "utilization_record" ADD COLUMN     "offhours_hours" DOUBLE PRECISION NOT NULL DEFAULT 0;
