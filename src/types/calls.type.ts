import { z } from "zod";

export const CallStatusEnumsSchema = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "BUSY",
  "NO_ANSWER",
]);
export type CallStatusEnums = z.infer<typeof CallStatusEnumsSchema>;

export const CallPayloadSchema = z.object({
  to: z.string(),
  scriptId: z.string(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
});

export type CallPayload = z.infer<typeof CallPayloadSchema>;

export const CallSchema = z.object({
  id: z.uuid(),
  status: CallStatusEnumsSchema,
  attempts: z.number(),
  payload: CallPayloadSchema,
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
  status: CallStatusEnumsSchema,
  durationSec: z.number().optional().nullable(),
  completedAt: z.date().optional().nullable(),
});
export type AIProviderCallReponse = z.infer<typeof AIProviderCallReponseSchema>;

export const WebhookCallbackSchema = z.object({
  callId: z.string(),
  status: CallStatusEnumsSchema,
  durationSec: z.number().optional().nullable(),
  completedAt: z.coerce.date().optional().nullable(),
});
export type WebhookCallback = z.infer<typeof WebhookCallbackSchema>;
