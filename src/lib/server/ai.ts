import { GoogleGenAI } from '@google/genai';

const SYSTEM_PROMPT = `You are an expert penetration testing assistant helping with CPTS (Certified Penetration Testing Specialist) exam preparation on Hack The Box.

IMPORTANT: Output ONLY your final response. Never show your thinking, reasoning steps, or internal monologue. Do not narrate what you are doing. Be direct.

You help with:
- Understanding attack techniques, exploitation paths, and tooling
- Writing professional penetration test findings and reports
- Suggesting specific commands and tools for given scenarios
- Explaining Active Directory attacks, web vulnerabilities, and privilege escalation chains
- Reviewing and summarizing engagement notes

Be concise, technical, and practical. Use markdown formatting with code blocks for commands.`;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function getProvider(): 'minimax' | 'gemini' {
  const val = process.env.AI_PROVIDER;
  if (val === 'minimax') return 'minimax';
  return 'gemini';
}

function getMiniMaxModel(): string {
  return process.env.MINIMAX_MODEL ?? 'MiniMax-M2.5';
}

function getGeminiModel(): string {
  return process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
}

async function* streamMinimax(
  messages: ChatMessage[],
  noteContext?: string,
): AsyncGenerator<string> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY is not configured');

  const systemContent = noteContext
    ? `${SYSTEM_PROMPT}\n\n---\nCurrent note for context:\n${noteContext.slice(0, 4000)}`
    : SYSTEM_PROMPT;

  const baseUrl = process.env.MINIMAX_BASE_URL ?? 'https://api.minimax.io/v1';
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getMiniMaxModel(),
      messages: [{ role: 'system', content: systemContent }, ...messages],
      stream: true,
      max_tokens: 2048,
      thinking_budget: 0,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`MiniMax API error: ${response.status} - ${text}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta;
        // reasoning_content is MiniMax M2.5 chain-of-thought - never forward it.
        // Only yield delta.content when it exists and is not CoT.
        if (delta?.reasoning_content) continue;
        if (delta?.content) yield delta.content;
      } catch {
        // ignore malformed SSE lines
      }
    }
  }
}

async function* streamGemini(
  messages: ChatMessage[],
  noteContext?: string,
): AsyncGenerator<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const baseUrl = process.env.GEMINI_BASE_URL; // undefined = default Google endpoint
  const model = getGeminiModel();

  const systemContent = noteContext
    ? `${SYSTEM_PROMPT}\n\n---\nCurrent note for context:\n${noteContext.slice(0, 4000)}`
    : SYSTEM_PROMPT;

  const ai = new GoogleGenAI({ apiKey, ...(baseUrl ? { baseUrl } : {}) });

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const lastMessage = messages[messages.length - 1]?.content ?? '';

  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction: systemContent,
      maxOutputTokens: 4096,
    },
    history,
  });

  const stream = await chat.sendMessageStream({ message: lastMessage });

  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}

export async function* streamChat(
  messages: ChatMessage[],
  noteContext?: string,
): AsyncGenerator<string> {
  const provider = getProvider();
  if (provider === 'gemini') {
    yield* streamGemini(messages, noteContext);
  } else {
    yield* streamMinimax(messages, noteContext);
  }
}

export async function summarize(content: string): Promise<string> {
  const prompt = `Please summarize these penetration testing notes into a concise quick-reference card.

Extract and organize:
- **Hosts & IPs** found
- **Credentials** harvested
- **Vulnerabilities** identified (with severity if known)
- **Tools & commands** used
- **Key findings** and attack paths
- **Flags / proofs** obtained

Format with clear markdown headers. Keep it brief and scannable.\n\n---\n${content.slice(0, 6000)}`;

  let result = '';
  for await (const chunk of streamChat([{ role: 'user', content: prompt }])) {
    result += chunk;
  }
  return result;
}
