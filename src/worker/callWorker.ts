import { callQueries } from "../database/queries";
import { queueService } from "../services/queueService";
import { redisService } from "../services/redisServices";
import { randomUUID } from "crypto";
import { config } from "../config/config";
import { bufferCall } from "./bufferCall";

class CallWorker {
  private isRunning: boolean = false;
  private bufferCheckInterval: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    console.log("CallWorker started");
    this.isRunning = true;
    this.startBufferChecker();
    await this.startKafkaWorker();
  }

  private async startKafkaWorker(): Promise<void> {
    try {
      await queueService.subscribe("calls", async (message) => {
        const { callId, to } = message;
        await this.handleCall(callId, to);
      });
    } catch (error) {
      console.error("Error starting Kafka worker:", error);
      throw error;
    }
  }

  private async handleCall(callId: string, to: string): Promise<void> {
    const processed = await this.tryProcessImmediately(callId, to);

    if (!processed) {
      const buffered = await bufferCall.addToBuffer(callId, to);

      if (!buffered) {
        console.error(`Failed to buffer call ${callId}`);
      }
    }
  }

  private async tryProcessImmediately(
    callId: string,
    to: string
  ): Promise<boolean> {
    const canStart = await redisService.canStartCall(to);

    if (!canStart) {
      console.log(`No slot available for call ${callId}, will buffer`);
      return false;
    }
    const call = await callQueries.getById(callId);
    if (!call) {
      console.error(`Call ${callId} not found`);
      return false;
    }
    try {
      await redisService.aquireSlot(to, callId);

      await callQueries.updateExternalCallId(callId, randomUUID());
      await callQueries.updateStatus(callId, "IN_PROGRESS");

      console.log(`Processed call ${callId} immediately`);
      return true;
    } catch (error) {
      console.error(`Error processing call ${callId}:`, error);

      await redisService.releaseSlot(to);

      await callQueries.incrementAttempts(callId);

      if (call.attempts + 1 < config.app.maxRetryAttempts) {
        await callQueries.updateStatus(call.id, "PENDING", String(error));
        return false;
      } else {
        await callQueries.updateStatus(call.id, "FAILED", String(error));
        return true;
      }
    }
  }

  private startBufferChecker(): void {
    console.log("Starting buffer checker");
    this.bufferCheckInterval = setInterval(async () => {
      await this.processBufferedCalls();
    }, config.app.bufferCheckInterval || 2000);
  }

  private async processBufferedCalls(): Promise<void> {
    try {
      const bufferSize = await bufferCall.getBufferSize();

      if (bufferSize === 0) {
        return;
      }

      console.log(`Checking buffer (${bufferSize} calls)`);

      const phoneNumbers = await bufferCall.getAllPhoneNumbers();

      for (const phoneNumber of phoneNumbers) {
        const currentConcurrency = await redisService.getCurrentConcurrency();

        if (currentConcurrency >= config.app.maxConcurrentCalls) {
          console.log(`No concurrency for ${phoneNumber}, skipping`);
          continue;
        }

        const callIds = await bufferCall.getBufferedCallsByPhone(
          phoneNumber,
          currentConcurrency
        );

        console.log(
          `Processing ${callIds.length} buffered calls for ${phoneNumber}`
        );

        for (const callId of callIds) {
          const call = await callQueries.getById(callId);

          if (!call) {
            console.warn(`Buffered call ${callId} not found in DB`);
            await bufferCall.removeFromBuffer(callId);
            continue;
          }

          if (call.status !== "PENDING") {
            console.log(
              `Buffered call ${callId} is ${call.status}, removing from buffer`
            );
            await bufferCall.removeFromBuffer(callId);
            continue;
          }

          const processed = await this.tryProcessImmediately(
            call.id,
            call.payload.to
          );

          if (processed) {
            await bufferCall.removeFromBuffer(callId);
          }
        }
      }

      const removed = await bufferCall.clearOldCalls(300000);
      if (removed) {
        console.warn(`Removed ${removed} old calls from buffer`);
      }
    } catch (error) {
      console.error("Error processing buffered calls:", error);
    }
  }

  async stop(): Promise<void> {
    console.log("Stopping worker...");
    this.isRunning = false;

    if (this.bufferCheckInterval) {
      clearInterval(this.bufferCheckInterval);
    }

    await queueService.disconnect();
  }

  async getBufferStats() {
    return await bufferCall.getStats();
  }
}

export const WorkService = new CallWorker();
