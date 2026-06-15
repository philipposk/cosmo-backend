import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from '../common/authenticated.guard';
import type { AuthenticatedRequest } from '../common/auth-request.util';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(AuthenticatedGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  query(@Req() req: AuthenticatedRequest, @Query('q') q?: string) {
    const viewerId = req.user?.id;
    return this.search.query(q ?? '', viewerId);
  }
}
