import { z } from "zod";

export const CallStatusEnumsSchema = z.enum([
  "PENDING,IN_PROGRESS,COMPLETED,FAILED,EXPIRED",
]);
export type CallStatusEnums = z.infer<typeof CallStatusEnumsSchema>;

export const CallPayloadSchema = z.object({
  to: z.string(),
  scriptId: z.string(),
  metadata: z.map(z.string(), z.any()).optional().nullable(),
});

export type CallPayload = z.infer<typeof CallPayloadSchema>;

export const CallSchema = z.object({
  id: z.uuid(),
  status: CallStatusEnumsSchema,
  attemps: z.number(),
  lastError: z.string().optional().nullable(),
  createdAt: z.date().default(() => new Date()),
  startedAt: z.date().optional().nullable(),
  endedAt: z.date().optional().nullable(),
  externalCallId: z.string().optional(),
});
export type Call = z.infer<typeof CallSchema>;

export const WebhookPayloadSchema = z.object({
  callId: z.string(),
  status: CallStatusEnumsSchema,
  durationSec: z.number().optional().nullable(),
});

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

export const AIProviderCallRequestSchema = z.object({
  to: z.string(),
  scriptId: z.string(),
  webhookUrl: z.string(),
});

export type AIProviderCallRequest = z.infer<typeof AIProviderCallRequestSchema>;

export const AIProviderCallReponseSchema = z.object({
  callId: z.string(),
  status: z.string(),
});
export type AIProviderCallReponse = z.infer<typeof AIProviderCallReponseSchema>;
