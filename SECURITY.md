# Security & privacy checklist

Status of the demo against the OWASP Top 10 (2021) and Thailand's PDPA. "Tested" means an
automated test fails if the protection is removed.

## OWASP Top 10

| Risk                             | What protects it                                                                                                                                                                                                                                                                                                                            | Where                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| A01 Broken access control (IDOR) | Every owner query goes through `ownedBy(ownerId)`; another owner's vehicle is a 404, never a 403. Admin routes need `@Roles('admin')`, enforced by a global `RolesGuard`. All routes need a JWT unless `@Public()`. Tested (mutation-checked).                                                                                              | `vehicles.service.ts`, `roles.guard.ts`, `jwt-auth.guard.ts` |
| A01 Mass assignment              | Zod strips unknown keys; `ownerId`, `status`, `role` can't be set by clients. Tested.                                                                                                                                                                                                                                                       | `packages/shared`                                            |
| A02 Cryptographic failures       | bcrypt password hashes; HMAC-SHA256 signed, expiring file URLs compared in constant time; secrets only from env.                                                                                                                                                                                                                            | `password.ts`, `file-storage.ts`                             |
| A03 Injection                    | Drizzle parameterised queries only; no string-built SQL with user input.                                                                                                                                                                                                                                                                    | —                                                            |
| A04 Insecure design              | Optimistic locking (`version`) so stale edits/approvals get 409; status changes only via one transition table. Tested.                                                                                                                                                                                                                      | `vehicle-status.ts`                                          |
| A05 Misconfiguration             | nginx: CSP on the SPA, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, no server version. API not exposed outside Docker. CORS not enabled (same origin via proxy).                                                                                                                                            | `docker/nginx.conf`                                          |
| A06 Vulnerable components        | Lockfile pinned; CI installs with `--frozen-lockfile`. **Not done:** automated dependency/CVE scanning (Dependabot/Renovate).                                                                                                                                                                                                               | `.github/workflows/ci.yml`                                   |
| A07 Authentication failures      | Same 401 for unknown email and wrong password, with equal timing; login/register limited to 10/min per client IP (429 + `Retry-After`); `trust proxy` only for private addresses so `X-Forwarded-For` can't be spoofed from outside. Tested. **Not done:** email verification, password reset, refresh tokens/revocation (JWT lives 1 day). | `auth.*`, `setup-app.ts`                                     |
| A08 Integrity failures           | Uploads are sniffed from bytes and images re-encoded, never trusted by name/mimetype. Tested.                                                                                                                                                                                                                                               | `files/uploads.ts`                                           |
| A09 Logging & monitoring         | One JSON line per request (request id, method, path, status, duration, IP) with no query strings, headers or bodies — so no tokens, signatures or personal data. Same request id in nginx and API. Tested. **Not done:** error tracking (Sentry) and uptime monitoring — need a deployed URL/account.                                       | `common/request-logging.ts`                                  |
| A10 SSRF                         | The API makes no outbound requests from user input.                                                                                                                                                                                                                                                                                         | —                                                            |

## PDPA (personal data)

| Requirement                | Status                                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Collect only what's needed | Name, email, optional phone; vehicle documents only for verification.                                                                        |
| Restrict access            | Documents and owner contact visible only to that owner and admins; files behind signed, expiring URLs.                                       |
| Location privacy           | EXIF (incl. GPS) stripped from every uploaded image. Tested.                                                                                 |
| Don't leak via logs        | Logs carry no emails, tokens or file signatures. Tested.                                                                                     |
| Right to erasure           | **Not done.** Needs an account-deletion flow that removes the user, their documents and files (vehicles are soft-deleted today, files kept). |
| Privacy notice & consent   | **Not done.** Needs a privacy policy and consent at sign-up.                                                                                 |
| Retention                  | **Not done.** No policy yet for deleting files of soft-deleted vehicles.                                                                     |

## Before a real launch

- Rotate `JWT_SECRET` / `FILE_SIGNING_SECRET` to long random values from a secret manager.
- Move uploads from local disk to private object storage (S3/R2); see the `ponytail:` note in `file-storage.ts`.
- HTTPS termination in front of nginx (and `Strict-Transport-Security`).
- Add the items marked **Not done** above.
