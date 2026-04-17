"""
Example: Python agent that registers itself with agentns on startup
and deregisters cleanly on shutdown.

Run:
    # Terminal 1 — start agentns
    docker run -p 8200:8200 agentns:latest

    # Terminal 2 — start this agent
    python examples/python_agent_startup.py
"""

import asyncio
import signal
import os
from agentns.client import AgentNSClient

AGENTNS_URL = os.getenv("AGENTNS_URL", "http://localhost:8200")
MY_LABEL    = os.getenv("AGENT_LABEL",    "emailer")
MY_ENDPOINT = os.getenv("AGENT_ENDPOINT", "http://localhost:9001")
MY_REGION   = os.getenv("AGENT_REGION",   "us-east")
MY_CITY     = os.getenv("AGENT_CITY",     "New York")


async def main():
    client = AgentNSClient(AGENTNS_URL)

    # ── register on startup ────────────────────────────────────────────────────
    result = await client.register(
        label     = MY_LABEL,
        endpoint  = MY_ENDPOINT,
        region    = MY_REGION,
        location  = {"city": MY_CITY},
        protocols = ["http", "A2A"],
        flag      = "🇺🇸",
    )
    print(f"Registered: {result}")

    # ── run your agent logic here ──────────────────────────────────────────────
    print(f"Agent '{MY_LABEL}' running at {MY_ENDPOINT} — Ctrl+C to stop")

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    loop.add_signal_handler(signal.SIGINT,  stop_event.set)
    loop.add_signal_handler(signal.SIGTERM, stop_event.set)
    await stop_event.wait()

    # ── deregister on shutdown ─────────────────────────────────────────────────
    await client.deregister(MY_LABEL, MY_ENDPOINT)
    print("Deregistered. Bye.")
    await client.close()


asyncio.run(main())
