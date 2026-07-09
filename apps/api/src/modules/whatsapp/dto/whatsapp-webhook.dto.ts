import { IsString, IsOptional, IsArray, IsObject, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class WhatsAppImage {
  @IsString()
  id!: string;

  @IsString()
  mime_type!: string;

  @IsString()
  sha256!: string;
}

export class WhatsAppText {
  @IsString()
  body!: string;
}

export class WhatsAppMessage {
  @IsString()
  from!: string;

  @IsString()
  id!: string;

  @IsString()
  timestamp!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppImage)
  image?: WhatsAppImage;

  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppText)
  text?: WhatsAppText;
}

export class WhatsAppMetadata {
  @IsString()
  phone_number_id!: string;
}

export class WhatsAppValue {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppMessage)
  messages?: WhatsAppMessage[];

  @ValidateNested()
  @Type(() => WhatsAppMetadata)
  metadata!: WhatsAppMetadata;
}

export class WhatsAppChange {
  @ValidateNested()
  @Type(() => WhatsAppValue)
  value!: WhatsAppValue;
}

export class WhatsAppEntry {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppChange)
  changes!: WhatsAppChange[];
}

export class WhatsAppWebhookPayload {
  @IsString()
  object!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppEntry)
  entry!: WhatsAppEntry[];
}

export class WebhookVerificationQuery {
  @IsString()
  @IsOptional()
  'hub.mode'?: string;

  @IsString()
  @IsOptional()
  'hub.verify_token'?: string;

  @IsString()
  @IsOptional()
  'hub.challenge'?: string;
}

export class SendMessageResponse {
  messaging_product!: string;
  contacts!: Array<{ input: string; wa_id: string }>;
  messages!: Array<{ id: string }>;
}

export class ParsedMpesaSms {
  receiptNumber!: string;
  date!: string;
  time!: string;
  amount!: number;
  senderName!: string;
  senderPhone!: string;
  transactionType!: 'RECEIVED' | 'SENT' | 'PAYMENT';
  fees?: number;
  newBalance?: number;
}

export class OcrResult {
  totalAmount?: number;
  vendorName?: string;
  date?: string;
  lineItems?: Array<{ description: string; amount: number }>;
  confidence!: number;
  rawText!: string;
}

export class DraftTransaction {
  amount!: number;
  description!: string;
  entryDate!: string;
  reference?: string;
  source!: 'WHATSAPP_IMAGE' | 'WHATSAPP_MPESA';
  vendorName?: string;
  phoneNumber?: string;
}

export class WhatsAppReply {
  messaging_product = 'whatsapp';
  to!: string;
  type = 'text';
  text!: {
    body: string;
    preview_url: boolean;
  };
}
