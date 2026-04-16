/**
 * Recurrence utilities shared between CreateEvent and EventDetail.
 */

export type RecurrenceType = "none" | "weekly" | "biweekly" | "monthly";
export type MonthlyMode = "same_date" | "same_day";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDINALS = ["", "first", "second", "third", "fourth", "fifth"];

/** How many times has `d`'s day-of-week occurred so far this month (1-based). */
export function weekOfMonth(d: Date): number {
  const dow = d.getDay();
  let count = 0;
  const cur = new Date(d.getFullYear(), d.getMonth(), 1);
  while (cur <= d) {
    if (cur.getDay() === dow) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** Build the recurrence_rule JSON stored in the DB. */
export function buildRecurrenceRule(
  date: Date,
  type: RecurrenceType,
  monthlyMode: MonthlyMode
): object | null {
  if (type === "none") return null;
  if (type === "weekly") return { day_of_week: date.getDay(), interval: 1 };
  if (type === "biweekly") return { day_of_week: date.getDay(), interval: 2 };
  if (type === "monthly") {
    if (monthlyMode === "same_date") {
      return { day_of_month: date.getDate() };
    }
    return { week_of_month: weekOfMonth(date), day_of_week: date.getDay() };
  }
  return null;
}

/** Map the UI RecurrenceType to the DB column string. */
export function getRecurrenceDbType(
  type: RecurrenceType,
  monthlyMode: MonthlyMode
): string {
  if (type === "none") return "none";
  if (type === "weekly") return "weekly";
  if (type === "biweekly") return "biweekly";
  if (type === "monthly") {
    return monthlyMode === "same_date" ? "monthly_date" : "monthly_day_of_week";
  }
  return "none";
}

/** Human-readable description built from the picker's current state. */
export function describeRecurrence(
  date: Date,
  type: RecurrenceType,
  monthlyMode: MonthlyMode
): string {
  if (type === "none") return "";
  const dayName = DAY_NAMES[date.getDay()];
  if (type === "weekly") return `Every ${dayName}`;
  if (type === "biweekly") return `Every other ${dayName}`;
  if (type === "monthly") {
    if (monthlyMode === "same_date") {
      const d = date.getDate();
      const sfx = d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th";
      return `${d}${sfx} of every month`;
    }
    const wom = weekOfMonth(date);
    const ord = ORDINALS[wom] ?? `${wom}th`;
    return `${ord.charAt(0).toUpperCase()}${ord.slice(1)} ${dayName} of every month`;
  }
  return "";
}

/** Human-readable description built from stored DB values (for display). */
export function describeStoredRecurrence(
  recurrenceType: string | null | undefined,
  recurrenceRule: any
): string {
  if (!recurrenceType || recurrenceType === "none") return "";

  if (recurrenceType === "weekly") {
    const dow = recurrenceRule?.day_of_week;
    return `Every ${dow != null ? DAY_NAMES[dow] : "week"}`;
  }
  if (recurrenceType === "biweekly") {
    const dow = recurrenceRule?.day_of_week;
    return `Every other ${dow != null ? DAY_NAMES[dow] : "two weeks"}`;
  }
  if (recurrenceType === "monthly_date") {
    const dom = recurrenceRule?.day_of_month;
    if (dom == null) return "Monthly";
    const sfx = dom === 1 ? "st" : dom === 2 ? "nd" : dom === 3 ? "rd" : "th";
    return `${dom}${sfx} of every month`;
  }
  if (recurrenceType === "monthly_day_of_week") {
    const dow = recurrenceRule?.day_of_week;
    const wom = recurrenceRule?.week_of_month;
    if (dow == null || wom == null) return "Monthly";
    const ord = ORDINALS[wom] ?? `${wom}th`;
    return `${ord.charAt(0).toUpperCase()}${ord.slice(1)} ${DAY_NAMES[dow]} of every month`;
  }
  return "";
}

/** Compute the next `count` occurrences after `date` (not including `date` itself). */
export function computePreviewDates(
  date: Date,
  type: RecurrenceType,
  monthlyMode: MonthlyMode,
  endDate?: Date,
  count = 3
): Date[] {
  if (type === "none") return [];
  const results: Date[] = [];
  const MAX = 200;
  let iter = 0;

  if (type === "weekly" || type === "biweekly") {
    const step = type === "weekly" ? 7 : 14;
    const cur = new Date(date);
    cur.setDate(cur.getDate() + step);
    while (results.length < count && iter++ < MAX) {
      if (endDate && cur > endDate) break;
      results.push(new Date(cur));
      cur.setDate(cur.getDate() + step);
    }
    return results;
  }

  if (type === "monthly") {
    let m = date.getMonth() + 1;
    let y = date.getFullYear();
    if (m > 11) { m = 0; y++; }

    if (monthlyMode === "same_date") {
      const dom = date.getDate();
      while (results.length < count && iter++ < MAX) {
        const daysInM = new Date(y, m + 1, 0).getDate();
        const candidate = new Date(y, m, Math.min(dom, daysInM), date.getHours(), date.getMinutes());
        if (endDate && candidate > endDate) break;
        results.push(candidate);
        if (++m > 11) { m = 0; y++; }
      }
    } else {
      const dow = date.getDay();
      const wom = weekOfMonth(date);
      while (results.length < count && iter++ < MAX) {
        const firstOfM = new Date(y, m, 1);
        // Find first occurrence of dow in this month
        const firstDow = new Date(firstOfM);
        while (firstDow.getDay() !== dow) firstDow.setDate(firstDow.getDate() + 1);
        // Advance to nth occurrence
        const candidate = new Date(firstDow);
        candidate.setDate(firstDow.getDate() + (wom - 1) * 7);
        candidate.setHours(date.getHours(), date.getMinutes());
        // Must still be in the target month
        if (candidate.getMonth() === m) {
          if (endDate && candidate > endDate) break;
          results.push(candidate);
        }
        if (++m > 11) { m = 0; y++; }
      }
    }
  }

  return results;
}
