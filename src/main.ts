import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { initSentry } from './common/sentry';

async function bootstrap() {
  // Fail fast in production when the JWT signing secret is missing. Several
  // services fall back to a weak default ('development-jwt-secret'); if that
  // ever ran in prod, anyone could forge auth tokens. Refuse to boot instead.
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET must be set in production — refusing to start with the insecure development default.',
    );
  }

  await initSentry();

  // rawBody:true exposes req.rawBody, which Stripe webhook signature
  // verification requires. Without it the parsed body is re-stringified and
  // never matches the signature, so real webhooks fail and paid
  // subscriptions never activate.
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const corsOrigins = process.env.FRONTEND_ORIGIN?.split(',').map((o) =>
    o.trim(),
  );
  if (process.env.NODE_ENV === 'production' && !corsOrigins) {
    new Logger('Bootstrap').warn(
      'FRONTEND_ORIGIN is not set — only localhost origins are allowed, which will block the production frontend.',
    );
  }

  app.enableCors({
    origin: corsOrigins ?? ['http://localhost:3000', 'http://localhost:5176'],
    credentials: true,
  });

  app.setGlobalPrefix('', { exclude: [] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const prisma = app.get(PrismaService);
  prisma.enableShutdownHooks(app);

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}
void bootstrap();
