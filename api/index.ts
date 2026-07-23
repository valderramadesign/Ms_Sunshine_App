import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createApp } from "../server/app";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await createApp();
  app(req, res);
}
