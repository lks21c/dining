# Redeploy

변경사항을 커밋/푸시한 뒤 원격 NAS에 dining 앱을 재배포합니다.

**Usage**: `/redeploy`

## Instructions

### Step 1: /gcp 실행
먼저 `/gcp` 스킬을 실행하여 변경사항을 커밋하고 push합니다.
- 변경사항이 없으면 이 단계를 건너뛰고 Step 2로 진행

### Step 2: deploy.sh 실행
프로젝트 루트에서 `deploy.sh` 실행:
```bash
./deploy.sh
```
- 타임아웃: 180초 (빌드 대기 포함)
- 홈 네트워크(192.168.1.177) 실패 시 외부(hydra01.asuscomm.com)로 자동 fallback

### Step 3: 결과 보고

## Output Format

```
🚀 재배포: <성공|실패>
호스트: <접속한 호스트>
컨테이너: <컨테이너 ID>
```
