import { getOpenRouter, FLASH_MODEL, extractJson } from "@/lib/openrouter";
import { prisma } from "@/lib/prisma";

export type PlaceCategory = "restaurant" | "cafe" | "bar" | "bakery";

export interface PlaceForClassify {
  name: string;
  category?: string;
  tags?: string;
  description?: string;
}

const SYSTEM_PROMPT = `당신은 한국 음식점/가게를 분류하는 전문가입니다.
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
[{"name":"가게명","type":"restaurant|cafe|bar|bakery"}]`;

/**
 * Classify places into restaurant/cafe/bar/bakery using Gemini Flash.
 * Processes in batches of 30 to avoid token limits.
 */
export async function classifyPlaces(
  places: PlaceForClassify[]
): Promise<Record<string, PlaceCategory>> {
  if (places.length === 0) return {};

  const BATCH_SIZE = 30;
  const result: Record<string, PlaceCategory> = {};

  for (let i = 0; i < places.length; i += BATCH_SIZE) {
    const batch = places.slice(i, i + BATCH_SIZE);
    const items = batch.map((p) => ({
      name: p.name,
      category: p.category || "",
      tags: p.tags || "",
      desc: (p.description || "").slice(0, 60),
    }));

    try {
      const completion = await getOpenRouter().chat.completions.create({
        model: FLASH_MODEL,
        temperature: 0,
        max_tokens: 4000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(items) },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) continue;

      const parsed: { name: string; type: PlaceCategory }[] = JSON.parse(
        extractJson(content)
      );
      for (const p of parsed) {
        if (["restaurant", "cafe", "bar", "bakery"].includes(p.type)) {
          result[p.name] = p.type;
        }
      }
    } catch (err) {
      console.error("[classify] batch error:", err);
    }
  }

  return result;
}

/**
 * Classify crawled places that have NULL placeType and persist to DB.
 * Returns the classification map for immediate use.
 */
export async function classifyAndPersist(
  records: { id: string; name: string; category: string | null; tags: string | null; description: string | null }[]
): Promise<Record<string, PlaceCategory>> {
  const unclassified = records.filter((r) => true); // caller already filters
  if (unclassified.length === 0) return {};

  const typeMap = await classifyPlaces(
    unclassified.map((r) => ({
      name: r.name,
      category: r.category ?? undefined,
      tags: r.tags ?? undefined,
      description: r.description ?? undefined,
    }))
  );

  // Persist to DB (fire-and-forget for speed, but await to ensure it completes)
  const updates = unclassified
    .filter((r) => typeMap[r.name])
    .map((r) =>
      prisma.crawledPlace.update({
        where: { id: r.id },
        data: { placeType: typeMap[r.name] },
      })
    );

  if (updates.length > 0) {
    await Promise.all(updates).catch((err) =>
      console.error("[classify] persist error:", err)
    );
    console.log(`[classify] persisted ${updates.length} placeType values`);
  }

  return typeMap;
}
