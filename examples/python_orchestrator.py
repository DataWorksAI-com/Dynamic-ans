"""
Example: Orchestrator that resolves agents via agentns before calling them.

Shows:
  - URN-based resolution with geo preference
  - Fallback when resolution fails
  - Cache hits on repeat calls

Run:
    # Terminal 1 — start agentns
    docker run -p 8200:8200 agentns:latest

    # Terminal 2 — register a demo agent
    curl -X POST http://localhost:8200/register \
      -H "Content-Type: application/json" \
      -d '{"label":"emailer","endpoint":"http://localhost:9001","region":"us-east","location":{"city":"New York"}}'

    # Terminal 3
    python examples/python_orchestrator.py
"""

import asyncio
import os
import httpx
from agentns.client import AgentNSClient

AGENTNS_URL = os.getenv("AGENTNS_URL", "http://localhost:8200")

# URN map — build from env vars in real projects
URN_MAP = {
    "emailer":   "urn:agentns.local:agents.local:emailer",
    "invoicer":  "urn:agentns.local:agents.local:invoicer",
    "scheduler": "urn:agentns.local:agents.local:scheduler",
}


async def call_agent(label: str, payload: dict, client: AgentNSClient) -> dict:
    """Resolve agent by URN, then POST the payload to its endpoint."""

    urn = URN_MAP.get(label, label)   # accept raw label or URN

    resolved = await client.resolve(
        urn,
        requester_context={
            "protocols": ["http", "A2A"],
            "location":  {"city": "Boston"},   # prefer nearest
        },
    )

    if resolved is None:
        print(f"[{label}] Resolution failed — agent unavailable")
        return {"error": "resolution_failed"}

    print(
        f"[{label}] → {resolved.endpoint} "
        f"({resolved.region}, {resolved.metadata.get('latency_ms', '?')}ms, "
        f"{'cached' if resolved.cached else 'fresh'}, "
        f"selected_by={resolved.selected_by})"
    )

    async with httpx.AsyncClient() as http:
        try:
            resp = await http.post(resolved.endpoint, json=payload, timeout=5.0)
            return resp.json()
        except Exception as exc:
            return {"error": str(exc)}


async def main():
    async with AgentNSClient(AGENTNS_URL) as client:
        # First call — fresh resolution
        result = await call_agent("emailer", {"to": "alice@example.com", "subject": "Hello"}, client)
        print(f"Response: {result}\n")

        # Second call — should be cached (same URN + context)
        result = await call_agent("emailer", {"to": "bob@example.com", "subject": "World"}, client)
        print(f"Response: {result}\n")

        # Show cache stats
        stats = await client._client.get("/cache/stats")
        print(f"Cache: {stats.json()}")


asyncio.run(main())
