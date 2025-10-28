import express from "express";
import { Call, CallSchema } from "./types/calls.type";
import z from "zod";
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World");
});
export default app;
