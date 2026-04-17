"""
MBTA Transit — real-world agentns example
==========================================
This is the actual production use case that agentns was built from.

The MBTA multi-agent system runs three specialist agents:
  - alerts     → real-time service alerts (port 8001)
  - planner    → trip planning (port 8002)
  - stopfinder → stop lookup (port 8003)

Each agent can have multiple geographic replicas (e.g. Boston + Frankfurt).
agentns selects the best replica based on:
  1. Health (unhealthy endpoints are skipped)
  2. Geographic proximity to the requester
  3. Response latency (breaks ties)
  4. Load (CPU %)

Run this example:
    # Start agentns
    docker run -p 8200:8200 agentns:latest

    # Run the demo
    python examples/mbta_transit_example.py
"""

import asyncio
import os
from agentns.client import AgentNSClient

AGENTNS_URL = os.getenv("AGENTNS_URL", "http://localhost:8200")

# URNs follow the pattern:  urn:{tld}:{namespace}:{label}
NS  = "mbta-transit-ci"
TLD = "agents.dataworksai.com"


async def setup_mbta_agents(client: AgentNSClient):
    """Register all MBTA agents (Boston primary + Frankfurt replica)."""
    print("Registering MBTA agents...\n")

    agents = [
        # alerts — Boston primary
        dict(label="alerts", endpoint="http://96.126.111.107:8001",
             namespace=NS, region="us-east", location={"city": "Boston"},
             protocols=["A2A", "SLIM"], flag="🇺🇸",
             health_check_url="http://96.126.111.107:8001/.well-known/agent.json"),

        # planner — Boston primary
        dict(label="planner", endpoint="http://96.126.111.107:8002",
             namespace=NS, region="us-east", location={"city": "Boston"},
             protocols=["A2A", "SLIM"], flag="🇺🇸",
             health_check_url="http://96.126.111.107:8002/.well-known/agent.json"),

        # stopfinder — Boston primary
        dict(label="stopfinder", endpoint="http://96.126.111.107:8003",
             namespace=NS, region="us-east", location={"city": "Boston"},
             protocols=["A2A", "SLIM"], flag="🇺🇸",
             health_check_url="http://96.126.111.107:8003/.well-known/agent.json"),

        # fares — Boston primary
        dict(label="fares", endpoint="http://192.168.1.50:8004",
             namespace=NS, region="us-east", location={"city": "Boston"},
             protocols=["A2A"], flag="🇺🇸"),

        # fares — Frankfurt replica  (auto-failover if Boston is down)
        dict(label="fares", endpoint="http://lin-de-fra1.example.com:8004",
             namespace=NS, region="eu-central", location={"city": "Frankfurt"},
             protocols=["A2A"], flag="🇩🇪"),
    ]

    for a in agents:
        result = await client.register(**a)
        print(f"  {result['status']:10s} {a['label']:12s} @ {a['endpoint']}")

    print()


async def resolve_for_user(client: AgentNSClient, agent: str, user_city: str):
    """Simulate an end-user request from user_city."""
    urn = f"urn:{TLD}:{NS}:{agent}"
    resolved = await client.resolve(
        urn,
        requester_context={
            "protocols": ["A2A"],
            "location":  {"city": user_city},
        },
    )

    if resolved:
        print(
            f"  {agent:12s} | user in {user_city:12s} → "
            f"{resolved.flag} {resolved.region:18s} | "
            f"{resolved.metadata.get('latency_ms', '?'):>5}ms | "
            f"{resolved.selected_by}"
        )
    else:
        print(f"  {agent:12s} | user in {user_city:12s} → RESOLUTION FAILED")


async def main():
    async with AgentNSClient(AGENTNS_URL) as client:
        # Check sidecar is up
        h = await client.health()
        print(f"agentns {h['status']} — {h['total_endpoints']} endpoint(s) loaded\n")

        await setup_mbta_agents(client)

        # Simulate resolutions from different cities
        print("Resolving agents for different user locations:")
        print(f"  {'Agent':12s} | {'User location':24s} | {'Latency':>5s} | Selected by")
        print("  " + "─" * 70)

        test_cases = [
            ("alerts",     "Boston"),
            ("planner",    "New York"),
            ("stopfinder", "Chicago"),
            ("fares",      "Boston"),      # should pick Boston fares
            ("fares",      "Frankfurt"),   # should pick Frankfurt fares
            ("fares",      "London"),      # geographically closer to Frankfurt
        ]
        for agent, city in test_cases:
            await resolve_for_user(client, agent, city)

        print()

        # Cache stats after all resolutions
        stats = await client._client.get("/cache/stats")
        s = stats.json()
        print(f"Cache: {s['hits']} hits / {s['misses']} misses ({s['hit_rate_pct']}% hit rate)")


asyncio.run(main())
