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

// Seoul 25 districts
const ALL_DISTRICTS = [
  "강남구", "강동구", "강북구", "강서구", "관악구",
  "광진구", "구로구", "금천구", "노원구", "도봉구",
  "동대문구", "동작구", "마포구", "서대문구", "서초구",
  "성동구", "성북구", "송파구", "양천구", "영등포구",
  "용산구", "은평구", "종로구", "중구", "중랑구",
];

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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchDistrictParking(districts: string[]): Promise<ParkingData[]> {
  const districtList = districts.join(", ");
  console.log(`\n📡 Gemini 요청: ${districtList}`);

  const completion = await openrouter.chat.completions.create({
    model: MODEL,
    temperature: 0,
    max_tokens: 32000,
    messages: [
      {
        role: "system",
        content: `당신은 서울시 공영주차장 정보를 정확하게 제공하는 전문가입니다.
반드시 JSON 배열로만 응답하세요. 다른 텍스트 없이 JSON만 응답하세요.

[
  {
    "name": "주차장 이름",
    "address": "서울특별시 OO구 OO로 123",
    "lat": 37.xxxx,
    "lng": 126.xxxx 또는 127.xxxx,
    "capacity": 주차면수(숫자, 모르면 0),
    "hourlyRate": 시간당요금(원, 숫자, 모르면 0),
    "operatingHours": "HH:MM~HH:MM",
    "type": "공영" 또는 "공유" 또는 "노상" 또는 "노외"
  }
]

규칙:
- 요청한 구의 공영주차장, 공유주차장, 공공주차장을 알고 있는 만큼 최대한 많이 알려주세요
- 구청 주차장, 공원 주차장, 주민센터 주차장, 체육관 주차장, 역 근처 공영주차장 등 포함
- address는 반드시 도로명주소로 "서울특별시 OO구 OO로 123" 형식
- lat, lng는 실제 위치의 정확한 좌표 (소수점 4자리)
- 서울 위도 범위: 37.45~37.70, 경도 범위: 126.76~127.18
- 각 구당 최소 5개 이상 알려주세요`,
      },
      {
        role: "user",
        content: `서울특별시 ${districtList}의 공영주차장 목록을 모두 알려주세요. 각 구별로 알고 있는 공영주차장을 빠짐없이 JSON 배열로 응답해주세요.`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    console.error(`  ❌ 응답 없음: ${districtList}`);
    return [];
  }

  try {
    const parsed: ParkingData[] = JSON.parse(extractJson(content));
    console.log(`  ✅ ${parsed.length}개 파싱 완료`);
    return parsed;
  } catch (e) {
    console.error(`  ❌ JSON 파싱 실패: ${districtList}`);
    console.error(`  원본: ${content.slice(0, 200)}...`);
    return [];
  }
}

function isValidCoord(lat: number, lng: number): boolean {
  return lat >= 37.45 && lat <= 37.70 && lng >= 126.76 && lng <= 127.18;
}

async function main() {
  console.log("🗑️  기존 주차장 데이터 삭제...");
  const deleted = await prisma.parkingLot.deleteMany();
  console.log(`  삭제: ${deleted.count}개\n`);

  const allParking: ParkingData[] = [];

  // Batch districts 5 at a time
  for (let i = 0; i < ALL_DISTRICTS.length; i += 5) {
    const batch = ALL_DISTRICTS.slice(i, i + 5);
    const results = await fetchDistrictParking(batch);
    allParking.push(...results);

    if (i + 5 < ALL_DISTRICTS.length) {
      console.log("  ⏳ 2초 대기...");
      await sleep(2000);
    }
  }

  console.log(`\n📊 총 ${allParking.length}개 수집 완료. DB 저장 시작...`);

  let inserted = 0;
  let skipped = 0;
  const seen = new Set<string>();

  for (const p of allParking) {
    if (!p.name || !p.lat || !p.lng) {
      skipped++;
      continue;
    }

    if (!isValidCoord(p.lat, p.lng)) {
      console.log(`  ⚠️  좌표 범위 밖: ${p.name} (${p.lat}, ${p.lng})`);
      skipped++;
      continue;
    }

    // Deduplicate by name
    const key = p.name.trim();
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);

    await prisma.parkingLot.create({
      data: {
        name: key,
        type: p.type || "공영",
        address: p.address || null,
        lat: p.lat,
        lng: p.lng,
        capacity: p.capacity || 0,
        hourlyRate: p.hourlyRate || 0,
        description: `${p.address || key}`,
        operatingHours: p.operatingHours || "00:00~24:00",
      },
    });
    inserted++;
  }

  console.log(`\n✅ 완료: ${inserted}개 추가, ${skipped}개 스킵`);

  const total = await prisma.parkingLot.count();
  console.log(`📍 전체 주차장: ${total}개`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ 오류:", e);
  process.exit(1);
});
