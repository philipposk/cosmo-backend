import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../common/authenticated.guard';
import type { AuthenticatedRequest } from '../common/auth-request.util';
import { assertAuthenticatedUser } from '../common/auth-request.util';
import { LibrariesService } from './libraries.service';

@Controller('libraries')
export class LibrariesController {
  constructor(private readonly libraries: LibrariesService) {}

  @Get('me')
  @UseGuards(AuthenticatedGuard)
  listOwn(@Req() req: AuthenticatedRequest) {
    const { id } = assertAuthenticatedUser(req);
    return this.libraries.listOwn(id);
  }

  @Get('by-user/:userId')
  listByUser(@Param('userId') userId: string) {
    return this.libraries.listPublic(userId);
  }

  @Post()
  @UseGuards(AuthenticatedGuard)
  create(
    @Req() req: AuthenticatedRequest,
    @Body() payload: {
      title: string;
      description?: string;
      tags?: string[];
    },
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.libraries.create(id, payload);
  }

  @Delete(':id')
  @UseGuards(AuthenticatedGuard)
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const user = assertAuthenticatedUser(req);
    return this.libraries.remove(id, user.id);
  }
}
