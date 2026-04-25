import { getAiConfig } from '$lib/server/ai';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  try {
    const config = getAiConfig();
    return new Response(JSON.stringify(config), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Configuration unavailable' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
