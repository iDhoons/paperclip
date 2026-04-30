import type {
  CompanyPortabilityIssueManifestEntry,
  CompanyPortabilityIssueRoutineManifestEntry,
  CompanyPortabilityIssueRoutineTriggerManifestEntry,
} from "@paperclipai/shared";
import {
  ROUTINE_CATCH_UP_POLICIES,
  ROUTINE_CONCURRENCY_POLICIES,
  ROUTINE_TRIGGER_KINDS,
  ROUTINE_TRIGGER_SIGNING_MODES,
} from "@paperclipai/shared";
import { validateCron } from "./cron.js";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}
const WEEKDAY_TO_CRON: Record<string, string> = {
  sunday: "0",
  monday: "1",
  tuesday: "2",
  wednesday: "3",
  thursday: "4",
  friday: "5",
  saturday: "6",
};

function readZonedDateParts(startsAt: string, timeZone: string) {
  try {
    const date = new Date(startsAt);
    if (Number.isNaN(date.getTime())) return null;
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      weekday: "long",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
    const parts = Object.fromEntries(
      formatter
        .formatToParts(date)
        .filter((entry) => entry.type !== "literal")
        .map((entry) => [entry.type, entry.value]),
    ) as Record<string, string>;
    const weekday = WEEKDAY_TO_CRON[parts.weekday?.toLowerCase() ?? ""];
    const month = Number(parts.month);
    const day = Number(parts.day);
    const hour = Number(parts.hour);
    const minute = Number(parts.minute);
    if (!weekday || !Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(hour) || !Number.isFinite(minute)) {
      return null;
    }
    return { weekday, month, day, hour, minute };
  } catch {
    return null;
  }
}

function normalizeCronList(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => Number(left) - Number(right)).join(",");
}

function buildLegacyRoutineTriggerFromRecurrence(
  issue: Pick<CompanyPortabilityIssueManifestEntry, "slug" | "legacyRecurrence">,
  scheduleValue: unknown,
) {
  const warnings: string[] = [];
  const errors: string[] = [];
  if (!issue.legacyRecurrence || !isPlainRecord(issue.legacyRecurrence)) {
    return { trigger: null, warnings, errors };
  }

  const schedule = isPlainRecord(scheduleValue) ? scheduleValue : null;
  const frequency = asString(issue.legacyRecurrence.frequency);
  const interval = asInteger(issue.legacyRecurrence.interval) ?? 1;
  if (!frequency) {
    errors.push(`Recurring task ${issue.slug} uses legacy recurrence without frequency; add .paperclip.yaml routines.${issue.slug}.triggers.`);
    return { trigger: null, warnings, errors };
  }
  if (interval < 1) {
    errors.push(`Recurring task ${issue.slug} uses legacy recurrence with an invalid interval; add .paperclip.yaml routines.${issue.slug}.triggers.`);
    return { trigger: null, warnings, errors };
  }

  const timezone = asString(schedule?.timezone) ?? "UTC";
  const startsAt = asString(schedule?.startsAt);
  const zonedStartsAt = startsAt ? readZonedDateParts(startsAt, timezone) : null;
  if (startsAt && !zonedStartsAt) {
    errors.push(`Recurring task ${issue.slug} has an invalid legacy startsAt/timezone combination; add .paperclip.yaml routines.${issue.slug}.triggers.`);
    return { trigger: null, warnings, errors };
  }

  const time = isPlainRecord(issue.legacyRecurrence.time) ? issue.legacyRecurrence.time : null;
  const hour = asInteger(time?.hour) ?? zonedStartsAt?.hour ?? 0;
  const minute = asInteger(time?.minute) ?? zonedStartsAt?.minute ?? 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    errors.push(`Recurring task ${issue.slug} uses legacy recurrence with an invalid time; add .paperclip.yaml routines.${issue.slug}.triggers.`);
    return { trigger: null, warnings, errors };
  }

  if (issue.legacyRecurrence.until != null || issue.legacyRecurrence.count != null) {
    warnings.push(`Recurring task ${issue.slug} uses legacy recurrence end bounds; Paperclip will import the routine trigger without those limits.`);
  }

  let cronExpression: string | null = null;

  if (frequency === "hourly") {
    const hourField = interval === 1
      ? "*"
      : zonedStartsAt
        ? `${zonedStartsAt.hour}-23/${interval}`
        : `*/${interval}`;
    cronExpression = `${minute} ${hourField} * * *`;
  } else if (frequency === "daily") {
    if (Array.isArray(issue.legacyRecurrence.weekdays) || Array.isArray(issue.legacyRecurrence.monthDays) || Array.isArray(issue.legacyRecurrence.months)) {
      errors.push(`Recurring task ${issue.slug} uses unsupported legacy daily recurrence constraints; add .paperclip.yaml routines.${issue.slug}.triggers.`);
      return { trigger: null, warnings, errors };
    }
    const dayField = interval === 1 ? "*" : `*/${interval}`;
    cronExpression = `${minute} ${hour} ${dayField} * *`;
  } else if (frequency === "weekly") {
    if (interval !== 1) {
      errors.push(`Recurring task ${issue.slug} uses legacy weekly recurrence with interval > 1; add .paperclip.yaml routines.${issue.slug}.triggers.`);
      return { trigger: null, warnings, errors };
    }
    const weekdays = Array.isArray(issue.legacyRecurrence.weekdays)
      ? issue.legacyRecurrence.weekdays
        .map((entry) => asString(entry))
        .filter((entry): entry is string => Boolean(entry))
      : [];
    const cronWeekdays = weekdays
      .map((entry) => WEEKDAY_TO_CRON[entry.toLowerCase()])
      .filter((entry): entry is string => Boolean(entry));
    if (cronWeekdays.length === 0 && zonedStartsAt?.weekday) {
      cronWeekdays.push(zonedStartsAt.weekday);
    }
    if (cronWeekdays.length === 0) {
      errors.push(`Recurring task ${issue.slug} uses legacy weekly recurrence without weekdays; add .paperclip.yaml routines.${issue.slug}.triggers.`);
      return { trigger: null, warnings, errors };
    }
    cronExpression = `${minute} ${hour} * * ${normalizeCronList(cronWeekdays)}`;
  } else if (frequency === "monthly") {
    if (interval !== 1) {
      errors.push(`Recurring task ${issue.slug} uses legacy monthly recurrence with interval > 1; add .paperclip.yaml routines.${issue.slug}.triggers.`);
      return { trigger: null, warnings, errors };
    }
    if (Array.isArray(issue.legacyRecurrence.ordinalWeekdays) && issue.legacyRecurrence.ordinalWeekdays.length > 0) {
      errors.push(`Recurring task ${issue.slug} uses legacy ordinal monthly recurrence; add .paperclip.yaml routines.${issue.slug}.triggers.`);
      return { trigger: null, warnings, errors };
    }
    const monthDays = Array.isArray(issue.legacyRecurrence.monthDays)
      ? issue.legacyRecurrence.monthDays
        .map((entry) => asInteger(entry))
        .filter((entry): entry is number => entry != null && entry >= 1 && entry <= 31)
      : [];
    if (monthDays.length === 0 && zonedStartsAt?.day) {
      monthDays.push(zonedStartsAt.day);
    }
    if (monthDays.length === 0) {
      errors.push(`Recurring task ${issue.slug} uses legacy monthly recurrence without monthDays; add .paperclip.yaml routines.${issue.slug}.triggers.`);
      return { trigger: null, warnings, errors };
    }
    const months = Array.isArray(issue.legacyRecurrence.months)
      ? issue.legacyRecurrence.months
        .map((entry) => asInteger(entry))
        .filter((entry): entry is number => entry != null && entry >= 1 && entry <= 12)
      : [];
    const monthField = months.length > 0 ? normalizeCronList(months.map(String)) : "*";
    cronExpression = `${minute} ${hour} ${normalizeCronList(monthDays.map(String))} ${monthField} *`;
  } else if (frequency === "yearly") {
    if (interval !== 1) {
      errors.push(`Recurring task ${issue.slug} uses legacy yearly recurrence with interval > 1; add .paperclip.yaml routines.${issue.slug}.triggers.`);
      return { trigger: null, warnings, errors };
    }
    const months = Array.isArray(issue.legacyRecurrence.months)
      ? issue.legacyRecurrence.months
        .map((entry) => asInteger(entry))
        .filter((entry): entry is number => entry != null && entry >= 1 && entry <= 12)
      : [];
    if (months.length === 0 && zonedStartsAt?.month) {
      months.push(zonedStartsAt.month);
    }
    const monthDays = Array.isArray(issue.legacyRecurrence.monthDays)
      ? issue.legacyRecurrence.monthDays
        .map((entry) => asInteger(entry))
        .filter((entry): entry is number => entry != null && entry >= 1 && entry <= 31)
      : [];
    if (monthDays.length === 0 && zonedStartsAt?.day) {
      monthDays.push(zonedStartsAt.day);
    }
    if (months.length === 0 || monthDays.length === 0) {
      errors.push(`Recurring task ${issue.slug} uses legacy yearly recurrence without month/monthDay anchors; add .paperclip.yaml routines.${issue.slug}.triggers.`);
      return { trigger: null, warnings, errors };
    }
    cronExpression = `${minute} ${hour} ${normalizeCronList(monthDays.map(String))} ${normalizeCronList(months.map(String))} *`;
  } else {
    errors.push(`Recurring task ${issue.slug} uses unsupported legacy recurrence frequency "${frequency}"; add .paperclip.yaml routines.${issue.slug}.triggers.`);
    return { trigger: null, warnings, errors };
  }

  return {
    trigger: {
      kind: "schedule",
      label: "Migrated legacy recurrence",
      enabled: true,
      cronExpression,
      timezone,
      signingMode: null,
      replayWindowSec: null,
    } satisfies CompanyPortabilityIssueRoutineTriggerManifestEntry,
    warnings,
    errors,
  };
}

export function resolvePortableRoutineDefinition(
  issue: Pick<CompanyPortabilityIssueManifestEntry, "slug" | "recurring" | "routine" | "legacyRecurrence">,
  scheduleValue: unknown,
) {
  const warnings: string[] = [];
  const errors: string[] = [];
  if (!issue.recurring) {
    return { routine: null, warnings, errors };
  }

  const routine = issue.routine
    ? {
      concurrencyPolicy: issue.routine.concurrencyPolicy,
      catchUpPolicy: issue.routine.catchUpPolicy,
      variables: issue.routine.variables ?? null,
      triggers: [...issue.routine.triggers],
    }
    : {
      concurrencyPolicy: null,
      catchUpPolicy: null,
      variables: null,
      triggers: [] as CompanyPortabilityIssueRoutineTriggerManifestEntry[],
    };

  // biome-ignore lint/suspicious/noExplicitAny: existing code, suppress for CI promotion
  if (routine.concurrencyPolicy && !ROUTINE_CONCURRENCY_POLICIES.includes(routine.concurrencyPolicy as any)) {
    errors.push(`Recurring task ${issue.slug} uses unsupported routine concurrencyPolicy "${routine.concurrencyPolicy}".`);
  }
  // biome-ignore lint/suspicious/noExplicitAny: existing code, suppress for CI promotion
  if (routine.catchUpPolicy && !ROUTINE_CATCH_UP_POLICIES.includes(routine.catchUpPolicy as any)) {
    errors.push(`Recurring task ${issue.slug} uses unsupported routine catchUpPolicy "${routine.catchUpPolicy}".`);
  }

  for (const trigger of routine.triggers) {
    // biome-ignore lint/suspicious/noExplicitAny: existing code, suppress for CI promotion
    if (!ROUTINE_TRIGGER_KINDS.includes(trigger.kind as any)) {
      errors.push(`Recurring task ${issue.slug} uses unsupported trigger kind "${trigger.kind}".`);
      continue;
    }
    if (trigger.kind === "schedule") {
      if (!trigger.cronExpression || !trigger.timezone) {
        errors.push(`Recurring task ${issue.slug} has a schedule trigger missing cronExpression/timezone.`);
        continue;
      }
      const cronError = validateCron(trigger.cronExpression);
      if (cronError) {
        errors.push(`Recurring task ${issue.slug} has an invalid schedule trigger: ${cronError}`);
      }
      continue;
    }
    // biome-ignore lint/suspicious/noExplicitAny: existing code, suppress for CI promotion
    if (trigger.kind === "webhook" && trigger.signingMode && !ROUTINE_TRIGGER_SIGNING_MODES.includes(trigger.signingMode as any)) {
      errors.push(`Recurring task ${issue.slug} uses unsupported webhook signingMode "${trigger.signingMode}".`);
    }
  }

  if (routine.triggers.length === 0 && issue.legacyRecurrence) {
    const migrated = buildLegacyRoutineTriggerFromRecurrence(issue, scheduleValue);
    warnings.push(...migrated.warnings);
    errors.push(...migrated.errors);
    if (migrated.trigger) {
      routine.triggers.push(migrated.trigger);
    }
  }

  return { routine, warnings, errors };
}
