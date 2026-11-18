import {
  type DocumentUploadInput,
  documentSchema,
  documentUploadSchema,
  photoSchema,
} from '@haupcar/shared';
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/decorators.js';
import { ApiErrors, ApiZodResponse } from '../common/openapi.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { MAX_UPLOAD_BYTES } from '../files/uploads.js';
import { VehicleMediaService } from './vehicle-media.service.js';

const upload = () => FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
const binary = { type: 'string', format: 'binary' };
const UNAUTHORIZED: [number, string] = [401, 'Missing or invalid token'];
const NOT_FOUND: [number, string] = [
  404,
  'Vehicle (or photo/document) not found, deleted, or not yours',
];
const TOO_LARGE: [number, string] = [413, 'File larger than 10 MB'];

@ApiTags('vehicles (owner)')
@ApiBearerAuth()
@Controller('vehicles/:vehicleId')
export class VehicleMediaController {
  constructor(private readonly media: VehicleMediaService) {}

  @Post('photos')
  @UseInterceptors(upload())
  @ApiOperation({
    summary: 'Upload a vehicle photo',
    description:
      'JPEG/PNG/WebP/HEIC, ≤ 10 MB, max 10 per vehicle. Stored as WebP ≤ 1600px with EXIF (incl. GPS) removed.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: binary } } })
  @ApiZodResponse(201, photoSchema)
  @ApiErrors(
    [400, 'Missing file or not an image'],
    UNAUTHORIZED,
    NOT_FOUND,
    [409, 'Photo limit reached'],
    TOO_LARGE,
  )
  addPhoto(
    @CurrentUser() user: User,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.media.addPhoto(user.id, vehicleId, file);
  }

  @Delete('photos/:photoId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a vehicle photo' })
  @ApiNoContentResponse({ description: 'Deleted, file removed' })
  @ApiErrors(UNAUTHORIZED, NOT_FOUND)
  removePhoto(
    @CurrentUser() user: User,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    return this.media.removePhoto(user.id, vehicleId, photoId);
  }

  @Post('documents')
  @UseInterceptors(upload())
  @ApiOperation({
    summary: 'Upload a vehicle document',
    description:
      'PDF or image, ≤ 10 MB. One per type: uploading again replaces it. ' +
      'Changing documents of an `approved` vehicle sends it back to `pending_review`. Visible only to the owner and admins.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'type'],
      properties: {
        file: binary,
        type: { type: 'string', enum: documentUploadSchema.shape.type.options },
        expiresOn: { type: 'string', format: 'date', example: '2027-06-30' },
      },
    },
  })
  @ApiZodResponse(201, documentSchema)
  @ApiErrors([400, 'Missing/invalid file, type or date'], UNAUTHORIZED, NOT_FOUND, TOO_LARGE)
  putDocument(
    @CurrentUser() user: User,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodPipe(documentUploadSchema)) body: DocumentUploadInput,
  ) {
    return this.media.putDocument(user.id, vehicleId, file, body);
  }

  @Delete('documents/:documentId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete a vehicle document',
    description: 'Re-queues an `approved` vehicle for review.',
  })
  @ApiNoContentResponse({ description: 'Deleted, file removed' })
  @ApiErrors(UNAUTHORIZED, NOT_FOUND)
  removeDocument(
    @CurrentUser() user: User,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.media.removeDocument(user.id, vehicleId, documentId);
  }
}
