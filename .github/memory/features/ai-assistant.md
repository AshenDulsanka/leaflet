# AI Assistant

## Purpose
Optional AI-powered features: chat with context from the current note, and summarize note content. Uses Google Gemini as the AI provider. All AI features are hidden when `GEMINI_API_KEY` is not set. The availability check happens at load time via `/api/ai/status`.

## Key Files
- `src/lib/components/panels/AiChat.svelte` — chat panel; sends messages with current note as context
- `src/lib/components/panels/SummarizePanel.svelte` — summarize button and result display
- `src/lib/server/ai.ts` — server-side Gemini API client; builds prompts, handles streaming or one-shot responses
- `src/routes/api/ai/` — API routes: `/status` (GET availability), `/chat` (POST), `/summarize` (POST)

## Status
stable

## Notes
- Requires `GEMINI_API_KEY` env var. Never hardcode the key.
- `/api/ai/status` returns `{ available: boolean }` — UI reads this on mount to conditionally render AI panels.
- No AI feature may block or be required for core note-taking workflows.
- If a different AI provider is added in future, add a new env var and update `/api/ai/status` logic.
