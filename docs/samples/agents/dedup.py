"""Deduplication utilities for crawled places."""

import re

from ..llm_service import calc_distance_m


def normalize_name(name: str) -> str:
    """Normalize place name for dedup matching."""
    result = name.strip().lower()
    result = re.sub(r"\s*(본점|지점|점|역점|직영점)\s*$", "", result)
    result = re.sub(r"\s+", " ", result)
    return result


def is_same_place(a: dict, b: dict) -> bool:
    """Check if two places are the same by name + proximity."""
    if normalize_name(a["name"]) != normalize_name(b["name"]):
        return False

    if (
        a.get("lat") is not None
        and a.get("lng") is not None
        and b.get("lat") is not None
        and b.get("lng") is not None
    ):
        dist = calc_distance_m(a["lat"], a["lng"], b["lat"], b["lng"])
        return dist <= 200

    return True


def deduplicate_places(places: list[dict]) -> list[dict]:
    """Deduplicate crawled places by name + proximity, merge sources."""
    groups: list[dict] = []

    for place in places:
        existing = None
        for g in groups:
            if is_same_place(g, place):
                existing = g
                break

        if existing:
            # Merge source info
            already_has = any(s["source"] == place.get("source") for s in existing["sources"])
            if not already_has:
                existing["sources"].append({
                    "source": place.get("source", ""),
                    "sourceUrl": place.get("sourceUrl"),
                    "rating": place.get("rating"),
                    "reviewCount": place.get("reviewCount"),
                    "snippet": place.get("snippet"),
                    "metadata": place.get("metadata"),
                })

            # Fill in missing fields
            if not existing.get("lat") and place.get("lat"):
                existing["lat"] = place["lat"]
            if not existing.get("lng") and place.get("lng"):
                existing["lng"] = place["lng"]
            if not existing.get("address") and place.get("address"):
                existing["address"] = place["address"]
            if not existing.get("category") and place.get("category"):
                existing["category"] = place["category"]
            if not existing.get("rating") and place.get("rating"):
                existing["rating"] = place["rating"]
            if not existing.get("tags") and place.get("tags"):
                existing["tags"] = place["tags"]
        else:
            groups.append({
                **place,
                "sources": [
                    {
                        "source": place.get("source", ""),
                        "sourceUrl": place.get("sourceUrl"),
                        "rating": place.get("rating"),
                        "reviewCount": place.get("reviewCount"),
                        "snippet": place.get("snippet"),
                        "metadata": place.get("metadata"),
                    }
                ],
            })

    return groups
