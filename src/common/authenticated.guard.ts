import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import * as jwt from 'jsonwebtoken';
import {
  AuthenticatedRequest,
  assertAuthenticatedUser,
  AuthenticatedUser,
} from './auth-request.util';

const DEFAULT_JWT_SECRET = 'development-jwt-secret';

function buildUserFromPayload(payload: jwt.JwtPayload): AuthenticatedUser {
  if (typeof payload.sub !== 'string') {
    throw new UnauthorizedException('Invalid authentication token');
  }

  const base: AuthenticatedUser = {
    id: payload.sub,
  };

  const record = payload as Record<string, unknown>;

  if (typeof record.username === 'string') {
    base.username = record.username;
  }

  if (Array.isArray(record.roles)) {
    base.roles = record.roles;
  }

  return base;
}

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      const authHeader =
        request.headers?.authorization ?? request.headers?.Authorization;

      if (!authHeader || typeof authHeader !== 'string') {
        throw new UnauthorizedException(
          'Authenticated user context is required',
        );
      }

      const [scheme, token] = authHeader.split(' ');

      if (scheme?.toLowerCase() !== 'bearer' || !token) {
        throw new UnauthorizedException(
          'Authenticated user context is required',
        );
      }

      try {
        const secret = process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET;
        const payload = jwt.verify(token, secret) as jwt.JwtPayload;
        request.user = buildUserFromPayload(payload);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('JWT verification failed:', (error as Error).message);
        throw new UnauthorizedException('Invalid authentication token');
      }
    }

    assertAuthenticatedUser(request);
    return true;
  }
}
