import { UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  [key: string]: unknown;
}

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

export function assertAuthenticatedUser(
  request: AuthenticatedRequest,
): AuthenticatedUser {
  const { user } = request;

  if (!user || typeof user.id !== 'string') {
    throw new UnauthorizedException('Authenticated user context is required');
  }

  return user;
}
