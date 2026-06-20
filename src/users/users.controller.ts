import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../common/authenticated.guard';
import { OptionalAuthGuard } from '../common/optional-auth.guard';
import type { AuthenticatedRequest } from '../common/auth-request.util';
import { assertAuthenticatedUser } from '../common/auth-request.util';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePrivacyDto } from './dto/update-privacy.dto';
import { UserProfileDto } from './dto/user-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':username')
  @UseGuards(OptionalAuthGuard)
  async getByUsername(
    @Req() req: AuthenticatedRequest,
    @Param('username') username: string,
  ): Promise<UserProfileDto> {
    const viewer = req.user
      ? { id: req.user.id, roles: req.user.roles as string[] | undefined }
      : null;
    return this.usersService.getByUsername(username, viewer);
  }

  @Patch(':id/profile')
  @UseGuards(AuthenticatedGuard)
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() payload: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    this.assertSelfOrAdmin(req, id);
    return this.usersService.updateProfile(id, payload);
  }

  @Patch(':id/privacy')
  @UseGuards(AuthenticatedGuard)
  async updatePrivacy(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() payload: UpdatePrivacyDto,
  ): Promise<UserProfileDto> {
    this.assertSelfOrAdmin(req, id);
    return this.usersService.updatePrivacy(id, payload);
  }

  /**
   * Allow a user to mutate only their own record, unless they are an admin.
   * Prevents the previous bypass where any caller could PATCH any user id.
   */
  private assertSelfOrAdmin(req: AuthenticatedRequest, targetId: string): void {
    const user = assertAuthenticatedUser(req);
    const roles = Array.isArray(user.roles) ? (user.roles as string[]) : [];
    if (user.id !== targetId && !roles.includes('ADMIN')) {
      throw new ForbiddenException('You can only modify your own profile.');
    }
  }
}
