import { expect, test } from '@playwright/test';

/** Phone cameras produce photos over the API's 10 MB limit; the browser shrinks them first. */
test('a photo larger than 10 MB from a phone camera still uploads', async ({ page }) => {
  const runId = crypto.randomUUID().slice(0, 8);
  await page.goto('/register');
  await page.getByLabel('ชื่อ').fill('ทดสอบ รูปใหญ่');
  await page.getByLabel('อีเมล').fill(`big-photo-${runId}@e2e.local`);
  await page.getByLabel('รหัสผ่าน (อย่างน้อย 8 ตัว)').fill('owner-password-123');
  await page.getByRole('button', { name: 'สมัครและเริ่มลงรถ' }).click();

  await page.getByLabel('รุ่นรถ').selectOption({ label: 'Honda City 2024' });
  await page.getByLabel('เลขทะเบียน').fill(`8ขข ${1000 + Math.floor(Math.random() * 9000)}`);
  await page.getByLabel('จังหวัด').selectOption('ระยอง');
  await page.getByRole('button', { name: 'บันทึกร่าง' }).click();
  await expect(page.getByRole('heading', { name: 'รูปรถ' })).toBeVisible();

  // Build a noisy 6000×4500 JPEG in the page (≈ a 27 MP camera shot) and pick it in the file input.
  const size = await page.evaluate(async () => {
    const canvas = new OffscreenCanvas(6000, 4500);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    const img = ctx.createImageData(6000, 4500);
    for (let i = 0; i < img.data.length; i++) img.data[i] = (i * 2654435761) >>> 24; // deterministic noise
    ctx.putImageData(img, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 1 });
    const input = document.querySelector<HTMLInputElement>('input[type=file][accept="image/*"]');
    if (!input) throw new Error('photo input missing');
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], 'IMG_1234.jpg', { type: 'image/jpeg' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return blob.size;
  });
  expect(size).toBeGreaterThan(10 * 1024 * 1024);

  await expect(page.getByRole('img', { name: 'รูปรถที่ 1' })).toBeVisible({ timeout: 20_000 });
});
