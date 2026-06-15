import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SocialModule } from './social/social.module';
import { StripeModule } from './stripe/stripe.module';
import { MembershipModule } from './membership/membership.module';
import { AIJobsModule } from './ai-jobs/ai-jobs.module';
import { StoriesModule } from './stories/stories.module';
import { ModerationModule } from './moderation/moderation.module';
import { ConnectedAppsModule } from './connected-apps/connected-apps.module';
import { FeedModule } from './feed/feed.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ForumsModule } from './forums/forums.module';
import { GoalsModule } from './goals/goals.module';
import { LibrariesModule } from './libraries/libraries.module';
import { SearchModule } from './search/search.module';
import { MediaModule } from './media/media.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    SocialModule,
    StripeModule,
    MembershipModule,
    AIJobsModule,
    StoriesModule,
    ModerationModule,
    ConnectedAppsModule,
    FeedModule,
    NotificationsModule,
    ForumsModule,
    GoalsModule,
    LibrariesModule,
    SearchModule,
    MediaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
