import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../common/authenticated.guard';
import type { AuthenticatedRequest } from '../common/auth-request.util';
import { assertAuthenticatedUser } from '../common/auth-request.util';
import { MediaService } from './media.service';

@Controller('media')
@UseGuards(AuthenticatedGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('presign')
  presign(
    @Req() req: AuthenticatedRequest,
    @Body() payload: { contentType: string; sizeBytes?: number; filename?: string },
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.media.presign(id, payload);
  }

  @Patch(':id/ready')
  markReady(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const user = assertAuthenticatedUser(req);
    return this.media.markReady(user.id, id);
  }
}
