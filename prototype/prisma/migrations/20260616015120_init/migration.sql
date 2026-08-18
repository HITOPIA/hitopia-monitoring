-- CreateTable
CREATE TABLE "app_user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "talent_code" TEXT,
    "division" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "employment_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "primary_project_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_mapping" (
    "id" TEXT NOT NULL,
    "talent_id" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "external_display_name" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),

    CONSTRAINT "identity_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "jira_project_key" TEXT,
    "clockify_project_id" TEXT,
    "budget_amount" DOUBLE PRECISION,
    "currency" TEXT,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_project" (
    "id" TEXT NOT NULL,
    "talent_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "period" TEXT,

    CONSTRAINT "talent_project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_run" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "records_ingested" INTEGER NOT NULL DEFAULT 0,
    "quality_summary" JSONB,

    CONSTRAINT "ingestion_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_quality_flag" (
    "id" TEXT NOT NULL,
    "ingestion_run_id" TEXT NOT NULL,
    "talent_id" TEXT,
    "severity" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,

    CONSTRAINT "data_quality_flag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilization_record" (
    "id" TEXT NOT NULL,
    "talent_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "project_id" TEXT,
    "tracked_hours" DOUBLE PRECISION NOT NULL,
    "productive_hours" DOUBLE PRECISION NOT NULL,
    "target_hours" DOUBLE PRECISION NOT NULL,
    "overtime_hours" DOUBLE PRECISION NOT NULL,
    "source_run_id" TEXT NOT NULL,

    CONSTRAINT "utilization_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_record" (
    "id" TEXT NOT NULL,
    "talent_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "tickets_committed" INTEGER NOT NULL,
    "tickets_completed" INTEGER NOT NULL,
    "tickets_overdue" INTEGER NOT NULL,
    "tickets_reopened" INTEGER NOT NULL,
    "avg_aging_days" DOUBLE PRECISION NOT NULL,
    "source_run_id" TEXT NOT NULL,

    CONSTRAINT "delivery_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_rate" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "ref_id" TEXT NOT NULL,
    "rate_amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "effective_from" TEXT NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "cost_rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_burn" (
    "id" TEXT NOT NULL,
    "talent_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "project_id" TEXT,
    "cost_incurred" DOUBLE PRECISION,
    "budget_allocated" DOUBLE PRECISION,
    "burn_pct" DOUBLE PRECISION,
    "cost_rate_id" TEXT,
    "computed_at" TIMESTAMP(3),
    "unavailable_reason" TEXT,

    CONSTRAINT "budget_burn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_assessment" (
    "id" TEXT NOT NULL,
    "talent_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "lead_ref" TEXT NOT NULL,
    "rubric_scores" JSONB NOT NULL,
    "normalized_score" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "submitted_by" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_config" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "weights" JSONB NOT NULL,
    "thresholds" JSONB NOT NULL,
    "effective_from" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "scoring_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_score" (
    "id" TEXT NOT NULL,
    "talent_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "delivery_score" DOUBLE PRECISION NOT NULL,
    "utilization_score" DOUBLE PRECISION NOT NULL,
    "efficiency_score" DOUBLE PRECISION NOT NULL,
    "overtime_health_score" DOUBLE PRECISION NOT NULL,
    "lead_assessment_score" DOUBLE PRECISION NOT NULL,
    "total_score" DOUBLE PRECISION NOT NULL,
    "flag" TEXT NOT NULL,
    "scoring_config_id" TEXT NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scorable" BOOLEAN NOT NULL DEFAULT true,
    "not_scorable_reason" TEXT,

    CONSTRAINT "performance_score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insight" (
    "id" TEXT NOT NULL,
    "talent_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "diagnosis" JSONB NOT NULL,
    "narrative" TEXT NOT NULL,
    "recommendations" JSONB NOT NULL,
    "source_refs" JSONB NOT NULL,
    "model_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_report" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "scope" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "exec_summary" TEXT,
    "file_ref" TEXT,
    "generated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_item" (
    "id" TEXT NOT NULL,
    "monthly_report_id" TEXT NOT NULL,
    "talent_id" TEXT,
    "insight_id" TEXT,
    "section" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "client_visible" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "report_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval" (
    "id" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "period" TEXT,
    "progress" JSONB,
    "result_refs" JSONB,
    "errors" JSONB,
    "created_by" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_setting" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_checked" TIMESTAMP(3),
    "last_status" TEXT,
    "last_error" TEXT,

    CONSTRAINT "source_setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "talent_email_key" ON "talent"("email");

-- CreateIndex
CREATE UNIQUE INDEX "talent_talent_code_key" ON "talent"("talent_code");

-- CreateIndex
CREATE INDEX "talent_division_idx" ON "talent"("division");

-- CreateIndex
CREATE INDEX "talent_status_idx" ON "talent"("status");

-- CreateIndex
CREATE INDEX "identity_mapping_talent_id_idx" ON "identity_mapping"("talent_id");

-- CreateIndex
CREATE INDEX "identity_mapping_system_external_id_idx" ON "identity_mapping"("system", "external_id");

-- CreateIndex
CREATE INDEX "talent_project_talent_id_idx" ON "talent_project"("talent_id");

-- CreateIndex
CREATE INDEX "talent_project_project_id_idx" ON "talent_project"("project_id");

-- CreateIndex
CREATE INDEX "ingestion_run_source_period_idx" ON "ingestion_run"("source", "period");

-- CreateIndex
CREATE INDEX "ingestion_run_started_at_idx" ON "ingestion_run"("started_at");

-- CreateIndex
CREATE INDEX "data_quality_flag_ingestion_run_id_idx" ON "data_quality_flag"("ingestion_run_id");

-- CreateIndex
CREATE INDEX "utilization_record_period_idx" ON "utilization_record"("period");

-- CreateIndex
CREATE UNIQUE INDEX "utilization_record_talent_id_period_key" ON "utilization_record"("talent_id", "period");

-- CreateIndex
CREATE INDEX "delivery_record_period_idx" ON "delivery_record"("period");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_record_talent_id_period_key" ON "delivery_record"("talent_id", "period");

-- CreateIndex
CREATE INDEX "cost_rate_scope_ref_id_idx" ON "cost_rate"("scope", "ref_id");

-- CreateIndex
CREATE INDEX "budget_burn_period_idx" ON "budget_burn"("period");

-- CreateIndex
CREATE UNIQUE INDEX "budget_burn_talent_id_period_key" ON "budget_burn"("talent_id", "period");

-- CreateIndex
CREATE INDEX "lead_assessment_talent_id_period_idx" ON "lead_assessment"("talent_id", "period");

-- CreateIndex
CREATE INDEX "lead_assessment_period_idx" ON "lead_assessment"("period");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_config_version_key" ON "scoring_config"("version");

-- CreateIndex
CREATE INDEX "performance_score_period_flag_idx" ON "performance_score"("period", "flag");

-- CreateIndex
CREATE UNIQUE INDEX "performance_score_talent_id_period_key" ON "performance_score"("talent_id", "period");

-- CreateIndex
CREATE INDEX "insight_talent_id_period_idx" ON "insight"("talent_id", "period");

-- CreateIndex
CREATE INDEX "insight_period_status_idx" ON "insight"("period", "status");

-- CreateIndex
CREATE INDEX "monthly_report_period_status_idx" ON "monthly_report"("period", "status");

-- CreateIndex
CREATE INDEX "report_item_monthly_report_id_idx" ON "report_item"("monthly_report_id");

-- CreateIndex
CREATE INDEX "approval_subject_id_idx" ON "approval"("subject_id");

-- CreateIndex
CREATE INDEX "job_type_status_idx" ON "job"("type", "status");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_idx" ON "audit_log"("entity_type");

-- CreateIndex
CREATE INDEX "audit_log_actor_user_id_idx" ON "audit_log"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "source_setting_source_key" ON "source_setting"("source");
