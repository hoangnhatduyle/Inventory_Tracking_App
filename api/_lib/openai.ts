import { env } from './env.js';
import { ApiError } from './errors.js';

// Minimal wrapper over the OpenAI chat-completions API. We deliberately avoid
// the `openai` SDK to keep cold start small and to make the surface easy to
// audit. User input is passed only inside `user` messages; system prompts are
// fixed strings under our control.

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }
      >;
}

interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  responseFormat?: 'json_object' | 'text';
  maxOutputTokens?: number;
}

export async function chat(req: ChatRequest): Promise<string> {
  const body: Record<string, unknown> = {
    model: req.model ?? env.openaiModel,
    messages: req.messages,
  };
  if (req.responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }
  if (req.maxOutputTokens) {
    body.max_completion_tokens = req.maxOutputTokens;
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.openaiApiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // Never leak upstream error bodies to the client (audit M7, M8, M9).
    const upstream = await res.text().catch(() => '');
    console.error('[openai] upstream error', res.status, upstream);
    throw new ApiError(
      'INTERNAL',
      'AI service is temporarily unavailable',
    );
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.length === 0) {
    throw new ApiError('INTERNAL', 'AI returned an empty response');
  }
  return content;
}

// Safe JSON.parse for AI responses: returns null instead of throwing,
// callers decide what to do on parse failure.
export function safeJsonParse<T = unknown>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}
