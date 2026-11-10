---
name: sketch-map-renderer
description: "핸드드로운 펜화/점묘화 스케치 스타일(외곽선 잉크 펜화 + 해안선 사선 음영 해칭 + 대륙 내부 점묘 Stippling + 정방형 모눈 그리드 배경)로 글로벌 세계 지도와 커피 벨트(25°N~25°S), 14개 세부 산지 핀을 렌더링하고 전환 애니메이션을 생성하는 전용 스킬. '글로벌 맵 그리기', '핸드드로운 스케치 지도', '점묘화 해칭 세계지도', '14개 산지 핀 렌더링', '지도 상승 애니메이션' 시 반드시 이 스킬을 사용할 것."
---

# Sketch Map Renderer — 핸드드로운(Hand-Drawn) 펜화 & 점묘 글로벌 맵 렌더러

정방형 모눈(Square Grid)이 인쇄된 웜 스톤/세피아 페이퍼 위에, 실제 펜으로 직접 그린 듯한 **불규칙 잉크 외곽선(Organic Ink Contour)**, **해안선 사선 음영 해칭(Coastal Diagonal Hatching)**, **대륙 내부 점묘(Interior Stippling)**를 결합한 핸드드로운 세계 지도를 렌더링합니다.

## 1. `anvaka/city-roads` (첨부2) 스타일 글로벌 세계지도 디자인 규격

### A. 캔버스 배경 및 팔레트 (Pure `#F7F2E8` Paper & `#1a1a1a` Charcoal Ink)
- **배경 컬러**: 정방형 모눈 그리드와 어두운 비네팅을 제거한 순수 `anvaka/city-roads` 웜 크림 페이퍼 (`#F7F2E8`)
- **선화 컬러**: `rgba(26, 26, 26, 0.84)` (`#1a1a1a`) 초세밀 차콜 벡터 도로망 및 해안선

### B. 대륙 도로망 렌더링 3요소 & 4가지 스타일 모드
1. **비중첩 보로노이(Voronoi) 지구 도로망**: 기존 점묘(Stippling)와 사선 해칭 대신, 전 세계 대륙 내부를 다각도 보로노이 도시/지역 블록과 세밀한 격자 도로망(`way[highway]`), 대륙 횡단 간선도로로 채워 `anvaka/city-roads` 특유의 밀도감 있는 도로 지도를 구현
2. **네거티브 스페이스(Negative Space) 대하천 및 교량**: 아마존강, 나일강, 미시시피강, 양쯔강, 다뉴브강, 마그달레나강 등 주요 하천을 `#F7F2E8` 여백 수로로 비워두고 양안 강변고속도로와 도하 교량 선분을 배치
3. **유기적 산악·사막 여백(Feathered Topographic Voids)**: 히말라야, 안데스, 알프스, 사하라, 고위도 툰드라 등 지형적 공백 가장자리로 골짜기 도로가 자연스럽게 스며드는 페더링(Feathering) 처리
4. **하단 4종 미니맵 스타일 스위처 (`assets/hand-drawn-mini-strip.png`)**:
   - `01. CITY-ROADS (#F7F2E8)`: `#F7F2E8` 크림 배경 + `#1a1a1a` 차콜 도로망
   - `02. VINTAGE PARCHMENT (#EAE2D3)`: `#EAE2D3` 양피지 배경 + `#261c12` 세피아 잉크
   - `03. DARK CYBER (#161616)`: `#161616` 다크 배경 + `#e8f0fa` 아이스 블루 도로망
   - `04. SEPIA BLUEPRINT (#F4EFE6)`: `#F4EFE6` 배경 + `#663314` 브라운 잉크

---

## 2. 14개 세부 산지 좌표계 매핑 (740 × 410 Map Viewport 기준)

- **북회귀선 (25°N, Coffee Belt North)**: `Y = 182`
- **적도 (0°, Equator)**: `Y = 240`
- **남회귀선 (25°S, Coffee Belt South)**: `Y = 296`

| 국가 | 산지 (Region) | 뷰포트 좌표 (X, Y) | 위경도 (WGS84) |
|---|---|---|---|
| **에티오피아** | 예가체프 (Yirgacheffe)<br>시다모·구지 (Sidamo/Guji) | (422, 222)<br>(426, 225) | 6.16°N, 38.20°E<br>5.85°N, 38.98°E |
| **케냐** | 니에리 (Nyeri)<br>키암부·키리양가 (Kiambu/Kirinyaga) | (420, 239)<br>(423, 243) | 0.42°S, 36.95°E<br>0.50°S, 37.28°E |
| **콜롬비아** | 우일라 (Huila)<br>나리뇨 (Nariño) | (203, 236)<br>(199, 242) | 2.92°N, 75.28°W<br>1.28°N, 77.35°W |
| **과테말라** | 안티구아 (Antigua)<br>우에우에테낭고 (Huehuetenango) | (168, 210)<br>(164, 205) | 14.56°N, 90.73°W<br>15.31°N, 91.47°W |
| **브라질** | 술 드 미나스 (Sul de Minas)<br>세하두 미네이루 (Cerrado Mineiro) | (258, 278)<br>(252, 270) | 21.78°S, 45.43°W<br>18.91°S, 48.27°W |
| **인도네시아** | 만델링 (Mandheling)<br>토라자 (Toraja) | (540, 242)<br>(582, 252) | 3.59°N, 98.67°E<br>3.02°S, 119.88°E |
| **코스타리카** | 타라쥬 (Tarrazú)<br>센트럴 밸리 (Central Valley) | (183, 223)<br>(180, 220) | 9.66°N, 84.02°W<br>10.01°N, 84.11°W |

---

## 3. `anvaka/city-roads` 기반 실시간 도로망(OSM `way[highway]`) & 내비게이션 렌더링 아키텍처

Reference: `https://github.com/anvaka/city-roads.git` (`src/lib/Query.js`, `src/lib/Grid.js`, `src/lib/GridLayer.js`, `src/config.js`)

1. **데이터 파이프라인 (`CityRoadsQuery` / `fetchLiveOverpassCityRoads`)**:
   - OpenStreetMap Overpass API (`[out:json][timeout:15][bbox:S,W,N,E];way[highway];(._;>;);out skel qt;`)를 통해 14개 커피 산지 주변의 실제 도로(`way[highway]`) 및 노드 좌표를 실시간 조회합니다.
   - 초기 진입 또는 오프라인/레이트리밋 환경에서도 지연 없이 즉시 렌더링되도록 `buildCityRoadsTopologyGrid`를 통해 복선 고속화도로(`motorway`/`trunk`), 입체 나들목 램프(`motorway_link`), 주간선·보조간선도로(`primary`/`secondary`), 다각도 회전 주거 블록 도로망(`residential`), 빗살형/루프형 골목(`service`/`living_street`)으로 구성된 순수 도로 선분(`WireCollection`)을 생성합니다.
2. **공간 투영 및 정규화 (`CityRoadsGrid.projectMercator`)**:
   - `d3-geo`의 Spherical Mercator 투영 공식을 적용해 위경도 `(lon, lat)`를 산지 중심 등각 평면 좌표로 변환하여 도로 교차각의 왜곡을 방지하고 바운딩 박스를 정규화합니다.
3. **순수 선화 배칭 렌더링 (`WireCollection` & `#F7F2E8` 미학)**:
   - 모든 도로를 2점 선분(`Float32Array` `[x1, y1, x2, y2]`)으로 분해하여 `WireCollection` 버퍼에 저장하고 단일 패스로 고속 드로잉합니다.
   - `anvaka/city-roads` 기본 테마인 **`#F7F2E8` 웜 크림 배경**(불필요한 모눈 그리드·인공 건물 박스 배제) 위에 **`rgba(26, 26, 26, 0.82)` 세밀 차콜 선**과 우측 하단 미니멀 도시 타이틀 블록(`YIRGACHEFFE`, 위경도 표기)을 표시합니다.
