import type { OpLogCategory } from "$lib/types";

const VALID_CATEGORIES = new Set<OpLogCategory>([
  "recon",
  "initial-access",
  "exploitation",
  "post-exploitation",
  "lateral-movement",
  "privilege-escalation",
  "exfiltration",
  "cleanup",
  "other",
]);

const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const ISO_DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

type ValidationSuccess<T> = {
  ok: true;
  data: T;
};

type ValidationFailure = {
  ok: false;
  error: string;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

function success<T>(data: T): ValidationSuccess<T> {
  return { ok: true, data };
}

type JsonObject = Record<string, unknown>;

export type OpLogCreateBody = {
  category: OpLogCategory;
  description: string;
  hostId: string | null;
  timestamp: string;
};

export type OpLogPatchBody = {
  category?: OpLogCategory;
  description?: string;
  hostId?: string | null;
  timestamp?: string;
};

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unknownFieldError(
  body: JsonObject,
  allowedKeys: readonly string[],
): ValidationFailure | null {
  for (const key of Object.keys(body)) {
    if (!allowedKeys.includes(key)) {
      return { ok: false, error: `Unknown field: ${key}` };
    }
  }

  return null;
}

function parseCategory(value: unknown): ValidationResult<OpLogCategory> {
  if (
    typeof value !== "string" ||
    !VALID_CATEGORIES.has(value as OpLogCategory)
  ) {
    return {
      ok: false,
      error: "category must be a valid operation log category",
    };
  }

  return { ok: true, data: value as OpLogCategory };
}

function parseDescription(value: unknown): ValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "description is required" };
  }

  const description = value.trim();
  if (!description) {
    return { ok: false, error: "description is required" };
  }

  return { ok: true, data: description };
}

function parseHostId(value: unknown): ValidationResult<string | null> {
  if (value === null) {
    return { ok: true, data: null };
  }

  if (typeof value !== "string") {
    return { ok: false, error: "host_id must be a string or null" };
  }

  const hostId = value.trim();
  if (!hostId) {
    return { ok: false, error: "host_id must be a non-empty string or null" };
  }

  if (!SAFE_ID_PATTERN.test(hostId)) {
    return { ok: false, error: "host_id must be a valid identifier" };
  }

  return { ok: true, data: hostId };
}

function parseIsoTimestamp(value: unknown): ValidationResult<string> {
  if (typeof value !== "string" || !ISO_DATETIME_PATTERN.test(value)) {
    return { ok: false, error: "timestamp must be a valid ISO datetime" };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, error: "timestamp must be a valid ISO datetime" };
  }

  return { ok: true, data: parsed.toISOString() };
}

export function parseRouteId(
  value: string | undefined,
  label: string,
): ValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: `Invalid ${label}` };
  }

  const trimmed = value.trim();
  if (!trimmed || !SAFE_ID_PATTERN.test(trimmed)) {
    return { ok: false, error: `Invalid ${label}` };
  }

  return { ok: true, data: trimmed };
}

export function parseOpLogCreateBody(
  value: unknown,
): ValidationResult<OpLogCreateBody> {
  if (!isJsonObject(value)) {
    return { ok: false, error: "Body must be a JSON object" };
  }

  const unknownField = unknownFieldError(value, [
    "category",
    "description",
    "host_id",
    "timestamp",
  ]);
  if (unknownField) {
    return unknownField;
  }

  const category =
    value.category === undefined
      ? success<OpLogCategory>("other")
      : parseCategory(value.category);
  if (!category.ok) {
    return category;
  }

  const description = parseDescription(value.description);
  if (!description.ok) {
    return description;
  }

  const hostId =
    value.host_id === undefined
      ? success<string | null>(null)
      : parseHostId(value.host_id);
  if (!hostId.ok) {
    return hostId;
  }

  const timestamp = parseIsoTimestamp(value.timestamp);
  if (!timestamp.ok) {
    return timestamp;
  }

  return {
    ok: true,
    data: {
      category: category.data,
      description: description.data,
      hostId: hostId.data,
      timestamp: timestamp.data,
    },
  };
}

export function parseOpLogPatchBody(
  value: unknown,
): ValidationResult<OpLogPatchBody> {
  if (!isJsonObject(value)) {
    return { ok: false, error: "Body must be a JSON object" };
  }

  const unknownField = unknownFieldError(value, [
    "category",
    "description",
    "host_id",
    "timestamp",
  ]);
  if (unknownField) {
    return unknownField;
  }

  if (Object.keys(value).length === 0) {
    return { ok: false, error: "At least one field is required" };
  }

  const patch: OpLogPatchBody = {};

  if ("category" in value) {
    const category = parseCategory(value.category);
    if (!category.ok) {
      return category;
    }
    patch.category = category.data;
  }

  if ("description" in value) {
    const description = parseDescription(value.description);
    if (!description.ok) {
      return description;
    }
    patch.description = description.data;
  }

  if ("host_id" in value) {
    const hostId = parseHostId(value.host_id);
    if (!hostId.ok) {
      return hostId;
    }
    patch.hostId = hostId.data;
  }

  if ("timestamp" in value) {
    const timestamp = parseIsoTimestamp(value.timestamp);
    if (!timestamp.ok) {
      return timestamp;
    }
    patch.timestamp = timestamp.data;
  }

  return { ok: true, data: patch };
}
