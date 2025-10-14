import dotenv from "dotenv";
dotenv.config();

import type { RequestHandler } from "express";
import { Client, middleware as lineMiddleware } from "@line/bot-sdk";

const token  = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const secret = process.env.LINE_CHANNEL_SECRET;
const hasLINE = !!token && !!secret;

export const lineClient = hasLINE
  ? new Client({ channelAccessToken: token! })
  : ({
      pushMessage: async (to: string, messages: any) => {
        console.log("[MOCK] pushMessage -> to:", to);
        console.log("[MOCK] messages:", JSON.stringify(messages, null, 2));
      }
    } as unknown as Client);

export const lineWebhookMiddleware: RequestHandler = hasLINE
  ? lineMiddleware({ channelAccessToken: token!, channelSecret: secret! } as any)
  : (_req, _res, next) => { console.warn("[MOCK] LINE webhook middleware"); next(); };

if (!hasLINE) {
  console.warn("  LINE creds not found. Running in MOCK mode (no real push).");
}
