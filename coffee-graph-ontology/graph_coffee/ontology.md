# 온톨로지 정의 및 규칙 — 커피

기준은 `build_graph.py`의 `CLASSES`, `RELATIONS`와 규칙 코드다. 규칙을 바꾸면 스크립트를 고치고 다시 실행한다.

## 클래스

| 클래스 | 설명 | 예 |
|---|---|---|
| Technique | 기술 분야 | 가공, 로스팅, 블렌딩 |
| Species | 커피 종 | 아라비카, 로부스타, 리베리카, 라세모사 |
| Variety | 품종 | 티피카, 버번, 게이샤, 카티모르 |
| Continent / Country / Region | 대륙 → 국가 → 산지 | 아시아 → 인도네시아 → 만델링 |
| Process | 가공 방식 | 워시드, 내추럴, 허니, 웻헐링, 코피 루왁, 몬순, 숙성 |
| RoastStage | 로스팅 단계 | 건조 → 갈변 → 팽창 → 1차 크랙 → 2차 크랙 → 냉각 |
| RoastLevel | 배전도 (속성: 구분 light/medium/dark, 온도) | 시나몬 196 °C … 이탈리안 245 °C |
| Equipment | 로스터 장비 | 드럼, 열풍(유동층) |
| BlendMethod | 블렌딩 방법 | 선블렌딩, 후블렌딩 |
| Blend | 블렌드 | 모카 자바 |
| Flavor | 풍미·특성 | 산미, 바디, 원산지 특성, 캐러멜 |

## 관계

| 관계 | 도메인 → 레인지 | 설명 |
|---|---|---|
| belongsTo | Variety → Species | 품종의 종 (종간 교잡은 2개) |
| mutationOf / selectedFrom / crossOf | Variety → Variety | 돌연변이 / 선발 / 교배(부모 2개) |
| descendsFrom | Variety → Variety | 계보 이행 (도출) |
| originatesIn | Variety·Process → 장소 | 기원지 |
| grownIn | Variety·Species → 장소 | 재배지 |
| produces | Country → Species | 국가의 종 생산 (속성: rank 순위) |
| mainlyProducedIn | Species → Continent | 주산 대륙 |
| locatedIn | Region → Country, Country → Continent | 지리 포함 |
| usesProcess | 장소 → Process | 산지의 가공 방식 |
| partOf | Process·RoastStage·RoastLevel·Equipment·BlendMethod → Technique | 기술 분야 소속 |
| nextStage | RoastStage → RoastStage | 단계 순서 |
| darkerThan / reachedAfter | RoastLevel → RoastLevel / RoastStage | 배전 순서, 크랙 도달 (도출) |
| increases / decreases / emphasizes | Process·RoastLevel 등 → Flavor | 풍미 영향 |
| hasComponent / usesMethod | Blend → 품종·산지 / BlendMethod | 블렌드 구성과 방법 |
| contrastsWith | BlendMethod ↔ BlendMethod | 대비 (대칭) |

## 간선 속성

- `confidence`: `confirmed`(출처에 직접 서술), `claimed`(업계 자료·문서 자체의 단서가 붙은 주장), `inferred`(암시 또는 규칙 도출). `claimed`·`inferred`는 시각화에서 점선.
- `src`: ①~⑦ 출처 번호 (`Coffee_원두_로스팅_원산지_블렌딩.md` 상단 표와 같음). 도출 간선은 `derived=true`와 규칙명.

## 추론 규칙 (간선을 추가)

| 규칙 | 내용 | 도출 |
|---|---|---|
| R3 | contrastsWith 대칭 | 1 |
| R4 | 종 상속: 돌연변이·선발 품종은 부모의 종을, 교배종은 두 부모 종의 합집합을 물려받음 (예: 카티모르 = 티모르 하이브리드(아라비카+로부스타) × 카투라 → 두 종) | 15 |
| R5 | 계보 이행: descendsFrom = (mutationOf ∪ selectedFrom ∪ crossOf)⁺ (예: 카투아이 → 문도 노보·카투라·버번·티피카) | 29 |
| R6 | 지리 상향: 지역에서 재배·가공되면 그 지역이 속한 국가에서도 재배·가공됨 | 9 |
| R7 | 배전도 순서: 온도가 높은 배전도가 바로 앞 단계보다 darkerThan | 7 |
| R8 | 배전도 온도 ≥ 크랙(단계) 온도이면 그 단계를 지남 (reachedAfter) | 20 |
| R9 | 단일 종 품종이 어떤 국가에서 재배되면 그 국가는 그 종을 생산함 | 10 |

## 검증 규칙 (위반을 보고)

| 규칙 | 내용 |
|---|---|
| R1 | 관계의 도메인/레인지 클래스 일치 |
| R2 | 모든 간선에 confidence, 직접 변환 간선에 출처 |
| R10 | 모든 품종은 종이 하나 이상 결정됨 (직접 또는 R4) |
| R11 | 종이 둘 이상인 품종은 데이터에 종간 교잡(interspecific)으로 표시되어 있어야 함 |
| R12 | 교배종은 부모가 정확히 2개 |
| R13 | 품종 계보에 순환 없음 |
| R14 | 지역은 정확히 한 국가에, 국가는 정확히 한 대륙에 속함 |
| R15 | 배전도 온도가 서로 다르고, 온도 순서가 라이트 < 미디엄 < 다크와 일치 |
| R16 | 로스팅 단계 순서와 온도 순서가 일치 |
| R17 | 종 수치 일관성: 아라비카+로부스타 비중 ≤ 100%, 카페인·클로로젠산 아라비카 < 로부스타 |
| R18 | 블렌드는 구성 요소가 2개 이상 |
| R19 | 같은 대상이 같은 풍미를 동시에 increases·decreases 하지 않음 |
| R20 | 자기 참조 간선 없음 |

## 현재 결과

`validation_report.md` 참고. 노드 130, 간선 325(직접 234 + 도출 91), 위반 0.
첫 실행에서 R1이 2건을 잡았다. 블렌드가 풍미를 강조하는 관계(`emphasizes`)의 도메인에 Blend를 넣지 않은 정의 누락이었고, 정의를 고쳐 해결했다.

## 모델링 결정과 한계

- **자바:** ②가 "종간 교잡, 단일 품종이 아닌 지역 스타일"로 적어 두 종 모두에 `claimed`로 연결했다.
- **종 미기재 품종:** S.288, 탄자니아 가뭄 저항 품종, 프렌치 미션은 출처에 종이 없어 아라비카로 `inferred` 연결했다(아라비카 품종의 부모라서).
- **기원 vs 재배지:** ②의 Origin 열은 기원과 재배지가 섞여 있다. "traced to", "found", "bred" 같은 표현이 있는 것만 `originatesIn`, 나머지는 `grownIn`으로 넣었다.
- **R9의 한계:** 품종이 재배된다는 사실만으로 국가의 종 생산을 도출하므로, 실제 생산 규모와는 무관하다.
- **블렌딩:** 방법과 현대 모카 자바는 웹 검색 요약(⑦) 근거라 모두 `claimed`다.
- **가공 풍미:** 워시드·내추럴·허니 가공의 풍미 영향은 출처에 없어 간선을 만들지 않았다.
- **배전도 풍미:** 위키 표의 "Flavor notes"를 풍미 노드로 옮긴 것이고, 그 절은 위키에서 출처 보강 필요 표시가 있다.
