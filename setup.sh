#!/bin/bash
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"
SCREENSHOTS_DIR="${TERMINAL_MCP_DIR:-$HOME/terminal-screenshots}"

echo -e "${BOLD}${BLUE}terminal-mcp setup${NC}"
echo -e "Install dir: ${INSTALL_DIR}"
echo ""

# ── Check Node.js ───────────────────────────────────────────────────────

if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js not found. Install Node.js 18+ first.${NC}"
    echo "  brew install node"
    echo "  or: https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Node.js 18+ required. Found: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}[+]${NC} Node.js $(node -v)"

# ── Install dependencies ───────────────────────────────────────────────

echo -e "${BLUE}[*]${NC} Installing dependencies..."
cd "$INSTALL_DIR"
npm install --silent 2>&1 | tail -1
echo -e "${GREEN}[+]${NC} Dependencies installed"

# ── Build ───────────────────────────────────────────────────────────────

echo -e "${BLUE}[*]${NC} Building TypeScript..."
npx tsc
echo -e "${GREEN}[+]${NC} Build complete: ${INSTALL_DIR}/dist/index.js"

# ── Create screenshots directory ────────────────────────────────────────

mkdir -p "$SCREENSHOTS_DIR"
echo -e "${GREEN}[+]${NC} Screenshots dir: ${SCREENSHOTS_DIR}"

# ── Register with Claude Code ───────────────────────────────────────────

if command -v claude &> /dev/null; then
    echo -e "${BLUE}[*]${NC} Registering MCP server with Claude Code..."

    # Remove existing if present
    claude mcp remove terminal-mcp --scope user 2>/dev/null || true

    # Add with user scope
    claude mcp add terminal-mcp --scope user -e TERMINAL_MCP_DIR="$SCREENSHOTS_DIR" -- node "$INSTALL_DIR/dist/index.js"

    echo -e "${GREEN}[+]${NC} Registered as MCP server (user scope)"
    echo -e "${YELLOW}[!]${NC} Restart Claude Code to load terminal-mcp"
else
    echo -e "${YELLOW}[!]${NC} Claude Code CLI not found. Add manually to ~/.mcp.json:"
    echo ""
    cat <<EOF
{
  "mcpServers": {
    "terminal-mcp": {
      "command": "node",
      "args": ["${INSTALL_DIR}/dist/index.js"],
      "env": {
        "TERMINAL_MCP_DIR": "${SCREENSHOTS_DIR}"
      }
    }
  }
}
EOF
    echo ""
fi

# ── Verify ──────────────────────────────────────────────────────────────

echo -e "${BLUE}[*]${NC} Verifying server starts..."
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
    | node "$INSTALL_DIR/dist/index.js" 2>/dev/null \
    | head -c 200 | grep -q "terminal-mcp" \
    && echo -e "${GREEN}[+]${NC} Server verified" \
    || echo -e "${RED}[-]${NC} Server failed to start"

echo ""
echo -e "${BOLD}${GREEN}Setup complete!${NC}"
echo ""
echo -e "Available tools after restart:"
echo -e "  ${BOLD}terminal_exec${NC}             - Execute command, capture output"
echo -e "  ${BOLD}terminal_screenshot${NC}        - Render capture as PNG"
echo -e "  ${BOLD}terminal_exec_screenshot${NC}   - Execute + screenshot in one step"
echo -e "  ${BOLD}terminal_screenshot_text${NC}   - Screenshot arbitrary text"
echo -e "  ${BOLD}terminal_list_captures${NC}     - List session captures"
echo -e "  ${BOLD}terminal_list_screenshots${NC}  - List saved PNGs"
echo -e "  ${BOLD}terminal_themes${NC}            - List available themes"
echo ""
echo -e "Themes: tokyonight (default), dracula, monokai, catppuccin, hacker"
echo -e "Screenshots saved to: ${SCREENSHOTS_DIR}"
