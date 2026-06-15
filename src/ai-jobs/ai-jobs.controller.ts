import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AIJobsService } from './ai-jobs.service';
import { CreateAIJobDto } from './dto/create-ai-job.dto';
import { assertAuthenticatedUser } from '../common/auth-request.util';
import { AuthenticatedGuard } from '../common/authenticated.guard';
import type { AuthenticatedRequest } from '../common/auth-request.util';

@Controller('ai-jobs')
@UseGuards(AuthenticatedGuard)
export class AIJobsController {
  constructor(private readonly aiJobsService: AIJobsService) {}

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
