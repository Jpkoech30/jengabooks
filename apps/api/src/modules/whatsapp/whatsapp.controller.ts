import { Controller, Get, Post, Query, Body, Logger } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookPayload } from './dto/whatsapp-webhook.dto';

/**
 * WhatsApp Business API webhook controller.
 *
 * **GET /api/v1/whatsapp/webhook** — Webhook verification (Meta sends this on setup)
 * **POST /api/v1/whatsapp/webhook** — Incoming message handling
 */
@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(private readonly whatsappService: WhatsAppService) {}

  /**
   * Webhook verification endpoint.
   * Meta sends a GET request with:
   * - `hub.mode` = "subscribe"
   * - `hub.verify_token` = configured token
   * - `hub.challenge` = random string to echo back
   *
   * Returns the challenge string if verification succeeds, otherwise 403.
   */
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    this.logger.log(`Webhook verification request: mode=${mode}, token=${token}`);

    const result = this.whatsappService.verifyWebhook(mode, token, challenge);
    if (result) {
      return result;
    }

    return { error: 'Verification failed' };
  }

  /**
   * Incoming message webhook.
   * Receives messages (images, text) forwarded from WhatsApp.
   */
  @Post('webhook')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 req/min for webhooks
  async handleIncoming(@Body() payload: WhatsAppWebhookPayload) {
    this.logger.debug(`Received webhook: object=${payload.object}, entries=${payload.entry?.length}`);

    const result = await this.whatsappService.processIncoming(payload);

    // Meta expects a 200 OK response within 20 seconds
    return {
      status: 'ok',
      processed: result.processed,
      errors: result.errors.length > 0 ? result.errors : undefined,
    };
  }
}
