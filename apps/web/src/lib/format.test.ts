import { formatBaht, satangFromBahtInput } from './format';

test('formats satang as Thai baht without trailing zeros', () => {
  expect(formatBaht(120000)).toBe('฿1,200');
  expect(formatBaht(120050)).toBe('฿1,200.50');
  expect(formatBaht(null)).toBe('—');
});

test.each([
  ['1200', 120000],
  ['1,200.5', 120050],
  [' 99.99 ', 9999],
  ['', null],
])('parses baht input %j to satang %j', (input, satang) => {
  expect(satangFromBahtInput(input)).toBe(satang);
});

test.each(['abc', '12.345', '-5'])('rejects %j', (input) => {
  expect(satangFromBahtInput(input)).toBeNaN();
});
