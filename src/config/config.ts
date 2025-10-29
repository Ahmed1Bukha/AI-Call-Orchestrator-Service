import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3000"),
  nodeEnv: process.env.NODE_ENV || "development",

  database: {
    host: process.env.DATABASE_HOST || "localhost",
    port: parseInt(process.env.DATABASE_PORT || "5432"),
    database: process.env.DATABASE_NAME || "ebra-calls",
    user: process.env.DATABASE_USER || "postgres",
    password: process.env.DATABASE_PASSWORD || "password",
  },

  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
    clientId: process.env.KAFKA_CLIENT_ID || "ebra-kafka",
    groupId: process.env.KAFKA_GROUP_ID || "call-workers",
  },

  app: {
    apiKey: process.env.API_KEY || "secret",
    baseUrl: process.env.BASE_URL || "http://localhost:3000",
    maxConcurrentCalls: parseInt(process.env.MAX_CONCURRENT_CALLS || "30"),
    maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || "3"),
    bufferCheckInterval: parseInt(process.env.BUFFER_CHECK_INTERVAL || "2000"),
  },
};
