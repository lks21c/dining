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

interface ParkingData {
  name: string;
  address: string;
  lat: number;
  lng: number;
  capacity: number;
  hourlyRate: number;
  operatingHours: string;
  type: string;
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : text.trim();
}

async function main() {
  console.log("🔍 Gemini 3 Pro에 용산구 공영주차장 정보 요청 중...");

  const completion = await openrouter.chat.completions.create({
    model: MODEL,
    temperature: 0,
    max_tokens: 16000,
    messages: [
      {
        role: "system",
        content: `당신은 서울시 용산구의 공영주차장 정보를 제공하는 도우미입니다.
반드시 다음 JSON 배열 형식으로 응답하세요. 다른 텍스트 없이 JSON만 응답하세요.

[
  {
    "name": "주차장 이름",
    "address": "서울 용산구 ...",
    "lat": 37.xxxx,
    "lng": 126.xxxx,
    "capacity": 주차면수(숫자),
    "hourlyRate": 시간당요금(원, 숫자),
    "operatingHours": "운영시간",
    "type": "공영"
  }
]

규칙:
- 용산구에 있는 공영주차장을 빠짐없이 모두 알려주세요
- 구청 지하주차장, 공원 주차장, 주민센터 주차장 등 공공 주차장 모두 포함
- lat, lng는 실제 위치에 가까운 좌표를 소수점 4자리까지
- 모르는 정보는 capacity: 0, hourlyRate: 0 으로
- "용산구청지하주차장"도 반드시 포함해주세요`,
      },
      {
        role: "user",
        content:
          "용산구 공영주차장 이름과 주소 모두 알려줘. 용산구청 지하주차장, 이태원 주차장, 한남동 주차장 등 용산구 관내 공영주차장 전부 빠짐없이 알려줘.",
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    console.error("❌ LLM 응답 없음");
    process.exit(1);
  }

  console.log("\n📋 LLM 원본 응답:\n");
  console.log(content);
  console.log("\n---\n");

  let parkingList: ParkingData[];
  try {
    parkingList = JSON.parse(extractJson(content));
  } catch (e) {
    console.error("❌ JSON 파싱 실패:", e);
    process.exit(1);
  }

  console.log(`✅ ${parkingList.length}개 주차장 데이터 파싱 완료\n`);

  let inserted = 0;
  let skipped = 0;

  for (const p of parkingList) {
    if (!p.name || !p.lat || !p.lng) {
      console.log(`  ⏭️  스킵 (데이터 불완전): ${p.name || "이름없음"}`);
      skipped++;
      continue;
    }

    // Check if already exists by name
    const existing = await prisma.parkingLot.findFirst({
      where: { name: p.name },
    });

    if (existing) {
      console.log(`  ⏭️  이미 존재: ${p.name}`);
      skipped++;
      continue;
    }

    await prisma.parkingLot.create({
      data: {
        name: p.name,
        type: p.type || "공영",
        lat: p.lat,
        lng: p.lng,
        capacity: p.capacity || 0,
        hourlyRate: p.hourlyRate || 0,
        description: `용산구 ${p.type || "공영"} 주차장 - ${p.address || ""}`,
        operatingHours: p.operatingHours || "24시간",
      },
    });

    console.log(`  ✅ 추가: ${p.name} (${p.lat}, ${p.lng})`);
    inserted++;
  }

  console.log(`\n📊 결과: ${inserted}개 추가, ${skipped}개 스킵`);

  // Show total parking lots in 용산구
  const yongsanCount = await prisma.parkingLot.count({
    where: {
      OR: [
        { description: { contains: "용산구" } },
        { name: { contains: "용산" } },
        { name: { contains: "이태원" } },
        { name: { contains: "한남" } },
        { name: { contains: "녹사평" } },
        { name: { contains: "경리단" } },
      ],
    },
  });

  const totalCount = await prisma.parkingLot.count();
  console.log(`\n📍 용산구 관련 주차장: ${yongsanCount}개`);
  console.log(`📍 전체 주차장: ${totalCount}개`);
}

main()
  .catch((e) => {
    console.error("❌ 오류:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
