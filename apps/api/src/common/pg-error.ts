/** Drizzle wraps driver errors; the pg error (code, constraint) is on `cause`. */
export function isUniqueViolation(e: unknown, constraint: string): boolean {
  const err = ((e as { cause?: unknown }).cause ?? e) as { code?: string; constraint?: string };
  return err.code === '23505' && err.constraint === constraint;
}
