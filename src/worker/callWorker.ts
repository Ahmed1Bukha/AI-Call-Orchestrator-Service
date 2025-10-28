import { callQueries } from "../database/queries";
import { queueService } from "../services/queueService";
import { redisService } from "../services/redisServices";
import { Call } from "../types/calls.type";
import { randomUUID } from "crypto";
import { config } from "../config/config";
class CallWorker {
  private isRunning: boolean = false;

  async start(): Promise<void> {
    console.log("CallWorker started");
    this.isRunning = true;
    await this.startKafkaWorker();
  }

  private async startKafkaWorker(): Promise<void> {
    await queueService.subscribe("calls", async (message) => {
      const { callId } = message;

      const call = await callQueries.getById(callId);
      console.log("Call is ", call);
      if (call && call.status === "PENDING") {
        await this.processCall(call);
      }
    });
  }

  private async processCall(call: Call): Promise<void> {
    try {
      console.log("Processing call ", call.id);
      const canStart = await redisService.canStartCall(call.payload.to);
      if (!canStart) {
        console.log(
          `Call ${call.id} cannot start because of concurrency limit`
        );
        await callQueries.updateStatus(call.id, "PENDING");
        return;
      }
      await redisService.aquireSlot(call.payload.to, call.id);
      /*
      {
        "to": "+966501234567",
        "scriptId": "welcomeFlow",
        "webhookUrl": "https://our-service.com/callbacks/call-status"
      }
      */
      await callQueries.updateExternalCallId(call.id, randomUUID());
      await callQueries.updateStatus(call.id, "IN_PROGRESS");
      return;
    } catch (error) {
      console.error(`Error processing call ${call.id}:`, error);
      await redisService.releaseSlot(call.payload.to);
      await callQueries.incrementAttempts(call.id);
      if (call.attempts + 1 < config.app.maxRetryAttempts) {
        await callQueries.updateStatus(call.id, "PENDING", String(error));
      } else {
        await callQueries.updateStatus(call.id, "FAILED", String(error));
      }
    }
  }
  async stop(): Promise<void> {
    console.log("Stopping worker...");
    this.isRunning = false;
    await queueService.disconnect();
  }
}

export const WorkService = new CallWorker();
