import { Router, Request, Response } from "express";
import { callQueries } from "../database/queries";
import { CallPayloadSchema, CallStatusEnumsSchema } from "../types/calls.type";
import { queueService } from "../services/queueService";

const router = Router();

//Get /calls:id | return calls
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(404).json({ error: "ID not provided" });
    }
    const call = await callQueries.getById(id);
    if (!call) {
      return res.status(404).json({ error: "call is not found" });
    }
    return res.status(200).json({ data: call });
  } catch (error) {
    console.error("Error fetching call:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//POST /calls: create a new call
router.post("/", async (req: Request, res: Response) => {
  try {
    const payload = CallPayloadSchema.parse(req.body);
    const call = await callQueries.create(payload);
    try {
      await queueService.publish("calls", { callId: call.id });
    } catch (error) {
      console.warn("Could not publish to Kafka");
    }
    return res
      .status(201)
      .json({ data: call, message: "Call created successfully" });
  } catch (error) {
    console.error("Error creating call:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to create call",
      details: error,
    });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(404).json({ error: "ID not provided" });
    }
    const status = CallStatusEnumsSchema.parse(req.body.status);
    const call = await callQueries.updateStatus(id, status, req.body.error);
    return res
      .status(200)
      .json({ data: call, message: "Call updated successfully" });
  } catch (error) {
    console.error("Error updating call:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to update call",
      details: error,
    });
  }
});
//GET /calls: list all calls
router.get("/", async (req: Request, res: Response) => {
  try {
    const status = CallStatusEnumsSchema.parse(req.query.status);
    const { limit, offset } = req.query;
    const calls = await callQueries.listByStatus(
      status,
      Number(limit) || 10,
      Number(offset) || 0
    );
    return res.status(200).json({ data: calls });
  } catch (error) {
    console.error("Error listing calls:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export const callsRouter = router;
