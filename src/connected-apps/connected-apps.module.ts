import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ConnectedAppsService } from './connected-apps.service';
import { ConnectedAppsController } from './connected-apps.controller';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [ConnectedAppsController],
  providers: [ConnectedAppsService],
  exports: [ConnectedAppsService],
})
export class ConnectedAppsModule {}
