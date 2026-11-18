const BASE = '/api/v1';
const TOKEN_KEY = 'haupcar.token';

/** Storage can be unavailable (private mode); auth then lasts only for the page session. */
let memoryToken: string | null = null;
export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return memoryToken;
    }
  },
  set(token: string) {
    memoryToken = token;
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {}
  },
  clear() {
    memoryToken = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
  },
};

export class ApiError extends Error {
  readonly status: number;
  readonly issues?: { path: string; message: string }[];
  readonly missing?: string[];

  constructor(status: number, message: string, issues?: ApiError['issues'], missing?: string[]) {
    super(message);
    this.status = status;
    this.issues = issues;
    this.missing = missing;
  }
}

type Options = { method?: string; body?: unknown; form?: FormData };

export async function api<T = unknown>(
  path: string,
  { method = 'GET', body, form }: Options = {},
): Promise<T> {
  const token = tokenStore.get();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (res.ok) return data as T;

  if (res.status === 401 && token) {
    tokenStore.clear();
    window.dispatchEvent(new Event('auth:expired'));
  }
  const message = Array.isArray(data.message)
    ? data.message.join(', ')
    : (data.message ?? res.statusText);
  throw new ApiError(res.status, message, data.issues, data.missing);
}

// Server messages are English and stable; map the ones people can act on.
const KNOWN: [RegExp, string][] = [
  [/modified by someone else/i, 'มีคนแก้ไขรถคันนี้ไปก่อนแล้ว โหลดหน้าใหม่แล้วลองอีกครั้ง'],
  [/plate number is already registered/i, 'ทะเบียนนี้ถูกลงไว้แล้วในจังหวัดนี้'],
  [/vin is already registered/i, 'เลขตัวถัง (VIN) นี้ถูกลงไว้แล้ว'],
  [/email is already registered/i, 'อีเมลนี้สมัครไว้แล้ว'],
  [/invalid email or password/i, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'],
  [/at most \d+ photos/i, 'ใส่รูปได้สูงสุด 10 รูปต่อคัน'],
  [/must be an image or a pdf/i, 'รองรับเฉพาะไฟล์รูปหรือ PDF'],
  [/must be an image/i, 'รองรับเฉพาะไฟล์รูป (JPEG, PNG, WebP, HEIC)'],
  [/cannot change status/i, 'เปลี่ยนสถานะแบบนี้ไม่ได้ในตอนนี้'],
];

const BY_STATUS: Record<number, string> = {
  400: 'ข้อมูลไม่ถูกต้อง ตรวจสอบช่องที่มีเครื่องหมายแล้วลองใหม่',
  401: 'กรุณาเข้าสู่ระบบอีกครั้ง',
  403: 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้',
  404: 'ไม่พบรายการนี้ อาจถูกลบไปแล้ว',
  413: 'ไฟล์ใหญ่เกิน 10 MB',
  429: 'ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่',
  422: 'ข้อมูลยังไม่ครบ',
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const known = KNOWN.find(([pattern]) => pattern.test(err.message));
    return known?.[1] ?? BY_STATUS[err.status] ?? 'ระบบขัดข้อง ลองใหม่อีกครั้ง';
  }
  return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
}
