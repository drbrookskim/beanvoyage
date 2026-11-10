// 커피 지식 그래프 조회 도구 (MCP 서버와 WebMCP 페이지가 함께 쓰는 공통 코드)
// functions/mcp.js는 ES 모듈로 import하고, build_graph.py는 `export`를 떼고 graph.html에 넣는다.
export function createGraphTools(DATA) {
  const G = DATA.graph;
  const nodeById = new Map(G.nodes.map((n) => [n.id, n]));
  const CLASSES = Object.keys(G.classes);
  const label = (id) => (nodeById.get(id) || { label: id }).label;
  const LINEAGE_RELS = ["mutationOf", "selectedFrom", "crossOf"];

  class ToolError extends Error {}

  const TOOLS = [
    {
      name: "get_overview",
      title: "그래프 개요",
      description: "클래스별 노드 수, 관계 유형(도메인·레인지·간선 수), confidence 의미, 출처 목록을 돌려줍니다. 처음에 한 번 호출하세요.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "search_nodes",
      title: "노드 검색",
      description: "라벨(한국어)·id(영어, 예: V_bourbon)·속성 값에 검색어가 들어간 노드를 찾습니다. 영어 품종명은 id로 찾기 쉽습니다(예: 'bourbon', 'geisha').",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "검색어 (대소문자 무시)" },
          class: { type: "string", enum: CLASSES, description: "클래스로 제한 (선택)" },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "get_node",
      title: "노드 상세",
      description: "노드의 속성과 나가는/들어오는 간선 전체를 돌려줍니다. id 또는 정확한 라벨을 받습니다.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "노드 id 또는 라벨" },
          include_derived: { type: "boolean", default: true, description: "규칙으로 도출한 간선 포함 여부" },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
    {
      name: "get_neighbors",
      title: "이웃 노드",
      description: "노드와 직접 연결된 이웃을 관계·방향으로 걸러 돌려줍니다.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          relation: { type: "string", description: "관계 이름으로 제한 (예: grownIn)" },
          direction: { type: "string", enum: ["out", "in", "both"], default: "both" },
          include_derived: { type: "boolean", default: true },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
    {
      name: "find_path",
      title: "경로 찾기",
      description: "두 노드 사이의 최단 연결 경로(방향 무시)를 찾고, 각 단계의 관계와 방향을 돌려줍니다.",
      inputSchema: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          max_depth: { type: "integer", minimum: 1, maximum: 6, default: 4 },
          include_derived: { type: "boolean", default: false },
        },
        required: ["from", "to"],
        additionalProperties: false,
      },
    },
    {
      name: "list_nodes",
      title: "클래스별 노드 목록",
      description: "한 클래스의 노드를 모두 나열합니다 (예: RoastLevel, Variety, Process).",
      inputSchema: {
        type: "object",
        properties: {
          class: { type: "string", enum: CLASSES },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 100 },
        },
        required: ["class"],
        additionalProperties: false,
      },
    },
    {
      name: "query_edges",
      title: "간선 질의",
      description: "관계·출발·도착·confidence 조건으로 간선을 찾습니다. 조건은 모두 선택이며 AND로 결합됩니다.",
      inputSchema: {
        type: "object",
        properties: {
          relation: { type: "string" },
          source: { type: "string", description: "출발 노드 id 또는 라벨" },
          target: { type: "string", description: "도착 노드 id 또는 라벨" },
          confidence: { type: "string", enum: ["confirmed", "claimed", "inferred"] },
          include_derived: { type: "boolean", default: true },
          limit: { type: "integer", minimum: 1, maximum: 300, default: 100 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "get_lineage",
      title: "품종 계보",
      description: "품종의 조상(부모·조부모…) 또는 후손을 계보 관계(mutationOf·selectedFrom·crossOf)로 따라가 트리로 돌려주고, 종(species)도 함께 알려 줍니다.",
      inputSchema: {
        type: "object",
        properties: {
          variety: { type: "string", description: "품종 id 또는 라벨 (예: V_catuai, 카투아이)" },
          direction: { type: "string", enum: ["ancestors", "descendants", "both"], default: "both" },
        },
        required: ["variety"],
        additionalProperties: false,
      },
    },
    {
      name: "get_roast_levels",
      title: "배전도 표",
      description: "배전도 8단계를 온도순으로 구분(light/medium/dark), 강조·감소하는 풍미, 지나는 크랙 단계와 함께 돌려줍니다.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "get_ontology",
      title: "온톨로지 규칙·검증 결과",
      description: "온톨로지 정의(클래스·관계·추론/검증 규칙, 모델링 한계)와 최신 검증 보고서를 마크다운으로 돌려줍니다.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
  ];
  for (const t of TOOLS) t.annotations = { readOnlyHint: true, openWorldHint: false, idempotentHint: true };

  function resolve(ref) {
    if (typeof ref !== "string" || !ref.trim()) throw new ToolError("노드 id 또는 라벨이 필요합니다.");
    const q = ref.trim();
    if (nodeById.has(q)) return q;
    const lower = q.toLowerCase();
    const exact = G.nodes.find((n) => n.id.toLowerCase() === lower || n.label.toLowerCase() === lower);
    if (exact) return exact.id;
    const part = G.nodes.filter((n) => n.label.toLowerCase().includes(lower) || n.id.toLowerCase().includes(lower));
    if (part.length === 1) return part[0].id;
    const hint = part.slice(0, 8).map((n) => `${n.id} (${n.label})`).join(", ");
    throw new ToolError(part.length ? `'${q}'에 해당하는 노드가 여러 개입니다: ${hint}` : `'${q}' 노드를 찾지 못했습니다. search_nodes로 먼저 찾아 보세요.`);
  }

  const edgeView = (e, side) => {
    const v = { relation: e.rel, [side]: e[side], [side + "_label"]: label(e[side]), confidence: e.confidence };
    if (e.derived) { v.derived = true; v.rule = e.rule; } else v.source_doc = DATA.sources[e.src] || e.src;
    for (const k of ["rank", "note", "series", "mode"]) if (e[k] !== undefined) v[k] = e[k];
    return v;
  };
  const nodeView = (n) => {
    const { id, cls, label: l, ...attrs } = n;
    return { id, class: cls, label: l, ...(Object.keys(attrs).length ? { attributes: attrs } : {}) };
  };

  function call(name, a) {
    a = a || {};
    switch (name) {
      case "get_overview": {
        const byClass = {};
        for (const c of CLASSES) byClass[c] = { description: G.classes[c], count: G.nodes.filter((n) => n.cls === c).length };
        const rels = {};
        for (const [r, d] of Object.entries(G.relations)) {
          const es = G.edges.filter((e) => e.rel === r);
          rels[r] = { domain: d.domain, range: d.range, property: d.property || undefined, edges: es.length, derived: es.filter((e) => e.derived).length };
        }
        return {
          nodes: G.nodes.length, edges: G.edges.length, derived_edges: G.edges.filter((e) => e.derived).length,
          classes: byClass, relations: rels,
          confidence: { confirmed: "출처에 직접 서술", claimed: "업계 자료 등 주장(검증 약함)", inferred: "암시 또는 규칙 도출" },
          sources: DATA.sources,
        };
      }
      case "search_nodes": {
        const q = String(a.query || "").trim().toLowerCase();
        if (!q) throw new ToolError("query가 비어 있습니다.");
        const lim = Math.min(a.limit || 20, 100);
        // 이미지 URL 같은 출처 속성은 검색 대상에서 뺀다 (예: 'coffee'가 모든 산지 사진 URL에 걸리지 않도록)
        const searchable = (n) => JSON.stringify(n, (k, v) => (["image", "image_file", "image_source", "image_kind", "wiki_url"].includes(k) ? undefined : v));
        const hits = G.nodes.filter((n) => (!a.class || n.cls === a.class) && searchable(n).toLowerCase().includes(q));
        hits.sort((x, y) => (x.label.toLowerCase().includes(q) ? 0 : 1) - (y.label.toLowerCase().includes(q) ? 0 : 1));
        return { total: hits.length, results: hits.slice(0, lim).map(nodeView) };
      }
      case "get_node": {
        const id = resolve(a.id), inc = a.include_derived !== false;
        const keep = (e) => inc || !e.derived;
        return {
          ...nodeView(nodeById.get(id)),
          outgoing: G.edges.filter((e) => e.source === id && keep(e)).map((e) => edgeView(e, "target")),
          incoming: G.edges.filter((e) => e.target === id && keep(e)).map((e) => edgeView(e, "source")),
        };
      }
      case "get_neighbors": {
        const id = resolve(a.id), dir = a.direction || "both", inc = a.include_derived !== false;
        const ok = (e) => (inc || !e.derived) && (!a.relation || e.rel === a.relation);
        const res = [];
        if (dir !== "in") G.edges.filter((e) => e.source === id && ok(e)).forEach((e) => res.push({ direction: "out", ...edgeView(e, "target"), class: nodeById.get(e.target).cls }));
        if (dir !== "out") G.edges.filter((e) => e.target === id && ok(e)).forEach((e) => res.push({ direction: "in", ...edgeView(e, "source"), class: nodeById.get(e.source).cls }));
        return { node: nodeView(nodeById.get(id)), count: res.length, neighbors: res };
      }
      case "find_path": {
        const from = resolve(a.from), to = resolve(a.to), maxD = Math.min(a.max_depth || 4, 6), inc = a.include_derived === true;
        const adj = new Map();
        for (const e of G.edges) {
          if (!inc && e.derived) continue;
          if (!adj.has(e.source)) adj.set(e.source, []);
          if (!adj.has(e.target)) adj.set(e.target, []);
          adj.get(e.source).push([e.target, e, "out"]);
          adj.get(e.target).push([e.source, e, "in"]);
        }
        const prev = new Map([[from, null]]);
        let frontier = [from];
        for (let d = 0; d < maxD && !prev.has(to) && frontier.length; d++) {
          const next = [];
          for (const u of frontier) for (const [v, e, dirn] of adj.get(u) || []) if (!prev.has(v)) { prev.set(v, [u, e, dirn]); next.push(v); }
          frontier = next;
        }
        if (!prev.has(to)) return { found: false, message: `${maxD}단계 안에 경로가 없습니다. max_depth를 늘리거나 include_derived=true로 다시 시도하세요.` };
        const steps = [];
        for (let v = to; prev.get(v); v = prev.get(v)[0]) {
          const [u, e, dirn] = prev.get(v);
          steps.unshift({ from: u, from_label: label(u), relation: e.rel, direction: dirn === "out" ? "→" : "←", to: v, to_label: label(v), confidence: e.confidence, derived: !!e.derived });
        }
        return { found: true, length: steps.length, path: [from, ...steps.map((s) => s.to)].map(label).join(" — "), steps };
      }
      case "list_nodes": {
        const list = G.nodes.filter((n) => n.cls === a.class);
        return { class: a.class, total: list.length, nodes: list.slice(0, Math.min(a.limit || 100, 200)).map(nodeView) };
      }
      case "query_edges": {
        const s = a.source ? resolve(a.source) : null, t = a.target ? resolve(a.target) : null, inc = a.include_derived !== false;
        const res = G.edges.filter((e) => (!a.relation || e.rel === a.relation) && (!s || e.source === s) && (!t || e.target === t) &&
          (!a.confidence || e.confidence === a.confidence) && (inc || !e.derived));
        return {
          total: res.length,
          edges: res.slice(0, Math.min(a.limit || 100, 300)).map((e) => ({ source: e.source, source_label: label(e.source), ...edgeView(e, "target") })),
        };
      }
      case "get_lineage": {
        const id = resolve(a.variety);
        if (nodeById.get(id).cls !== "Variety") throw new ToolError(`${label(id)}은(는) 품종(Variety)이 아닙니다.`);
        const dir = a.direction || "both";
        const lin = G.edges.filter((e) => LINEAGE_RELS.includes(e.rel) && !e.derived);
        const species = (v) => G.edges.filter((e) => e.rel === "belongsTo" && e.source === v).map((e) => ({ species: label(e.target), confidence: e.confidence, derived: !!e.derived }));
        const up = (v, seen) => lin.filter((e) => e.source === v && !seen.has(e.target)).map((e) => ({
          variety: e.target, label: label(e.target), via: e.rel, species: species(e.target), parents: up(e.target, new Set([...seen, e.target])) }));
        const down = (v, seen) => lin.filter((e) => e.target === v && !seen.has(e.source)).map((e) => ({
          variety: e.source, label: label(e.source), via: e.rel, children: down(e.source, new Set([...seen, e.source])) }));
        const out = { variety: id, label: label(id), species: species(id), interspecific: !!nodeById.get(id).interspecific };
        // 모델이 중첩 트리를 잘못 읽지 않도록 직접 부모와 세대별 조상을 평평하게, 한 줄 요약과 함께 준다
        const describe = (v) => {
          const ps = lin.filter((e) => e.source === v);
          const cross = ps.filter((e) => e.rel === "crossOf").map((e) => label(e.target));
          const mut = ps.filter((e) => e.rel === "mutationOf").map((e) => label(e.target));
          const sel = ps.filter((e) => e.rel === "selectedFrom").map((e) => label(e.target));
          const parts = [];
          if (cross.length) parts.push(`${label(v)} = ${cross.join(" × ")} (교배)`);
          if (mut.length) parts.push(`${label(v)}은(는) ${mut.join(", ")}의 돌연변이`);
          if (sel.length) parts.push(`${label(v)}은(는) ${sel.join(", ")}에서 선발`);
          return parts.join("; ");
        };
        out.direct_parents = lin.filter((e) => e.source === id).map((e) => ({ variety: e.target, label: label(e.target), relation: e.rel }));
        const gens = [];
        let frontier = [id];
        const seenG = new Set([id]);
        while (frontier.length && gens.length < 6) {
          const next = [];
          for (const v of frontier) for (const e of lin) if (e.source === v && !seenG.has(e.target)) { seenG.add(e.target); next.push(e.target); }
          if (!next.length) break;
          gens.push(next.map(label));
          frontier = next;
        }
        out.ancestor_generations = gens.map((g, i) => ({ generation: i + 1, varieties: g }));
        out.summary = [id, ...[...seenG].filter((v) => v !== id)].map(describe).filter(Boolean).join(". ") || `${label(id)}의 계보 정보가 그래프에 없습니다.`;
        if (dir !== "descendants") out.ancestors = up(id, new Set([id]));
        if (dir !== "ancestors") out.descendants = down(id, new Set([id]));
        return out;
      }
      case "get_roast_levels": {
        const lv = G.nodes.filter((n) => n.cls === "RoastLevel").sort((x, y) => x.temp_c - y.temp_c);
        const rel = (id, r) => G.edges.filter((e) => e.source === id && e.rel === r).map((e) => label(e.target));
        return {
          source: "Wikipedia Coffee roasting (배전도 절은 위키에서 출처 보강 필요 표시)",
          levels: lv.map((n) => ({ id: n.id, label: n.label, category: n.category, temp_c: n.temp_c,
            emphasizes: rel(n.id, "emphasizes"), decreases: rel(n.id, "decreases"), passed_stages: rel(n.id, "reachedAfter"), note: n.note })),
        };
      }
      case "get_ontology":
        return { ontology_markdown: DATA.ontology, validation_report_markdown: DATA.report };
      default:
        throw new ToolError(`알 수 없는 도구: ${name}`);
    }
  }

  return { TOOLS, call, resolve, label, nodeById, CLASSES, ToolError };
}
