import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { initSentry } from './common/sentry';

async function bootstrap() {
  await initSentry();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN?.split(',') ?? [
      'http://localhost:3000',
      'http://localhost:5176',
    ],
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
