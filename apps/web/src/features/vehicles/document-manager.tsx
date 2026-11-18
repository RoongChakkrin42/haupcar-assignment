import { DOCUMENT_TYPES, type DocumentType, type Vehicle } from '@haupcar/shared';
import { FileText, Trash2, Upload } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { documentLabel } from '@/lib/messages';
import { useDeleteDocument, useUploadDocument } from './api';

const HAS_EXPIRY: DocumentType[] = ['insurance', 'compulsory_insurance'];

export function DocumentManager({ vehicle }: { vehicle: Vehicle }) {
  return (
    <section aria-labelledby="docs-heading" className="flex flex-col gap-3">
      <h2 id="docs-heading" className="text-lg font-semibold">
        เอกสาร
      </h2>
      {vehicle.status === 'approved' && (
        <p className="rounded-md bg-pending/15 px-3 py-2 text-sm">
          รถคันนี้อนุมัติแล้ว ถ้าเปลี่ยนเอกสาร รถจะกลับไปรอตรวจอีกครั้ง
        </p>
      )}
      <ul className="flex flex-col divide-y rounded-lg border bg-card">
        {DOCUMENT_TYPES.map((type) => (
          <DocumentRow key={type} vehicle={vehicle} type={type} />
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        รับไฟล์ PDF หรือรูปถ่าย ไม่เกิน 10 MB เอกสารจะเห็นเฉพาะคุณกับทีมงาน
      </p>
    </section>
  );
}

function DocumentRow({ vehicle, type }: { vehicle: Vehicle; type: DocumentType }) {
  const id = useId();
  const doc = vehicle.documents.find((d) => d.type === type);
  const upload = useUploadDocument(vehicle.id);
  const remove = useDeleteDocument(vehicle.id);
  const [expiresOn, setExpiresOn] = useState(doc?.expiresOn ?? '');

  const onFile = (file: File | undefined) => {
    if (!file) return;
    upload.mutate(
      { type, file, expiresOn: expiresOn || undefined },
      {
        onSuccess: () => toast.success(`อัปโหลด${documentLabel[type]}แล้ว`),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {documentLabel[type]}
          {type === 'registration' && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">จำเป็นสำหรับส่งตรวจ</span>
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          {doc ? (
            <>
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                ดูไฟล์
              </a>
              {doc.expiresOn && <span className="ml-3">หมดอายุ {formatDate(doc.expiresOn)}</span>}
            </>
          ) : (
            'ยังไม่ได้อัปโหลด'
          )}
        </p>
      </div>
      {HAS_EXPIRY.includes(type) && (
        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-exp`} className="text-sm text-muted-foreground">
            วันหมดอายุ
          </label>
          <Input
            id={`${id}-exp`}
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            className="w-40"
          />
        </div>
      )}
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm" disabled={upload.isPending}>
          <label className="cursor-pointer">
            <Upload /> {upload.isPending ? 'กำลังอัปโหลด…' : doc ? 'เปลี่ยนไฟล์' : 'อัปโหลด'}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="sr-only"
              aria-label={`อัปโหลด${documentLabel[type]}`}
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </Button>
        {doc && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`ลบ${documentLabel[type]}`}
            disabled={remove.isPending}
            onClick={() => remove.mutate(doc.id, { onError: (e) => toast.error(errorMessage(e)) })}
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </li>
  );
}
