"""Place mapper — convert DB models to API response dicts."""

import json
import re


def map_seed_places(restaurants, cafes, parking_lots) -> list[dict]:
    """Map seed data (ORM objects) to Place dicts."""
    result = []

    for r in restaurants:
        result.append({
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "lat": r.lat,
            "lng": r.lng,
            "type": "restaurant",
            "category": r.category,
            "priceRange": r.price_range,
            "atmosphere": r.atmosphere,
            "goodFor": r.good_for,
            "rating": r.rating,
            "reviewCount": r.review_count,
            "parkingAvailable": r.parking_available,
            "nearbyParking": r.nearby_parking,
        })

    for c in cafes:
        result.append({
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "lat": c.lat,
            "lng": c.lng,
            "type": "cafe",
            "specialty": c.specialty,
            "priceRange": c.price_range,
            "atmosphere": c.atmosphere,
            "goodFor": c.good_for,
            "rating": c.rating,
            "reviewCount": c.review_count,
            "parkingAvailable": c.parking_available,
            "nearbyParking": c.nearby_parking,
        })

    for p in parking_lots:
        result.append({
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "lat": p.lat,
            "lng": p.lng,
            "type": "parking",
            "parkingType": p.type,
            "address": p.address,
            "capacity": p.capacity,
            "hourlyRate": p.hourly_rate,
            "baseTime": p.base_time,
            "baseRate": p.base_rate,
            "extraTime": p.extra_time,
            "extraRate": p.extra_rate,
            "freeNote": p.free_note,
            "operatingHours": p.operating_hours,
        })

    return result


def map_crawled_to_places(crawled_places, llm_type_map: dict | None = None) -> list[dict]:
    """Map crawled place ORM objects to Place dicts."""
    if llm_type_map is None:
        llm_type_map = {}

    result = []
    for cp in crawled_places:
        if cp.lat is None or cp.lng is None:
            continue

        p_type = cp.place_type or llm_type_map.get(cp.name) or "restaurant"
        first_source = cp.sources[0] if cp.sources else None

        base = {
            "id": cp.id,
            "name": cp.name,
            "description": cp.description or (first_source.snippet if first_source else None) or "다이닝코드 크롤링",
            "lat": cp.lat,
            "lng": cp.lng,
            "priceRange": cp.price_range or "미정",
            "atmosphere": cp.atmosphere or "미정",
            "goodFor": cp.good_for or "미정",
            "rating": first_source.rating if first_source else 0,
            "reviewCount": first_source.review_count if first_source else 0,
            "parkingAvailable": False,
            "nearbyParking": None,
            "tags": cp.tags,
        }

        if p_type == "cafe":
            base["type"] = "cafe"
            base["specialty"] = cp.category or "카페"
        elif p_type == "bar":
            base["type"] = "bar"
            base["category"] = cp.category or "술집"
        elif p_type == "bakery":
            base["type"] = "bakery"
            base["specialty"] = cp.category or "빵집"
        else:
            base["type"] = "restaurant"
            base["category"] = cp.category or "맛집"

        result.append(base)

    return result


def rank_by_diningcode(crawled_as_places: list[dict], crawled_places) -> None:
    """Add diningcodeRank to places based on DiningCode score."""
    valid_crawled = [cp for cp in crawled_places if cp.lat is not None and cp.lng is not None]

    with_scores = []
    for i, p in enumerate(crawled_as_places):
        if i >= len(valid_crawled):
            break
        dc_source = next((s for s in valid_crawled[i].sources if s.source == "diningcode"), None)
        meta = dc_source.metadata_ if dc_source else None
        score = None
        if meta:
            try:
                score = json.loads(meta).get("score")
            except Exception:
                pass
        if score is not None:
            with_scores.append({"place": p, "score": score})

    with_scores.sort(key=lambda x: x["score"], reverse=True)

    for i, x in enumerate(with_scores):
        if x["place"].get("type") != "parking":
            x["place"]["diningcodeRank"] = i + 1


def deduplicate_places(seed_places: list[dict], crawled_as_places: list[dict]) -> list[dict]:
    """Remove duplicate crawled places that match seed data by name."""
    seed_names = {p["name"].lower() for p in seed_places}
    unique_crawled = [p for p in crawled_as_places if p["name"].lower() not in seed_names]
    return seed_places + unique_crawled


def extract_region(address: str | None) -> str:
    """Extract region (구/시) from Korean address string."""
    if not address:
        return "기타"

    # Metropolitan city + 구/군
    m = re.match(r"^(서울특별시|서울)\s+(\S+[구군])", address)
    if m:
        return m.group(2)

    # Other metro cities
    m = re.match(r"^(대구|부산|인천|광주|대전|울산)(광역시)?\s+(\S+[구군])", address)
    if m:
        return f"{m.group(1)} {m.group(3)}"

    # Province + city
    m = re.match(
        r"^(경기도|충청[남북]도|전라[남북]도|경상[남북]도|강원도|제주특별자치도|세종특별자치시)\s*(\S+[시군구])?",
        address,
    )
    if m:
        return f"{m.group(1)} {m.group(2)}" if m.group(2) else m.group(1)

    # Fallback
    m = re.search(r"(\S+[구군시])", address)
    if m:
        return m.group(1)

    return "기타"
