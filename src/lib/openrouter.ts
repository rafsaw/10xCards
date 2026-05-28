export type OpenRouterErrorCode = "openrouter_http_error" | "openrouter_parse_error" | "openrouter_timeout";

export class OpenRouterError extends Error {
  code: OpenRouterErrorCode;
  detail?: string;

  constructor(code: OpenRouterErrorCode, message: string, detail?: string) {
    super(message);
    this.name = "OpenRouterError";
    this.code = code;
    this.detail = detail;
  }
}

export interface CandidateCard {
  front: string;
  back: string;
}

const RESPONSE_SCHEMA = {
  name: "candidate_cards",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["cards"],
    properties: {
      cards: {
        type: "array",
        minItems: 1,
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["front", "back"],
          properties: {
            front: { type: "string", minLength: 1, maxLength: 500 },
            back: { type: "string", minLength: 1, maxLength: 2000 },
          },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = [
  "You receive a passage of source text. Produce between 3 and 10 question/answer flashcards",
  "covering its key testable claims. Each card has `front` (a question answerable from the passage)",
  "and `back` (the answer — one concept, at most 2 sentences). Write each card in the same language",
  "as the source text. Return only the structured JSON; do not add prose.",
].join(" ");

export async function generateCandidateCards(
  sourceText: string,
  opts: { apiKey: string; model: string; signal?: AbortSignal },
): Promise<CandidateCard[]> {
  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: opts.signal,
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://10x-cards.rafsaw.workers.dev",
        "X-Title": "10xCards",
      },
      body: JSON.stringify({
        model: opts.model,
        response_format: { type: "json_schema", json_schema: RESPONSE_SCHEMA },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: sourceText },
        ],
      }),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new OpenRouterError("openrouter_timeout", "OpenRouter request timed out.");
    }
    throw new OpenRouterError("openrouter_http_error", "Failed to reach OpenRouter.", String(err));
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new OpenRouterError(
      "openrouter_http_error",
      `OpenRouter returned ${response.status}. The configured model may not support JSON-schema responses.`,
      body.slice(0, 500),
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new OpenRouterError("openrouter_parse_error", "OpenRouter response was not valid JSON.");
  }

  const content = extractMessageContent(payload);
  if (content === null) {
    throw new OpenRouterError("openrouter_parse_error", "OpenRouter response had no message content.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new OpenRouterError("openrouter_parse_error", "Model output was not valid JSON.");
  }

  const cards = extractCards(parsed);
  if (cards.length === 0) {
    throw new OpenRouterError("openrouter_parse_error", "Model returned no usable cards.");
  }

  return cards.slice(0, 10);
}

function extractMessageContent(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : null;
}

function extractCards(parsed: unknown): CandidateCard[] {
  if (typeof parsed !== "object" || parsed === null) return [];
  const cards = (parsed as { cards?: unknown }).cards;
  if (!Array.isArray(cards)) return [];
  return cards.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const front = (item as { front?: unknown }).front;
    const back = (item as { back?: unknown }).back;
    if (typeof front !== "string" || typeof back !== "string") return [];
    const trimmedFront = front.trim();
    const trimmedBack = back.trim();
    if (trimmedFront.length === 0 || trimmedBack.length === 0) return [];
    return [{ front: trimmedFront, back: trimmedBack }];
  });
}
