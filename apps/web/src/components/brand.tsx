import { Link } from 'react-router';

/** The logo is itself a plate. */
export function Brand({ to = '/' }: { to?: string }) {
  return (
    <Link
      to={to}
      aria-label="Haupcar หน้าแรก"
      className="inline-flex h-10 flex-col items-center justify-center rounded-[4px] border-2 border-plate-ink bg-plate px-2.5 text-plate-ink"
    >
      <span className="font-heading text-[0.95rem] leading-none font-bold tracking-wider">
        HAUPCAR
      </span>
      <span className="font-heading text-[0.55rem] leading-tight font-medium">ลงรถให้เช่า</span>
    </Link>
  );
}
