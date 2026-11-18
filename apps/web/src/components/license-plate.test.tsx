import { render, screen } from '@testing-library/react';
import { PROVINCES } from '@/lib/messages';
import { LicensePlate, plateDisplay } from './license-plate';

test.each([
  ['1กข1234', '1กข 1234'],
  ['กข99', 'กข 99'],
  ['ฒ514', 'ฒ 514'],
  ['ABC123', 'ABC123'], // not a Thai pattern: shown as entered
])('spaces %s like a real plate: %s', (raw, shown) => {
  expect(plateDisplay(raw)).toBe(shown);
});

test('reads out number and province', () => {
  render(<LicensePlate number="1กข1234" province="ภูเก็ต" />);
  expect(screen.getByRole('img', { name: 'ทะเบียน 1กข 1234 ภูเก็ต' })).toBeInTheDocument();
});

test('lists all 77 provinces', () => {
  expect(new Set(PROVINCES).size).toBe(77);
});
