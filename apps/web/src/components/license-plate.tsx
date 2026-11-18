import { cn } from '@/lib/utils';

/** "1กข1234" → "1กข 1234": the API stores plates without spaces; plates print one. */
export function plateDisplay(raw: string) {
  return raw.replace(/^(\d?[ก-ฮ]{1,3})(\d{1,4})$/, '$1 $2');
}

type Props = { number: string; province: string; size?: 'sm' | 'lg'; className?: string };

/**
 * The signature element: every vehicle is identified by a Thai private-car plate
 * (white plate, dark ink, province underneath).
 */
export function LicensePlate({ number, province, size = 'sm', className }: Props) {
  const shown = plateDisplay(number);
  return (
    <div
      role="img"
      aria-label={`ทะเบียน ${shown} ${province}`}
      className={cn(
        'inline-flex shrink-0 flex-col items-center justify-center rounded-[5px] border-2 border-plate-ink bg-plate text-plate-ink',
        'shadow-[inset_0_0_0_2px_var(--plate),inset_0_0_0_3px_color-mix(in_oklab,var(--plate-ink)_35%,transparent)]',
        size === 'sm' ? 'h-14 w-32 px-2' : 'h-24 w-60 px-4',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'font-heading font-bold leading-none tracking-wide',
          size === 'sm' ? 'text-xl' : 'text-[2.5rem]',
        )}
      >
        {shown}
      </span>
      <span
        aria-hidden
        className={cn(
          'font-heading font-medium leading-tight',
          size === 'sm' ? 'text-[0.7rem]' : 'text-base',
        )}
      >
        {province}
      </span>
    </div>
  );
}
