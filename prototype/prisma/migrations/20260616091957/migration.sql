-- CreateTable
CREATE TABLE "delivery_ticket" (
    "id" TEXT NOT NULL,
    "talent_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "issue_key" TEXT NOT NULL,
    "summary" TEXT,
    "status" TEXT NOT NULL,
    "status_category" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "overdue" BOOLEAN NOT NULL DEFAULT false,
    "created" TEXT,
    "resolved_date" TEXT,
    "due_date" TEXT,
    "aging_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source_run_id" TEXT NOT NULL,

    CONSTRAINT "delivery_ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entry" (
    "id" TEXT NOT NULL,
    "talent_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "entry_date" TEXT NOT NULL,
    "description" TEXT,
    "ticket_ref" TEXT,
    "project_name" TEXT,
    "duration_sec" INTEGER NOT NULL DEFAULT 0,
    "source_run_id" TEXT NOT NULL,

    CONSTRAINT "time_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_ticket_talent_id_period_idx" ON "delivery_ticket"("talent_id", "period");

-- CreateIndex
CREATE INDEX "delivery_ticket_period_idx" ON "delivery_ticket"("period");

-- CreateIndex
CREATE INDEX "time_entry_talent_id_period_idx" ON "time_entry"("talent_id", "period");

-- CreateIndex
CREATE INDEX "time_entry_period_idx" ON "time_entry"("period");
