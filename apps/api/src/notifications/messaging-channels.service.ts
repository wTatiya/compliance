import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type DeliveryResult = {
  success: boolean;
  externalId?: string | null;
  statusCode?: number;
  error?: string | null;
};

type EmailMessage = {
  to: string;
  subject: string;
  body: string;
};

type SmsMessage = {
  to: string;
  body: string;
};

@Injectable()
export class MessagingChannelsService {
  private readonly logger = new Logger(MessagingChannelsService.name);

  private readonly sendGridApiKey: string | undefined;
  private readonly sendGridFromEmail: string | undefined;
  private readonly twilioAccountSid: string | undefined;
  private readonly twilioAuthToken: string | undefined;
  private readonly twilioFromNumber: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.sendGridApiKey = this.configService.get<string>('SENDGRID_API_KEY');
    this.sendGridFromEmail = this.configService.get<string>('SENDGRID_FROM_EMAIL');
    this.twilioAccountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    this.twilioAuthToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.twilioFromNumber = this.configService.get<string>('TWILIO_FROM_NUMBER');
  }

  async sendEmail(message: EmailMessage): Promise<DeliveryResult> {
    if (!this.sendGridApiKey || !this.sendGridFromEmail) {
      const error = 'SendGrid configuration is missing';
      this.logger.warn(`${error}; unable to deliver email to ${message.to}`);
      return { success: false, error };
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.sendGridApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: message.to }],
              subject: message.subject
            }
          ],
          from: { email: this.sendGridFromEmail },
          content: [
            {
              type: 'text/plain',
              value: message.body
            }
          ]
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        const error = `SendGrid request failed (${response.status}): ${errorBody}`;
        this.logger.error(error);
        return { success: false, statusCode: response.status, error };
      }

      const externalId = response.headers.get('x-message-id');
      return { success: true, externalId, statusCode: response.status };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      this.logger.error(`SendGrid delivery error: ${messageText}`);
      return { success: false, error: messageText };
    }
  }

  async sendSms(message: SmsMessage): Promise<DeliveryResult> {
    if (!this.twilioAccountSid || !this.twilioAuthToken || !this.twilioFromNumber) {
      const error = 'Twilio configuration is missing';
      this.logger.warn(`${error}; unable to deliver SMS to ${message.to}`);
      return { success: false, error };
    }

    const body = new URLSearchParams({
      To: message.to,
      From: this.twilioFromNumber,
      Body: message.body
    });

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.twilioAccountSid}:${this.twilioAuthToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: body.toString()
        }
      );

      const responseText = await response.text();
      if (!response.ok) {
        const error = `Twilio request failed (${response.status}): ${responseText}`;
        this.logger.error(error);
        return { success: false, statusCode: response.status, error };
      }

      let externalId: string | null = null;
      try {
        const parsed = JSON.parse(responseText) as { sid?: string };
        externalId = parsed.sid ?? null;
      } catch (parseError) {
        this.logger.warn('Unable to parse Twilio response body for message SID');
      }

      return { success: true, externalId, statusCode: response.status };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      this.logger.error(`Twilio delivery error: ${messageText}`);
      return { success: false, error: messageText };
    }
  }
}
