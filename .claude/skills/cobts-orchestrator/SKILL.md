---
name: cobts-orchestrator
description: "CoBTS (Coffee Bean Tracking Service) 에이전트 팀 전체를 조율하는 상위 오케스트레이터. 사용자의 체감 맛 표현(산미, 단맛, 바디, 고소함: 거의없게~많이나게)을 분석하여 7개국 14개 산지 싱글 및 3종 AI 블렌드(단일국 60% 제한)를 도출하고, 건축 펜화 스케치 스타일 지도 및 관세청 통관 정보와 연결한다. 'CoBTS 실행', '커피 맛 추적', '14개 산지 매칭', '블렌딩 제안', '스케치 지도 렌더링' 시 반드시 이 스킬을 사용할 것. 후속 작업: 체감 표현 변경, 블렌드 비율 재조정, 산지 변경, 로스팅 보정 on/off, 재실행 및 결과 개선 시에도 반드시 이 스킬을 사용할 것."
---

# CoBTS Orchestrator — 커피 맛 추적 및 14개 산지 매칭 서비스 오케스트레이터

CoBTS (Coffee Bean Tracking Service)의 5인 전문 에이전트 팀을 총괄 조율하여, 고객이 원하는 체감 맛(산미, 단맛, 바디, 고소함)으로부터 7개국 14개 산지 기반의 싱글 및 AI 블렌드를 도출하고, 건축 펜화 스케치 지도 시각화와 관세청 수입 규제를 연계하는 워크플로우입니다.

> **서비스 모토:** *"고객이 원하는 맛을 정확하게 제공한다. 빈이든 카페든."*  
> **표현 원칙:** *"표준적인 이론 값을 기준으로 계산한 추천입니다. 맛은 사람의 입맛에 따라 다르게 느껴질 수 있습니다."*

## 실행 모드: 에이전트 팀 (Agent Team)

에이전트 간 직접 통신(`SendMessage`)과 공유 작업 목록(`TaskCreate`/`TaskUpdate`)으로 조율하며, 7개 메인 시드 및 14개 산지 고도/가공 보정치와 3원두 블렌딩 쏠림 방지 제약(한 나라 최대 60%)을 교차 검증합니다.

## 팀 구성 및 역할

| 팀원 | 타입 | 모델 | 핵심 역할 | 전용 스킬 | 산출물 |
|------|------|------|----------|----------|--------|
| `flavor-cartographer` | custom | opus | 체감 표현 분석, 7개국 14개 산지 매칭, 3원두 AI 블렌드 계산, 스케치 지도 좌표계 | `coffee-taste-mapping`, `sketch-map-renderer` | `_workspace/02_cartographer_origin_map.json` |
| `roast-bean-curator` | custom | opus | 14개 산지 고도(기준 1400m)·가공방식(워시드/내추럴/허니) 보정, 로스팅 정보 유무별 보정 | `coffee-taste-mapping` | `_workspace/02_curator_bean_roasting.json` |
| `customs-trade-analyst` | custom | opus | 관세청 국가단위 수입 여부(HS 0901.11/0901.21), 식약처 정밀검사, CLIP .xlsx 연간 규격 | `customs-hs-verifier` | `_workspace/02_customs_import_clearance.json` |
| `commerce-finder` | custom | opus | 판매처 상태 관리(현재: 연결 보류 / 네이버 API HUB 이관 절차 및 아마존 연계 모니터링) | `distribution-finder` | `_workspace/02_commerce_vendor_channels.json` |
| `cobts-qa` | general-purpose | opus | 고도 보정 공식(±1.0), 블렌드 쏠림 제약(단일국 ≤ 60%), 경계면 계약 교차 검증 | - | `_workspace/03_qa_verification_report.md` |

---

## 워크플로우

### Phase 0: 컨텍스트 확인 (후속 작업 지원)
1. `_workspace/` 존재 여부 확인
2. 실행 모드 판별:
   - **초기 실행**: 신규 `_workspace/` 생성 후 Phase 1 진행
   - **체감 표현/산지 수정 요청**: 부분 재실행 (기존 산출물 참조하여 해당 파라미터만 재계산)
   - **새로운 테이스트 검색**: 기존 `_workspace/`를 `_workspace_{timestamp}/`로 이동 후 재생성

### Phase 1: 준비 및 체감 표현 파싱
1. 사용자 입력 파싱:
   - 4대 감각 축: 산미, 단맛, 바디, 고소함 (체감 5단계: `거의없게`, `은은하게`, `적당히`, `뚜렷하게`, `많이나게`)
   - 부가 감각: 쓴맛, 텁텁함(Mouth drying)
   - 선택 옵션: 로스팅 보정 모드 (`with_roast` / `no_roast`), 가공 방식 필터 (`washed`, `natural`, `honey`)
2. `_workspace/00_input/taste_request.json`에 저장

### Phase 2: 팀 구성 및 작업 할당
1. `TeamCreate(team_name: "cobts-team")` (5명 모두 `model: "opus"`)
2. `TaskCreate`:
   - Task 1: "7개국 시드 및 14개 산지 고도 보정 프로파일 계산" (`assignee: flavor-cartographer`)
   - Task 2: "싱글 오리진 1순위 도출 및 AI 3원두 블렌드(60% 쏠림 제약 적용) 생성" (`assignee: flavor-cartographer`, `depends_on: [Task 1]`)
   - Task 3: "건축 펜화 스케치 지도(Image 2) 14개 산지 핀 및 커피벨트 오버레이" (`assignee: flavor-cartographer`, `depends_on: [Task 2]`)
   - Task 4: "산지별 가공/로스팅 사실 정보 큐레이션 및 로스팅 이론 보정" (`assignee: roast-bean-curator`, `depends_on: [Task 2]`)
   - Task 5: "관세청 HS 코드 및 수입 가능성 판정" (`assignee: customs-trade-analyst`, `depends_on: [Task 2]`)
   - Task 6: "국내외 판매처 연결 상태(보류) 및 검색 딥링크 안내" (`assignee: commerce-finder`, `depends_on: [Task 4, Task 5]`)
   - Task 7: "모듈 간 경계면 및 블렌드 쏠림 제약 점진적 교차 검증" (`assignee: cobts-qa`, `depends_on: [Task 3, Task 4, Task 5, Task 6]`)

### Phase 3: 병렬 처리 및 조율
- `flavor-cartographer`가 계산한 최적 싱글 산지와 블렌드 조합(예: 에티오피아 50% + 콜롬비아 30% + 브라질 20%)을 `SendMessage`로 전파
- `roast-bean-curator`는 상품 사실 정보(농장, 고도, 가공)와 이론 로스팅 가이드를 병기
- `customs-trade-analyst`는 관세청 국가단위 수입 요건 검증 결과를 전달
- `commerce-finder`는 판매처 연결이 현재 "보류" 상태임을 명시하고 네이버 쇼핑 및 구글 검색 딥링크를 안내

### Phase 4: 점진적 QA 및 통합
1. `cobts-qa`가 다음 사항을 교차 검증:
   - 블렌드 내 단일 국가 비중이 60%를 초과하지 않는지 (쏠림 제약 확인)
   - 고도 보정 공식(기준 1400m, 100m당 산미 +0.15 등)이 ±1.0 한도 내인지
   - 법적 표현 원칙(*"표준적인 이론 값을 기준으로 계산한 추천입니다..."*)이 명시되었는지
2. 검증 완료 시 통합 산출물 `_workspace/04_cobts_integrated_result.json` 생성

### Phase 5: 스케치 지도 및 대시보드 렌더링
1. Image 1의 전환 흐름(초기 검색창 → "전세계가 올라가는 애니메이션" → 14개 산지 스케치 지도 & 상세 대시보드) 전개
2. 팀 정리 (`TeamDelete`) 및 산출물 보존

---

## 데이터 흐름 다이어그램

```
[사용자 체감 표현: 산미/단맛/바디/고소함]
                    │
                    ▼ Phase 1
           [taste_request.json]
                    │
                    ▼ Phase 2 & 3
         [flavor-cartographer]
            │               │
  (14개 산지 고도 보정)     (3원두 블렌드 제안: ≤60% 쏠림 제약)
            │               │
            ▼               ▼
      [02_cartographer_origin_map.json]
            │               │
            ├───────────────┼───────────────┐
            ▼               ▼               ▼
  [roast-bean-curator] [customs-analyst] [commerce-finder]
   (가공/로스팅 사실)  (관세청 0901)   (연결 보류/안내)
            │               │               │
            └───────────────┼───────────────┘
                            ▼ Phase 4
                       [cobts-qa]
               (경계면 & 쏠림 제약 검증)
                            │
                            ▼ Phase 5
          [CoBTS 스케치 지도 & 싱글/블렌드 대시보드]
```
