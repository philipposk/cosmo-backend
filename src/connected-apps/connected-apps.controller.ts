import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConnectedAppKey } from '../prisma/generated';
import { AuthenticatedGuard } from '../common/authenticated.guard';
import type { AuthenticatedRequest } from '../common/auth-request.util';
import { assertAuthenticatedUser } from '../common/auth-request.util';
import { ConnectedAppsService } from './connected-apps.service';

const VALID_KEYS: ConnectedAppKey[] = [
  ConnectedAppKey.AI_OS,
  ConnectedAppKey.LIFEHUB,
  ConnectedAppKey.APPMAKER,
  ConnectedAppKey.APPBLUEPRINTS,
];

function parseAppKey(raw: string): ConnectedAppKey {
  const upper = raw.toUpperCase().replace(/-/g, '_');
  if (!VALID_KEYS.includes(upper as ConnectedAppKey)) {
    throw new BadRequestException(`Unknown app key: ${raw}`);
  }
  return upper as ConnectedAppKey;
}

@Controller('connected-apps')
@UseGuards(AuthenticatedGuard)
export class ConnectedAppsController {
  constructor(private readonly service: ConnectedAppsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    const { id } = assertAuthenticatedUser(request);
    return this.service.list(id);
  }

  @Post(':appKey/connect')
  connect(
    @Req() request: AuthenticatedRequest,
    @Param('appKey') appKey: string,
  ) {
    const { id } = assertAuthenticatedUser(request);
    return this.service.connect(id, parseAppKey(appKey));
  }

  @Delete(':appKey')
  disconnect(
    @Req() request: AuthenticatedRequest,
    @Param('appKey') appKey: string,
  ) {
    const { id } = assertAuthenticatedUser(request);
    return this.service.disconnect(id, parseAppKey(appKey));
  }
}
