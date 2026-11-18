import type { DocumentUploadInput } from '@haupcar/shared';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, eq } from 'drizzle-orm';
import { vehicleDocuments, vehiclePhotos } from '../db/schema.js';
import { FileStorage } from '../files/file-storage.js';
import { makeThumbnail, prepareUpload } from '../files/uploads.js';
import { VehiclesService } from './vehicles.service.js';

const MAX_PHOTOS = 10;

@Injectable()
export class VehicleMediaService {
  constructor(
    private readonly storage: FileStorage,
    private readonly vehicles: VehiclesService,
  ) {}

  async addPhoto(ownerId: string, vehicleId: string, file: Express.Multer.File | undefined) {
    const { data, ext } = await prepareUpload(file, { allowPdf: false });
    const thumb = await makeThumbnail(data);
    return this.vehicles.withOwnedVehicle(ownerId, vehicleId, async (tx) => {
      const [{ n }] = await tx
        .select({ n: count() })
        .from(vehiclePhotos)
        .where(eq(vehiclePhotos.vehicleId, vehicleId));
      if (n >= MAX_PHOTOS)
        throw new ConflictException(`A vehicle can have at most ${MAX_PHOTOS} photos`);

      const key = await this.storage.save(data, ext);
      const thumbKey = await this.storage.save(thumb, 'webp');
      try {
        const [photo] = await tx
          .insert(vehiclePhotos)
          .values({ vehicleId, storageKey: key, thumbStorageKey: thumbKey })
          .returning();
        return this.vehicles.photoDto(photo);
      } catch (e) {
        await Promise.all([this.storage.remove(key), this.storage.remove(thumbKey)]);
        throw e;
      }
    });
  }

  async removePhoto(ownerId: string, vehicleId: string, photoId: string) {
    const photo = await this.vehicles.withOwnedVehicle(ownerId, vehicleId, async (tx) => {
      const [photo] = await tx
        .delete(vehiclePhotos)
        .where(and(eq(vehiclePhotos.id, photoId), eq(vehiclePhotos.vehicleId, vehicleId)))
        .returning();
      if (!photo) throw new NotFoundException('Photo not found');
      return photo;
    });
    // After commit, so a rollback never leaves a row without its files.
    await this.storage.remove(photo.storageKey);
    if (photo.thumbStorageKey) await this.storage.remove(photo.thumbStorageKey);
  }

  /** Uploading a type that already exists replaces it. Changing documents of an approved vehicle re-queues it. */
  async putDocument(
    ownerId: string,
    vehicleId: string,
    file: Express.Multer.File | undefined,
    { type, expiresOn }: DocumentUploadInput,
  ) {
    const { data, ext } = await prepareUpload(file, { allowPdf: true });
    const key = await this.storage.save(data, ext);
    try {
      const { doc, replacedKey } = await this.vehicles.withOwnedVehicle(
        ownerId,
        vehicleId,
        async (tx, current) => {
          const [old] = await tx
            .delete(vehicleDocuments)
            .where(and(eq(vehicleDocuments.vehicleId, vehicleId), eq(vehicleDocuments.type, type)))
            .returning();
          const [doc] = await tx
            .insert(vehicleDocuments)
            .values({ vehicleId, type, expiresOn, storageKey: key })
            .returning();
          await this.vehicles.requeueIfApproved(tx, current, ownerId, `Document changed: ${type}`);
          return { doc, replacedKey: old?.storageKey };
        },
      );
      if (replacedKey) await this.storage.remove(replacedKey);
      return this.vehicles.documentDto(doc);
    } catch (e) {
      await this.storage.remove(key);
      throw e;
    }
  }

  async removeDocument(ownerId: string, vehicleId: string, documentId: string) {
    const key = await this.vehicles.withOwnedVehicle(ownerId, vehicleId, async (tx, current) => {
      const [doc] = await tx
        .delete(vehicleDocuments)
        .where(and(eq(vehicleDocuments.id, documentId), eq(vehicleDocuments.vehicleId, vehicleId)))
        .returning();
      if (!doc) throw new NotFoundException('Document not found');
      await this.vehicles.requeueIfApproved(tx, current, ownerId, `Document removed: ${doc.type}`);
      return doc.storageKey;
    });
    await this.storage.remove(key);
  }
}
