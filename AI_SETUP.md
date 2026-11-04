# 시장 가격 — AI 서술형 피드백 연결

이 저장소에는 Firebase Functions의 AI 피드백 **코드**가 준비되어 있지만,
Firebase 프로젝트에 배포하고 인증을 설정하기 전에는 실제 AI 호출이 작동하지 않습니다.
키와 인증 설정이 없을 때 학생에게는 기존 개념 점검 피드백만 표시됩니다.

## 구성

- GitHub Pages: `price-lab.html` — 학생/교사 화면
- Firebase Realtime Database: 학습방, 학생별 답변, 단계별 임시 저장, 수정 이력
- Firebase Auth: 익명 사용자 인증
- Firebase App Check: reCAPTCHA v3를 사용해 웹앱 출처 확인
- Firebase Functions v2: `asia-northeast3 / assessMarketEssay`
- OpenAI Responses API: 개인 답변에 대한 질문형 피드백 생성

**보안 원칙:** OpenAI API 키를 GitHub, `ai-config.js`, HTML, 클라이언트 JS나 Firebase Realtime Database에 저장하지 마세요. Cloud Functions Secret Manager를 사용합니다.

## 최초 설정 (프로젝트 관리자만)

1. Firebase Console에서 `marketgo-80ab5` 프로젝트를 선택하고 Blaze 결제 사용 가능 상태를 확인합니다. Cloud Functions v2 배포에 필요한 Google Cloud API를 활성화합니다.
2. Authentication → Sign-in method에서 **Anonymous(익명)** 공급자를 사용 설정합니다.
3. App Check에서 이 웹앱을 등록하고 **reCAPTCHA v3** 사이트 키를 생성합니다. 등록 도메인에 `rlaekdus1116.github.io`를 넣고, 적절한 시점에 Functions App Check를 적용합니다. 테스트 중에는 별도의 App Check 디버그 토큰으로 검증할 수 있습니다.
4. 프로젝트 루트에서 Firebase CLI를 준비하고 계정에 로그인합니다.

```bash
npm install -g firebase-tools
firebase login
cd functions && npm install && cd ..
firebase use marketgo-80ab5
firebase functions:secrets:set OPENAI_API_KEY
firebase deploy --only functions:assessMarketEssay
```

키 입력 프롬프트가 뜨면 자신의 OpenAI API 키를 넣습니다. 이 저장소에는 올리지 마세요.

5. 공개 `ai-config.js` 파일의 `APP_CHECK_SITE_KEY`에 **reCAPTCHA v3 공개 사이트 키만** 설정하고 GitHub Pages를 다시 배포합니다.
6. 해당 페이지와 Cloud Function의 Firebase Auth / App Check / RTDB 접근 권한을 테스트합니다. Firebase의 보안 규칙이 학습방 참여자의 읽기·쓰기 권한을 적절히 제한하는지도 확인해야 합니다.
7. 비용 알림과 일별 예산/할당량을 Google Cloud / OpenAI 양쪽에 설정합니다.

## 서버가 동작하는 방식

- 클라이언트가 임의의 답안을 API로 보내지 않습니다. 서버가 DB에 저장된 **현재 학생 본인의 제출본**을 다시 읽어 평가합니다.
- 학생의 실명은 OpenAI 입력에 포함하지 않습니다. API에는 네 문항의 서술 답안과 교과 기준만 전달됩니다.
- 익명 인증 UID가 학생 기록의 `authUid`와 일치해야 합니다.
- API는 App Check 검증을 필수로 하고 학생별 하루 4회 / 학습방별 하루 150회를 제한합니다. 호출 실패 시에도 사용량이 집계될 수 있습니다.
- 응답을 서버에서 `final/aiFeedback`에 저장하므로 학생이 재입장해도 볼 수 있습니다.
- 점수·성적의 최종 판단은 교사가 하며, AI가 자동으로 확정하지 않습니다.

## 시험 순서

1. 교사용 시장 가격 페이지에서 4자리 방을 만들고 QR 코드로 학생을 입장시킵니다.
2. 학생은 1~3단계 완료 후 4단계에서 문장 조각을 **탭/드래그**하여 답안을 만듭니다.
3. 네 문장을 모두 채워 제출하면 서버 저장을 읽어 **성공 여부를 확인한 뒤** 5단계로 이동합니다.
4. AI가 준비되어 있으면 사용자별 개념 피드백을 생성하며, 불가할 경우 기존 규칙 기반 안내를 표시합니다.
5. 5단계에서 수정본을 작성하고 제출합니다. 초안은 브라우저와 Firebase에 임시 저장됩니다.
6. 교사 CSV에는 원본 답변, 피드백, 수정본, 시각이 들어가는지 확인합니다.

## 제한

- GitHub 파일 변경만으로 Firebase에 Cloud Function이 자동 배포되지는 않습니다.
- 학교 기기에서 App Check 또는 Firebase 인증이 차단되면 AI 피드백은 실패할 수 있습니다. 기본 형성평가는 AI 없이도 진행됩니다.
- 브라우저의 붙여넣기 차단과 문장 완성 기능은 모든 부정행위를 막지는 못합니다.
- 학습방 데이터를 학생 이름으로 조회하는 기존 설계는 보안 규칙 검토가 필요합니다. 실제 수업에서는 학생의 개인정보 대신 비식별 별명을 권장합니다.
