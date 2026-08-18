/**
 * Loads the org work-hour schedule from SourceSetting (source="schedule").
 * Falls back to DEFAULT_SCHEDULE when unset. Used by Clockify ingest + /overtime.
 */
import { prisma } from "./db";
import { DEFAULT_SCHEDULE } from "../overtime";
import type { Schedule } from "../contract/types";

export async function loadSchedule(): Promise<Schedule> {
  const row = await prisma.sourceSetting.findUnique({ where: { source: "schedule" } });
  const cfg = (row?.config as Partial<Schedule> | undefined) ?? {};
  return {
    work_start: cfg.work_start || DEFAULT_SCHEDULE.work_start,
    work_end: cfg.work_end || DEFAULT_SCHEDULE.work_end,
    timezone: cfg.timezone || DEFAULT_SCHEDULE.timezone,
    workdays: cfg.workdays?.length ? cfg.workdays : DEFAULT_SCHEDULE.workdays,
  };
}
