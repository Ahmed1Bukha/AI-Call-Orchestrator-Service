import app from "./app";
import { WorkService } from "./worker/callWorker";

app.listen(3000, () => {
  console.log(`Server running on port ${3000}`);
});

// Add a small delay to ensure Kafka is fully ready
setTimeout(async () => {
  try {
    await WorkService.start();
  } catch (error) {
    console.error("Failed to start worker:", error);
  }
}, 5000); // 5 second delay

process.on("SIGINT", async () => {
  console.log("SIGINT signal received, stopping worker...");
  await WorkService.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM signal received, stopping worker...");
  await WorkService.stop();
  process.exit(0);
});
