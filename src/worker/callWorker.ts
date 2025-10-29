// callWorker.ts
import { callQueries } from "../database/queries";
import { queueService } from "../services/queueService";
import { redisService } from "../services/redisServices";
import { Call } from "../types/calls.type";
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
    // Try to process immediately
    const processed = await this.tryProcessImmediately(callId, to);

    if (!processed) {
      // Add to buffer for later processing
      const buffered = await bufferCall.addToBuffer(callId, to);

      if (!buffered) {
        console.error(`Failed to buffer call ${callId}`);
        // Optionally mark as failed or let it retry
      }
    }

    // DON'T THROW - let Kafka commit the offset
  }

  private async tryProcessImmediately(
    callId: string,
    to: string
  ): Promise<boolean> {
    const canStart = await redisService.canStartCall(to);

    if (!canStart) {
      console.log(`No slot available for call ${callId}, will buffer`);
      return false; // Will be buffered
    }
    const call = await callQueries.getById(callId);
    if (!call) {
      console.error(`Call ${callId} not found`);
      return false;
    }
    try {
      await redisService.aquireSlot(to, callId);

      // Successfully acquired slot, process it
      await callQueries.updateExternalCallId(callId, randomUUID());
      await callQueries.updateStatus(callId, "IN_PROGRESS");

      console.log(`✅ Processed call ${callId} immediately`);
      return true;
    } catch (error) {
      console.error(`Error processing call ${callId}:`, error);

      // Release slot if we acquired it
      await redisService.releaseSlot(to);

      // Handle retries
      await callQueries.incrementAttempts(callId);

      if (call.attempts + 1 < config.app.maxRetryAttempts) {
        await callQueries.updateStatus(call.id, "PENDING", String(error));
        return false; // Will be buffered for retry
      } else {
        await callQueries.updateStatus(call.id, "FAILED", String(error));
        return true; // Don't buffer, it's failed
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
        return; // Nothing to process
      }

      console.log(`Checking buffer (${bufferSize} calls)`);

      // Get all unique phone numbers in buffer
      const phoneNumbers = await bufferCall.getAllPhoneNumbers();

      for (const phoneNumber of phoneNumbers) {
        // Check how many slots available for this number
        const currentConcurrency = await redisService.getCurrentConcurrency();

        if (currentConcurrency >= config.app.maxConcurrentCalls) {
          console.log(`No concurrency for ${phoneNumber}, skipping`);
          continue;
        }

        // Get buffered calls for this phone number (up to available slots)
        const callIds = await bufferCall.getBufferedCallsByPhone(
          phoneNumber,
          currentConcurrency
        );

        console.log(
          `Processing ${callIds.length} buffered calls for ${phoneNumber}`
        );

        // Process each call
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
            // Successfully processed, remove from buffer
            await bufferCall.removeFromBuffer(callId);
          }
          // If not processed, leave in buffer for next iteration
        }
      }

      // Cleanup old calls from buffer
      const removed = await bufferCall.clearOldCalls(300000); // 5 minutes
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

  // Monitoring method
  async getBufferStats() {
    return await bufferCall.getStats();
  }
}

export const WorkService = new CallWorker();
