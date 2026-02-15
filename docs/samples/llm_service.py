"""LLM service for location extraction and course-based recommendations."""

import json
import math
import logging

from .openrouter_client import MODEL, chat_completion, extract_json

logger = logging.getLogger(__name__)


def calc_distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    """Calculate distance in meters between two coordinates using Haversine."""
    R = 6371000
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return round(2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def _compress_place(place: dict, index: int, anchor: dict | None = None) -> str:
    """Compress a place dict into a compact string for LLM input."""
    ptype = place.get("type", "restaurant")
    prefix = {"restaurant": "R", "cafe": "C", "bar": "R", "bakery": "C"}.get(ptype, "P")
    pid = f"{prefix}{index}"

    dist_str = ""
    if anchor:
        dist = calc_distance_m(anchor["lat"], anchor["lng"], place["lat"], place["lng"])
        dist_str = f"|{dist}m"

    if ptype in ("restaurant", "bar"):
        return (
            f"{pid}|{place['name']}|{place.get('category', '')}|{place.get('priceRange', '')}|"
            f"{place.get('atmosphere', '')}|{place.get('goodFor', '')}|"
            f"★{place.get('rating', 0)}|주차{'O' if place.get('parkingAvailable') else 'X'}{dist_str}"
        )
    if ptype in ("cafe", "bakery"):
        return (
            f"{pid}|{place['name']}|{place.get('specialty', '')}|{place.get('priceRange', '')}|"
            f"{place.get('atmosphere', '')}|{place.get('goodFor', '')}|"
            f"★{place.get('rating', 0)}|주차{'O' if place.get('parkingAvailable') else 'X'}{dist_str}"
        )
    # parking
    return (
        f"{pid}|{place['name']}|{place.get('parkingType', '')}|{place.get('hourlyRate', 0)}원/시|"
        f"{place.get('capacity', 0)}대|{place.get('operatingHours', '')}{dist_str}"
    )


def _build_system_prompt(anchor: dict | None = None) -> str:
    anchor_instruction = ""
    if anchor:
        anchor_instruction = f"""
앵커 위치: {anchor['name']} ({anchor['lat']}, {anchor['lng']})
- 각 장소까지의 거리(m)가 데이터에 포함되어 있습니다.
- 앵커 기준으로 최소 이동 동선을 구성하세요.
- 걸어서 이동 가능한 범위(도보 15분, ~1km)를 우선하세요."""

    return f"""당신은 한국 맛집 추천 전문 AI입니다.
사용자의 자연어 요청을 분석하여 여러 코스를 조합해서 추천합니다.
{anchor_instruction}

역할:
1. 사용자 맥락 파싱 (누구와, 목적, 분위기, 예산, 위치)
2. 사용자의 모든 조건을 AND로 결합하여 필터링
3. 맛집+카페/디저트 조합으로 여러 코스를 구성
4. 각 코스마다 방문 순서 제안

응답은 반드시 다음 JSON 형식으로:
{{
  "summary": "(아래 작성 가이드 참조 — 풍부하고 상세하게 작성할 것)",
  "persona": "사용자 맥락 요약",
  "courses": [
    {{
      "courseNumber": 1,
      "title": "맛집명 + 카페명 코스",
      "stops": [
        {{ "order": 1, "id": "P1", "type": "parking", "reason": "추천 이유" }},
        {{ "order": 2, "id": "R3", "type": "restaurant", "reason": "추천 이유" }},
        {{ "order": 3, "id": "C2", "type": "cafe", "reason": "추천 이유" }}
      ],
      "routeSummary": "주차장 → 도보5분 → 맛집 → 도보3분 → 카페"
    }}
  ]
}}

★ 코스 구성 규칙 (가장 중요):
- 코스는 2~4개 생성 (데이터가 적으면 최소 1개)
- 각 코스의 기본 구성: 맛집 1개 + 카페/디저트 1개
- 디저트 전문점, 테이크아웃, 베이커리 등이 있으면 추가 stop으로 넣어도 됨
- 차로 이동하는 경우("차대고", "주차") 각 코스에 주차장 1개를 첫 번째로 배치 (같은 주차장 공유 가능)
- 각 코스는 서로 다른 특색 (예: 고기코스, 해산물코스, 이탈리안코스 등)
- title은 핵심 장소명 조합 (예: "육몽 + 콩카페", "바토스 + 오띠젤리")
- 같은 카페가 다른 맛집과 조합되어도 OK
- 같은 맛집이 다른 카페와 조합되어도 OK

★ summary 작성 가이드:
summary는 사용자에게 직접 보여주는 메인 텍스트입니다:

1) 도입부 (2-3문장): 해당 지역의 특성, 주차 상황, 접근성 등 유용한 정보
2) 추천 가능한 맛집/카페 소개 (번호 매겨서):
   - **장소명** (볼드)
   - 어떤 곳인지 2-3문장 상세 설명 (대표 메뉴, 맛의 특징, 분위기 등)
   - 특징: 한줄 요약
   - 평점: 데이터에 있으면 표기
3) 마무리 팁 (1-2문장): 주차 팁, 예약 팁, 방문 시간 팁 등

규칙:
- type은 반드시 "restaurant", "cafe", "parking" 중 하나
- id는 입력된 장소 목록의 ID를 그대로 사용
- JSON만 응답, 다른 텍스트 금지
- summary 안에서 줄바꿈은 \\n 사용
- 조건에 맞는 장소가 부족하면 가장 가까운 대안을 추천하되, 이유에 "대안" 명시"""


def extract_location(query: str) -> dict:
    """Extract location name from natural language query.

    Returns: {"location": str|None, "error": str|None}
    """
    try:
        content = chat_completion(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": """사용자 요청에서 지명/장소명을 추출하세요.
"~에", "~에서", "~근처", "~앞", "~주변" 등의 위치 표현에서 장소명만 추출합니다.
위치 표현이 없으면 "NONE"을 반환합니다.
장소명만 반환, 다른 텍스트 금지.

예시:
- "용산구청에 차대고 갈만한 맛집" → "용산구청"
- "홍대 근처 카페" → "홍대"
- "강남역 주변 맛집" → "강남역"
- "혼밥하기 좋은 조용한 곳" → "NONE"
- "4인 가족 이태원 맛집" → "이태원\"""",
                },
                {"role": "user", "content": query},
            ],
            temperature=0,
            max_tokens=2000,
        )
        if not content:
            return {"location": None}
        result = content.strip()
        if result == "NONE":
            return {"location": None}
        return {"location": result}
    except Exception as e:
        logger.error("Location extraction error: %s", e)
        return {"location": None, "error": str(e)}


def get_recommendations(query: str, places: list[dict], anchor: dict | None = None) -> dict:
    """Get course-based recommendations from LLM.

    Returns: {"summary": str, "persona": str, "courses": list, "warning": str?}
    """
    id_map: dict[str, dict] = {}
    compressed = []
    for i, p in enumerate(places):
        ptype = p.get("type", "restaurant")
        prefix = {"restaurant": "R", "cafe": "C", "bar": "R", "bakery": "C"}.get(ptype, "P")
        pid = f"{prefix}{i}"
        id_map[pid] = p
        compressed.append(_compress_place(p, i, anchor))

    user_message = f"장소 목록:\n{chr(10).join(compressed)}\n\n사용자 요청: {query}"

    try:
        content = chat_completion(
            model=MODEL,
            messages=[
                {"role": "system", "content": _build_system_prompt(anchor)},
                {"role": "user", "content": user_message},
            ],
            temperature=0.5,
            max_tokens=16000,
        )
        if not content:
            raise ValueError("No response from LLM")

        parsed = json.loads(extract_json(content))

        # Map compressed IDs back to real IDs
        courses = []
        for c in parsed.get("courses", []):
            stops = []
            for s in c.get("stops", []):
                if s["id"] in id_map:
                    real_place = id_map[s["id"]]
                    stops.append({
                        "order": s["order"],
                        "id": real_place["id"],
                        "type": real_place["type"],
                        "reason": s.get("reason", ""),
                    })
            courses.append({
                "courseNumber": c.get("courseNumber", 1),
                "title": c.get("title", ""),
                "stops": stops,
                "routeSummary": c.get("routeSummary", ""),
            })

        return {
            "summary": parsed.get("summary", ""),
            "persona": parsed.get("persona", ""),
            "courses": courses,
        }
    except Exception as e:
        logger.error("LLM error, falling back to keyword search: %s", e)
        err_msg = str(e)
        if "401" in err_msg or "403" in err_msg or "API key" in err_msg:
            warning = "AI 추천 서비스에 연결할 수 없습니다 (API 키 오류). 키워드 기반 검색 결과를 대신 표시합니다."
        elif "404" in err_msg or "No allowed providers" in err_msg:
            warning = "AI 모델에 연결할 수 없습니다 (모델 설정 오류). 키워드 기반 검색 결과를 대신 표시합니다."
        else:
            warning = "AI 추천 서비스에 일시적 오류가 발생했습니다. 키워드 기반 검색 결과를 대신 표시합니다."
        result = _keyword_fallback(query, places)
        result["warning"] = warning
        return result


def _keyword_fallback(query: str, places: list[dict]) -> dict:
    """Simple keyword-based fallback when LLM is unavailable."""
    keywords = query.lower().split()

    scored = []
    for p in places:
        score = 0
        search_text = " ".join(
            filter(None, [
                p.get("name", ""),
                p.get("description", ""),
                p.get("category", ""),
                p.get("specialty", ""),
                p.get("atmosphere", ""),
                p.get("goodFor", ""),
            ])
        ).lower()

        for kw in keywords:
            if kw in search_text:
                score += 1
        scored.append({"place": p, "score": score})

    scored.sort(key=lambda x: x["score"], reverse=True)

    restaurants = [s for s in scored if s["place"].get("type") == "restaurant" and s["score"] > 0][:3]
    cafes = [s for s in scored if s["place"].get("type") == "cafe" and s["score"] > 0][:2]

    if not restaurants:
        restaurants = [s for s in scored if s["place"].get("type") == "restaurant"][:2]
    if not cafes:
        cafes = [s for s in scored if s["place"].get("type") == "cafe"][:1]

    courses = []
    for i, r in enumerate(restaurants):
        cafe = cafes[i % len(cafes)] if cafes else None
        stops = [{"order": 1, "id": r["place"]["id"], "type": r["place"]["type"], "reason": "인기 맛집"}]
        if cafe:
            stops.append({"order": 2, "id": cafe["place"]["id"], "type": cafe["place"]["type"], "reason": "인기 카페"})
        title = f"{r['place']['name']} + {cafe['place']['name']}" if cafe else r["place"]["name"]
        courses.append({
            "courseNumber": i + 1,
            "title": title,
            "stops": stops,
            "routeSummary": " → ".join(s.get("reason", "") for s in stops),
        })

    if not courses:
        top3 = scored[:3]
        courses = [{
            "courseNumber": 1,
            "title": "추천 코스",
            "stops": [
                {"order": i + 1, "id": s["place"]["id"], "type": s["place"]["type"], "reason": "키워드 매칭"}
                for i, s in enumerate(top3)
            ],
            "routeSummary": " → ".join(s["place"]["name"] for s in top3),
        }]

    all_names = [r["place"]["name"] for r in restaurants] + [c["place"]["name"] for c in cafes]
    return {
        "summary": f'"{query}" 검색 결과입니다. {", ".join(all_names)} 등을 조합한 코스를 추천드려요!',
        "persona": query,
        "courses": courses,
    }
