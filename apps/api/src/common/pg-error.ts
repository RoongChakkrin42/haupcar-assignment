type PgError = { code?: string; constraint?: string };

/** Drizzle wraps driver errors; the pg error (code, constraint) is on `cause`. */
export function pgErrorOf(e: unknown): PgError {
  return ((e as { cause?: unknown }).cause ?? e) as PgError;
}

export function isUniqueViolation(e: unknown, constraint: string): boolean {
  const err = pgErrorOf(e);
  return err.code === '23505' && err.constraint === constraint;
}
