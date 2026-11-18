import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators.js';
import { ApiErrors } from '../common/openapi.js';
import { FileStorage } from './file-storage.js';

@ApiTags('files')
@Public() // access is granted by the URL signature, not a bearer token
@Controller('files')
export class FilesController {
  constructor(private readonly storage: FileStorage) {}

  @Get(':key')
  @Header('Cache-Control', 'private, max-age=3600')
  @ApiOperation({
    summary: 'Download a photo or document',
    description:
      'Use the signed `url` returned on vehicles (valid 1 hour); usable directly as `<img src>`.',
  })
  @ApiOkResponse({
    description: 'File bytes',
    content: {
      'image/webp': { schema: { type: 'string', format: 'binary' } },
      'application/pdf': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @ApiErrors([403, 'Bad or expired signature'], [404, 'File was deleted'])
  async download(@Param('key') key: string, @Query('exp') exp: string, @Query('sig') sig: string) {
    const path = this.storage.resolveSigned(key, exp, sig);
    if (!path) throw new ForbiddenException('Invalid or expired file URL');
    if (!(await stat(path).catch(() => null))) throw new NotFoundException('File not found');
    const type = key.endsWith('.pdf') ? 'application/pdf' : 'image/webp';
    return new StreamableFile(createReadStream(path), { type });
  }
}
