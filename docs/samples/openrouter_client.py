"""OpenRouter API client for dining LLM calls."""

import os
import re
import logging

import requests

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-3-pro-preview")
FLASH_MODEL = os.getenv("OPENROUTER_FLASH_MODEL", "google/gemini-2.5-flash")


def _get_api_key():
    return os.getenv("OPENROUTER_API_KEY", "")


def extract_json(text: str) -> str:
    """Strip markdown code fences that Gemini sometimes wraps around JSON."""
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    return m.group(1).strip() if m else text.strip()


def chat_completion(model: str, messages: list, temperature: float = 0, max_tokens: int = 4000) -> str | None:
    """Call OpenRouter chat completion and return content string."""
    api_key = _get_api_key()
    if not api_key:
        logger.warning("OPENROUTER_API_KEY not set")
        return None

    try:
        resp = requests.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("choices", [{}])[0].get("message", {}).get("content")
    except Exception as e:
        logger.error("OpenRouter API error: %s", e)
        raise
