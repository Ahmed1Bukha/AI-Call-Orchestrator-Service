import { Pool } from "pg";
import { config } from "../config/config";

export const pool = new Pool(config.database);

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log("The duration of query took around: ", duration);
    return res;
  } catch (error) {
    console.error("Database query error", { text, error });
    throw error;
  }
};
