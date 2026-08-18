/**
 * Reporting-period helpers.
 *
 * The default reporting period is generated at request time and passed into
 * client components as a snapshot. Users can choose any month within the
 * current year through 10 years back.
 */
export const REPORTING_TIME_ZONE = "Asia/Jakarta";
export const REPORTING_YEAR_LOOKBACK = 10;

export function isPeriod(value: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function getReportingYearOptions(currentPeriod: string): string[] {
  const year = Number(currentPeriod.slice(0, 4));
  if (!year) return [];
  return Array.from({ length: REPORTING_YEAR_LOOKBACK + 1 }, (_, i) => String(year - i));
}

export function isSelectablePeriod(value: string, currentPeriod: string): boolean {
  return isPeriod(value) && getReportingYearOptions(currentPeriod).includes(value.slice(0, 4));
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function periodParts(referenceDate: Date, timeZone: string): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(referenceDate);

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);

  if (!year || !month) {
    throw new Error(`Could not derive reporting period for timezone ${timeZone}.`);
  }

  return { year, month };
}

export function getCurrentPeriod(referenceDate = new Date(), timeZone = REPORTING_TIME_ZONE): string {
  const { year, month } = periodParts(referenceDate, timeZone);
  return `${year}-${pad2(month)}`;
}

