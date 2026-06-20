import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AIJobsService } from './ai-jobs.service';
import { CreateAIJobDto } from './dto/create-ai-job.dto';
import { assertAuthenticatedUser } from '../common/auth-request.util';
import { AuthenticatedGuard } from '../common/authenticated.guard';
import type { AuthenticatedRequest } from '../common/auth-request.util';

@Controller('ai-jobs')
@UseGuards(AuthenticatedGuard)
export class AIJobsController {
  constructor(private readonly aiJobsService: AIJobsService) {}

  // AI jobs cost money per call — cap to 20/minute/user on top of the global
  // limit to contain runaway usage and abuse.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  submitJob(@Req() req: AuthenticatedRequest, @Body() dto: CreateAIJobDto) {
    const userId = assertAuthenticatedUser(req).id;
    return this.aiJobsService.submitJob(userId, dto);
  }

  @Get(':id')
  getJob(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = assertAuthenticatedUser(req).id;
    return this.aiJobsService.getJobForUser(userId, id);
  }

  @Get()
  listJobs(@Req() req: AuthenticatedRequest) {
    const userId = assertAuthenticatedUser(req).id;
    return this.aiJobsService.listJobsForUser(userId);
  }

  @Get('catalog/models')
  listModels(@Req() req: AuthenticatedRequest) {
    const userId = assertAuthenticatedUser(req).id;
    return this.aiJobsService.listModelsForUser(userId);
  }
}
