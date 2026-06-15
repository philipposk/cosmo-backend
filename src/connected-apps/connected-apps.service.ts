import {
  BadRequestException,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectedAppKey, ConnectedAppStatus } from '../prisma/generated';

export const APP_CATALOG: Array<{
  key: ConnectedAppKey;
  name: string;
  tagline: string;
  description: string;
  available: boolean;
}> = [
  {
    key: ConnectedAppKey.AI_OS,
    name: 'AI OS',
    tagline: 'Powers your AI generation',
    description:
      'Rotates across OpenRouter, Groq, NVIDIA NIM, Ollama, and Anthropic — Cosmo delegates story generation here so you get the cheapest available model with cost tracking and circuit breakers.',
    available: true,
  },
  {
    key: ConnectedAppKey.LIFEHUB,
    name: 'LifeHub',
    tagline: 'Sync personal tasks into Cosmo goals',
    description:
      'Mirror your LifeHub OCR notes, OpenAI memory, and tasks as Cosmo goals so progress shows up in your dashboard automatically.',
    available: false,
  },
  {
    key: ConnectedAppKey.APPMAKER,
    name: 'AppMaker · Vibecoders',
    tagline: 'Apps you build appear as library items',
    description:
      'Connect AppMaker so each app you publish becomes a Cosmo library item with AI attribution and live link — your developer portfolio lives next to your creative work.',
    available: false,
  },
  {
    key: ConnectedAppKey.APPBLUEPRINTS,
    name: 'AppBlueprints',
    tagline: 'Use Cosmo from your AI coding tool',
    description:
      'Install the Cosmo blueprint and Claude Code, Cursor, Codex, Cline, Windsurf, Aider, Continue, Gemini CLI, Zed, or OpenHands can read your Cosmo content directly.',
    available: false,
  },
];

@Injectable()
export class ConnectedAppsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  catalog() {
    const aiOsBaseUrl = this.config.get<string>('AI_OS_BASE_URL') ?? null;
    return APP_CATALOG.map((entry) => ({
      ...entry,
      effectiveAvailable:
        entry.key === ConnectedAppKey.AI_OS
          ? Boolean(aiOsBaseUrl)
          : entry.available,
      detailsUrl: this.detailsUrlFor(entry.key, aiOsBaseUrl),
    }));
  }

  async list(userId: string) {
    const rows = await this.prisma.connectedApp.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    const byKey = new Map(rows.map((row) => [row.appKey, row]));
    const aiOsBaseUrl = this.config.get<string>('AI_OS_BASE_URL') ?? null;

    return APP_CATALOG.map((entry) => {
      const stored = byKey.get(entry.key);
      const aiOsConfigured =
        entry.key === ConnectedAppKey.AI_OS && Boolean(aiOsBaseUrl);

      return {
        key: entry.key,
        name: entry.name,
        tagline: entry.tagline,
        description: entry.description,
        available: aiOsConfigured || entry.available,
        status:
          stored?.status ??
          (aiOsConfigured
            ? ConnectedAppStatus.CONNECTED
            : entry.available
              ? ConnectedAppStatus.DISCONNECTED
              : ConnectedAppStatus.COMING_SOON),
        lastSyncAt: stored?.lastSyncAt ?? null,
        scopes: stored?.scopes ?? [],
        detailsUrl: this.detailsUrlFor(entry.key, aiOsBaseUrl),
      };
    });
  }

  async connect(userId: string, appKey: ConnectedAppKey) {
    const catalogEntry = APP_CATALOG.find((entry) => entry.key === appKey);
    if (!catalogEntry) {
      throw new BadRequestException(`Unknown app key: ${appKey}`);
    }

    if (appKey === ConnectedAppKey.AI_OS) {
      const aiOsBaseUrl = this.config.get<string>('AI_OS_BASE_URL');
      if (!aiOsBaseUrl) {
        throw new BadRequestException(
          'AI OS is not configured on this Cosmo instance — set AI_OS_BASE_URL in the backend environment.',
        );
      }
      return this.prisma.connectedApp.upsert({
        where: { userId_appKey: { userId, appKey } },
        update: { status: ConnectedAppStatus.CONNECTED },
        create: {
          userId,
          appKey,
          status: ConnectedAppStatus.CONNECTED,
        },
      });
    }

    // Other apps are reserved seams: persist the intent but signal that the
    // OAuth handshake is not implemented yet.
    await this.prisma.connectedApp.upsert({
      where: { userId_appKey: { userId, appKey } },
      update: { status: ConnectedAppStatus.PENDING },
      create: {
        userId,
        appKey,
        status: ConnectedAppStatus.PENDING,
      },
    });
    throw new NotImplementedException(
      `${catalogEntry.name} integration is on the roadmap. Your interest has been recorded.`,
    );
  }

  async disconnect(userId: string, appKey: ConnectedAppKey) {
    await this.prisma.connectedApp.deleteMany({
      where: { userId, appKey },
    });
    return { success: true };
  }

  private detailsUrlFor(
    key: ConnectedAppKey,
    aiOsBaseUrl: string | null,
  ): string | null {
    switch (key) {
      case ConnectedAppKey.AI_OS:
        // Streamlit dashboard ships at :8501 when the user runs the standard
        // AI OS deploy script; the HTTP shim is on :8765.
        if (!aiOsBaseUrl) return null;
        try {
          const url = new URL(aiOsBaseUrl);
          return `${url.protocol}//${url.hostname}:8501`;
        } catch {
          return null;
        }
      case ConnectedAppKey.LIFEHUB:
      case ConnectedAppKey.APPMAKER:
      case ConnectedAppKey.APPBLUEPRINTS:
      default:
        return null;
    }
  }
}
