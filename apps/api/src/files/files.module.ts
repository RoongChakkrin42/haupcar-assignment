import { Global, Module } from '@nestjs/common';
import { FileStorage } from './file-storage.js';
import { FilesController } from './files.controller.js';

@Global()
@Module({
  controllers: [FilesController],
  providers: [FileStorage],
  exports: [FileStorage],
})
export class FilesModule {}
