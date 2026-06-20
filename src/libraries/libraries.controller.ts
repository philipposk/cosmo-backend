import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../common/authenticated.guard';
import type { AuthenticatedRequest } from '../common/auth-request.util';
import { assertAuthenticatedUser } from '../common/auth-request.util';
import { LibrariesService } from './libraries.service';
import {
  CreateLibraryItemDto,
  UpdateLibraryItemDto,
} from './dto/library-item.dto';
import { ContentCategory } from '../prisma/generated';

@Controller('libraries')
export class LibrariesController {
  constructor(private readonly libraries: LibrariesService) {}

  @Get('me')
  @UseGuards(AuthenticatedGuard)
  listOwn(
    @Req() req: AuthenticatedRequest,
    @Query('category') category?: ContentCategory,
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.libraries.listOwn(id, category);
  }

  @Get('by-user/:userId')
  listByUser(
    @Param('userId') userId: string,
    @Query('category') category?: ContentCategory,
  ) {
    return this.libraries.listPublic(userId, category);
  }

  @Post()
  @UseGuards(AuthenticatedGuard)
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateLibraryItemDto,
  ) {
    const { id } = assertAuthenticatedUser(req);
    return this.libraries.create(id, dto);
  }

  @Patch(':id')
  @UseGuards(AuthenticatedGuard)
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateLibraryItemDto,
  ) {
    const user = assertAuthenticatedUser(req);
    return this.libraries.update(id, user.id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthenticatedGuard)
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const user = assertAuthenticatedUser(req);
    return this.libraries.remove(id, user.id);
  }
}
