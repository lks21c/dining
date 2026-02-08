import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env") });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import OpenAI from "openai";

const dbPath = resolve(__dirname, "..", "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const MODEL = process.env.OPENROUTER_MODEL || "google/gemini-3-pro-preview";

interface EnrichedParking {
  name: string;
  address: string;
  operatingHours: string;
  capacity: number;
  baseTime: number;
  baseRate: number;
  extraTime: number;
  extraRate: number;
  hourlyRate: number;
  freeNote: string;
  description: string;
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : text.trim();
}

async function main() {
  // Get the 15 Yongsan parking lots we just added
  const targets = await prisma.parkingLot.findMany({
    where: {
      description: { contains: "용산구" },
      type: "공영",
    },
  });

  console.log(`🔍 용산구 공영주차장 ${targets.length}개 상세 정보 조회 중...\n`);

  const nameList = targets.map((t) => t.name).join("\n- ");

  const completion = await openrouter.chat.completions.create({
    model: MODEL,
    temperature: 0,
    max_tokens: 16000,
    messages: [
      {
        role: "system",
        content: `당신은 서울시 용산구 공영주차장의 상세 정보를 제공하는 도우미입니다.
각 주차장에 대해 정확한 정보를 JSON 배열로 응답하세요. 다른 텍스트 없이 JSON만 응답.

[
  {
    "name": "주차장 이름 (입력과 동일하게)",
    "address": "정확한 도로명 주소",
    "operatingHours": "운영시간 (예: 24시간, 08:00~22:00)",
    "capacity": 주차면수(숫자),
    "baseTime": 기본시간_분(숫자, 예: 30),
    "baseRate": 기본요금_원(숫자, 예: 1000),
    "extraTime": 추가단위시간_분(숫자, 예: 5),
    "extraRate": 추가단위요금_원(숫자, 예: 250),
    "hourlyRate": 1시간주차시_대략요금_원(숫자),
    "freeNote": "무료/할인 조건 (예: 민원방문시 30분 무료, 주말 최초2시간 50%할인 등). 없으면 빈 문자열",
    "description": "주차장 특이사항 요약 (지하/지상, 기계식/자주식, 장애인구역, 전기차충전 등 유용한 정보)"
  }
]

규칙:
- 모르는 정보는 합리적으로 추정하되, 추정한 경우 description에 "(추정)" 표기
- baseTime/baseRate/extraTime/extraRate는 서울시 공영주차장 일반 요금체계 기준으로
- 용산구 공영주차장 표준요금: 최초 30분 1,000원, 초과 5분당 250원 (2024년 기준)
- 일부 주차장은 요금이 다를 수 있으니 정확히 알고 있는 경우 해당 요금 적용
- description에 맛집 앱 사용자에게 유용한 정보 포함 (주변 맛집거리 접근성, 출구 위치 등)`,
      },
      {
        role: "user",
        content: `다음 용산구 공영주차장들의 상세 정보를 알려줘:\n\n- ${nameList}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    console.error("❌ LLM 응답 없음");
    process.exit(1);
  }

  console.log("📋 LLM 응답 수신 완료\n");

  let enrichedList: EnrichedParking[];
  try {
    enrichedList = JSON.parse(extractJson(content));
  } catch (e) {
    console.error("❌ JSON 파싱 실패. 원본 응답:\n", content);
    process.exit(1);
  }

  console.log(`✅ ${enrichedList.length}개 주차장 상세 데이터 파싱 완료\n`);

  let updated = 0;

  for (const enriched of enrichedList) {
    // Find matching parking lot in DB
    const existing = targets.find(
      (t) =>
        t.name === enriched.name ||
        t.name.replace(/\s/g, "").includes(enriched.name.replace(/\s/g, "")) ||
        enriched.name.replace(/\s/g, "").includes(t.name.replace(/\s/g, ""))
    );

    if (!existing) {
      console.log(`  ⚠️  DB에서 매칭 실패: ${enriched.name}`);
      continue;
    }

    await prisma.parkingLot.update({
      where: { id: existing.id },
      data: {
        address: enriched.address || null,
        operatingHours: enriched.operatingHours || existing.operatingHours,
        capacity: enriched.capacity > 0 ? enriched.capacity : existing.capacity,
        baseTime: enriched.baseTime || 30,
        baseRate: enriched.baseRate || 1000,
        extraTime: enriched.extraTime || 5,
        extraRate: enriched.extraRate || 250,
        hourlyRate: enriched.hourlyRate > 0 ? enriched.hourlyRate : existing.hourlyRate,
        freeNote: enriched.freeNote || null,
        description: enriched.description || existing.description,
      },
    });

    console.log(`  ✅ 업데이트: ${existing.name}`);
    console.log(`     📍 ${enriched.address}`);
    console.log(`     💰 기본 ${enriched.baseTime}분 ${enriched.baseRate}원 / 추과 ${enriched.extraTime}분당 ${enriched.extraRate}원`);
    if (enriched.freeNote) {
      console.log(`     🆓 ${enriched.freeNote}`);
    }
    console.log(`     📝 ${enriched.description}`);
    console.log();
    updated++;
  }

  console.log(`\n📊 결과: ${updated}개 업데이트 완료`);
}

main()
  .catch((e) => {
    console.error("❌ 오류:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
