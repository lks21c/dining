"""Place cache — find and save crawled places in dining.db."""

import logging
from datetime import datetime, timezone, timedelta

from .models import CrawledPlace, PlaceSource, get_dining_session

logger = logging.getLogger(__name__)


def find_cached_places(session, bounds: dict | None = None, max_age_hours: int = 24) -> list[dict]:
    """Find cached crawled places within bounds and within maxAge hours."""
    since = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)

    query = session.query(CrawledPlace).filter(
        CrawledPlace.updated_at >= since,
        CrawledPlace.lat.isnot(None),
        CrawledPlace.lng.isnot(None),
    )

    if bounds:
        query = query.filter(
            CrawledPlace.lat >= bounds["swLat"],
            CrawledPlace.lat <= bounds["neLat"],
            CrawledPlace.lng >= bounds["swLng"],
            CrawledPlace.lng <= bounds["neLng"],
        )

    cached = query.all()

    results = []
    for cp in cached:
        dc_source = next((s for s in cp.sources if s.source == "diningcode"), None)
        primary = dc_source or (cp.sources[0] if cp.sources else None)
        results.append({
            "name": cp.name,
            "category": cp.category,
            "description": cp.description,
            "address": cp.address,
            "lat": cp.lat,
            "lng": cp.lng,
            "rating": primary.rating if primary else None,
            "reviewCount": primary.review_count if primary else None,
            "source": primary.source if primary else "cache",
            "sourceUrl": primary.source_url if primary else None,
            "snippet": primary.snippet if primary else None,
            "tags": cp.tags,
            "metadata": dc_source.metadata_ if dc_source else None,
        })

    return results


def save_crawled_places(session, places: list[dict]) -> None:
    """Save merged crawled places to DB (upsert by name)."""
    for place in places:
        try:
            existing = session.query(CrawledPlace).filter(
                CrawledPlace.name == place["name"]
            ).first()

            if existing:
                # Update main record
                if place.get("category"):
                    existing.category = place["category"]
                if place.get("description"):
                    existing.description = place["description"]
                if place.get("address"):
                    existing.address = place["address"]
                if place.get("lat"):
                    existing.lat = place["lat"]
                if place.get("lng"):
                    existing.lng = place["lng"]
                if place.get("tags"):
                    existing.tags = place["tags"]
                if place.get("placeType"):
                    existing.place_type = place["placeType"]
                existing.updated_at = datetime.now(timezone.utc)

                # Upsert sources
                for src in place.get("sources", []):
                    existing_src = session.query(PlaceSource).filter(
                        PlaceSource.crawled_place_id == existing.id,
                        PlaceSource.source == src["source"],
                    ).first()

                    if existing_src:
                        existing_src.source_url = src.get("sourceUrl")
                        existing_src.rating = src.get("rating")
                        existing_src.review_count = src.get("reviewCount")
                        existing_src.snippet = src.get("snippet")
                        existing_src.metadata_ = src.get("metadata")
                        existing_src.crawled_at = datetime.now(timezone.utc)
                    else:
                        new_src = PlaceSource(
                            crawled_place_id=existing.id,
                            source=src["source"],
                            source_url=src.get("sourceUrl"),
                            rating=src.get("rating"),
                            review_count=src.get("reviewCount"),
                            snippet=src.get("snippet"),
                            metadata_=src.get("metadata"),
                        )
                        session.add(new_src)
            else:
                # Create new
                cp = CrawledPlace(
                    name=place["name"],
                    category=place.get("category"),
                    description=place.get("description"),
                    address=place.get("address"),
                    lat=place.get("lat"),
                    lng=place.get("lng"),
                    tags=place.get("tags"),
                    place_type=place.get("placeType"),
                )
                session.add(cp)
                session.flush()  # Get the ID

                for src in place.get("sources", []):
                    ps = PlaceSource(
                        crawled_place_id=cp.id,
                        source=src["source"],
                        source_url=src.get("sourceUrl"),
                        rating=src.get("rating"),
                        review_count=src.get("reviewCount"),
                        snippet=src.get("snippet"),
                        metadata_=src.get("metadata"),
                    )
                    session.add(ps)

            session.commit()
        except Exception as e:
            session.rollback()
            logger.error('Failed to save place "%s": %s', place.get("name"), e)
