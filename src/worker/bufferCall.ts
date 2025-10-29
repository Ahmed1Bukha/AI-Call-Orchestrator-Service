// bufferCall.ts
interface BufferedCall {
  callId: string;
  phoneNumber: string;
  addedAt: number;
}

class BufferCall {
  private buffer: Map<string, BufferedCall> = new Map(); // callId -> BufferedCall
  private readonly MAX_BUFFER_SIZE = 10000;

  async addToBuffer(callId: string, phoneNumber: string): Promise<boolean> {
    // Prevent duplicates
    if (this.buffer.has(callId)) {
      console.log(`Call ${callId} already in buffer`);
      return false;
    }

    // Check buffer size
    if (this.buffer.size >= this.MAX_BUFFER_SIZE) {
      console.error(`Buffer full (${this.buffer.size} calls)`);
      return false;
    }

    this.buffer.set(callId, {
      callId,
      phoneNumber,
      addedAt: Date.now(),
    });

    console.log(`Added call ${callId} to buffer (size: ${this.buffer.size})`);
    return true;
  }

  async getBufferedCallsByPhone(
    phoneNumber: string,
    limit: number = 10
  ): Promise<string[]> {
    const calls: BufferedCall[] = [];

    for (const bufferedCall of this.buffer.values()) {
      if (bufferedCall.phoneNumber === phoneNumber) {
        calls.push(bufferedCall);
      }
    }

    // Sort by age (oldest first - FIFO)
    calls.sort((a, b) => a.addedAt - b.addedAt);

    return calls.slice(0, limit).map((c) => c.callId);
  }

  async getAllPhoneNumbers(): Promise<string[]> {
    const phoneNumbers = new Set<string>();
    for (const call of this.buffer.values()) {
      phoneNumbers.add(call.phoneNumber);
    }
    return Array.from(phoneNumbers);
  }

  async removeFromBuffer(callId: string): Promise<void> {
    this.buffer.delete(callId);
  }

  async getBufferSize(): Promise<number> {
    return this.buffer.size;
  }

  async clearOldCalls(maxAgeMs: number = 300000): Promise<number> {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [callId, call] of this.buffer.entries()) {
      if (now - call.addedAt > maxAgeMs) {
        toRemove.push(callId);
      }
    }

    for (const callId of toRemove) {
      this.buffer.delete(callId);
      console.warn(`Removed old call ${callId} from buffer`);
    }

    return toRemove.length;
  }

  async clearBuffer(): Promise<void> {
    this.buffer.clear();
  }

  async getStats(): Promise<{
    totalBuffered: number;
    byPhoneNumber: Record<string, number>;
  }> {
    const byPhoneNumber: Record<string, number> = {};

    for (const call of this.buffer.values()) {
      byPhoneNumber[call.phoneNumber] =
        (byPhoneNumber[call.phoneNumber] || 0) + 1;
    }

    return {
      totalBuffered: this.buffer.size,
      byPhoneNumber,
    };
  }
}

export const bufferCall = new BufferCall();
