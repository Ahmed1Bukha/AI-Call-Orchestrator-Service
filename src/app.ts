import express from "express";
import morgan from "morgan";
import { callsRouter } from "./routes/calls.routes";
import { metricRouter } from "./routes/metric.routes";
import { callbacksRouter } from "./routes/callbacks.routes";
const app = express();

// Log requests early and force output via console.log
app.use(morgan("dev", { stream: process.stdout }));
app.use(express.json());

app.use("/api/v1/calls", callsRouter);
app.use("/api/v1/metrics", metricRouter);
app.use("/api/v1/callbacks", callbacksRouter);

app.get("/", (req, res) => {
  res.send("Hello World");
});
export default app;
