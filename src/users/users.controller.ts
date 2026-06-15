import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePrivacyDto } from './dto/update-privacy.dto';
import { UserProfileDto } from './dto/user-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':username')
  async getByUsername(
    @Param('username') username: string,
  ): Promise<UserProfileDto> {
    return this.usersService.getByUsername(username);
  }

  @Patch(':id/profile')
  async updateProfile(
    @Param('id') id: string,
    @Body() payload: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    // TODO: secure with authentication guard comparing id with session subject
    return this.usersService.updateProfile(id, payload);
  }

  @Patch(':id/privacy')
  async updatePrivacy(
    @Param('id') id: string,
    @Body() payload: UpdatePrivacyDto,
  ): Promise<UserProfileDto> {
    // TODO: secure with authentication guard comparing id with session subject
    return this.usersService.updatePrivacy(id, payload);
  }
}
