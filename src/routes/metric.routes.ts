import { Router, Request, Response } from "express";
import { callQueries } from "../database/queries";

const router = Router();

//GET /metrics: get metrics
router.get("/", async (req: Request, res: Response) => {
  try {
    const metrics = await callQueries.getMetrics();
    return res.status(200).json({ data: metrics });
  } catch (error) {
    console.error("Error getting metrics:", error);
  }
});

export const metricRouter = router;
