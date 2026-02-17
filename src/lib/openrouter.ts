import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenRouter(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }
  return _client;
}

export const MODEL = process.env.OPENROUTER_MODEL || "google/gemini-3-pro-preview";
export const FLASH_MODEL = process.env.OPENROUTER_FLASH_MODEL || "google/gemini-2.5-flash";

/** Strip markdown code fences that Gemini sometimes wraps around JSON */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : text.trim();
}
