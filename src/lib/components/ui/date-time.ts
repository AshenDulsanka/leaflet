export type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export type CalendarDay = {
  key: string;
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  ariaLabel: string;
};

const LOCAL_VALUE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function padNumber(value: number): string {
  return String(value).padStart(2, "0");
}

export function dateKeyFromParts(
  parts: Pick<DateParts, "year" | "month" | "day">,
): string {
  return `${parts.year}-${padNumber(parts.month)}-${padNumber(parts.day)}`;
}

export function formatDateTimeValue(parts: DateParts): string {
  return `${dateKeyFromParts(parts)}T${padNumber(parts.hour)}:${padNumber(parts.minute)}`;
}

function buildDate(parts: DateParts): Date {
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    0,
    0,
  );
}

function isValidParts(parts: DateParts): boolean {
  const candidate = buildDate(parts);

  return (
    candidate.getFullYear() === parts.year &&
    candidate.getMonth() === parts.month - 1 &&
    candidate.getDate() === parts.day &&
    candidate.getHours() === parts.hour &&
    candidate.getMinutes() === parts.minute
  );
}

function partsFromDate(date: Date): DateParts {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

export function parseDateTimeValue(value: string): DateParts | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const localMatch = trimmedValue.match(LOCAL_VALUE_PATTERN);
  if (localMatch) {
    const parsed = {
      year: Number(localMatch[1]),
      month: Number(localMatch[2]),
      day: Number(localMatch[3]),
      hour: Number(localMatch[4]),
      minute: Number(localMatch[5]),
    } satisfies DateParts;

    return isValidParts(parsed) ? parsed : null;
  }

  const parsedDate = new Date(trimmedValue);
  if (Number.isNaN(parsedDate.getTime())) return null;

  return partsFromDate(parsedDate);
}

export function localDateTimeValue(date: Date = new Date()): string {
  return formatDateTimeValue(partsFromDate(date));
}

export function toLocalDateTimeValue(
  value: string | Date | null | undefined,
): string {
  if (value instanceof Date) return localDateTimeValue(value);
  if (!value) return "";

  const parsed = parseDateTimeValue(value);
  return parsed ? formatDateTimeValue(parsed) : "";
}

function splitDateKey(
  dateKey: string,
): Pick<DateParts, "year" | "month" | "day"> | null {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const parsed = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };

  const candidate = new Date(parsed.year, parsed.month - 1, parsed.day);
  const isValid =
    candidate.getFullYear() === parsed.year &&
    candidate.getMonth() === parsed.month - 1 &&
    candidate.getDate() === parsed.day;

  return isValid ? parsed : null;
}

function fallbackParts(fallback: Date): DateParts {
  return partsFromDate(fallback);
}

export function selectedDateKey(value: string): string | null {
  const parsed = parseDateTimeValue(value);
  return parsed ? dateKeyFromParts(parsed) : null;
}

export function monthAnchorFromValue(
  value: string,
  fallback: Date = new Date(),
): Date {
  const parsed = parseDateTimeValue(value) ?? fallbackParts(fallback);
  return new Date(parsed.year, parsed.month - 1, 1);
}

export function monthLabel(anchor: Date): string {
  return anchor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function gridStart(anchor: Date): Date {
  const firstDayOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const mondayOffset = (firstDayOfMonth.getDay() + 6) % 7;
  firstDayOfMonth.setDate(firstDayOfMonth.getDate() - mondayOffset);
  return firstDayOfMonth;
}

export function buildCalendarDays(
  anchor: Date,
  selectedKey: string | null,
  today: Date = new Date(),
): CalendarDay[] {
  const currentMonth = anchor.getMonth();
  const firstVisibleDay = gridStart(anchor);
  const todayKey = dateKeyFromParts(partsFromDate(today));

  return Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(firstVisibleDay);
    cellDate.setDate(firstVisibleDay.getDate() + index);

    const dateParts = partsFromDate(cellDate);
    const dateKey = dateKeyFromParts(dateParts);

    return {
      key: `${dateKey}-${index}`,
      dateKey,
      dayNumber: dateParts.day,
      inCurrentMonth: cellDate.getMonth() === currentMonth,
      isSelected: selectedKey === dateKey,
      isToday: todayKey === dateKey,
      ariaLabel: DATE_LABEL_FORMATTER.format(cellDate),
    } satisfies CalendarDay;
  });
}

export function withSelectedDate(
  currentValue: string,
  dateKey: string,
  fallback: Date = new Date(),
): string {
  const nextDate = splitDateKey(dateKey);
  if (!nextDate) return currentValue;

  const currentParts =
    parseDateTimeValue(currentValue) ?? fallbackParts(fallback);

  return formatDateTimeValue({
    ...currentParts,
    ...nextDate,
  });
}

export function withSelectedTime(
  currentValue: string,
  hour: number,
  minute: number,
  fallback: Date = new Date(),
): string {
  const currentParts =
    parseDateTimeValue(currentValue) ?? fallbackParts(fallback);

  return formatDateTimeValue({
    ...currentParts,
    hour,
    minute,
  });
}
