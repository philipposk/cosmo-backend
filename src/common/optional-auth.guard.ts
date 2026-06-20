import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AuthenticatedRequest, AuthenticatedUser } from './auth-request.util';

const DEFAULT_JWT_SECRET = 'development-jwt-secret';

/**
 * Like AuthenticatedGuard, but never rejects: if a valid bearer token is
 * present it attaches req.user, otherwise it leaves the request anonymous and
 * still allows it through. Use on routes that serve both guests and signed-in
 * users (e.g. public profile pages whose private fields gate on the viewer).
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.user) {
      return true;
    }

    const authHeader =
      request.headers?.authorization ?? request.headers?.Authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      return true; // anonymous is allowed
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return true;
    }

    try {
      const secret = process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET;
      const payload = jwt.verify(token, secret) as jwt.JwtPayload;
      if (typeof payload.sub === 'string') {
        const user: AuthenticatedUser = { id: payload.sub };
        const record = payload as Record<string, unknown>;
        if (typeof record.username === 'string') user.username = record.username;
        if (Array.isArray(record.roles)) user.roles = record.roles;
        request.user = user;
      }
    } catch {
      // Invalid/expired token → treat as anonymous, don't reject.
    }

    return true;
  }
}
