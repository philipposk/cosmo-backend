import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import { PrismaService } from '../prisma/prisma.service';
import { MediaKind, MediaStatus } from '../prisma/generated';

const ALLOWED: Record<MediaKind, RegExp> = {
  IMAGE: /^image\/(png|jpe?g|webp|gif|avif)$/i,
  AUDIO: /^audio\/(mpeg|mp4|aac|wav|webm|ogg)$/i,
  VIDEO: /^video\/(mp4|webm|quicktime)$/i,
  DOCUMENT: /^(application\/pdf|text\/markdown|text\/plain)$/i,
};

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly minio: MinioClient | null;
  private readonly bucket: string;
  private readonly publicEndpoint: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const endpoint = this.config.get<string>('MINIO_ENDPOINT') ?? 'localhost';
    const port = parseInt(this.config.get<string>('MINIO_PORT') ?? '9100', 10);
    const accessKey = this.config.get<string>('MINIO_ACCESS_KEY') ?? 'cosmo';
    const secretKey =
      this.config.get<string>('MINIO_SECRET_KEY') ?? 'cosmo-secret';
    this.bucket = this.config.get<string>('MINIO_BUCKET') ?? 'cosmo-media';
    this.publicEndpoint =
      this.config.get<string>('MINIO_PUBLIC_URL') ??
      `http://${endpoint}:${port}`;

    try {
      this.minio = new MinioClient({
        endPoint: endpoint,
        port,
        useSSL: false,
        accessKey,
        secretKey,
      });
      void this.ensureBucket();
    } catch (err) {
      this.logger.warn(
        `MinIO unavailable: ${(err as Error).message}. Media uploads disabled.`,
      );
      this.minio = null;
    }
  }

  private async ensureBucket() {
    if (!this.minio) return;
    try {
      const exists = await this.minio.bucketExists(this.bucket);
      if (!exists) {
        await this.minio.makeBucket(this.bucket, 'us-east-1');
        await this.minio.setBucketPolicy(
          this.bucket,
          JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: { AWS: ['*'] },
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${this.bucket}/*`],
              },
            ],
          }),
        );
        this.logger.log(`Created MinIO bucket "${this.bucket}"`);
      }
    } catch (err) {
      this.logger.warn(
        `Could not ensure bucket "${this.bucket}": ${(err as Error).message}`,
      );
    }
  }

  inferKind(contentType: string): MediaKind {
    if (ALLOWED.IMAGE.test(contentType)) return MediaKind.IMAGE;
    if (ALLOWED.AUDIO.test(contentType)) return MediaKind.AUDIO;
    if (ALLOWED.VIDEO.test(contentType)) return MediaKind.VIDEO;
    if (ALLOWED.DOCUMENT.test(contentType)) return MediaKind.DOCUMENT;
    throw new BadRequestException(`Unsupported content type: ${contentType}`);
  }

  async presign(
    ownerId: string,
    payload: { contentType: string; sizeBytes?: number; filename?: string },
  ) {
    if (!this.minio) {
      throw new BadRequestException(
        'Media uploads are disabled — MinIO is not reachable from this Cosmo instance.',
      );
    }
    const kind = this.inferKind(payload.contentType);

    // Reject oversized uploads up-front (storage-abuse guard). Limits are per
    // media kind; a claimed size over the cap is refused before we presign.
    const MAX_BYTES: Record<MediaKind, number> = {
      [MediaKind.IMAGE]: 15 * 1024 * 1024,
      [MediaKind.AUDIO]: 100 * 1024 * 1024,
      [MediaKind.VIDEO]: 200 * 1024 * 1024,
      [MediaKind.DOCUMENT]: 25 * 1024 * 1024,
    };
    if (payload.sizeBytes != null) {
      if (payload.sizeBytes <= 0) {
        throw new BadRequestException('Invalid file size.');
      }
      if (payload.sizeBytes > MAX_BYTES[kind]) {
        const mb = Math.round(MAX_BYTES[kind] / 1024 / 1024);
        throw new BadRequestException(
          `File too large — ${kind.toLowerCase()} uploads are limited to ${mb}MB.`,
        );
      }
    }

    const extGuess = payload.contentType.split('/')[1] ?? 'bin';
    const id = `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    const objectKey = `${ownerId}/${id}.${extGuess}`;

    const uploadUrl = await this.minio.presignedPutObject(
      this.bucket,
      objectKey,
      60 * 15,
    );

    const media = await this.prisma.media.create({
      data: {
        ownerId,
        kind,
        status: MediaStatus.PENDING,
        bucket: this.bucket,
        objectKey,
        contentType: payload.contentType,
        sizeBytes: payload.sizeBytes ?? null,
      },
    });

    return {
      mediaId: media.id,
      uploadUrl,
      publicUrl: this.publicUrlFor(objectKey),
      kind,
    };
  }

  async markReady(ownerId: string, mediaId: string) {
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, ownerId },
    });
    if (!media) throw new NotFoundException('Media not found');
    return this.prisma.media.update({
      where: { id: mediaId },
      data: { status: MediaStatus.READY },
    });
  }

  publicUrlFor(objectKey: string): string {
    return `${this.publicEndpoint.replace(/\/$/, '')}/${this.bucket}/${objectKey}`;
  }
}
