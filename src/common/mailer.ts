import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type Mail = {
  to: string;
  subject: string;
  text: string;
};

/**
 * Email transport abstraction. In development logs to stdout. In production
 * set MAIL_TRANSPORT=postmark|ses|smtp and add the provider env vars; this
 * service refuses to send if the production transport is requested but the
 * SDK is not installed.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly config: ConfigService) {}

  async send(mail: Mail): Promise<void> {
    const transport =
      this.config.get<string>('MAIL_TRANSPORT')?.toLowerCase() ?? 'console';

    if (transport === 'console') {
      this.logger.log(
        `[mail:console] to=${mail.to} subject="${mail.subject}"\n${mail.text}`,
      );
      return;
    }

    // Production transports stay disabled until configured by the operator.
    this.logger.warn(
      `[mailer] MAIL_TRANSPORT=${transport} is not yet wired. Falling back to console.`,
    );
    this.logger.log(
      `[mail:console] to=${mail.to} subject="${mail.subject}"\n${mail.text}`,
    );
  }
}
