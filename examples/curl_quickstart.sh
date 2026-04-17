#!/usr/bin/env bash
# agentns curl quick-start
# Works with any language — pure HTTP, no SDK needed.
#
# Usage:
#   chmod +x examples/curl_quickstart.sh
#   ./examples/curl_quickstart.sh

BASE="http://localhost:8200"
BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RESET='\033[0m'

echo -e "${BOLD}━━━  agentns curl quick-start  ━━━${RESET}\n"

# ── 1. Health check ────────────────────────────────────────────────────────────
echo -e "${CYAN}1. Service health${RESET}"
curl -s "$BASE/health" | python3 -m json.tool
echo

# ── 2. Register two endpoints for "emailer" ───────────────────────────────────
echo -e "${CYAN}2. Register emailer — New York instance${RESET}"
curl -s -X POST "$BASE/register" \
  -H "Content-Type: application/json" \
  -d '{
    "label":    "emailer",
    "endpoint": "http://ny-host:9001",
    "region":   "us-east",
    "location": {"city": "New York"},
    "protocols": ["http", "A2A"],
    "flag":     "🇺🇸"
  }' | python3 -m json.tool
echo

echo -e "${CYAN}3. Register emailer — London instance${RESET}"
curl -s -X POST "$BASE/register" \
  -H "Content-Type: application/json" \
  -d '{
    "label":    "emailer",
    "endpoint": "http://lon-host:9001",
    "region":   "eu-west",
    "location": {"city": "London"},
    "protocols": ["http", "A2A"],
    "flag":     "🇬🇧"
  }' | python3 -m json.tool
echo

# ── 3. List agents ─────────────────────────────────────────────────────────────
echo -e "${CYAN}4. List all agents${RESET}"
curl -s "$BASE/agents" | python3 -m json.tool
echo

# ── 4. Resolve by URN (Boston requester → prefers New York) ───────────────────
echo -e "${CYAN}5. Resolve emailer — requester in Boston (expects New York)${RESET}"
curl -s -X POST "$BASE/resolve" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_name": "urn:agentns.local:agents.local:emailer",
    "requester_context": {
      "location":  {"city": "Boston"},
      "protocols": ["A2A", "http"]
    }
  }' | python3 -m json.tool
echo

# ── 5. Resolve by URN (Paris requester → prefers London) ─────────────────────
echo -e "${CYAN}6. Resolve emailer — requester in Paris (expects London)${RESET}"
curl -s -X POST "$BASE/resolve" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_name": "urn:agentns.local:agents.local:emailer",
    "requester_context": {
      "location":  {"city": "Paris"},
      "protocols": ["A2A", "http"]
    }
  }' | python3 -m json.tool
echo

# ── 6. Cache stats ─────────────────────────────────────────────────────────────
echo -e "${CYAN}7. Cache stats${RESET}"
curl -s "$BASE/cache/stats" | python3 -m json.tool
echo

echo -e "${GREEN}Done!${RESET}"
