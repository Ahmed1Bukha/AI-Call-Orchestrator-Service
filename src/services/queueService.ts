import { Kafka, Producer, Consumer } from "kafkajs";
import { config } from "../config/config";

class QueueService {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;

  constructor() {
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
    });
  }

  async getProducer(): Promise<Producer> {
    if (!this.producer) {
      this.producer = this.kafka.producer();
      await this.producer.connect();
    }
    return this.producer;
  }

  async publish(topic: string, message: any): Promise<void> {
    const producer = await this.getProducer();
    await producer.send({
      topic,
      messages: [
        {
          value: JSON.stringify(message),
        },
      ],
    });
  }

  async subscribe(
    topic: string,
    handler: (message: any) => Promise<void>
  ): Promise<void> {
    if (!this.consumer) {
      this.consumer = this.kafka.consumer({
        groupId: config.kafka.groupId,
      });
      await this.consumer.connect();
      await this.consumer.subscribe({ topic, fromBeginning: false });

      await this.consumer.run({
        autoCommit: false,
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const value = JSON.parse(message.value?.toString() || "{}");
            await handler(value);
          } catch (error) {
            console.error("Error processing message:", error);
          }
        },
      });
    }
  }

  async disconnect(): Promise<void> {
    if (this.producer) await this.producer.disconnect();
    if (this.consumer) await this.consumer.disconnect();
  }
}

export const queueService = new QueueService();
