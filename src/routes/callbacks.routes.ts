import { Router, Request, Response } from "express";
import { WebhookCallbackSchema } from "../types/calls.type";
import { config } from "../config/config";
import { callQueries } from "../database/queries";
import { redisService } from "../services/redisServices";
const router = Router();
//POST /callbacks/call-status: process call status callback
router.post("/call-status", async (req: Request, res: Response) => {
  try {
    console.log("Callback is ", req.body);
    const api_key = req.headers["x-api-key"];
    if (!api_key) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (api_key !== config.app.apiKey) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const callback = WebhookCallbackSchema.parse(req.body);
    if (!callback.callId || !callback.status) {
      return res.status(400).json({ error: "Callback is required" });
    }
    const call = await callQueries.getByExternalId(callback.callId);
    if (!call) {
      return res.status(404).json({ error: "Call not found" });
    }
    await callQueries.updateStatus(
      call.id,
      callback.status,
      undefined,
      undefined,
      callback.completedAt ? new Date(callback.completedAt) : undefined
    );
    await redisService.releaseSlot(call.payload.to);

    return res.status(200).json({ message: "Callback received" });
  } catch (error) {
    console.error("Error processing callback:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export const callbacksRouter = router;
