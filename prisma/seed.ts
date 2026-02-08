import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, "..", "dev.db");

const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.restaurant.deleteMany();
  await prisma.cafe.deleteMany();
  await prisma.parkingLot.deleteMany();

  await prisma.restaurant.createMany({
    data: [
      { name: "스시오마카세 강남", category: "일식", description: "제철 생선으로 구성된 오마카세. 조용한 카운터석에서 셰프와 대화하며 즐기는 코스.", lat: 37.4979, lng: 127.0276, priceRange: "₩₩₩₩", atmosphere: "조용한", goodFor: "데이트,기념일,접대", rating: 4.7, reviewCount: 342, parkingAvailable: false, nearbyParking: "강남역공영주차장" },
      { name: "봉피양 강남점", category: "한식", description: "평양냉면과 불고기 전문. 깔끔한 인테리어에 넓은 좌석.", lat: 37.4985, lng: 127.0290, priceRange: "₩₩₩", atmosphere: "깔끔한", goodFor: "가족,회식,데이트", rating: 4.4, reviewCount: 1205, parkingAvailable: true, nearbyParking: null },
      { name: "라 미아 쿠치나", category: "양식", description: "정통 이탈리안 레스토랑. 수제 파스타와 화덕 피자가 시그니처.", lat: 37.5005, lng: 127.0245, priceRange: "₩₩₩", atmosphere: "로맨틱", goodFor: "데이트,기념일,커플", rating: 4.5, reviewCount: 876, parkingAvailable: false, nearbyParking: "강남역공영주차장" },
      { name: "육전식당", category: "한식", description: "한우 육전과 전골 전문. 반찬이 푸짐하고 가성비 좋은 한정식.", lat: 37.4960, lng: 127.0310, priceRange: "₩₩", atmosphere: "활기찬", goodFor: "가족,혼밥,회식", rating: 4.2, reviewCount: 2341, parkingAvailable: false, nearbyParking: "역삼공영주차장" },
      { name: "하이디라오 강남점", category: "중식", description: "마라탕/훠궈 전문. 퍼포먼스 면 뽑기와 다양한 소스바가 특징.", lat: 37.4995, lng: 127.0260, priceRange: "₩₩₩", atmosphere: "활기찬", goodFor: "친구,회식,단체", rating: 4.3, reviewCount: 1567, parkingAvailable: false, nearbyParking: "강남역공영주차장" },
      { name: "도스타코스 강남", category: "멕시칸", description: "정통 멕시칸 타코와 부리또. 캐주얼한 분위기에 맥주 한잔하기 좋은 곳.", lat: 37.5010, lng: 127.0235, priceRange: "₩₩", atmosphere: "캐주얼", goodFor: "친구,혼밥,술자리", rating: 4.1, reviewCount: 654, parkingAvailable: false, nearbyParking: "강남역공영주차장" },
      { name: "삼원가든", category: "한식", description: "50년 전통의 갈비 전문점. 넓은 정원과 한옥 분위기.", lat: 37.5045, lng: 127.0195, priceRange: "₩₩₩₩", atmosphere: "전통적", goodFor: "접대,가족,기념일,외국인", rating: 4.6, reviewCount: 3421, parkingAvailable: true, nearbyParking: null },
      { name: "모수 서울", category: "양식", description: "파인다이닝 코리안 퓨전. 한국 식재료를 모던하게 재해석한 코스.", lat: 37.5025, lng: 127.0210, priceRange: "₩₩₩₩", atmosphere: "모던", goodFor: "데이트,기념일,특별한날", rating: 4.8, reviewCount: 198, parkingAvailable: false, nearbyParking: "강남역공영주차장" },
      { name: "돈까스 클럽", category: "일식", description: "두꺼운 등심돈까스와 히레까스. 직접 갈아먹는 참깨소스가 시그니처.", lat: 37.4970, lng: 127.0330, priceRange: "₩₩", atmosphere: "캐주얼", goodFor: "혼밥,친구,가족", rating: 4.3, reviewCount: 1823, parkingAvailable: false, nearbyParking: "역삼공영주차장" },
      { name: "마포갈매기 강남점", category: "한식", description: "갈매기살과 된장찌개 전문. 직장인들의 회식 성지.", lat: 37.4988, lng: 127.0300, priceRange: "₩₩", atmosphere: "활기찬", goodFor: "회식,친구,술자리", rating: 4.0, reviewCount: 987, parkingAvailable: false, nearbyParking: "역삼공영주차장" },
      { name: "연남서식당", category: "한식", description: "연남동 골목 한식당. 제철 반찬과 정갈한 한상차림이 인기.", lat: 37.5607, lng: 126.9254, priceRange: "₩₩", atmosphere: "아늑한", goodFor: "데이트,가족,혼밥", rating: 4.4, reviewCount: 1432, parkingAvailable: false, nearbyParking: "연남공영주차장" },
      { name: "홍대 쭈꾸미 골목", category: "한식", description: "매콤한 쭈꾸미볶음 전문. 소주 한잔과 함께하기 좋은 곳.", lat: 37.5565, lng: 126.9238, priceRange: "₩", atmosphere: "활기찬", goodFor: "친구,술자리,단체", rating: 4.0, reviewCount: 876, parkingAvailable: false, nearbyParking: "홍대입구공영주차장" },
      { name: "리틀넥 홍대", category: "양식", description: "뉴욕 스타일 브런치와 버거. 루프탑 테라스에서 즐기는 주말 브런치.", lat: 37.5585, lng: 126.9270, priceRange: "₩₩₩", atmosphere: "트렌디", goodFor: "데이트,친구,브런치", rating: 4.3, reviewCount: 2156, parkingAvailable: false, nearbyParking: "홍대입구공영주차장" },
      { name: "아오리라멘 홍대점", category: "일식", description: "돈코츠 라멘 전문. 진한 육수와 수제 차슈가 일품.", lat: 37.5555, lng: 126.9225, priceRange: "₩₩", atmosphere: "캐주얼", goodFor: "혼밥,친구", rating: 4.2, reviewCount: 1654, parkingAvailable: false, nearbyParking: "홍대입구공영주차장" },
      { name: "오우야 연남", category: "양식", description: "파스타와 와인 전문. 아늑한 인테리어와 감성적인 조명.", lat: 37.5615, lng: 126.9260, priceRange: "₩₩₩", atmosphere: "로맨틱", goodFor: "데이트,커플,기념일", rating: 4.5, reviewCount: 743, parkingAvailable: false, nearbyParking: "연남공영주차장" },
      { name: "신마포갈매기 홍대점", category: "한식", description: "갈매기살 직화구이. 고기 퀄리티와 사이드메뉴가 풍부.", lat: 37.5540, lng: 126.9210, priceRange: "₩₩", atmosphere: "활기찬", goodFor: "회식,친구,술자리,단체", rating: 4.1, reviewCount: 1321, parkingAvailable: false, nearbyParking: "홍대입구공영주차장" },
      { name: "콩불 홍대점", category: "한식", description: "콩나물 불고기 전문. 매콤달콤한 양념에 밥 비벼먹기 최고.", lat: 37.5575, lng: 126.9245, priceRange: "₩", atmosphere: "캐주얼", goodFor: "혼밥,친구,가성비", rating: 4.0, reviewCount: 2087, parkingAvailable: false, nearbyParking: "홍대입구공영주차장" },
      { name: "쿠시카츠 탄중 홍대", category: "일식", description: "오사카식 꼬치튀김 전문. 다양한 꼬치와 하이볼이 인기.", lat: 37.5560, lng: 126.9280, priceRange: "₩₩", atmosphere: "이자카야", goodFor: "친구,술자리,데이트", rating: 4.2, reviewCount: 567, parkingAvailable: false, nearbyParking: "홍대입구공영주차장" },
      { name: "플랜트 이태원", category: "양식", description: "비건/채식 레스토랑. 건강한 식사와 유기농 와인.", lat: 37.5345, lng: 126.9945, priceRange: "₩₩₩", atmosphere: "힙한", goodFor: "데이트,건강식,외국인", rating: 4.4, reviewCount: 432, parkingAvailable: false, nearbyParking: "이태원공영주차장" },
      { name: "르비스트로 이태원", category: "양식", description: "프렌치 비스트로. 정통 프랑스 요리와 와인 페어링.", lat: 37.5340, lng: 126.9960, priceRange: "₩₩₩₩", atmosphere: "로맨틱", goodFor: "데이트,기념일,접대", rating: 4.6, reviewCount: 287, parkingAvailable: false, nearbyParking: "이태원공영주차장" },
      { name: "경리단길 타코", category: "멕시칸", description: "경리단길의 인기 타코집. 수제 살사와 콘칩이 유명.", lat: 37.5365, lng: 126.9935, priceRange: "₩₩", atmosphere: "캐주얼", goodFor: "친구,혼밥,외국인", rating: 4.1, reviewCount: 876, parkingAvailable: false, nearbyParking: "이태원공영주차장" },
      { name: "보쌈집 이태원", category: "한식", description: "수육보쌈과 족발 전문. 겉바속촉 족발이 시그니처.", lat: 37.5350, lng: 126.9920, priceRange: "₩₩", atmosphere: "활기찬", goodFor: "친구,술자리,회식", rating: 4.2, reviewCount: 1567, parkingAvailable: false, nearbyParking: "이태원공영주차장" },
      { name: "앤트러사이트 이태원점", category: "양식", description: "브런치와 커피가 유명한 올데이 다이닝. 넓은 테라스.", lat: 37.5335, lng: 126.9975, priceRange: "₩₩₩", atmosphere: "트렌디", goodFor: "브런치,데이트,외국인", rating: 4.3, reviewCount: 1987, parkingAvailable: false, nearbyParking: "이태원공영주차장" },
      { name: "케밥 팩토리 이태원", category: "터키", description: "정통 터키 케밥과 시샤. 이국적인 분위기의 인테리어.", lat: 37.5355, lng: 126.9950, priceRange: "₩₩", atmosphere: "이국적", goodFor: "친구,외국인,데이트", rating: 4.0, reviewCount: 654, parkingAvailable: false, nearbyParking: "이태원공영주차장" },
      { name: "부타동 이태원", category: "일식", description: "일본식 돼지고기 덮밥 전문. 달콤한 간장 소스가 일품.", lat: 37.5370, lng: 126.9940, priceRange: "₩", atmosphere: "캐주얼", goodFor: "혼밥,점심,가성비", rating: 4.1, reviewCount: 1234, parkingAvailable: false, nearbyParking: "이태원공영주차장" },
      { name: "팔레트 서울", category: "양식", description: "한남동 파인다이닝. 계절 식재료 기반 모던 유럽식 코스.", lat: 37.5330, lng: 127.0010, priceRange: "₩₩₩₩", atmosphere: "세련된", goodFor: "기념일,데이트,접대,특별한날", rating: 4.8, reviewCount: 156, parkingAvailable: true, nearbyParking: null },
      { name: "백사골 손두부", category: "한식", description: "직접 만든 순두부와 콩국수 전문. 건강하고 담백한 맛.", lat: 37.5360, lng: 126.9910, priceRange: "₩", atmosphere: "소박한", goodFor: "혼밥,가족,건강식", rating: 4.3, reviewCount: 987, parkingAvailable: false, nearbyParking: "이태원공영주차장" },
      { name: "더 그리핀 바", category: "양식", description: "가스트로펍. 수제 버거와 크래프트 맥주 조합이 인기.", lat: 37.5345, lng: 126.9965, priceRange: "₩₩₩", atmosphere: "활기찬", goodFor: "친구,술자리,외국인,단체", rating: 4.2, reviewCount: 1432, parkingAvailable: false, nearbyParking: "이태원공영주차장" },
      { name: "진옥화 이태원", category: "한식", description: "전통 빈대떡과 동동주. 한옥 건물에서 즐기는 전통 요리.", lat: 37.5338, lng: 126.9930, priceRange: "₩₩", atmosphere: "전통적", goodFor: "외국인,데이트,가족", rating: 4.4, reviewCount: 2156, parkingAvailable: false, nearbyParking: "이태원공영주차장" },
      { name: "매드포갈릭 강남점", category: "양식", description: "갈릭 테마 이탈리안. 마늘을 활용한 다양한 파스타와 스테이크.", lat: 37.5000, lng: 127.0280, priceRange: "₩₩₩", atmosphere: "캐주얼", goodFor: "가족,친구,데이트", rating: 4.1, reviewCount: 2543, parkingAvailable: false, nearbyParking: "강남역공영주차장" },
    ],
  });

  await prisma.cafe.createMany({
    data: [
      { name: "블루보틀 강남카페", specialty: "스페셜티", description: "싱글 오리진 핸드드립이 시그니처. 미니멀한 공간.", lat: 37.4982, lng: 127.0268, priceRange: "₩₩₩", atmosphere: "미니멀", goodFor: "작업,혼자,데이트", rating: 4.5, reviewCount: 2341, parkingAvailable: false, nearbyParking: "강남역공영주차장" },
      { name: "투썸플레이스 강남역점", specialty: "디저트", description: "케이크와 커피 전문. 넓은 좌석과 콘센트 완비.", lat: 37.4975, lng: 127.0285, priceRange: "₩₩", atmosphere: "편안한", goodFor: "작업,미팅,친구", rating: 4.0, reviewCount: 3456, parkingAvailable: false, nearbyParking: "강남역공영주차장" },
      { name: "카페 마마스", specialty: "브런치", description: "브런치와 라떼아트가 유명. 2층 통창으로 자연광이 좋음.", lat: 37.5015, lng: 127.0220, priceRange: "₩₩₩", atmosphere: "밝은", goodFor: "데이트,브런치,사진", rating: 4.4, reviewCount: 876, parkingAvailable: false, nearbyParking: "강남역공영주차장" },
      { name: "폴 바셋 강남", specialty: "스페셜티", description: "바리스타 챔피언이 운영하는 스페셜티 커피숍.", lat: 37.4990, lng: 127.0310, priceRange: "₩₩₩", atmosphere: "세련된", goodFor: "커피,작업,데이트", rating: 4.6, reviewCount: 1234, parkingAvailable: false, nearbyParking: "역삼공영주차장" },
      { name: "메가커피 역삼점", specialty: "일반", description: "가성비 좋은 대용량 커피. 테이크아웃 전문.", lat: 37.4965, lng: 127.0340, priceRange: "₩", atmosphere: "캐주얼", goodFor: "가성비,테이크아웃", rating: 3.8, reviewCount: 4567, parkingAvailable: false, nearbyParking: "역삼공영주차장" },
      { name: "어니언 연남", specialty: "베이커리", description: "폐공장 개조한 카페. 빵과 커피 모두 수준급. 인생사진 스팟.", lat: 37.5620, lng: 126.9250, priceRange: "₩₩₩", atmosphere: "힙한", goodFor: "데이트,사진,브런치", rating: 4.6, reviewCount: 5432, parkingAvailable: false, nearbyParking: "연남공영주차장" },
      { name: "릴리카페 홍대", specialty: "디저트", description: "수플레 팬케이크가 시그니처. 달콤한 디저트 천국.", lat: 37.5570, lng: 126.9260, priceRange: "₩₩", atmosphere: "아기자기", goodFor: "데이트,친구,디저트", rating: 4.3, reviewCount: 1876, parkingAvailable: false, nearbyParking: "홍대입구공영주차장" },
      { name: "커피니 홍대점", specialty: "스페셜티", description: "로스팅 직접 하는 스페셜티 카페. 원두 구매도 가능.", lat: 37.5548, lng: 126.9230, priceRange: "₩₩", atmosphere: "차분한", goodFor: "작업,혼자,커피", rating: 4.4, reviewCount: 765, parkingAvailable: false, nearbyParking: "홍대입구공영주차장" },
      { name: "벨로우즈 연남", specialty: "브런치", description: "연남동 대표 브런치 카페. 에그베네딕트와 팬케이크 인기.", lat: 37.5610, lng: 126.9240, priceRange: "₩₩₩", atmosphere: "따뜻한", goodFor: "브런치,데이트,주말", rating: 4.5, reviewCount: 2345, parkingAvailable: false, nearbyParking: "연남공영주차장" },
      { name: "트렁크 한남", specialty: "스페셜티", description: "한남동 숨은 카페. 시그니처 라떼와 베이커리. 정원이 아름다움.", lat: 37.5335, lng: 127.0005, priceRange: "₩₩₩", atmosphere: "고급스러운", goodFor: "데이트,사진,특별한날", rating: 4.7, reviewCount: 1234, parkingAvailable: true, nearbyParking: null },
      { name: "에스프레소집 이태원", specialty: "스페셜티", description: "이태원 베테랑 카페. 에스프레소와 마키아또가 일품.", lat: 37.5348, lng: 126.9955, priceRange: "₩₩", atmosphere: "빈티지", goodFor: "커피,작업,혼자", rating: 4.5, reviewCount: 876, parkingAvailable: false, nearbyParking: "이태원공영주차장" },
      { name: "알토 이태원", specialty: "디저트", description: "루프탑 카페. 서울 야경이 보이는 테라스에서 디저트.", lat: 37.5358, lng: 126.9970, priceRange: "₩₩₩", atmosphere: "로맨틱", goodFor: "데이트,야경,특별한날", rating: 4.4, reviewCount: 2167, parkingAvailable: false, nearbyParking: "이태원공영주차장" },
      { name: "사운즈 한남", specialty: "스페셜티", description: "음악과 커피를 함께. 바이닐 컬렉션과 스페셜티 커피.", lat: 37.5325, lng: 127.0020, priceRange: "₩₩₩", atmosphere: "감성적", goodFor: "데이트,음악,작업", rating: 4.6, reviewCount: 543, parkingAvailable: false, nearbyParking: "한남공영주차장" },
      { name: "카멜 커피 이태원", specialty: "일반", description: "경리단길 초입의 캐주얼 카페. 아메리카노가 깔끔.", lat: 37.5362, lng: 126.9925, priceRange: "₩", atmosphere: "캐주얼", goodFor: "가성비,혼자,테이크아웃", rating: 4.0, reviewCount: 432, parkingAvailable: false, nearbyParking: "이태원공영주차장" },
      { name: "퍼센트 한남", specialty: "스페셜티", description: "도쿄 발 스페셜티 카페 서울점. 미니멀한 공간에서 핸드드립.", lat: 37.5340, lng: 127.0015, priceRange: "₩₩₩", atmosphere: "미니멀", goodFor: "커피,작업,데이트", rating: 4.5, reviewCount: 1987, parkingAvailable: false, nearbyParking: "한남공영주차장" },
    ],
  });

  await prisma.parkingLot.createMany({
    data: [
      { name: "강남역공영주차장", type: "공영", lat: 37.4978, lng: 127.0275, capacity: 350, hourlyRate: 3000, description: "강남역 인근 대규모 공영주차장. 지하 3층.", operatingHours: "24시간" },
      { name: "역삼공영주차장", type: "공영", lat: 37.4955, lng: 127.0325, capacity: 200, hourlyRate: 2500, description: "역삼역 도보 3분. 주말 할인 적용.", operatingHours: "06:00-24:00" },
      { name: "강남파이낸스센터 주차장", type: "민영", lat: 37.5000, lng: 127.0250, capacity: 500, hourlyRate: 5000, description: "GFC 빌딩 지하. 넓고 쾌적하지만 요금 높음.", operatingHours: "24시간" },
      { name: "홍대입구공영주차장", type: "공영", lat: 37.5558, lng: 126.9235, capacity: 180, hourlyRate: 2000, description: "홍대입구역 3번 출구 인근. 주말 혼잡.", operatingHours: "24시간" },
      { name: "연남공영주차장", type: "공영", lat: 37.5605, lng: 126.9245, capacity: 120, hourlyRate: 1500, description: "연남동 주민센터 옆. 소형차 위주.", operatingHours: "07:00-23:00" },
      { name: "서교동민영주차장", type: "민영", lat: 37.5545, lng: 126.9215, capacity: 80, hourlyRate: 3000, description: "홍대 메인거리 인근. 편리하지만 소규모.", operatingHours: "24시간" },
      { name: "이태원공영주차장", type: "공영", lat: 37.5342, lng: 126.9942, capacity: 150, hourlyRate: 2000, description: "이태원역 1번 출구 인근. 평일 여유, 주말 혼잡.", operatingHours: "24시간" },
      { name: "한남공영주차장", type: "공영", lat: 37.5328, lng: 127.0008, capacity: 100, hourlyRate: 2500, description: "한남동 카페거리 인근. 소형 규모.", operatingHours: "08:00-23:00" },
      { name: "경리단길주차장", type: "민영", lat: 37.5368, lng: 126.9928, capacity: 60, hourlyRate: 4000, description: "경리단길 초입. 좁지만 위치 최고.", operatingHours: "10:00-02:00" },
      { name: "녹사평역주차장", type: "공영", lat: 37.5338, lng: 126.9870, capacity: 220, hourlyRate: 1500, description: "녹사평역 연결. 넓고 요금 저렴.", operatingHours: "24시간" },
    ],
  });

  console.log("Seed completed: 30 restaurants, 15 cafes, 10 parking lots");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
