import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { requireEnv } from '../common/env.js';

export type StoredExt = 'webp' | 'pdf';

const KEY_PATTERN = /^[0-9a-f-]{36}\.(webp|pdf)$/;
const BUCKET_MS = 15 * 60 * 1000;
const URL_TTL_MS = 60 * 60 * 1000;

/**
 * Private file storage on local disk, read back through short-lived signed URLs
 * (same model as S3 presigned GETs, so <img src> works without a bearer token).
 * ponytail: local disk only works with a single API instance; swap this class for S3/R2 when scaling out.
 */
@Injectable()
export class FileStorage {
  private readonly dir = resolve(process.env.UPLOAD_DIR ?? 'uploads');
  private readonly secret = requireEnv('FILE_SIGNING_SECRET');

  async save(data: Buffer, ext: StoredExt): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    const key = `${randomUUID()}.${ext}`;
    await writeFile(join(this.dir, key), data, { flag: 'wx' });
    return key;
  }

  async remove(key: string) {
    if (KEY_PATTERN.test(key)) await rm(join(this.dir, key), { force: true });
  }

  signedUrl(key: string): string {
    // Rounded to a 15-minute bucket: the same file keeps the same URL for a while,
    // so browsers can cache it. Valid for 60–75 minutes.
    const exp = (Math.floor(Date.now() / BUCKET_MS) + 1) * BUCKET_MS + URL_TTL_MS;
    return `/api/v1/files/${key}?exp=${exp}&sig=${this.sign(key, exp)}`;
  }

  /** Absolute path for a validly signed, unexpired key; otherwise null. */
  resolveSigned(key: string, exp: string, sig: string): string | null {
    const expected = Buffer.from(this.sign(key, exp));
    const given = Buffer.from(sig ?? '');
    const valid =
      given.length === expected.length &&
      timingSafeEqual(given, expected) &&
      Number(exp) > Date.now() &&
      KEY_PATTERN.test(key);
    return valid ? join(this.dir, key) : null;
  }

  private sign(key: string, exp: number | string) {
    return createHmac('sha256', this.secret).update(`${key}.${exp}`).digest('base64url');
  }
}
