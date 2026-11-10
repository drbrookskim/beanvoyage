# 프로젝트 작업 기록 (이어서 작업용)

- 폴더: `/Users/nelcome/Downloads/genai-lv4/orca-lv4-20261027/` (모든 결과물은 여기에 저장)
- 최종 갱신: 2026-10-27
- 새 세션에서는 이 파일을 먼저 읽고 이어서 진행

## 목표

주제별로 자료를 수집해 한국어 문서로 정리하고, 지식 그래프(온톨로지 규칙 적용)로 시각화·배포한다.

1. JTBC 드라마 《재벌집 막내아들》(2022)
2. 커피: 원두 · 로스팅 · 원산지 · 블렌딩

## 결과물

| 파일 | 내용 | 상태 |
|---|---|---|
| `RebornRich_줄거리.md` | 정보·출연진·16화 목록(시청률)·회차별 줄거리 (Wikipedia + TVmaze) | 완료 (회차 줄거리가 짧음) |
| `graph_reborn_rich/graph.html` | 지식 그래프 시각화 (인터넷 필요: vis-network CDN). 포스트잇 메모, 노드 메모, 오른쪽 클릭 메뉴 포함 | 완료 |
| `graph_reborn_rich/graph.json`, `nodes.csv`, `edges.csv` | 그래프 데이터 (노드 94, 간선 282) | 완료 |
| `graph_reborn_rich/ontology.md` | 온톨로지 클래스·관계·규칙(R1~R16) 정의 | 완료 |
| `graph_reborn_rich/validation_report.md` | 규칙 검증 결과 (위반 0) | 완료 |
| `graph_reborn_rich/build_graph.py`, `graph_template.html` | 위 파일을 재생성하는 스크립트와 템플릿 (`python3 build_graph.py`) | |
| `graph_reborn_rich/deploy/index.html`, `wrangler.jsonc` | 배포용 사본과 설정 | |
| 배포 URL | https://reborn-rich-graph.hello-world-history.workers.dev (Cloudflare Workers 정적 자산, 재배포: `source ~/.zshrc` 후 `cd graph_reborn_rich && npx wrangler deploy`) | 배포됨 (메모 기능 포함 최신) |
| `Coffee_원두_로스팅_원산지_블렌딩.md` | 커피 종·품종 계보·원산지·가공·로스팅 단계/배전도/장비·블렌딩 (위키백과 6개 문서 + 블렌딩은 웹 검색 요약) | 완료 |
| `graph_coffee/` | 커피 지식 그래프 (graph.html·데이터·ontology.md·validation_report.md·build_graph.py). 노드 130, 간선 325, 위반 0. 옵시디언 스타일 UI(d3-force 캔버스, 탐색기·그래프 설정·노트 패널) + 메모 기능 | 완료 |
| `graph_coffee/functions/mcp.js` | MCP 서버 (Pages Function, Streamable HTTP·stateless·읽기 전용). 도구 10개·리소스 4개. 데이터는 build_graph.py가 만드는 `mcp_data.js` | 완료 |
| `graph_coffee/connect.html` | MCP 연결 안내 페이지 (Claude Code·Claude·Cursor·VS Code·stdio·curl), 서버에서 도구 목록 실시간 표시 | 완료 |
| `graph_coffee/test_mcp.mjs` | MCP 서버 로컬 테스트 (`node test_mcp.mjs`) | |
| `graph_coffee/tools_core.js` | MCP 서버·WebMCP가 함께 쓰는 조회 도구 10개 (build_graph.py가 페이지에 넣음) | 완료 |
| `graph_coffee/functions/api/chat.js` | 내장 AI 채팅. Workers AI `@cf/zai-org/glm-4.7-flash`(실패 시 gemma-4-26b) + MCP(initialize·tools/list·tools/call)로 그래프 조회, 화면 동작(하이라이트·이동·필터) 반환 | 완료 |
| `graph_coffee/fetch_origin_images.py`, `origin_images.json` | 원산지(대륙·국가·산지) 위키백과 대표 이미지 수집 스크립트와 캐시 (48/49개, 예가체프는 이미지 없음). 노트 패널·MCP get_node에 표시 | 완료 |
| `graph_coffee/test_chat.mjs` | 채팅 함수 로컬 테스트 (가짜 모델로 MCP 흐름 검증, `node test_chat.mjs`) | |
| 그래프 페이지 기능 | WebMCP(도구 22개: 조회 10 + 화면·메모 12), 노트 뷰 ON/OFF, AI 채팅 창, 검색·채팅 하이라이트(그래프 후광·탐색기·노트 형광 표시) | 완료 |
| 커피 배포 URL | https://coffee-graph.pages.dev (그래프), /connect (안내), /mcp (MCP 엔드포인트). Cloudflare Pages. 재배포: `source ~/.zshrc` 후 `cd graph_coffee && python3 build_graph.py && npx wrangler pages deploy --branch main` | 배포됨 |
| `embedding_map/` | **임베딩 지도 (커피만)**: 커피 문서(표 행·문단 75개)와 커피 그래프 노드 130개, 조각 205개를 한 가지 형식("대상 — 분류. 항목: 값.", 그래프 관계·속성은 한국어로 풀어 씀)으로 써서 `@cf/baai/bge-m3`(1024차원, 다국어)로 임베딩. 투영 전환 UMAP(브라우저 umap-js, 질문은 `transform`. 결과가 이웃 가중 평균에서 0.2 넘게 벗어나면 이웃 평균으로 대체하고 범례에 근사로 표시) · t-SNE(파이썬 사전 계산, 질문은 이웃 5개 가중 평균 근사) · PCA(파이썬 사전 계산, 질문은 같은 주성분에 정확히 사영, PC1+PC2 설명 분산 18%). 채팅 질문 → 의미 검색 + BM25 키워드(한글 2글자, 본문만) → RRF 상위 20개 후보를 지도(★·연결선·순위)와 후보 패널(의미×키워드 산점도, 점수 막대)로 표시, 상위 6개를 문맥으로 GLM-4.7-Flash(실패 시 gemma)가 답하고 인용 [n] 표시. 색 기준 "질문 유사도", `?q=질문` 링크 | 완료 |
| 임베딩 지도 배포 URL | https://embedding-map.pages.dev (Cloudflare Pages). 재생성: `cd embedding_map && python3 build_corpus.py && python3 build_vectors.py && npx wrangler pages deploy --branch main` (API 토큰에 Workers AI 권한이 없어 임베딩은 배포된 `/api/embed-corpus`가 계산. 이 함수는 비밀값 BUILD_KEY 필요, 로컬 사본은 `embedding_map/.build_key`. 바뀐 조각만 다시 임베딩: `embed_cache.npz`) | 배포됨 |
| `PROJECT_LOG.md` | 이 파일 | |

## 알려진 한계

- 위키백과(영어)에 회차 줄거리가 없어 TVmaze 요약을 사용. 현우의 죽음 장면, 12화의 배후, 결말은 출처에 없음.
- 한국어 위키 문서는 접근 불가(404).
- 사건 간선(사망·정체 공개·소개)은 1~3화에 한정. 일부 관계는 `inferred`/`claimed`.
- 메모(포스트잇·노드 메모)는 보는 사람의 브라우저 localStorage에만 저장됨.

## 다음에 할 일

- [ ] 임베딩 지도: 공개 `/api/search`·`/api/chat`도 무료 할당을 함께 씀 → 필요 시 요청 제한. t-SNE의 질문 위치는 근사(이웃 가중 평균)

- [ ] AI 채팅 답변 품질: 소형 무료 모델이 도구 결과를 잘못 요약하는 경우가 있음 (예: 로스팅 비교에서 자기 표와 모순). 필요하면 유료 플랜 모델 검토
- [ ] AI 채팅 남용 대비: 공개 엔드포인트라 누구나 계정의 무료 할당(하루 10,000 뉴런)을 쓸 수 있음. 필요 시 요청 제한(Rate Limiting) 추가

- [ ] 이전 커피 주소(coffee-graph.hello-world-history.workers.dev, Workers) 삭제 여부 결정 — 삭제: `npx wrangler delete coffee-graph`
- [ ] 재벌집 그래프에도 옵시디언 스타일 UI·MCP 적용 여부 (선택)

- [ ] 커피: 블렌딩 출처 보강(원문 확인 또는 신뢰할 문헌), 워시드·내추럴·허니 가공의 풍미 영향 자료 확보

- [ ] 더 자세한 줄거리 출처(한국어 문서 등) 확보 시 사건 간선 보강
- [ ] 사용자가 별도의 온톨로지 규칙을 갖고 있다면 `ontology.md`와 대조해 반영

## 작업 로그 (최신이 위)

| 날짜 | 작업 |
|---|---|
| 2026-10-27 | 임베딩 지도: 문서·노드가 따로 모이던 문제 개선. 원인은 글 형식 차이(표 "키: 값 /" vs 영어 관계명). 두 종류를 공통 형식으로 다시 써서 이웃 10개 중 다른 종류 비율(기대값 대비) 17%→58%, t-SNE 2D 16%→79%, 같은 대상 문서행↔노드가 서로 1위인 비율 2%→92%. 종류별 평균 빼기 보정은 이득이 작아(66%·83%·90%) 쓰지 않음. 임베딩 엔드포인트는 빌드 키가 있으면 글 목록을 직접 받도록 변경 |
| 2026-10-27 | 임베딩 지도: 재벌집 자료 제외(커피만 206개), UMAP(브라우저, 질문 transform)·t-SNE·PCA 투영 전환(애니메이션·자동 맞춤) 추가 후 배포. CDP로 세 투영·모바일 확인, 콘솔 오류 없음 |
| 2026-10-27 | 임베딩 지도(embedding_map/) 제작·배포: bge-m3 임베딩, t-SNE 지도, 하이브리드 검색(의미+BM25, RRF) 후보 시각화, 근거 인용 채팅. CDP로 데스크톱·모바일(390px) 화면과 콘솔 오류 없음 확인 |
| 2026-10-27 | `orca-lv4-20261027-1` 폴더 생성, Colab MCP(colab-mcp)를 Claude Code 프로젝트 `.mcp.json`에 등록. Python 3.13 설치함. Intel Mac(macOS 12)에서 cryptography 49+ 휠이 없어 빌드 실패 → `--with "cryptography<49"` 추가. 서버 시작·브라우저 연결·42 출력 검증은 남음 |
| 2026-10-27 | 상태 표시줄 WebMCP 문구 변경(사용 불가 이유·사용 방법 팝업), 원산지 이미지 추가(국가 21곳은 커피 산지 사진, 나머지는 대표 이미지) 후 배포 |
| 2026-10-27 | 탐색기·노트 사이드바 너비 조절(드래그, 더블클릭 시 기본값, 설정에 저장, 그래프 최소 320px 보장) 추가 후 배포 |
| 2026-10-27 | WebMCP 추가, 노트 뷰 ON/OFF 동작, Workers AI 채팅(MCP 사용)·동적 그래프 반영·검색 하이라이트 추가 후 배포. 실제 모델로 질문 4개 시험(계보 오류를 get_lineage 요약 필드로 개선, 빈 답 재요청 처리) |
| 2026-10-27 | 커피 그래프를 옵시디언 그래프 뷰 스타일로 재구성, MCP 서버와 연결 안내 페이지 추가, Cloudflare Pages(coffee-graph.pages.dev)로 이전 배포. 헤드리스 Chrome으로 화면·동작 확인, curl·node로 MCP 확인 |
| 2026-10-27 | 커피(원두·로스팅·원산지·블렌딩) 문서, 지식 그래프(R1~R20), 검증, coffee-graph로 배포. 재벌집 작업물은 유지 |
| 2026-10-27 | 메모 기능(포스트잇·노드 메모·오른쪽 클릭 메뉴) 반영본을 reborn-rich-graph에 재배포 |
| 2026-10-27 | 이전 배포 주소 삭제 확인(Worker 없음, 주소 404). 토큰을 `~/.zshrc`에 설정해 대화 노출 없이 wrangler 사용 가능 |
| 2026-10-27 | 이전 작업(다른 드라마) 관련 로컬 파일 전부 삭제, 재벌집 막내아들만 남김 |
| 2026-10-27 | 오른쪽 클릭 메뉴(노드: 포스트잇/노드 메모 추가·편집·삭제, 빈 곳: 포스트잇), 노드 자체 메모(📝·툴팁·검색 포함), 포스트잇 메모 추가. 로컬만 갱신 |
| 2026-10-27 | 재벌집 막내아들 줄거리·지식 그래프·온톨로지 규칙·검증, reborn-rich-graph Workers로 배포. API 토큰은 저장하지 않음 |

> 규칙: 새 작업을 할 때마다 위 "다음에 할 일", "결과물", "작업 로그"를 갱신한다.
