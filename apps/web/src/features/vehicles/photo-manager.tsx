import type { Vehicle } from '@haupcar/shared';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api';
import { useDeletePhoto, useUploadPhoto } from './api';

const MAX_PHOTOS = 10;

export function PhotoManager({ vehicle }: { vehicle: Vehicle }) {
  const upload = useUploadPhoto(vehicle.id);
  const remove = useDeletePhoto(vehicle.id);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const room = MAX_PHOTOS - vehicle.photos.length;

  const onFiles = async (files: FileList | null) => {
    const list = Array.from(files ?? []).slice(0, room);
    for (const [i, file] of list.entries()) {
      setProgress({ done: i, total: list.length });
      try {
        await upload.mutateAsync(file);
      } catch (e) {
        toast.error(`${file.name}: ${errorMessage(e)}`);
      }
    }
    setProgress(null);
  };

  return (
    <section aria-labelledby="photos-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="photos-heading" className="text-lg font-semibold">
          รูปรถ
        </h2>
        <span className="text-sm text-muted-foreground">
          {vehicle.photos.length} จาก {MAX_PHOTOS} รูป
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {vehicle.photos.map((p, i) => (
          <li key={p.id} className="group relative overflow-hidden rounded-lg border bg-muted">
            <img src={p.url} alt={`รูปรถที่ ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
            {i === 0 && (
              <span className="absolute top-2 left-2 rounded bg-foreground/80 px-2 py-0.5 text-xs text-background">
                รูปปก
              </span>
            )}
            <Button
              size="icon"
              variant="secondary"
              aria-label={`ลบรูปที่ ${i + 1}`}
              className="absolute top-2 right-2 opacity-90"
              disabled={remove.isPending}
              onClick={() => remove.mutate(p.id, { onError: (e) => toast.error(errorMessage(e)) })}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
        {room > 0 && (
          <li>
            <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-card text-sm text-muted-foreground hover:border-primary hover:text-primary focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/50">
              <ImagePlus className="size-6" />
              {progress ? `กำลังอัปโหลด ${progress.done + 1}/${progress.total}` : 'เพิ่มรูป'}
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                disabled={!!progress}
                onChange={(e) => {
                  onFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          </li>
        )}
      </ul>
      <p className="text-sm text-muted-foreground">ระบบจะลบข้อมูลตำแหน่ง GPS ในรูปออกให้อัตโนมัติ</p>
    </section>
  );
}
