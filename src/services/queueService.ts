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
  async createTopic(topic: string): Promise<void> {
    const admin = this.kafka.admin();
    try {
      await admin.connect();
      const topics = await admin.listTopics();
      if (!topics.includes(topic)) {
        await admin.createTopics({
          topics: [{ topic, numPartitions: 1, replicationFactor: 1 }],
          waitForLeaders: true,
        });

        // Ensure metadata is stabilized before proceeding
        for (let attempt = 0; attempt < 10; attempt++) {
          const metadata = await admin.fetchTopicMetadata({ topics: [topic] });
          const hasPartitions = metadata.topics.some(
            (t) => t.name === topic && t.partitions.length > 0
          );
          if (hasPartitions) break;
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      console.log(`Topic ${topic} created`);
    } catch (error) {
      console.error("Error creating topic:", error);
      throw error;
    } finally {
      await admin.disconnect();
    }
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
      await this.createTopic(topic);
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
