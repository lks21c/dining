"""Classify places into restaurant/cafe/bar/bakery using Gemini Flash."""

import json
import logging

from .openrouter_client import FLASH_MODEL, chat_completion, extract_json

logger = logging.getLogger(__name__)

VALID_TYPES = {"restaurant", "cafe", "bar", "bakery"}

SYSTEM_PROMPT = """당신은 한국 음식점/가게를 분류하는 전문가입니다.
각 가게를 아래 4가지 중 하나로 분류하세요:

- "restaurant": 일반 음식점, 맛집 (한식, 중식, 일식, 양식, 분식, 고기, 해산물, 국밥, 찌개, 면류 등)
- "cafe": 카페, 커피숍, 차 전문점, 디저트카페, 브런치카페
- "bar": 술집, 주점, 이자카야, 포차, 호프, 와인바, 칵테일바, 펍, 막걸리집, 사케바
- "bakery": 빵집, 베이커리, 제과점, 도넛, 케이크숍, 베이글, 크루아상, 마카롱, 타르트, 소금빵

분류 힌트:
- tags에 "혼카페", "혼커", "차모임" → cafe 가능성 높음
- tags에 "술모임", "혼술" → bar 가능성 높음 (단, 연탄구이/고기집/횟집 등은 restaurant)
- tags에 "간식" → bakery 또는 cafe (이름에 빵/베이글/베이커리 있으면 bakery)
- "콜키지" → bar 가능성 높음 (단, 양식/이탈리안 레스토랑은 restaurant)
- 이름에 "커피", "카페", "coffee" → cafe
- 이름에 "빵", "베이글", "베이커리", "bakery" → bakery
- 이름에 "포차", "주점", "이자카야", "펍", "bar" → bar

JSON 배열로만 응답하세요:
[{"name":"가게명","type":"restaurant|cafe|bar|bakery"}]"""


def classify_places(places: list[dict]) -> dict[str, str]:
    """Classify places into restaurant/cafe/bar/bakery.

    Args:
        places: list of dicts with keys: name, category?, tags?, description?

    Returns:
        dict mapping name -> place type
    """
    if not places:
        return {}

    BATCH_SIZE = 30
    result: dict[str, str] = {}

    for i in range(0, len(places), BATCH_SIZE):
        batch = places[i : i + BATCH_SIZE]
        items = [
            {
                "name": p["name"],
                "category": p.get("category", ""),
                "tags": p.get("tags", ""),
                "desc": (p.get("description", "") or "")[:60],
            }
            for p in batch
        ]

        try:
            content = chat_completion(
                model=FLASH_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(items, ensure_ascii=False)},
                ],
                temperature=0,
                max_tokens=4000,
            )
            if not content:
                continue

            parsed = json.loads(extract_json(content))
            for p in parsed:
                if p.get("type") in VALID_TYPES:
                    result[p["name"]] = p["type"]
        except Exception as e:
            logger.error("[classify] batch error: %s", e)

    return result


def classify_and_persist(session, records: list[dict]) -> dict[str, str]:
    """Classify crawled places that have NULL placeType and persist to DB.

    Args:
        session: SQLAlchemy session for dining.db
        records: list of dicts with id, name, category, tags, description
    """
    from .models import CrawledPlace

    if not records:
        return {}

    type_map = classify_places(
        [
            {
                "name": r["name"],
                "category": r.get("category") or "",
                "tags": r.get("tags") or "",
                "description": r.get("description") or "",
            }
            for r in records
        ]
    )

    updated = 0
    for r in records:
        pt = type_map.get(r["name"])
        if pt:
            cp = session.query(CrawledPlace).filter(CrawledPlace.id == r["id"]).first()
            if cp:
                cp.place_type = pt
                updated += 1

    if updated:
        session.commit()
        logger.info("[classify] persisted %d placeType values", updated)

    return type_map
