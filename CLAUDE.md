# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes
│   │   ├── auth/           #   로그인/로그아웃
│   │   ├── chat/           #   LLM 채팅 (LangGraph 멀티에이전트)
│   │   ├── menus/          #   메뉴 데이터
│   │   ├── places/         #   장소 검색/크롤링
│   │   └── regions/        #   지역 정보
│   ├── login/              # 로그인 페이지
│   ├── page.tsx            # 메인 페이지 (지도 + 채팅)
│   └── layout.tsx          # 루트 레이아웃
├── components/
│   ├── chat/               # 채팅 UI (AssistantBubble, ChatInputBar 등)
│   ├── map/                # 네이버 지도 (NaverMap, PlaceMarker 등)
│   ├── menu/               # 네비게이션 (HamburgerButton, NavigationDrawer)
│   ├── place/              # 장소 카드/상세 (PlaceCard, PlaceDetail)
│   ├── search/             # 검색 (SearchBar, FilterTags, RegionSearch)
│   └── ui/                 # 공통 UI (BottomSheet)
├── hooks/                  # 커스텀 훅 (useNaverMap, usePlaces, useSearch 등)
├── lib/
│   ├── agents/             # LangGraph 에이전트
│   │   ├── graph.ts        #   에이전트 그래프 정의
│   │   ├── state.ts        #   상태 정의
│   │   └── nodes/          #   개별 에이전트 (naver-place, diningcode, youtube 등)
│   ├── llm.ts              # LLM 프롬프트/응답
│   ├── openrouter.ts       # OpenRouter API 클라이언트
│   ├── prisma.ts           # Prisma 싱글턴
│   └── geocode.ts          # 주소 ↔ 좌표 변환
└── types/                  # 타입 정의 (place.ts, naver-maps.d.ts)

prisma/
├── schema.prisma           # DB 스키마 (CrawledPlace, PlaceSource, Menu 등)
└── migrations/             # 마이그레이션 히스토리
```

### Tech Stack
- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **DB**: SQLite (better-sqlite3 + Prisma)
- **LLM**: OpenRouter (Gemini-3-Pro) + LangChain/LangGraph
- **지도**: Naver Maps API
- **크롤링**: Cheerio + Puppeteer
- **스타일**: Tailwind CSS 4
- **포트**: 3232 (dev/prod 통일)

### Conventions
- **Import alias**: `@/` → `src/` (e.g. `import { prisma } from "@/lib/prisma"`)
- **Client components**: `"use client"` 디렉티브 사용 (hooks, interactive components)
- **API routes**: `src/app/api/*/route.ts` — Next.js App Router 규칙
- **DB 마이그레이션**: `npx prisma migrate dev` → `npx prisma generate`
- **커밋 메시지**: conventional commits, 한국어 (`feat(chat): 기능 추가`)
- **quote style**: double quotes (`"`)
- **세미콜론**: 있음

### Env Variables
| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` | 네이버 지도 클라이언트 ID (public) |
| `OPENROUTER_API_KEY` | OpenRouter LLM API 키 |
| `OPENROUTER_MODEL` | LLM 모델 (기본: `google/gemini-3-pro-preview`) |
| `DATABASE_URL` | SQLite DB 경로 (`file:./dev.db`) |
| `SEOUL_OPENDATA_API_KEY` | 서울 공공데이터 API 키 (주차장) |

### Agent Architecture
```
사용자 질의 → [Dispatcher] → 7개 에이전트 병렬 실행
  ├── Naver Place  ├── DiningCode  ├── Suyo Food Talk
  ├── Hongseokcheon  ├── YouTube  ├── Instagram  └── Parking
→ [Aggregator] → LLM 랭킹 → 코스 추천 결과
```

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
