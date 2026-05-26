import { json } from "@sveltejs/kit";
import { summarize } from "$lib/server/ai";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  let body: { content?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return json({ error: "content is required" }, { status: 400 });
  }

  try {
    const summary = await summarize(content);
    return json({ summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI error";
    return json({ error: msg }, { status: 500 });
  }
};
