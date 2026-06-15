import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GroqProvider } from './providers/groq.provider';
import { AIOSProvider } from './providers/aios.provider';
import { ProviderRegistry } from './provider-registry.service';

@Module({
  imports: [ConfigModule],
  providers: [GroqProvider, AIOSProvider, ProviderRegistry],
  exports: [ProviderRegistry],
})
export class AIProvidersModule {}
