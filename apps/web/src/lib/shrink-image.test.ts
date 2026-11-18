import { fitWithin, shrinkImage } from './shrink-image';

test.each([
  [8000, 6000, 2000, { width: 2000, height: 1500 }],
  [3000, 4000, 2000, { width: 1500, height: 2000 }],
  [1200, 900, 2000, { width: 1200, height: 900 }], // never enlarges
])('fits %ix%i within %i', (w, h, max, expected) => {
  expect(fitWithin(w, h, max)).toEqual(expected);
});

const file = (bytes: number, type = 'image/jpeg', name = 'IMG_0001.jpg') =>
  new File([new Uint8Array(bytes)], name, { type });

afterEach(() => vi.unstubAllGlobals());

test('leaves non-images (e.g. a PDF of the registration book) alone', async () => {
  const pdf = file(5_000_000, 'application/pdf', 'book.pdf');
  expect(await shrinkImage(pdf)).toBe(pdf);
});

test('sends the original when the browser cannot decode it (e.g. HEIC outside Safari)', async () => {
  vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('unsupported')));
  const heic = file(12_000_000, 'image/heic', 'IMG_0001.HEIC');
  expect(await shrinkImage(heic)).toBe(heic);
});

test('re-encodes a large phone photo to a ≤2000px JPEG', async () => {
  const close = vi.fn();
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({ width: 8000, height: 6000, close }),
  );
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => {
    cb(new Blob([new Uint8Array(900_000)], { type: 'image/jpeg' }));
  });

  const out = await shrinkImage(file(14_000_000));
  expect(out).toMatchObject({ name: 'IMG_0001.jpg', type: 'image/jpeg', size: 900_000 });
  expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2000, 1500);
  expect(close).toHaveBeenCalled();
});

test('keeps small photos that are already within size', async () => {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({ width: 1200, height: 900, close: vi.fn() }),
  );
  const small = file(400_000);
  expect(await shrinkImage(small)).toBe(small);
});
