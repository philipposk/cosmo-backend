import { Injectable } from '@nestjs/common';
import { AIProvider } from './interfaces/ai-provider';
import { GroqProvider } from './providers/groq.provider';
import { AIOSProvider } from './providers/aios.provider';

@Injectable()
export class ProviderRegistry {
  private readonly providers: AIProvider[];

  constructor(aiosProvider: AIOSProvider, groqProvider: GroqProvider) {
    // Order matters: AI OS is checked first so `aios:*` identifiers route
    // through the local multi-provider rotator before falling back to direct
    // vendor SDKs like Groq.
    this.providers = [aiosProvider, groqProvider];
  }

  resolve(modelIdentifier: string): AIProvider {
    const provider = this.providers.find((candidate) =>
      candidate.supports(modelIdentifier),
    );

    if (!provider) {
      throw new Error(
        `No AI provider registered for model "${modelIdentifier}"`,
      );
    }

    return provider;
  }
}
