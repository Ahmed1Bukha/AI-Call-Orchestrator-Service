import Redis from "ioredis";

import { config } from "../config/config";

class RedisService {
  private client: Redis;
  constructor() {
    this.client = new Redis(config.redis);

    this.client.on("error", (err) => {
      console.error("error with redis", err);
    });

    this.client.on("connect", () => {
      console.log("Connected to redis succefully");
    });
  }

  async getCurrentConcurrency(): Promise<number> {
    const count = await this.client.get("concurrent_calls");
    return parseInt(count || "0");
  }

  async canStartCall(phoneNumber: string): Promise<boolean> {
    const currentCalls = await this.getCurrentConcurrency();
    if (currentCalls > config.app.maxConcurrentCalls) {
      return false;
    }
    const phoneLocked = await this.client.exists(`phone_lock:${phoneNumber}`);
    return !phoneLocked;
  }
  async getClient(): Promise<Redis> {
    return this.client;
  }

  async aquireSlot(phoneNumber: string, callId: string): Promise<void> {
    await this.client.incr("concurrent_calls");
    await this.client.setex(`phone_lock:${phoneNumber}`, 600, callId);
  }

  async releaseSlot(phoneNumber: string): Promise<void> {
    await this.client.decr("concurrent_calls");
    await this.client.del(`phone_lock:${phoneNumber}`);
  }
}

export const redisService = new RedisService();
