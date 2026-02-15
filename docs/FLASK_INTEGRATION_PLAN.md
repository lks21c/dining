# dining → rich_project Flask 통합 계획

## 개요

dining(Next.js 16 + React 19 맛집 추천 앱)을 rich_project(Flask 3 투자 포트폴리오 관리 시스템)에 **단일 서버로 통합 배포**한다.

- **전략**: Next.js Static Export → Flask에서 정적 서빙 + API를 Python으로 포팅
- **예상 작업량**: 7~10일
- **샘플 코드**: `docs/samples/` 디렉토리에 Python 포팅 초안 포함

---

## 두 프로젝트 비교

| 항목 | dining (Next.js) | rich_project (Flask) |
|------|-----------------|---------------------|
| 프레임워크 | Next.js 16 + React 19 | Flask 3.0.3 |
| DB | Prisma + SQLite (`dev.db`) | SQLAlchemy + SQLite (`portfolio.db`) |
| 프론트엔드 | React SPA (`"use client"` 전체) | Jinja2 + vanilla JS |
| API 수 | 6개 라우트 | 67개 라우트 |
| LLM | OpenRouter (JS SDK) | OpenRouter (Python requests) |
| 인증 | 없음 | JWT 기반 |
| ORM | Prisma (cuid ID, camelCase) | SQLAlchemy (integer ID, snake_case) |

---

## 통합 후 디렉토리 구조

```
rich_project/
├── rich_project/
│   ├── app.py                    ← Blueprint 등록 + 정적 서빙 추가
│   ├── service.py                ← DiningService 초기화 추가
│   ├── dining/                   ← 신규 모듈
│   │   ├── __init__.py
│   │   ├── models.py             ← SQLAlchemy 모델 6개
│   │   ├── routes.py             ← Blueprint: /dining/api/*
│   │   ├── geocode.py            ← 지오코딩 (Naver/Nominatim)
│   │   ├── classify.py           ← LLM 장소 분류
│   │   ├── llm_service.py        ← LLM 추천/위치추출
│   │   ├── openrouter_client.py  ← OpenRouter API 클라이언트
│   │   ├── place_mapper.py       ← DB→API 변환
│   │   ├── place_cache.py        ← 크롤 결과 캐시
│   │   └── agents/
│   │       ├── diningcode.py     ← DiningCode 스크래핑
│   │       └── dedup.py          ← 중복 제거
│   └── vo/base.py                ← 기존 (변경 없음)
├── static/dining/                ← next export 빌드 산출물
│   ├── index.html
│   ├── _next/static/...
│   └── ...
├── portfolio.db                  ← 기존 DB (변경 없음)
└── dining.db                     ← dining 전용 DB (별도)
```

---

## Step 1: Next.js Static Export 설정

### 변경 파일: `dining/next.config.ts`

```ts
const nextConfig: NextConfig = {
  output: "export",
  basePath: "/dining",
};
```

### 호환성 체크

| 항목 | 상태 | 비고 |
|------|------|------|
| `"use client"` 전체 | ✅ | SSR 없음, export 가능 |
| API Routes | ✅ | export에서 자동 제외됨 |
| Naver Maps Script | ✅ | 외부 CDN, basePath 영향 없음 |
| `metadata` (layout.tsx) | ✅ | 정적 metadata, `generateMetadata` 아님 |
| `next/font/google` | ✅ | 빌드 타임에 처리됨 |

### 빌드 명령

```bash
cd dining && npm run build
cp -r out/ ../rich_project/static/dining/
```

---

## Step 2: 프론트엔드 fetch 경로 수정

모든 `/api/...` 호출을 `/dining/api/...`로 변경:

| 파일 | 변경 내용 |
|------|----------|
| `src/hooks/usePlaces.ts:20` | `` `/api/places?${params}` `` → `` `/dining/api/places?${params}` `` |
| `src/hooks/useSearch.ts:22` | `"/api/places/search"` → `"/dining/api/places/search"` |
| `src/hooks/useCrawl.ts:34` | `"/api/places/crawl"` → `"/dining/api/places/crawl"` |
| `src/hooks/useAllPlaces.ts:30` | `"/api/places/all"` → `"/dining/api/places/all"` |
| `src/components/search/RegionSearch.tsx:25` | `"/api/regions"` → `"/dining/api/regions"` |
| `src/components/place/PlaceDetail.tsx:43` | `` `/api/menus?placeName=...` `` → `` `/dining/api/menus?placeName=...` `` |

> `RouteMarkers.tsx`의 fetch는 외부 OSRM API이므로 변경 불필요.

---

## Step 3: Flask에서 정적 파일 서빙

### 변경 파일: `rich_project/app.py`

```python
from flask import send_from_directory

@app.route('/dining/')
@app.route('/dining/<path:path>')
def serve_dining(path='index.html'):
    return send_from_directory('static/dining', path)
```

---

## Step 4: Prisma → SQLAlchemy 모델 변환

### 샘플 코드: [`docs/samples/models.py`](samples/models.py)

| Prisma 모델 | SQLAlchemy 모델 | 테이블명 | 주요 차이 |
|-------------|----------------|---------|----------|
| `CrawledPlace` | `CrawledPlace` | `crawled_place` | cuid→autoincrement, camelCase→snake_case |
| `PlaceSource` | `PlaceSource` | `place_source` | FK: crawled_place_id (int) |
| `Menu` | `Menu` | `menu` | 동일 구조 |
| `Restaurant` | `Restaurant` | `restaurant` | seed 데이터용 |
| `Cafe` | `Cafe` | `cafe` | seed 데이터용 |
| `ParkingLot` | `ParkingLot` | `parking_lot` | hourlyRate→hourly_rate 등 |

### DB 분리 전략

- `dining.db`를 별도 엔진/세션으로 운용
- `portfolio.db`와 완전 독립 (FK 교차 없음)
- `models.py`에 자체 `DiningBase`, `get_dining_session()`, `init_dining_db()` 포함

### 데이터 마이그레이션

기존 `dev.db` (Prisma SQLite) → `dining.db` (SQLAlchemy SQLite) 데이터 이관 필요:
- Prisma의 cuid 문자열 ID → SQLAlchemy의 integer autoincrement ID
- 컬럼명 camelCase → snake_case 매핑
- 마이그레이션 스크립트 별도 작성 필요

---

## Step 5: 서비스 로직 Python 포팅

### 모듈별 매핑

| JS 모듈 | Python 샘플 | 핵심 내용 |
|---------|------------|----------|
| `lib/openrouter.ts` | [`samples/openrouter_client.py`](samples/openrouter_client.py) | OpenRouter API 클라이언트 (requests 기반) |
| `lib/geocode.ts` | [`samples/geocode.py`](samples/geocode.py) | LANDMARK_MAP + Naver API + Nominatim 폴백 |
| `lib/classify.ts` | [`samples/classify.py`](samples/classify.py) | Gemini Flash로 장소 분류 (배치 30개) |
| `lib/llm.ts` | [`samples/llm_service.py`](samples/llm_service.py) | 위치 추출 + 코스 추천 + 키워드 폴백 |
| `lib/place-mapper.ts` | [`samples/place_mapper.py`](samples/place_mapper.py) | ORM→API dict 변환, 지역 추출, 중복 제거 |
| `agents/nodes/diningcode.ts` | [`samples/agents/diningcode.py`](samples/agents/diningcode.py) | BeautifulSoup로 DiningCode 스크래핑 |
| `agents/utils/dedup.ts` | [`samples/agents/dedup.py`](samples/agents/dedup.py) | 이름+좌표(200m) 기반 중복 병합 |
| `agents/utils/place-cache.ts` | [`samples/place_cache.py`](samples/place_cache.py) | DB upsert (이름 기준) |

### 이점: rich_project 기존 의존성 재사용

- `beautifulsoup4` — DiningCode 스크래핑
- `requests` — HTTP 클라이언트 (Naver API, OpenRouter, Nominatim)
- `sqlalchemy` — ORM
- `OPENROUTER_API_KEY` 환경변수 — 이미 `LLMAnalysisService`에서 사용 중

---

## Step 6: Flask Blueprint API 라우트 (6개)

### 파일: `rich_project/dining/routes.py` (신규 작성 필요)

| Next.js Route | Flask Route | Method | 난이도 | 핵심 로직 |
|--------------|-------------|--------|--------|----------|
| `/api/places` | `/dining/api/places` | GET | 낮음 | bounds 쿼리 + LLM 분류 |
| `/api/places/search` | `/dining/api/places/search` | POST | 중간 | LLM 위치 추출 + 지오코딩 + 코스 추천 |
| `/api/places/crawl` | `/dining/api/places/crawl` | POST | **높음** | SSE 스트리밍 + DiningCode 스크래핑 |
| `/api/places/all` | `/dining/api/places/all` | GET | 낮음 | 전체 장소 + 지역 정보 |
| `/api/regions` | `/dining/api/regions` | GET | 낮음 | 지역 집계 + LANDMARK_MAP |
| `/api/menus` | `/dining/api/menus` | GET | 낮음 | placeName으로 메뉴 조회 |

### SSE 스트리밍 (crawl 라우트)

```python
from flask import Blueprint, Response, request, jsonify
import json

dining_bp = Blueprint('dining', __name__, url_prefix='/dining')

@dining_bp.route('/api/places/crawl', methods=['POST'])
def crawl():
    data = request.get_json()
    keyword = data.get('keyword', '').strip()
    bounds = data.get('bounds')

    def generate():
        yield f"data: {json.dumps({'step': 'searching', 'message': '맛집 검색 중...'})}\n\n"
        # ... 크롤링 로직 (diningcode + parking)
        # ... 지오코딩 (progress 이벤트)
        # ... 분류 + 저장
        yield f"data: {json.dumps({'step': 'done', 'count': n, 'parkingAdded': m})}\n\n"

    return Response(generate(), mimetype='text/event-stream',
                    headers={'Cache-Control': 'no-cache', 'Connection': 'keep-alive'})
```

### Blueprint 등록 (`app.py`)

```python
from rich_project.dining.routes import dining_bp
app.register_blueprint(dining_bp)
```

### Service 초기화 (`service.py`)

```python
# Service.__init__ 에 추가
from rich_project.dining.models import init_dining_db
init_dining_db()  # 테이블 자동 생성
```

---

## Step 7: 검증 체크리스트

1. [ ] `next build` with `output: 'export'` 성공
2. [ ] Flask에서 `/dining/` 접속 시 React 앱 정상 로딩
3. [ ] Naver 지도 렌더링 확인
4. [ ] `/dining/api/places?swLat=...` 응답 확인
5. [ ] `/dining/api/places/all` 전체 장소 + 지역 응답 확인
6. [ ] `/dining/api/regions` 지역 목록 응답 확인
7. [ ] `/dining/api/menus?placeName=...` 메뉴 응답 확인
8. [ ] `/dining/api/places/search` AI 검색 작동 확인
9. [ ] `/dining/api/places/crawl` SSE 스트리밍 정상 작동 확인
10. [ ] `dining.db` 데이터 정합성 확인

---

## 주요 리스크 및 대응

| 리스크 | 영향 | 대응 |
|-------|------|------|
| Static Export 실패 | 빌드 불가 | App Router 동적 기능 사용 여부 사전 체크 (현재는 `"use client"` 전체라 문제 없을 것) |
| SSE + Gunicorn worker 점유 | 동시성 저하 | gevent/eventlet worker 사용 또는 thread 기반 처리 |
| Prisma→SQLAlchemy 데이터 마이그레이션 | ID 체계 변경 | cuid→integer 매핑 스크립트 작성, FK 관계 재구성 |
| CORS | 동일 서버라 문제 없음 | — |
| Naver Maps Script 로딩 | basePath 변경 영향 | 외부 CDN이라 영향 없음 확인 완료 |

---

## 대안: 프록시 방식 (빠른 통합)

API를 Python으로 포팅하지 않고 Flask에서 Next.js를 subprocess로 실행 + 프록시:

```python
import subprocess
next_proc = subprocess.Popen(['npm', 'start'], cwd='../dining')

@app.route('/dining/api/<path:path>', methods=['GET', 'POST'])
def dining_api_proxy(path):
    resp = requests.request(request.method, f'http://localhost:3000/api/{path}', ...)
    return Response(resp.content, status=resp.status_code)
```

| | Python 포팅 | 프록시 방식 |
|---|---|---|
| 작업량 | 7~10일 | 1~2일 |
| 런타임 | Flask만 | Flask + Node.js |
| 유지보수 | 단일 코드베이스 | 두 프로젝트 동시 관리 |
| 프로세스 | 1개 | 2개 (프로세스 관리 복잡) |
| 추천 | ✅ 장기적으로 유리 | 빠른 PoC용 |

---

## 작업 순서 요약

| 순서 | 작업 | 예상 |
|------|------|------|
| 1 | `next.config.ts` + fetch 경로 수정 | 0.5일 |
| 2 | `next build` + Flask 정적 서빙 설정 | 0.5일 |
| 3 | SQLAlchemy 모델 + DB 마이그레이션 | 1일 |
| 4 | 서비스 로직 포팅 (geocode, classify, llm 등) | 2~3일 |
| 5 | Flask Blueprint API 6개 | 2~3일 |
| 6 | 테스트 + 디버깅 | 1~2일 |
| **합계** | | **약 7~10일** |
