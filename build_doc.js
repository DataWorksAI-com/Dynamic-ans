const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  TableOfContents, PageBreak, Header, Footer, PageNumber, LevelFormat,
  UnderlineType
} = require("docx");
const fs = require("fs");

// ── colour palette ──────────────────────────────────────────────────────────
const NAVY   = "1B3A6B";   // section headings
const TEAL   = "0E6B8A";   // sub-headings
const SLATE  = "374151";   // body text
const CODE_BG= "F3F4F6";   // code block background
const TBL_HDR= "1B3A6B";   // table header fill
const TBL_ROW= "EFF6FF";   // table alt row fill
const RULE   = "D1D5DB";   // thin rule colour

// ── helpers ──────────────────────────────────────────────────────────────────

function spacer(pt = 6) {
  return new Paragraph({ children: [new TextRun("")], spacing: { before: 0, after: pt * 20 } });
}

function rule() {
  return new Paragraph({
    children: [new TextRun("")],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 1 } },
    spacing: { before: 80, after: 80 },
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, color: NAVY, size: 36, font: "Arial" })],
    spacing: { before: 480, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY, space: 4 } },
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, color: TEAL, size: 28, font: "Arial" })],
    spacing: { before: 320, after: 120 },
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, bold: true, color: SLATE, size: 24, font: "Arial" })],
    spacing: { before: 240, after: 80 },
  });
}

function h4(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: SLATE, size: 22, font: "Arial", underline: { type: UnderlineType.SINGLE, color: TEAL } })],
    spacing: { before: 200, after: 60 },
  });
}

function body(text, { bold = false, italic = false, indent = false } = {}) {
  return new Paragraph({
    children: [new TextRun({ text, bold, italic, color: SLATE, size: 22, font: "Arial" })],
    spacing: { before: 0, after: 100 },
    indent: indent ? { left: 360 } : undefined,
  });
}

function inlineCode(text) {
  return new TextRun({ text, font: "Courier New", size: 20, color: "C7254E", bold: false });
}

function codeBlock(lines) {
  const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" };
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder },
            shading: { fill: CODE_BG, type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 200, right: 200 },
            width: { size: 9360, type: WidthType.DXA },
            children: lines.map(line =>
              new Paragraph({
                children: [new TextRun({ text: line || " ", font: "Courier New", size: 18, color: "1F2937" })],
                spacing: { before: 0, after: 0 },
              })
            ),
          }),
        ],
      }),
    ],
  });
}

function makeTable(headers, rows, colWidths) {
  const total = colWidths.reduce((a, b) => a + b, 0);
  const hdrBorder = { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" };
  const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" };

  const hdrRow = new TableRow({
    children: headers.map((h, i) => new TableCell({
      borders: { top: hdrBorder, bottom: hdrBorder, left: hdrBorder, right: hdrBorder },
      shading: { fill: TBL_HDR, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 150, right: 150 },
      width: { size: colWidths[i], type: WidthType.DXA },
      children: [new Paragraph({
        children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 20, font: "Arial" })],
        spacing: { before: 0, after: 0 },
      })],
    })),
  });

  const dataRows = rows.map((row, ri) => new TableRow({
    children: row.map((cell, ci) => new TableCell({
      borders: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder },
      shading: { fill: ri % 2 === 0 ? "FFFFFF" : TBL_ROW, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 150, right: 150 },
      width: { size: colWidths[ci], type: WidthType.DXA },
      children: [new Paragraph({
        children: cell.includes("`")
          ? cell.split(/(`[^`]+`)/).map(p => p.startsWith("`") && p.endsWith("`")
              ? inlineCode(p.slice(1, -1))
              : new TextRun({ text: p, color: SLATE, size: 20, font: "Arial" }))
          : [new TextRun({ text: cell, color: SLATE, size: 20, font: "Arial" })],
        spacing: { before: 0, after: 0 },
      })],
    })),
  }));

  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: colWidths, rows: [hdrRow, ...dataRows] });
}

function bullet(text, level = 0) {
  const indentLeft = 720 + level * 360;
  return new Paragraph({
    numbering: { reference: "bullets", level },
    children: [new TextRun({ text, color: SLATE, size: 22, font: "Arial" })],
    spacing: { before: 0, after: 60 },
    indent: { left: indentLeft, hanging: 360 },
  });
}

// ── document content ─────────────────────────────────────────────────────────

const children = [];

// ── PAGE 1: Title Page ───────────────────────────────────────────────────────
children.push(
  new Paragraph({ children: [new TextRun("")], spacing: { before: 2880, after: 0 } }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "agentns", bold: true, color: NAVY, size: 72, font: "Arial" })],
    spacing: { before: 0, after: 160 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Agent Name Service", color: TEAL, size: 44, font: "Arial" })],
    spacing: { before: 0, after: 400 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: TEAL, space: 1 } },
    children: [new TextRun("")],
    spacing: { before: 0, after: 400 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "TECHNICAL REFERENCE", bold: true, color: SLATE, size: 28, font: "Arial", characterSpacing: 200 })],
    spacing: { before: 0, after: 240 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Version 1.0.0  |  DataWorksAI", color: "6B7280", size: 22, font: "Arial" })],
    spacing: { before: 0, after: 160 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "MIT License  |  github.com/DataWorksAI-com/agentns", color: "6B7280", size: 20, font: "Arial" })],
    spacing: { before: 0, after: 0 },
  }),
  new Paragraph({ children: [new PageBreak()] }),
);

// ── PAGE 2: Table of Contents ────────────────────────────────────────────────
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "TABLE OF CONTENTS", bold: true, color: NAVY, size: 28, font: "Arial", characterSpacing: 200 })],
    spacing: { before: 0, after: 240 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY, space: 4 } },
  }),
  spacer(12),
  new TableOfContents("", { hyperlink: true, headingStyleRange: "1-3", stylesWithLevels: [] }),
  new Paragraph({ children: [new PageBreak()] }),
);

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — SYSTEM OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1("1.  System Overview"));

children.push(body(
  "agentns is a service discovery sidecar for multi-agent AI systems. It solves the same problem that DNS solves for the internet — but for AI agents instead of web servers."
));
children.push(spacer(4));

children.push(h2("1.1  The Core Problem"));
children.push(body(
  "In a multi-agent system, orchestrators need to find and call other agents by name. Without a discovery layer, agent URLs are hardcoded. This breaks when:"
));
children.push(bullet("Agents scale horizontally — multiple replicas are running simultaneously"));
children.push(bullet("Agents move between hosts, containers, or cloud regions"));
children.push(bullet("An agent goes down and a geographic replica must take over automatically"));
children.push(bullet("Geographic routing is needed to send each request to the nearest healthy replica"));
children.push(spacer(6));

children.push(h2("1.2  What agentns Does"));
children.push(body(
  "agentns runs as a sidecar process alongside your orchestrator. Agents register themselves with the sidecar on startup. Orchestrators ask the sidecar \"where is the emailer agent?\" and receive back the best available endpoint — selected by health status, geographic distance, protocol compatibility, and measured latency."
));
children.push(spacer(6));

children.push(h2("1.3  Design Principles"));
children.push(spacer(4));
children.push(makeTable(
  ["Principle", "Implementation"],
  [
    ["Zero hardcoded values", "Every IP, URL, and name comes from environment variables"],
    ["Language-agnostic", "Plain HTTP API — Python, Go, Node.js, Java, and curl all work identically"],
    ["Graceful degradation", "Never crashes the caller — returns emergency fallback if all replicas are unhealthy"],
    ["No single point of failure", "In-memory mode works without MongoDB; MongoDB mode survives process restarts"],
    ["Self-healing", "Background health loop continuously re-evaluates endpoints and auto-recovers when agents come back online"],
  ],
  [3200, 6160]
));
children.push(spacer(8), new Paragraph({ children: [new PageBreak()] }));

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — ARCHITECTURE
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1("2.  Architecture"));

children.push(h2("2.1  Component Map"));
children.push(body(
  "The following diagram shows every runtime component and how they relate inside a single agentns process:"
));
children.push(spacer(4));
children.push(codeBlock([
  "┌──────────────────────────────────────────────────────────────┐",
  "│                      agentns Process                          │",
  "│                                                              │",
  "│  ┌──────────────┐    ┌─────────────────────────────────┐    │",
  "│  │  FastAPI app  │    │         Global State             │    │",
  "│  │  (server.py) │    │                                  │    │",
  "│  │              │    │  _registry: Dict[label, [ep,...]]│    │",
  "│  │  POST /resolve│    │  _health_cache: Dict[url, dict] │    │",
  "│  │  POST /register│   │  _cache: ResolutionCache        │    │",
  "│  │  DELETE /...  │    │  _mongo_col: Collection | None  │    │",
  "│  │  GET /health  │    └─────────────────────────────────┘    │",
  "│  └──────┬───────┘                                           │",
  "│         │ calls                                              │",
  "│  ┌──────▼───────────────────────────────────────────────┐   │",
  "│  │              Core Modules                             │   │",
  "│  │  urn_parser.py      → parse / build URNs              │   │",
  "│  │  health_checker.py  → async HTTP health probes        │   │",
  "│  │  server_selection.py→ rank endpoints by 5-key sort    │   │",
  "│  │  cache.py           → TTL resolution cache            │   │",
  "│  └───────────────────────────────────────────────────────┘   │",
  "│                                                              │",
  "│  ┌───────────────────────────────────────────────────────┐   │",
  "│  │  Background Task: _health_loop()                      │   │",
  "│  │  runs every HEALTH_INTERVAL seconds                   │   │",
  "│  └───────────────────────────────────────────────────────┘   │",
  "└──────────────────────────────────────────────────────────────┘",
  "         ▲                          ▲                           ",
  "         │ POST /register           │ POST /resolve             ",
  "   ┌─────┴──────┐            ┌──────┴──────┐                   ",
  "   │   Agent    │            │ Orchestrator │                   ",
  "   └────────────┘            └─────────────┘                   ",
]));
children.push(spacer(8));

children.push(h2("2.2  Module Dependency Graph"));
children.push(codeBlock([
  "server.py",
  "   ├── urn_parser.py       (parse_urn, build_urn, extract_label)",
  "   ├── health_checker.py   (check_agent_health, probe_endpoint)",
  "   ├── server_selection.py (rank_servers, select_protocol, calculate_ttl)",
  "   └── cache.py            (ResolutionCache)",
  "",
  "client.py                  (standalone — calls server.py via HTTP only)",
]));
children.push(spacer(8));

children.push(h2("2.3  The Three ANS Roles"));
children.push(body(
  "Every Agent Name Service — whether distributed across three servers or collapsed into one process — has three conceptually distinct roles. Understanding them is essential to understanding how agentns works:"
));
children.push(spacer(4));
children.push(makeTable(
  ["Role", "Responsibility", "agentns code"],
  [
    ["Namespace Server", "Target Agent registers its deployment and receives a canonical AI Agent Name (URN). The NS owns and issues URNs — it is the authoritative source of agent identity.", "POST /register → build_urn() → returns agent_name in response"],
    ["Authoritative Name Server", "Knows the live status of the environment. When asked for an agent, it checks health, load, and location in real time and generates a Tailored End-Point — not a static URL but the best endpoint right now.", "Background _health_loop() + rank_servers() + calculate_ttl()"],
    ["Recursive Resolver", "Entry point for the Requester Agent. Accepts a URN query, validates it belongs to this nameserver, checks cache, delegates to the Auth NS logic, and returns the Tailored End-Point. The requester never talks to the NS or Auth NS directly.", "POST /resolve → parse_urn() → cache → rank_servers() → response"],
  ],
  [2200, 3800, 3360]
));
children.push(spacer(6));
children.push(body(
  "The namespace validation in POST /resolve enforces the Resolver role correctly: if the URN's TLD does not match this instance's AGENTNS_TLD, agentns returns HTTP 403 — it is literally the wrong nameserver for that URN, exactly as DNS would reject a query for a zone it does not own.",
  { italic: true }
));
children.push(spacer(8));

children.push(h2("2.4  Why Single Binary"));
children.push(body(
  "Traditional ANS architectures require three separate networked hops, each adding latency and a potential point of failure:"
));
children.push(spacer(4));
children.push(codeBlock([
  "Traditional:  Orchestrator → Recursive Resolver → Registry NS → Auth NS",
  "agentns:      Orchestrator → agentns (all three hops in one process)",
]));
children.push(spacer(4));
children.push(body(
  "agentns collapses all three into one in-process function call chain, eliminating the network overhead of the middle hops while preserving the same logical resolution model. Each role still has a clear boundary: registration (NS), health + ranking (Auth NS), and query entry (Resolver) — they are just function calls rather than network round-trips."
));
children.push(spacer(8), new Paragraph({ children: [new PageBreak()] }));

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — STARTUP SEQUENCE
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1("3.  Startup Sequence"));

children.push(body(
  "When agentns starts (via agentns-server or docker run), the following steps execute in strict order before any HTTP request is accepted:"
));
children.push(spacer(6));
children.push(codeBlock([
  "Process starts",
  "     │",
  "     ▼",
  "main() in server.py",
  "  └─ parse CLI args (--port, --host, --namespace, --log-level)",
  "  └─ uvicorn.run('agentns.server:app', ...)",
  "         │",
  "         ▼",
  "     FastAPI lifespan() begins (asynccontextmanager)",
  "         │",
  "         ├─ Step 1: _init_mongo()",
  "         │     If MONGODB_URI is set:",
  "         │       - Create AsyncIOMotorClient with 6s selection timeout",
  "         │       - Get database[MONGODB_DB] → collection 'agents'",
  "         │       - Create index on 'label'",
  "         │       - Create unique compound index on (label, endpoint)",
  "         │       - Ping MongoDB to verify connection",
  "         │     If MONGODB_URI is empty:",
  "         │       - Log warning, continue in in-memory mode",
  "         │",
  "         ├─ Step 2: _load_from_mongo()",
  "         │     Stream all documents from MongoDB",
  "         │     Restore _registry — agents survive restarts",
  "         │",
  "         ├─ Step 3: _check_all()  ← initial health sweep",
  "         │     Parallel health probe of every registered endpoint",
  "         │     Fills _health_cache before first request arrives",
  "         │",
  "         ├─ Step 4: asyncio.create_task(_health_loop())",
  "         │     Spawns background health sweep (non-blocking)",
  "         │",
  "         └─ yield  ← server begins accepting HTTP requests",
]));
children.push(spacer(8));

children.push(h2("Shutdown Sequence"));
children.push(codeBlock([
  "SIGTERM / Ctrl-C received",
  "  └─ lifespan() resumes after yield",
  "       └─ task.cancel()       ← signal _health_loop to stop",
  "       └─ await task          ← wait for clean cancellation",
  "       └─ except CancelledError  ← expected, suppressed",
]));
children.push(spacer(8), new Paragraph({ children: [new PageBreak()] }));

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — END-TO-END FLOWS
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1("4.  End-to-End Flows"));

// 4.1 Registration
children.push(h2("4.1  Agent Registration Flow"));
children.push(body(
  "An agent calls POST /register on startup. The following steps occur inside agentns:"
));
children.push(spacer(4));
children.push(codeBlock([
  "POST /register",
  "{",
  '  "label": "emailer",',
  '  "endpoint": "http://ny-host:9001",',
  '  "region": "us-east",',
  '  "location": {"city": "New York"},',
  '  "protocols": ["http", "A2A"]',
  "}",
  "",
  "Step 1  Validate — HTTP 400 if label or endpoint missing",
  "Step 2  Normalize location — city 'New York' → lat 40.7128, lon -74.0060",
  "Step 3  Build URN — build_urn(TLD, namespace, label)",
  "         → 'urn:agentns.local:agents.local:emailer'",
  "Step 4  Build entry dict — endpoint + all metadata + agent_name",
  "Step 5  Update _registry[label]",
  "         If endpoint exists → update in place",
  "         If endpoint is new → append (creates replica pool)",
  "Step 6  _save_to_mongo() — upsert with $set + $setOnInsert",
  "Step 7  asyncio.create_task(_check_single()) — non-blocking health probe",
  "",
  "Response:",
  '{  "status": "registered",  "total_endpoints": 1,  "agent_name": "urn:..."  }',
]));
children.push(spacer(6));
children.push(body(
  "Key behavior: If the same (label, endpoint) pair is registered again, the existing entry is updated, not duplicated. If a new endpoint is registered under the same label, it is appended — creating a replica group. This is how multi-region failover is achieved without any configuration change. The agent_name field in the response is the URN issued by the Namespace Server role — the caller can store this as its permanent AI Agent Name.",
  { italic: true }
));
children.push(spacer(8));

// 4.2 Namespace Validation
children.push(h2("4.2  Namespace Validation Flow"));
children.push(body(
  "When a URN is provided (not a plain label), agentns first validates that the URN belongs to this instance before doing any lookup. This is the Recursive Resolver checking it owns the zone:"
));
children.push(spacer(4));
children.push(codeBlock([
  "POST /resolve  { 'agent_name': 'urn:wrong.com:sales:emailer' }",
  "",
  "Step 1  parse_urn()  →  tld='wrong.com'  namespace='sales'  label='emailer'",
  "Step 2  TLD check: 'wrong.com' != AGENTNS_TLD ('agentns.local')",
  "         → HTTP 403  'You are asking the wrong nameserver.'",
  "",
  "POST /resolve  { 'agent_name': 'urn:agentns.local:other-app:emailer' }",
  "",
  "Step 1  parse_urn()  →  tld='agentns.local'  namespace='other-app'  label='emailer'",
  "Step 2  TLD check:       PASS (matches AGENTNS_TLD)",
  "Step 3  Namespace check: 'other-app' != AGENTNS_NAMESPACE ('agents.local')",
  "         → HTTP 403  'This instance handles namespace agents.local, not other-app.'",
  "",
  "POST /resolve  { 'label': 'emailer' }",
  "",
  "  Plain label — no URN → namespace check skipped entirely → proceeds to lookup",
]));
children.push(spacer(6));
children.push(body(
  "Plain labels (no urn: prefix) skip namespace validation entirely. This allows simple label-based resolution without requiring a full URN, which is useful during development or in single-namespace deployments.",
  { italic: true }
));
children.push(spacer(8));

// 4.3 Cache Hit
children.push(h2("4.3  Resolution Flow — Cache Hit"));
children.push(body(
  "The fast path. A repeated resolution within the TTL window returns a cached result in under 1 ms:"
));
children.push(spacer(4));
children.push(codeBlock([
  "POST /resolve  { 'agent_name': 'urn:...:emailer', 'requester_context': {...} }",
  "",
  "Step 1  parse_urn()  →  label = 'emailer'",
  "Step 2  Build cache key: MD5(label | sorted_protocols | location_json)",
  "         → deterministic hex digest, e.g. 'a3f2c1d8...'",
  "Step 3  _cache.get(key)",
  "         Entry found AND monotonic() < expiry → cache HIT",
  "         Increment hits counter",
  "Step 4  Inject resolution_time_ms, set cached=True",
  "Step 5  Return immediately",
  "",
  "Typical round-trip: < 1 ms (in-process dict lookup + MD5)",
]));
children.push(spacer(8));

// 4.4 Cache Miss
children.push(h2("4.4  Resolution Flow — Cache Miss"));
children.push(body(
  "Full resolution path — executed on first call or after TTL expiry. Example: two replicas registered (New York, London), requester in Paris:"
));
children.push(spacer(4));
children.push(codeBlock([
  "Step 1   parse_urn()  →  label = 'emailer'",
  "Step 2   Cache miss — key not found or expired",
  "Step 3   Registry lookup: _registry['emailer']",
  "          → [nyc_entry, london_entry]  (HTTP 404 if unknown)",
  "Step 4   Build servers list with server_id, protocols, region, location",
  "Step 5   Read health from _health_cache",
  "          health_map = {",
  "            'http://ny-host:9001': {status:'healthy', latency:45ms},",
  "            'http://lon-host:9001': {status:'healthy', latency:210ms}",
  "          }",
  "Step 6   Live-check any 'unknown' endpoints (parallel asyncio.gather)",
  "Step 7   rank_servers(servers, health_map, requester_context)",
  "          Requester: Paris  48.8566°N  2.3522°E",
  "          NYC:    haversine(Paris, NYC)    = 5,837 km",
  "          London: haversine(Paris, London) =   341 km",
  "          Sort keys:",
  "            NYC:    (0, 0, 5837, 45.0,  30.0)",
  "            London: (0, 0,  341, 210.0, 20.0)",
  "          → London wins at position 3 (geo distance 341 < 5837)",
  "Step 8   selected_by = 'geo_nearest' (location provided + multiple candidates)",
  "Step 9   select_protocol(['http','A2A'], ['A2A'])  →  'A2A'",
  "Step 10  calculate_ttl({status:'healthy'})  →  60 seconds",
  "Step 11  _cache.set(key, result, ttl=60)",
  "Step 12  Return full result",
]));
children.push(spacer(8));

// 4.5 Health Sweep
children.push(h2("4.5  Background Health Sweep"));
children.push(body(
  "This loop runs concurrently with all HTTP requests. It is the engine behind automatic failover and recovery:"
));
children.push(spacer(4));
children.push(codeBlock([
  "_health_loop()  [background asyncio task]",
  "",
  "  loop forever:",
  "    _check_all()",
  "      ├─ Build deduped map: {endpoint_url → health_check_url}",
  "      │   (same endpoint shared by multiple labels → probed only once)",
  "      └─ asyncio.gather(*[_check_one(url, hc_url) for each])",
  "              return_exceptions=True  — one timeout doesn't cancel the rest",
  "              Each _check_one():",
  "                check_agent_health(hc_url)  ← HTTP GET",
  "                async with _health_lock:",
  "                  _health_cache[endpoint_url] = result",
  "",
  "    _cache.purge_expired()  ← evict stale resolution cache entries",
  "    asyncio.sleep(HEALTH_INTERVAL)  ← default 30 seconds",
]));
children.push(spacer(6));

children.push(h3("Failover Scenario"));
children.push(bullet("emailer-nyc goes down"));
children.push(bullet("Within 30 s: health sweep detects unhealthy status"));
children.push(bullet("_health_cache[\"http://nyc:9001\"] = {status: \"unhealthy\", ...}"));
children.push(bullet("Next /resolve: rank_servers() excludes nyc — London selected automatically"));
children.push(bullet("Zero configuration change, zero code change"));
children.push(spacer(4));

children.push(h3("Recovery Scenario"));
children.push(bullet("emailer-nyc comes back up"));
children.push(bullet("Within 30 s: health sweep measures healthy, latency = 45 ms"));
children.push(bullet("Next /resolve: both healthy, NYC wins (45 ms vs 210 ms for London)"));
children.push(bullet("Fully automatic — no human intervention required"));
children.push(spacer(8), new Paragraph({ children: [new PageBreak()] }));

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5 — MODULE REFERENCE
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1("5.  Module Reference"));

// ── 5.1 server.py ────────────────────────────────────────────────────────
children.push(h2("5.1  server.py — Main Application"));
children.push(body(
  "FastAPI application. Owns all HTTP endpoints, global state, startup/shutdown, MongoDB integration, and the background health loop. All other modules are called from here."
));
children.push(spacer(6));

children.push(h3("Global State"));
children.push(spacer(4));
children.push(makeTable(
  ["Variable", "Type", "Description"],
  [
    ["`_registry`", "Dict[str, List[Dict]]", "Maps every label to its list of endpoint dicts. One label can have many endpoints (replica pool)."],
    ["`_health_cache`", "Dict[str, Dict]", "Maps each endpoint URL to its most recent health result. Written by health loop and on-demand checks. Protected by _health_lock."],
    ["`_health_lock`", "asyncio.Lock", "Prevents concurrent writes to _health_cache from the background loop and inline checks inside resolve()."],
    ["`_cache`", "ResolutionCache", "Singleton TTL cache holding fully-resolved response payloads, keyed by MD5 of (label + protocols + location)."],
    ["`_mongo_col`", "Collection | None", "Handle to the MongoDB agents collection. None if MongoDB not configured or connection failed."],
  ],
  [2000, 2200, 5160]
));
children.push(spacer(8));

children.push(h3("Function Reference — server.py"));
children.push(spacer(4));

const serverFunctions = [
  ["_init_mongo()", "async", "Startup", "Establishes MongoDB connection, creates indexes on label and compound (label, endpoint) — unique constraint prevents duplicate registrations. 6-second connection timeout prevents hanging startup. On failure: logs error, sets _mongo_col=None, continues in-memory."],
  ["_load_from_mongo()", "async", "Startup", "Streams all documents from MongoDB and restores _registry. Checks for duplicates before appending. Without this, dynamically registered agents would be lost on every restart."],
  ["_save_to_mongo(label, entry)", "async", "Per-register", "Upserts one endpoint to MongoDB. Uses $set (update all fields + last_seen) and $setOnInsert (set registered_at only on first insert). Fully idempotent — re-registering the same endpoint 100 times produces exactly one document."],
  ["_check_all()", "async", "Startup + loop", "Parallel health probe of all unique registered endpoints. Deduplicates URLs so a host serving multiple labels gets only one probe. Uses asyncio.gather(return_exceptions=True) — one timeout never cancels other probes."],
  ["_health_loop()", "async", "Background task", "Infinite loop: calls _check_all(), then _cache.purge_expired(), then sleeps HEALTH_INTERVAL seconds. Wrapped in try/except — a single iteration error logs a warning but does not terminate the loop."],
  ["_cached_health(url)", "sync", "Per-resolve", "Safe read from _health_cache with a default sentinel (status=unknown, load=50). Prevents KeyError and ensures rank_servers() always receives a valid health dict."],
  ["_check_single(url, hc_url)", "async", "Post-register", "One-shot health probe fired as a background task immediately after registration. Ensures the very next /resolve call has real health data rather than the unknown sentinel."],
  ["lifespan(app)", "asynccontextmanager", "ASGI lifespan", "FastAPI lifespan context manager. Before yield: runs init → load → check → start loop. After yield (shutdown): cancels background task and awaits clean exit."],
  ["resolve(body)", "POST /resolve", "Request handler", "Full resolution pipeline: parse URN, check cache, lookup registry, fetch health, live-check unknowns, rank_servers(), select protocol, calculate TTL, cache result, return."],
  ["register(body)", "POST /register", "Request handler", "Validates input, normalizes city → coordinates, builds entry dict, updates/appends registry, saves to MongoDB, fires non-blocking health check."],
  ["deregister(label, body)", "DELETE /register/{label}", "Request handler", "Removes specific endpoint or all endpoints for a label. Cleans up MongoDB accordingly."],
  ["health()", "GET /health", "Request handler", "Builds per-agent status report from _registry + _health_cache. Returns service metadata including uptime, MongoDB status, total counts."],
  ["list_agents()", "GET /agents", "Request handler", "Full registry dump with current health for every endpoint. Includes URN, namespace, protocols, last_check."],
  ["namespaces()", "GET /namespaces", "Request handler", "Groups all labels by namespace. Returns {tld, namespaces: {ns: [labels]}}."],
  ["main()", "CLI entrypoint", "Process startup", "Parses CLI args, sets env vars if overridden, prints banner, calls uvicorn.run()."],
];

children.push(makeTable(
  ["Function", "Type", "Called By", "Description"],
  serverFunctions,
  [2200, 1400, 1400, 4360]
));
children.push(spacer(8), new Paragraph({ children: [new PageBreak()] }));

// ── 5.2 health_checker.py ───────────────────────────────────────────────
children.push(h2("5.2  health_checker.py — Health Probing"));
children.push(body(
  "Async HTTP health checking. Probes agent endpoints and returns a normalized health dict. No state — all functions are pure input/output."
));
children.push(spacer(4));

children.push(h3("Module Constants"));
children.push(spacer(2));
children.push(makeTable(
  ["Constant", "Value", "Purpose"],
  [
    ["CONNECT_TIMEOUT", "5.0 s", "Maximum time to establish a TCP connection before marking unhealthy"],
    ["READ_TIMEOUT", "5.0 s", "Maximum time to receive the full HTTP response body"],
    ["SLOW_MS", "2000 ms", "Response times above this threshold cause status to be 'degraded' instead of 'healthy'"],
  ],
  [2200, 1200, 5960]
));
children.push(spacer(6));

children.push(h3("Function Reference — health_checker.py"));
children.push(spacer(4));
children.push(makeTable(
  ["Function", "Returns", "Description"],
  [
    ["_get_client()", "httpx.AsyncClient", "Returns a singleton shared HTTP client. Lazily created. Connection pool: 100 max connections, 20 keepalive. Avoids TLS handshake overhead per probe."],
    ["_now_iso()", "str", "Current UTC time as ISO-8601 string. Populates last_check in every health result."],
    ["_unhealthy(reason)", "Dict", "Factory for standardized unhealthy result. Sets load=100.0 to ensure unhealthy servers sort last even on the load tiebreaker."],
    ["check_agent_health(url)", "Dict", "Primary probe. Issues GET, measures elapsed time, extracts load_percent from JSON body (if present, silently ignores parse errors). Returns healthy / degraded / unhealthy based on status code + elapsed + load."],
    ["probe_endpoint(endpoint)", "Dict", "Auto-discovery. Tries /.well-known/agent.json → /health → /healthz in sequence. Returns first non-unhealthy result. Used when no health_check_url was provided at registration."],
  ],
  [2400, 1600, 5360]
));
children.push(spacer(4));

children.push(h3("Health Status Decision Logic"));
children.push(spacer(2));
children.push(codeBlock([
  "HTTP status >= 400                         → unhealthy (HTTP error code)",
  "Connection refused                         → unhealthy (connection refused)",
  "Timeout (connect or read)                  → unhealthy (timeout)",
  "2xx AND elapsed > 2000 ms                  → degraded  (slow response)",
  "2xx AND load_percent >= 90                 → degraded  (high CPU load)",
  "2xx AND elapsed <= 2000 ms AND load < 90   → healthy",
]));
children.push(spacer(8));

// ── 5.3 server_selection.py ─────────────────────────────────────────────
children.push(h2("5.3  server_selection.py — Ranking Engine"));
children.push(body(
  "Pure functions for ranking a pool of endpoints. No I/O, no side effects, no global state. Deterministic given identical inputs. This is where the routing intelligence lives."
));
children.push(spacer(6));

children.push(h3("CITY_COORDS Lookup Table"));
children.push(body(
  "A dict mapping 120+ lowercase city name strings to (latitude, longitude) tuples. Covers North America (including NJ datacenter cities: Newark, Parsippany, Secaucus), Europe, Asia-Pacific (India: Bangalore, Hyderabad, Chennai, Pune, Kolkata), Africa, and South America. Used in two places:"
));
children.push(bullet("_resolve_location() — converts a requester's city name to coordinates for geo-scoring"));
children.push(bullet("register() in server.py — injects coordinates when an agent registers with only a city name"));
children.push(spacer(6));

children.push(h3("Function Reference — server_selection.py"));
children.push(spacer(4));
children.push(makeTable(
  ["Function", "Signature", "Description"],
  [
    ["_haversine", "(lat1, lon1, lat2, lon2) → float", "Great-circle distance in km using the Haversine formula. Accurate to < 0.5% for global distances. Earth radius = 6,371 km."],
    ["_resolve_location", "(ctx) → Optional[Tuple]", "Extracts (lat, lon) from requester_context. Accepts explicit coordinates, city name, or nested location dict. Returns None if no location extractable — triggers math.inf geo distance in ranking."],
    ["_health_score", "(status) → int", "Maps health string to sort integer: healthy=0, degraded=1, unknown=2, unhealthy=3. Any unrecognized string defaults to 2."],
    ["_geo_distance", "(server, latlon) → float", "Computes haversine distance between server location and requester. Returns math.inf if either party has no coordinates — geo falls through to latency as tiebreaker."],
    ["rank_servers", "(servers, health_map, ctx, include_unhealthy) → List", "Core ranking function. Builds 5-key sort tuple per server. Excludes unhealthy servers by default. Returns [(server_dict, health_dict), ...] sorted best-first."],
    ["select_protocol", "(server_protocols, preferred) → str", "Iterates preferred list, returns first protocol also in server_protocols (case-insensitive). Falls back to server_protocols[0], then 'http'."],
    ["calculate_ttl", "(health) → int", "Maps health status to cache TTL: healthy=60s, degraded=15s, unknown=10s, unhealthy=5s. Low TTL on unhealthy means aggressive recheck."],
  ],
  [2000, 2800, 4560]
));
children.push(spacer(8), new Paragraph({ children: [new PageBreak()] }));

// ── 5.4 cache.py ─────────────────────────────────────────────────────────
children.push(h2("5.4  cache.py — Resolution Cache"));
children.push(body(
  "Thread-safe (asyncio-safe) TTL-based in-memory cache. Stores fully resolved agent response payloads. No external dependencies."
));
children.push(spacer(4));

children.push(h3("ResolutionCache — Internal State"));
children.push(codeBlock([
  "_store: Dict[str, Tuple[Any, float]]   # key → (payload, expiry_monotonic_timestamp)",
  "_lock:  asyncio.Lock                   # serializes all mutations",
  "_hits:  int                            # lifetime hit counter",
  "_misses: int                           # lifetime miss counter",
]));
children.push(spacer(6));

children.push(h3("Method Reference — ResolutionCache"));
children.push(spacer(4));
children.push(makeTable(
  ["Method", "Description"],
  [
    ["make_key(label, ctx)", "Generates MD5 hex digest from label + sorted(protocols) + json.dumps(location, sort_keys=True). Sorting ensures [\"A2A\",\"http\"] and [\"http\",\"A2A\"] produce the same key. MD5 used for speed, not security."],
    ["get(key)", "Looks up key. Checks expiry using time.monotonic() — immune to wall-clock changes (NTP, DST). Returns None on miss or expiry. Increments hit/miss counter accordingly."],
    ["set(key, payload, ttl)", "Stores (payload, monotonic() + ttl) at key. Overwrites existing entry for the same key."],
    ["invalidate(agent_name)", "Removes entries tagged with _cache_key_agent == agent_name. Used after deregistration."],
    ["clear()", "Wipes entire store, resets counters. Returns count of entries removed."],
    ["stats()", "Returns total/active/expired entries, hits, misses, hit_rate_pct. All computed under lock for consistency."],
    ["purge_expired()", "Scans and deletes expired entries. Called by _health_loop() every HEALTH_INTERVAL seconds to prevent unbounded memory growth."],
  ],
  [2400, 7000]
));
children.push(spacer(8));

// ── 5.5 urn_parser.py ────────────────────────────────────────────────────
children.push(h2("5.5  urn_parser.py — URN Parsing"));
children.push(body(
  "Parse, build, and validate Agent URNs. No I/O, no dependencies beyond the Python standard library."
));
children.push(spacer(4));

children.push(h3("URN Format"));
children.push(codeBlock([
  "urn : <tld> : <namespace> : <label>",
  " │       │         │           └── agent role   (e.g. emailer, planner, alerts)",
  " │       │         └────────────── app / org    (e.g. sales, mbta-transit-ci)",
  " │       └──────────────────────── domain       (e.g. acme.com, agents.local)",
  " └──────────────────────────────── literal scheme prefix",
  "",
  "Examples:",
  "  urn:acme.com:sales:emailer",
  "  urn:acme.com:sales:invoicer",
  "  urn:agents.dataworksai.com:mbta-transit-ci:alerts",
]));
children.push(spacer(6));

children.push(h3("Accepted Input Forms"));
children.push(spacer(2));
children.push(makeTable(
  ["Input", "tld", "namespace", "label"],
  [
    ["urn:acme.com:sales:emailer", "acme.com", "sales", "emailer"],
    ["urn:agentns.local:emailer", "agentns.local", "(empty)", "emailer"],
    ["sales:emailer", "sales", "(empty)", "emailer"],
    ["emailer", "(empty)", "(empty)", "emailer"],
  ],
  [3000, 2000, 1800, 2560]
));
children.push(spacer(6));

children.push(h3("Function Reference — urn_parser.py"));
children.push(spacer(4));
children.push(makeTable(
  ["Function / Class", "Description"],
  [
    ["ParsedURN (dataclass)", "Holds tld, namespace, label, raw. Property full rebuilds canonical URN string. Method matches_namespace(tld, ns) checks namespace equality."],
    ["parse_urn(value)", "Never raises. Strips urn: prefix, splits on ':', assigns parts left-to-right filling missing positions with empty string."],
    ["build_urn(tld, ns, label)", "Returns f\"urn:{tld}:{namespace}:{label}\". Used to construct agent_name stored in registry."],
    ["extract_label(value)", "Quick helper — parses URN and returns just the label portion. Returns original string if label is empty."],
  ],
  [2600, 6760]
));
children.push(spacer(8), new Paragraph({ children: [new PageBreak()] }));

// ── 5.6 client.py ────────────────────────────────────────────────────────
children.push(h2("5.6  client.py — Python Client SDK"));
children.push(body(
  "Type-safe Python client for calling the agentns sidecar. Two classes: AgentNSClient (async, for production code) and AgentNSClientSync (sync wrapper, for scripts and startup code)."
));
children.push(spacer(6));

children.push(h3("ResolvedAgent Dataclass"));
children.push(spacer(2));
children.push(makeTable(
  ["Field", "Type", "Description"],
  [
    ["endpoint", "str", "Full URL of the selected agent — use this to make your agent call"],
    ["protocol", "str", "Selected protocol string, e.g. 'A2A', 'http'"],
    ["ttl", "int", "Seconds until this resolution should be refreshed"],
    ["region", "str", "Human-readable region name, e.g. 'New York, NY'"],
    ["cached", "bool", "True if served from the resolution cache"],
    ["selected_by", "str", "Selection reason: geo_nearest / lowest_latency / only_available / emergency_fallback"],
    ["resolution_time_ms", "float", "Total round-trip time including network + ranking"],
    ["metadata", "dict", "all_candidates list, total_candidates count, latency_ms of winner"],
    ["endpoint_url (property)", "str", "Alias for endpoint — backward compatibility"],
  ],
  [2400, 1400, 5560]
));
children.push(spacer(6));

children.push(h3("AgentNSClient Methods"));
children.push(spacer(2));
children.push(makeTable(
  ["Method", "Raises?", "Description"],
  [
    ["resolve(agent_name, *, requester_context, cache_enabled)", "Never — returns None on failure", "Resolves URN or label to ResolvedAgent. Caller must handle None (implement fallback)."],
    ["register(label, endpoint, **kwargs)", "HTTPStatusError on server error", "Registers agent endpoint. Call from agent startup code."],
    ["deregister(label, endpoint='')", "HTTPStatusError on server error", "Empty endpoint removes all replicas for label."],
    ["health()", "HTTPStatusError", "Returns service health dict."],
    ["agents()", "HTTPStatusError", "Returns full agent registry with health."],
    ["close() / async with", "—", "Closes underlying httpx connection pool. Always call on shutdown."],
  ],
  [3200, 2200, 4000]
));
children.push(spacer(6));

children.push(h3("AgentNSClientSync"));
children.push(body(
  "Wraps each AgentNSClient method in asyncio.run(). Creates and destroys an event loop per call. Suitable for scripts, agent startup/shutdown, and testing. For high-throughput production paths, use the async AgentNSClient with await."
));
children.push(spacer(8), new Paragraph({ children: [new PageBreak()] }));

// ── 5.7 geocoder.py ──────────────────────────────────────────────────────
children.push(h2("5.7  geocoder.py — Automatic City Geocoding"));
children.push(body(
  "Resolves any city name to (latitude, longitude) coordinates so agents can register with only a city name and still participate in geo-routing. No API key required. Falls back gracefully — if geocoding fails, the endpoint is still registered, geo-routing is simply disabled for it."
));
children.push(spacer(6));

children.push(h3("Resolution Order"));
children.push(codeBlock([
  "1. Built-in CITY_COORDS table (instant, no network)",
  "   → 120+ major cities pre-loaded in server_selection.py",
  "",
  "2. In-process memory cache _geocode_cache (instant, no network)",
  "   → cities looked up via Nominatim are cached indefinitely",
  "",
  "3. OpenStreetMap Nominatim API (free, no API key, any city on Earth)",
  "   → rate-limited: max 1 request/second (Nominatim fair-use policy)",
  "   → 200–500 ms typical, 5 second timeout",
  "   → User-Agent: agentns/1.0.0",
  "",
  "4. Returns None — geo-routing disabled for that endpoint (never raises)",
  "   → a warning is logged suggesting the caller pass explicit lat/lon",
]));
children.push(spacer(6));

children.push(h3("Module Constants and State"));
children.push(spacer(2));
children.push(makeTable(
  ["Name", "Type", "Description"],
  [
    ["GEOCODING_ENABLED", "bool", "Read from AGENTNS_GEOCODING env var. Set to 'off' to disable Nominatim calls entirely (air-gapped environments). Built-in table and cache still work."],
    ["NOMINATIM_URL", "str", "https://nominatim.openstreetmap.org/search — OpenStreetMap geocoding API"],
    ["NOMINATIM_TIMEOUT", "float", "5.0 seconds — HTTP timeout for Nominatim requests"],
    ["_geocode_cache", "Dict[str, Optional[Tuple]]", "In-process memory cache: city_key (lowercase) → (lat, lon) or None. Never expires — city coordinates don't change."],
    ["_last_request_time", "float", "Monotonic timestamp of last Nominatim request, used to enforce 1 req/s rate limit"],
  ],
  [2400, 1800, 5160]
));
children.push(spacer(6));

children.push(h3("Function Reference — geocoder.py"));
children.push(spacer(4));
children.push(makeTable(
  ["Function", "Description"],
  [
    ["_wait_for_rate_limit()", "Async rate limiter. Computes elapsed since last Nominatim call. If < 1.0 s, sleeps the remainder. Enforces Nominatim's fair-use policy of max 1 request/second."],
    ["_nominatim_lookup(city)", "Calls Nominatim API with q=city, format=json, limit=1. Parses lat/lon from first result. Returns None on HTTP error, empty results, timeout, or any exception. Never raises."],
    ["resolve_city(city)", "Primary entry point. Runs the 4-step resolution chain. Called by server.py register() when an agent provides a city name. Caches results (including None) to avoid repeated Nominatim calls."],
    ["geocode_cache_snapshot()", "Returns a copy of _geocode_cache. Used by GET /health to show which cities have been geocoded and their resolved coordinates."],
  ],
  [2600, 6760]
));
children.push(spacer(6));

children.push(h3("Example: Agent registers with city name"));
children.push(codeBlock([
  'POST /register  { "label": "emailer", "endpoint": "http://host:9001",',
  '                  "location": {"city": "Hyderabad"} }',
  "",
  "Step 1  'hyderabad' found in CITY_COORDS → (17.3850, 78.4867)  [instant]",
  "        location updated: { city, latitude: 17.385, longitude: 78.4867 }",
  "        geo_routing: active",
  "",
  'POST /register  { "label": "emailer", "endpoint": "http://host:9001",',
  '                  "location": {"city": "Gdansk"} }',
  "",
  "Step 1  'gdansk' NOT in CITY_COORDS",
  "Step 2  NOT in _geocode_cache",
  "Step 3  GEOCODING_ENABLED=true → _nominatim_lookup('Gdansk')",
  "        Nominatim returns lat=54.3521, lon=18.6464",
  "        _geocode_cache['gdansk'] = (54.3521, 18.6464)",
  "        geo_routing: active",
  "",
  'POST /register  { "label": "emailer", "endpoint": "http://host:9001",',
  '                  "location": {"city": "Unknown City XYZ"} }',
  "",
  "Step 1-3  Not found in table, not in cache, Nominatim returns no results",
  "          _geocode_cache['unknown city xyz'] = None",
  "          geo_routing: disabled — endpoint still registered normally",
]));
children.push(spacer(8), new Paragraph({ children: [new PageBreak()] }));

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6 — DATA MODELS
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1("6.  Data Models"));

children.push(h2("6.1  Endpoint Entry (in _registry)"));
children.push(codeBlock([
  "{",
  '  "endpoint":         "http://ny-host:9001",        // required',
  '  "health_check_url": "http://ny-host:9001/health", // empty = auto-discover',
  '  "namespace":        "agents.local",',
  '  "protocols":        ["http", "A2A"],',
  '  "region":           "us-east",',
  '  "region_label":     "New York, NY",',
  '  "flag":             "🇺🇸",',
  '  "location": {',
  '    "city":           "New York",',
  '    "latitude":       40.7128,',
  '    "longitude":      -74.0060',
  '  },',
  '  "agent_name":       "urn:agentns.local:agents.local:emailer"',
  "}",
]));
children.push(spacer(8));

children.push(h2("6.2  Health Dict (in _health_cache)"));
children.push(codeBlock([
  "{",
  '  "status":           "healthy",    // healthy | degraded | unhealthy | unknown',
  '  "load":             42.5,         // 0–100, defaults to 50 if not reported by agent',
  '  "response_time_ms": 87.3,         // round-trip to health URL in milliseconds',
  '  "last_check":       "2025-04-17T14:23:01.456789+00:00",',
  '  "reason":           ""            // populated only when status is unhealthy',
  "}",
]));
children.push(spacer(8));

children.push(h2("6.3  Resolution Response (POST /resolve)"));
children.push(codeBlock([
  "{",
  '  "endpoint":             "http://lon-host:9001",',
  '  "protocol":             "A2A",',
  '  "ttl":                  60,',
  '  "region":               "London, UK",',
  '  "flag":                 "🇬🇧",',
  '  "cached":               false,',
  '  "selected_by":          "geo_nearest",',
  '  "resolution_time_ms":   3.7,',
  '  "metadata": {',
  '    "label":              "emailer",',
  '    "latency_ms":         210.0,',
  '    "total_candidates":   2,',
  '    "all_candidates": [',
  '      { "endpoint":"http://lon-host:9001", "status":"healthy",',
  '        "latency_ms":210.0, "region":"London, UK", "flag":"🇬🇧" },',
  '      { "endpoint":"http://ny-host:9001",  "status":"healthy",',
  '        "latency_ms":45.0,  "region":"New York, NY","flag":"🇺🇸" }',
  '    ]',
  '  }',
  "}",
]));
children.push(spacer(8));

children.push(h2("6.4  MongoDB Document Schema"));
children.push(codeBlock([
  "{",
  '  "_id":           ObjectId("..."),             // MongoDB internal',
  '  "label":         "emailer",                   // indexed',
  '  "endpoint":      "http://ny-host:9001",       // unique compound index with label',
  '  "health_check_url": "http://ny-host:9001/health",',
  '  "namespace":     "agents.local",',
  '  "protocols":     ["http", "A2A"],',
  '  "region":        "us-east",',
  '  "region_label":  "New York, NY",',
  '  "flag":          "🇺🇸",',
  '  "location":      { "city":"New York", "latitude":40.7128, "longitude":-74.006 },',
  '  "agent_name":    "urn:agentns.local:agents.local:emailer",',
  '  "registered_at": ISODate("2025-04-17T10:00:00Z"),  // $setOnInsert — set once',
  '  "last_seen":     ISODate("2025-04-17T14:23:01Z")   // $set — updated each call',
  "}",
]));
children.push(spacer(8), new Paragraph({ children: [new PageBreak()] }));

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7 — SERVER SELECTION ALGORITHM
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1("7.  Server Selection Algorithm"));

children.push(body(
  "The ranking algorithm is the intellectual core of agentns. It answers: given N endpoints registered for label X, and a request from location L wanting protocol P, which endpoint should answer?"
));
children.push(spacer(6));

children.push(h2("7.1  The Sort Key"));
children.push(body(
  "For every candidate endpoint, a 5-element tuple is computed. Python's lexicographic tuple comparison means only the first differing position decides the winner:"
));
children.push(spacer(4));
children.push(codeBlock([
  "(health_score, protocol_score, geo_distance_km, response_time_ms, load_percent)",
  "",
  "health_score     0=healthy  1=degraded  2=unknown  3=unhealthy (excluded by default)",
  "protocol_score   0=preferred protocol available    1=not available",
  "geo_distance_km  haversine km from requester       math.inf if no location",
  "response_time_ms measured round-trip               9999.0 if never probed",
  "load_percent     CPU/load from agent health JSON   50.0 if not reported",
]));
children.push(spacer(8));

children.push(h2("7.2  Priority Hierarchy"));
children.push(spacer(4));
children.push(makeTable(
  ["Priority", "Factor", "Rationale"],
  [
    ["1 (highest)", "Health status", "A degraded but alive endpoint always beats an unknown one. Unhealthy endpoints are excluded entirely."],
    ["2", "Protocol compatibility", "If the caller wants A2A and an endpoint only speaks HTTP, it scores 1. Protocol match scores 0."],
    ["3", "Geographic distance", "Nearest healthy replica wins. Correlates with network latency at global scale and satisfies data-sovereignty requirements."],
    ["4", "Response time (latency)", "When geo distance is equal (or no location provided), the fastest endpoint wins. Breaks ties within the same region."],
    ["5 (lowest)", "CPU load", "Final tiebreaker when all other factors are equal. Enables primitive load balancing within a co-located replica group."],
  ],
  [1200, 2000, 6160]
));
children.push(spacer(8));

children.push(h2("7.3  Worked Example"));
children.push(body("Two replicas of the 'emailer' agent. Requester is in Boston, Massachusetts:"));
children.push(spacer(4));
children.push(codeBlock([
  "                    NYC               London",
  "health_score:        0 (healthy)       0 (healthy)",
  "protocol_score:      0 (A2A ✓)         0 (A2A ✓)",
  "geo_distance_km:   306 km            5,263 km",
  "response_time_ms:   45 ms              210 ms",
  "load_percent:       30%                20%",
  "",
  "NYC sort key:    (0, 0,  306,  45, 30)",
  "London sort key: (0, 0, 5263, 210, 20)",
  "",
  "NYC wins at position 3 (geo_km 306 < 5263)",
  "selected_by = 'geo_nearest'",
  "",
  "Same example — no location provided:",
  "NYC sort key:    (0, 0, inf,  45, 30)",
  "London sort key: (0, 0, inf, 210, 20)",
  "",
  "NYC wins at position 4 (latency_ms 45 < 210)",
  "selected_by = 'lowest_latency'",
]));
children.push(spacer(8), new Paragraph({ children: [new PageBreak()] }));

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8 — CONCURRENCY MODEL
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1("8.  Concurrency Model"));

children.push(body(
  "agentns uses cooperative multitasking via Python's asyncio. There are no threads. All concurrency is achieved through coroutines and the asyncio event loop."
));
children.push(spacer(6));

children.push(h2("8.1  Event Loop Tasks"));
children.push(codeBlock([
  "asyncio event loop",
  "    ├── uvicorn ASGI server            (handles HTTP connections)",
  "    │     ├── resolve() coroutine       (per incoming request)",
  "    │     ├── register() coroutine      (per incoming request)",
  "    │     └── health() coroutine        (per incoming request)",
  "    │",
  "    └── _health_loop() task            (background, started in lifespan)",
  "          └── _check_all()             (every HEALTH_INTERVAL seconds)",
  "                └── asyncio.gather()   (all endpoint probes in parallel)",
]));
children.push(spacer(6));

children.push(h2("8.2  Shared State and Locking"));
children.push(spacer(4));
children.push(makeTable(
  ["State", "Lock needed?", "Reason"],
  [
    ["_health_cache", "Yes — asyncio.Lock", "Written by both the background loop (_check_all) and the inline live-check block inside resolve(). These can interleave at await yield points."],
    ["_registry", "No", "Only modified by register() and deregister() — sequential HTTP handlers. Dict mutations between yield points are atomic in asyncio."],
    ["_cache (ResolutionCache)", "Yes — internal Lock", "The cache's own asyncio.Lock protects _store from concurrent get/set calls."],
  ],
  [2200, 2000, 5160]
));
children.push(spacer(6));

children.push(h2("8.3  Health Probe Parallelism"));
children.push(body(
  "All health probes in a sweep run concurrently via asyncio.gather(). For N endpoints with 100 ms average probe latency:"
));
children.push(bullet("Sequential approach: N × 100 ms = 10,000 ms for 100 endpoints"));
children.push(bullet("With gather(): ≈ max(individual latencies) ≈ 5,000 ms timeout bound"));
children.push(bullet("return_exceptions=True ensures one timed-out probe never cancels the rest"));
children.push(spacer(8), new Paragraph({ children: [new PageBreak()] }));

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9 — PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1("9.  Persistence Layer"));

children.push(makeTable(
  ["Mode", "Config", "Behaviour", "Use Case"],
  [
    ["In-memory", "MONGODB_URI not set", "Registry lives in process memory. Lost on restart.", "Local dev, single-process, ephemeral containers"],
    ["MongoDB", "MONGODB_URI set", "Every registration upserted to MongoDB. Registry restored on restart. Full consistency.", "Production, multi-instance, long-running agents"],
  ],
  [1400, 2200, 3200, 2560]
));
children.push(spacer(8));

children.push(h2("MongoDB Upsert Semantics"));
children.push(body(
  "Every POST /register call performs the following MongoDB operation:"
));
children.push(spacer(4));
children.push(codeBlock([
  "update_one(",
  "  filter:  { label: label, endpoint: entry.endpoint },   # unique identity",
  "  update: {",
  "    $set:         { ...all_fields, last_seen: now },      # always update",
  "    $setOnInsert: { registered_at: now },                 # only on first insert",
  "  },",
  "  upsert: True",
  ")",
  "",
  "Result: Calling POST /register with the same (label, endpoint)",
  "100 times produces exactly ONE MongoDB document.",
  "registered_at is set once. last_seen is updated every time.",
]));
children.push(spacer(8), new Paragraph({ children: [new PageBreak()] }));

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 10 — CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1("10.  Configuration Reference"));

children.push(body(
  "All configuration is via environment variables. No config files. No hardcoded values. To change any IP, URL, or name — update one env var and restart."
));
children.push(spacer(6));
children.push(makeTable(
  ["Variable", "Default", "Type", "Description"],
  [
    ["AGENTNS_PORT", "8200", "int", "HTTP port the server listens on"],
    ["AGENTNS_NAMESPACE", "agents.local", "str", "Default URN namespace for newly registered agents"],
    ["AGENTNS_TLD", "agentns.local", "str", "URN TLD used when building agent_name URNs"],
    ["AGENTNS_HEALTH_INTERVAL", "30", "int", "Seconds between background health sweeps"],
    ["MONGODB_URI", "(empty)", "str", "MongoDB connection string. Empty = in-memory mode. Supports Atlas SRV strings."],
    ["MONGODB_DB", "agentns", "str", "MongoDB database name"],
    ["AGENTNS_URL", "http://localhost:8200", "str", "Used by AgentNSClient() constructor when no URL argument provided"],
    ["AGENTNS_GEOCODING", "on", "str", "Set to 'off' to disable Nominatim geocoding (air-gapped environments). Built-in CITY_COORDS table and explicit lat/lon still work."],
  ],
  [2600, 2000, 900, 3860]
));
children.push(spacer(8), new Paragraph({ children: [new PageBreak()] }));

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 11 — API REFERENCE
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1("11.  API Reference"));

children.push(body(
  "agentns exposes a plain HTTP JSON API. Any language or tool can call it."
));
children.push(spacer(6));

children.push(makeTable(
  ["Method", "Path", "Description"],
  [
    ["POST", "/register", "Register or update an agent endpoint"],
    ["POST", "/resolve", "Resolve an agent to its best available endpoint"],
    ["DELETE", "/register/{label}", "Deregister one or all endpoints for a label"],
    ["GET", "/health", "Full service health report with per-agent status"],
    ["GET", "/agents", "All registered agents with current health"],
    ["GET", "/namespaces", "All registered namespaces and their labels"],
    ["GET", "/cache/stats", "Cache hit rate and entry counts"],
    ["POST", "/cache/clear", "Flush the resolution cache"],
  ],
  [1200, 2200, 5960]
));
children.push(spacer(8));

children.push(h2("selected_by Values"));
children.push(spacer(4));
children.push(makeTable(
  ["Value", "Meaning"],
  [
    ["geo_nearest", "Location provided in requester_context; picked geographically closest healthy endpoint"],
    ["lowest_latency", "No location provided; picked fastest healthy endpoint by measured response time"],
    ["only_available", "Only one healthy endpoint existed in the pool"],
    ["emergency_fallback", "All endpoints unhealthy; returned best guess with TTL=5 so caller retries quickly"],
  ],
  [2400, 6960]
));
children.push(spacer(8));

children.push(h2("HTTP Error Codes"));
children.push(spacer(4));
children.push(makeTable(
  ["Code", "When Returned"],
  [
    ["200", "All success cases — including emergency_fallback (intentional: prevents orchestrators from hard-failing)"],
    ["400", "Missing required fields: label + endpoint for /register; agent_name or label for /resolve"],
    ["403", "URN's TLD does not match AGENTNS_TLD (wrong nameserver), or URN's namespace does not match AGENTNS_NAMESPACE (wrong namespace). Plain labels never trigger 403."],
    ["404", "Label not registered when resolving or deregistering"],
  ],
  [1200, 8160]
));
children.push(spacer(8), new Paragraph({ children: [new PageBreak()] }));

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 12 — ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1("12.  Error Handling"));

children.push(body(
  "The core principle: agentns never crashes the caller. Every code path returns a response."
));
children.push(spacer(6));
children.push(makeTable(
  ["Scenario", "Behavior"],
  [
    ["MongoDB unreachable at startup", "Logs error, continues in in-memory mode. Server starts normally."],
    ["MongoDB write fails during register", "Logs error. Registration still succeeds in-memory."],
    ["MongoDB load fails at startup", "Logs error, starts with empty in-memory registry."],
    ["Health probe times out", "Returns _unhealthy('timeout'). Endpoint marked unhealthy for next sweep."],
    ["Health probe connection refused", "Returns _unhealthy('connection refused')."],
    ["All endpoints unhealthy during resolve", "Returns emergency_fallback with first server, TTL=5. HTTP 200."],
    ["One probe in asyncio.gather() throws", "return_exceptions=True — all other probes continue unaffected."],
    ["Background health loop iteration fails", "Logs warning, sleeps HEALTH_INTERVAL seconds, retries on next cycle."],
    ["AgentNSClient.resolve() network error", "Catches all exceptions, returns None. Caller implements fallback."],
    ["Unknown status string in _health_score()", "Defaults to 2 (unknown). Never raises."],
    ["City name not in CITY_COORDS (registration)", "geocoder.py tries Nominatim API. On success: coordinates injected, geo-routing active. On failure: warning logged, endpoint registered without coordinates, geo-routing disabled for that endpoint only."],
    ["City name not in CITY_COORDS (resolve requester_context)", "_resolve_location() returns None (built-in table only). Geo distance = math.inf — ranking falls through to latency tiebreaker."],
    ["Nominatim API unreachable / timeout", "Returns None. Endpoint still registered. Geo disabled. Warning logged with suggestion to pass explicit lat/lon."],
    ["URN TLD mismatch in resolve", "HTTP 403 returned. No lookup performed. Detail message names the correct vs received TLD."],
    ["URN namespace mismatch in resolve", "HTTP 403 returned. No lookup performed. Detail message names the correct namespace."],
  ],
  [3200, 6160]
));
children.push(spacer(8), new Paragraph({ children: [new PageBreak()] }));

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 13 — PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1("13.  Performance Characteristics"));

children.push(h2("13.1  Resolution Latency"));
children.push(spacer(4));
children.push(makeTable(
  ["Code Path", "Typical Latency"],
  [
    ["Cache hit", "< 1 ms — in-process dict lookup + MD5 hash"],
    ["Cache miss, all endpoints in health cache", "1–5 ms — registry lookup + sort + select"],
    ["Cache miss, one endpoint unchecked (live probe)", "50–5000 ms — depends on network to agent"],
  ],
  [3600, 5760]
));
children.push(spacer(8));

children.push(h2("13.2  Health Sweep Throughput"));
children.push(body(
  "All probes run in parallel via asyncio.gather(). Total sweep time equals the slowest individual probe, not the sum:"
));
children.push(bullet("10 endpoints × 100 ms avg latency → ~100 ms sweep (not 1,000 ms)"));
children.push(bullet("50 endpoints × 100 ms avg latency → ~100 ms sweep"));
children.push(bullet("Bounded by CONNECT_TIMEOUT + READ_TIMEOUT = 10 s maximum per sweep"));
children.push(spacer(6));

children.push(h2("13.3  Memory Usage"));
children.push(body(
  "All in-memory state is proportional to the number of registered endpoints and distinct resolution contexts:"
));
children.push(bullet("_registry: a few KB per registered endpoint"));
children.push(bullet("_health_cache: ~200 bytes per endpoint (health dict)"));
children.push(bullet("_cache (ResolutionCache): 1–5 KB per cached resolution payload"));
children.push(bullet("100 agents, 500 distinct (label + context) combinations: total < 5 MB"));
children.push(spacer(6));

children.push(h2("13.4  Scaling Limits and Recommendations"));
children.push(body(
  "agentns is designed as a per-orchestrator sidecar. For very large deployments:"
));
children.push(bullet("Multiple agentns instances can share the same MongoDB backend"));
children.push(bullet("Each instance maintains its own local _health_cache and _registry (refreshed from MongoDB at startup)"));
children.push(bullet("Each instance runs its own health loop — health state is not shared across instances"));
children.push(bullet("For systems with thousands of agents, increase AGENTNS_HEALTH_INTERVAL to reduce probe frequency"));
children.push(spacer(8));

// ── Final rule ──────────────────────────────────────────────────────────
children.push(rule());
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: "agentns v1.0.0  —  DataWorksAI  —  MIT License  —  github.com/DataWorksAI-com/agentns", color: "9CA3AF", size: 18, font: "Arial" })],
  spacing: { before: 160, after: 0 },
}));

// ═══════════════════════════════════════════════════════════════════════════
// BUILD DOCUMENT
// ═══════════════════════════════════════════════════════════════════════════

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
          {
            level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  styles: {
    default: {
      document: { run: { font: "Arial", size: 22, color: SLATE } },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: NAVY },
        paragraph: { spacing: { before: 480, after: 160 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: TEAL },
        paragraph: { spacing: { before: 320, after: 120 }, outlineLevel: 1 },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: SLATE },
        paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 2 },
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "agentns — Technical Reference", color: "9CA3AF", size: 18, font: "Arial" }),
                new TextRun({ text: "   |   DataWorksAI   |   v1.0.0", color: "D1D5DB", size: 18, font: "Arial" }),
              ],
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB", space: 4 } },
              spacing: { before: 0, after: 120 },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: "Page ", color: "9CA3AF", size: 18, font: "Arial" }),
                new TextRun({ children: [PageNumber.CURRENT], color: "9CA3AF", size: 18, font: "Arial" }),
                new TextRun({ text: " of ", color: "9CA3AF", size: 18, font: "Arial" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], color: "9CA3AF", size: 18, font: "Arial" }),
              ],
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB", space: 4 } },
              spacing: { before: 120, after: 0 },
            }),
          ],
        }),
      },
      children,
    },
  ],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("agentns_technical_reference.docx", buffer);
  console.log("Created: agentns_technical_reference.docx");
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
