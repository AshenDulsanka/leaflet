import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  const provider = process.env.AI_PROVIDER === "gemini" ? "gemini" : "minimax";

  const status = {
    provider,
    model:
      provider === "gemini"
        ? (process.env.GEMINI_MODEL ?? "gemini-2.5-flash")
        : (process.env.MINIMAX_MODEL ?? "MiniMax-M2.5"),
    endpoint:
      provider === "gemini"
        ? (process.env.GEMINI_BASE_URL ??
          "https://generativelanguage.googleapis.com")
        : (process.env.MINIMAX_BASE_URL ?? "https://api.minimax.io/v1"),
    keyConfigured:
      provider === "gemini"
        ? Boolean(process.env.GEMINI_API_KEY)
        : Boolean(process.env.MINIMAX_API_KEY),
  };

  return json(status);
};
