import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import request from 'supertest';
import { vehiclePhotos, vehicleStatusHistory, vehicles } from '../src/db/schema.js';
import {
  createTestApp,
  registerAndLogin,
  testJpeg,
  testPdf,
  uploadDocument,
  uploadPhoto,
} from './app.js';
import { db, insertCarModel, pool, resetDb } from './db.js';

let app: INestApplication;
let owner: Awaited<ReturnType<typeof registerAndLogin>>;
let other: Awaited<ReturnType<typeof registerAndLogin>>;
let vehicleId: string;

const http = () => request(app.getHttpServer());
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const getVehicle = async (token = owner.token) =>
  (await http().get(`/api/v1/vehicles/${vehicleId}`).set(auth(token)).expect(200)).body;
/** Signed URLs are absolute paths; fetch them without a token, like an <img>. */
const fetchFile = (url: string) =>
  http()
    .get(url)
    .buffer(true)
    .parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });

beforeAll(async () => {
  app = await createTestApp();
});
beforeEach(async () => {
  await resetDb();
  owner = await registerAndLogin(app);
  other = await registerAndLogin(app);
  const { id: modelId } = await insertCarModel();
  const res = await http()
    .post('/api/v1/vehicles')
    .set(auth(owner.token))
    .send({
      modelId,
      plateNumber: '1กข1234',
      plateProvince: 'กรุงเทพมหานคร',
      location: { lat: 13.7, lng: 100.5 },
      pickupAddress: 'Siam',
      dailyPrice: 100000,
    })
    .expect(201);
  vehicleId = res.body.id;
});
afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('photos', () => {
  it('re-encodes uploads: strips EXIF/GPS, caps size at 1600px, serves via signed URL', async () => {
    const original = await testJpeg({ width: 2400, height: 1800 });
    expect((await sharp(original).metadata()).exif).toBeDefined(); // sanity: input has EXIF

    const res = await http()
      .post(`/api/v1/vehicles/${vehicleId}/photos`)
      .set(auth(owner.token))
      .attach('file', original, 'car.jpg')
      .expect(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      url: expect.stringMatching(/^\/api\/v1\/files\//),
      thumbUrl: expect.stringMatching(/^\/api\/v1\/files\//),
    });
    expect(res.body.thumbUrl).not.toBe(res.body.url);

    const file = await fetchFile(res.body.url).expect(200).expect('content-type', 'image/webp');
    const meta = await sharp(file.body).metadata();
    expect(meta.exif).toBeUndefined();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(1600);
  });

  it('makes a 400px thumbnail for lists, also without EXIF', async () => {
    const res = await http()
      .post(`/api/v1/vehicles/${vehicleId}/photos`)
      .set(auth(owner.token))
      .attach('file', await testJpeg({ width: 2400, height: 1800 }), 'car.jpg')
      .expect(201);
    const thumb = await fetchFile(res.body.thumbUrl)
      .expect(200)
      .expect('content-type', 'image/webp');
    const meta = await sharp(thumb.body).metadata();
    expect(meta.exif).toBeUndefined();
    expect([meta.width, meta.height]).toEqual([400, 300]);
  });

  it('falls back to the full image for photos stored before thumbnails existed', async () => {
    const photo = (await uploadPhoto(app, owner.token, vehicleId)).body;
    await db
      .update(vehiclePhotos)
      .set({ thumbStorageKey: null })
      .where(eq(vehiclePhotos.id, photo.id));
    const [listed] = (await getVehicle()).photos;
    expect(listed.thumbUrl).toBe(listed.url);
  });

  it('lists photos on the vehicle in upload order', async () => {
    const a = (await uploadPhoto(app, owner.token, vehicleId)).body;
    const b = (await uploadPhoto(app, owner.token, vehicleId)).body;
    expect((await getVehicle()).photos.map((p: { id: string }) => p.id)).toEqual([a.id, b.id]);
  });

  it('rejects files that are not images, whatever their name says', async () => {
    await http()
      .post(`/api/v1/vehicles/${vehicleId}/photos`)
      .set(auth(owner.token))
      .attach('file', Buffer.from('not an image'), {
        filename: 'car.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
  });

  it('requires a file', async () => {
    await http().post(`/api/v1/vehicles/${vehicleId}/photos`).set(auth(owner.token)).expect(400);
  });

  it('rejects files over 10 MB with 413', async () => {
    await http()
      .post(`/api/v1/vehicles/${vehicleId}/photos`)
      .set(auth(owner.token))
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), 'big.jpg')
      .expect(413);
  });

  it('allows at most 10 photos per vehicle', async () => {
    for (let i = 0; i < 10; i++)
      expect((await uploadPhoto(app, owner.token, vehicleId)).status).toBe(201);
    expect((await uploadPhoto(app, owner.token, vehicleId)).status).toBe(409);
  });

  it("can't touch someone else's vehicle photos", async () => {
    const photo = (await uploadPhoto(app, owner.token, vehicleId)).body;
    expect((await uploadPhoto(app, other.token, vehicleId)).status).toBe(404);
    await http()
      .delete(`/api/v1/vehicles/${vehicleId}/photos/${photo.id}`)
      .set(auth(other.token))
      .expect(404);
  });

  it('deletes a photo and its file', async () => {
    const photo = (await uploadPhoto(app, owner.token, vehicleId)).body;
    await http()
      .delete(`/api/v1/vehicles/${vehicleId}/photos/${photo.id}`)
      .set(auth(owner.token))
      .expect(204);
    expect((await getVehicle()).photos).toEqual([]);
    await fetchFile(photo.url).expect(404);
    await fetchFile(photo.thumbUrl).expect(404);
  });

  it('keeps an approved vehicle approved when photos change', async () => {
    await db.update(vehicles).set({ status: 'approved' }).where(eq(vehicles.id, vehicleId));
    await uploadPhoto(app, owner.token, vehicleId);
    expect((await getVehicle()).status).toBe('approved');
  });
});

describe('signed file URLs', () => {
  it('rejects a tampered signature, a moved expiry, and a forged key', async () => {
    const { url } = (await uploadPhoto(app, owner.token, vehicleId)).body;
    const u = new URL(url, 'http://x');
    const sig = u.searchParams.get('sig') as string;
    const flipped = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1);

    await fetchFile(url.replace(sig, flipped)).expect(403);
    await fetchFile(url.replace(/exp=\d+/, `exp=${Date.now() + 10 ** 9}`)).expect(403);
    await fetchFile(
      `/api/v1/files/..%2F..%2F.env?exp=${u.searchParams.get('exp')}&sig=${sig}`,
    ).expect(403);
  });

  it('rejects an expired URL', async () => {
    const { url } = (await uploadPhoto(app, owner.token, vehicleId)).body;
    const realNow = Date.now;
    Date.now = () => realNow() + 2 * 60 * 60 * 1000; // URLs live 1 hour
    try {
      await fetchFile(url).expect(403);
    } finally {
      Date.now = realNow;
    }
  });
});

describe('documents', () => {
  it('stores a PDF with its expiry date and shows it on the vehicle', async () => {
    const res = await uploadDocument(app, owner.token, vehicleId, 'insurance')
      .field('expiresOn', '2027-06-30')
      .expect(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      type: 'insurance',
      expiresOn: '2027-06-30',
      url: expect.stringMatching(/^\/api\/v1\/files\//),
    });
    await fetchFile(res.body.url).expect(200).expect('content-type', 'application/pdf');
    expect((await getVehicle()).documents).toEqual([res.body]);
  });

  it('accepts a photo of the document, stripped of EXIF', async () => {
    const res = await uploadDocument(
      app,
      owner.token,
      vehicleId,
      'registration',
      await testJpeg(),
      'book.jpg',
    ).expect(201);
    const file = await fetchFile(res.body.url).expect(200).expect('content-type', 'image/webp');
    expect((await sharp(file.body).metadata()).exif).toBeUndefined();
  });

  it('replaces the previous document of the same type', async () => {
    const first = (await uploadDocument(app, owner.token, vehicleId).expect(201)).body;
    const second = (await uploadDocument(app, owner.token, vehicleId).expect(201)).body;
    expect((await getVehicle()).documents).toEqual([second]);
    await fetchFile(first.url).expect(404);
  });

  it.each([
    ['unknown type', 'passport', testPdf()],
    ['non-PDF, non-image file', 'registration', Buffer.from('hello')],
  ])('rejects %s with 400', async (_, type, file) => {
    await uploadDocument(app, owner.token, vehicleId, type, file).expect(400);
  });

  it('rejects a malformed expiry date', async () => {
    await uploadDocument(app, owner.token, vehicleId, 'insurance')
      .field('expiresOn', '30/06/2027')
      .expect(400);
  });

  it('sends an approved vehicle back to review when a document changes', async () => {
    await db.update(vehicles).set({ status: 'approved' }).where(eq(vehicles.id, vehicleId));
    await uploadDocument(app, owner.token, vehicleId).expect(201);

    expect((await getVehicle()).status).toBe('pending_review');
    const history = await db
      .select()
      .from(vehicleStatusHistory)
      .where(eq(vehicleStatusHistory.vehicleId, vehicleId));
    expect(history).toMatchObject([
      { fromStatus: 'approved', toStatus: 'pending_review', changedBy: owner.user.id },
    ]);
  });

  it("can't touch someone else's vehicle documents", async () => {
    const doc = (await uploadDocument(app, owner.token, vehicleId).expect(201)).body;
    await uploadDocument(app, other.token, vehicleId).expect(404);
    await http()
      .delete(`/api/v1/vehicles/${vehicleId}/documents/${doc.id}`)
      .set(auth(other.token))
      .expect(404);
  });

  it('deletes a document and its file', async () => {
    const doc = (await uploadDocument(app, owner.token, vehicleId).expect(201)).body;
    await http()
      .delete(`/api/v1/vehicles/${vehicleId}/documents/${doc.id}`)
      .set(auth(owner.token))
      .expect(204);
    expect((await getVehicle()).documents).toEqual([]);
    await fetchFile(doc.url).expect(404);
  });
});

describe('submit', () => {
  it('needs at least one photo and the registration book', async () => {
    const res = await http()
      .post(`/api/v1/vehicles/${vehicleId}/submit`)
      .set(auth(owner.token))
      .expect(422);
    expect(res.body.missing.sort()).toEqual(['photos', 'registrationDocument']);

    await uploadPhoto(app, owner.token, vehicleId);
    await uploadDocument(app, owner.token, vehicleId, 'insurance').expect(201);
    const still = await http()
      .post(`/api/v1/vehicles/${vehicleId}/submit`)
      .set(auth(owner.token))
      .expect(422);
    expect(still.body.missing).toEqual(['registrationDocument']);

    await uploadDocument(app, owner.token, vehicleId, 'registration').expect(201);
    await http().post(`/api/v1/vehicles/${vehicleId}/submit`).set(auth(owner.token)).expect(200);
  });
});
