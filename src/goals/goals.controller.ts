import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../common/authenticated.guard';
import type { AuthenticatedRequest } from '../common/auth-request.util';
import { assertAuthenticatedUser } from '../common/auth-request.util';
import { GoalsService } from './goals.service';

@Controller('goals')
@UseGuards(AuthenticatedGuard)
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    const { id } = assertAuthenticatedUser(req);
    return this.goals.list(id);
  }

  @Get(':id')
  get(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const user = assertAuthenticatedUser(req);
    return this.goals.get(id, user.id);
  }

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() payload: { title: string; description?: string; targetDate?: string },
  ) {
    const user = assertAuthenticatedUser(req);
    return this.goals.create(user.id, payload);
  }

  @Post(':id/progress')
  progress(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() payload: { note: string; progress?: number },
  ) {
    const user = assertAuthenticatedUser(req);
    return this.goals.logProgress(id, user.id, payload);
  }

  @Patch(':id/status')
  setStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() payload: { status: string },
  ) {
    const user = assertAuthenticatedUser(req);
    return this.goals.setStatus(id, user.id, payload.status);
  }

  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const user = assertAuthenticatedUser(req);
    return this.goals.remove(id, user.id);
  }
}
