import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LibrariesService } from './libraries.service';
import { LibrariesController } from './libraries.controller';

@Module({
  imports: [PrismaModule],
  controllers: [LibrariesController],
  providers: [LibrariesService],
  exports: [LibrariesService],
})
export class LibrariesModule {}
