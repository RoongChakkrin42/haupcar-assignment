import { expect, type Page, test } from '@playwright/test';

/**
 * The flow the business depends on: an owner lists a car, an admin rejects it with a
 * reason, the owner fixes and resubmits, the admin approves.
 */
const ADMIN = { email: 'admin@e2e.local', password: 'admin-password-123' };
// Unique per run: repeated/parallel runs share one database and plates must be unique.
const runId = crypto.randomUUID().slice(0, 8);
const owner = {
  name: 'สมหญิง ทดสอบ',
  email: `owner-${runId}@e2e.local`,
  password: 'owner-password-123',
};
const PLATE = { number: `7กข ${1000 + Math.floor(Math.random() * 9000)}`, province: 'ขอนแก่น' };

async function logIn(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel('อีเมล').fill(email);
  await page.getByLabel('รหัสผ่าน').fill(password);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
}

async function logOut(page: Page) {
  await page.getByRole('button', { name: 'ออกจากระบบ' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function openInReviewQueue(page: Page) {
  await expect(page.getByRole('heading', { name: 'ตรวจรถ' })).toBeVisible();
  await page.getByRole('row', { name: new RegExp(owner.email) }).click();
  await expect(
    page.getByRole('img', { name: `ทะเบียน ${PLATE.number} ${PLATE.province}` }),
  ).toBeVisible();
}

test('owner lists a car, admin rejects, owner resubmits, admin approves', async ({ page }) => {
  // Owner signs up and lands on the new-vehicle form.
  await page.goto('/register');
  await page.getByLabel('ชื่อ').fill(owner.name);
  await page.getByLabel('อีเมล').fill(owner.email);
  await page.getByLabel('รหัสผ่าน (อย่างน้อย 8 ตัว)').fill(owner.password);
  await page.getByRole('button', { name: 'สมัครและเริ่มลงรถ' }).click();
  await expect(page.getByRole('heading', { name: 'ลงรถคันใหม่' })).toBeVisible();

  // Vehicle details, pickup pin and price → saved as a draft.
  await page.getByLabel('รุ่นรถ').selectOption({ label: 'Honda City 2024' });
  await page.getByLabel('เลขทะเบียน').fill(PLATE.number);
  await page.getByLabel('จังหวัด').selectOption(PLATE.province);
  await page.locator('.leaflet-container').click();
  await expect(page.getByText(/^\d+\.\d+, \d+\.\d+$/)).toBeVisible();
  await page.getByLabel('ที่อยู่จุดรับรถ').fill('หน้าเซ็นทรัลขอนแก่น');
  await page.getByLabel('ราคาต่อวัน (บาท)').fill('1,100');
  await page.getByRole('button', { name: 'บันทึกร่าง' }).click();

  await expect(
    page.getByRole('img', { name: `ทะเบียน ${PLATE.number} ${PLATE.province}` }),
  ).toBeVisible();
  const submit = page.getByRole('button', { name: 'ส่งตรวจ' });
  await expect(submit).toBeDisabled(); // photo and registration book still missing

  // Photo + registration book complete the checklist.
  await page.locator('input[type=file][accept="image/*"]').setInputFiles('e2e/fixtures/car.jpg');
  await expect(page.getByRole('img', { name: 'รูปรถที่ 1' })).toBeVisible();
  await page.getByLabel('อัปโหลดเล่มทะเบียน').setInputFiles('e2e/fixtures/registration.pdf');
  await expect(page.getByRole('link', { name: 'ดูไฟล์' })).toBeVisible();

  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText('ทีมงานกำลังตรวจรถคันนี้')).toBeVisible();
  await logOut(page);

  // Admin rejects with a reason.
  await logIn(page, ADMIN);
  await openInReviewQueue(page);
  await page.getByLabel('เหตุผล (เจ้าของรถจะเห็น)').fill('รูปเล่มทะเบียนไม่ชัด ถ่ายใหม่ให้เห็นเลขตัวถัง');
  await page.getByRole('button', { name: 'ไม่อนุมัติ' }).click();
  await expect(page.getByText('ส่งกลับให้เจ้าของรถแก้ไขแล้ว')).toBeVisible();
  await logOut(page);

  // Owner sees why and resubmits.
  await logIn(page, owner);
  const row = page.getByRole('link', { name: /Honda City 2024/ });
  await expect(row).toContainText('ไม่ผ่าน');
  await row.click();
  await expect(page.getByText('รูปเล่มทะเบียนไม่ชัด ถ่ายใหม่ให้เห็นเลขตัวถัง')).toBeVisible();
  await page.getByRole('button', { name: 'ส่งตรวจอีกครั้ง' }).click();
  await expect(page.getByText('ทีมงานกำลังตรวจรถคันนี้')).toBeVisible();
  await logOut(page);

  // Admin approves.
  await logIn(page, ADMIN);
  await openInReviewQueue(page);
  await page.getByRole('button', { name: 'อนุมัติ', exact: true }).click();
  await expect(page.getByText('อนุมัติแล้ว รถเปิดให้เช่าได้')).toBeVisible();
  await logOut(page);

  // Owner sees the approval.
  await logIn(page, owner);
  await expect(page.getByRole('link', { name: /Honda City 2024/ })).toContainText('อนุมัติแล้ว');
});
