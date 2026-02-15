"""DiningCode scraper — extract POI data from list page."""

import json
import re
import logging
import random

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]


def _fetch_html(url: str, timeout: int = 15) -> str:
    resp = requests.get(
        url,
        headers={
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.text


def _extract_list_data(html: str) -> list[dict]:
    """Extract listData from DiningCode list page localStorage script."""
    soup = BeautifulSoup(html, "html.parser")
    list_data_raw = ""

    for script in soup.find_all("script"):
        text = script.string or ""
        m = re.search(r"localStorage\.setItem\('listData',\s*'(.+?)'\)", text)
        if m:
            list_data_raw = m.group(1)
            break

    if not list_data_raw:
        return []

    try:
        # Double-escaped JSON — strip JS-escaped single quotes
        sanitized = list_data_raw.replace("\\'", "'")
        unescaped = json.loads(f'"{sanitized}"')
        data = json.loads(unescaped)
        poi_list = data.get("poi_section", {}).get("list", [])
        if not isinstance(poi_list, list):
            return []
        return poi_list
    except Exception:
        return []


def _extract_terms(field) -> str | None:
    """Extract tag terms from keyword/hash field (array or string)."""
    if not field:
        return None
    if isinstance(field, str):
        return field
    if isinstance(field, list) and field:
        return ", ".join(t.get("term", "") for t in field if isinstance(t, dict))
    return None


def crawl_diningcode(search_term: str) -> list[dict]:
    """Crawl DiningCode for a search term and return raw place data."""
    encoded = requests.utils.quote(search_term)
    url = f"https://www.diningcode.com/list.dc?query={encoded}"
    html = _fetch_html(url)

    poi_list = _extract_list_data(html)
    soup = BeautifulSoup(html, "html.parser")

    # Build tag map from HTML cards
    html_tag_map: dict[str, str] = {}
    for el in soup.select(".PoiBlock, .dc-poi, li[class*='poi']"):
        name_el = el.select_one(".InfoHeader, .tit, .name")
        tag_el = el.select_one(".Hash, .Category, .keyword, .tag")
        if name_el and tag_el:
            card_name = name_el.get_text(strip=True)
            tag_text = tag_el.get_text(strip=True).replace("#", "").strip()
            if card_name and tag_text:
                html_tag_map[card_name] = tag_text

    results = []
    for poi in poi_list[:20]:
        name = poi.get("nm", "")
        branch = poi.get("branch", "")
        if branch:
            name = f"{name} {branch}"

        tags = (
            _extract_terms(poi.get("keyword"))
            or _extract_terms(poi.get("hash"))
            or html_tag_map.get(poi.get("nm", ""))
        )
        score = poi.get("score")

        results.append({
            "name": name,
            "address": poi.get("road_addr") or poi.get("addr"),
            "lat": poi.get("lat"),
            "lng": poi.get("lng"),
            "source": "diningcode",
            "sourceUrl": (
                f"https://www.diningcode.com/profile.php?rid={poi['v_rid']}"
                if poi.get("v_rid")
                else None
            ),
            "tags": tags,
            "rating": score,
            "metadata": json.dumps({"score": score}) if score is not None else None,
        })

    return results
