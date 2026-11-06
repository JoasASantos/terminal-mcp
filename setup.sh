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
OS="$(uname -s)"

echo -e "${BOLD}${BLUE}terminal-mcp setup${NC}"
echo -e "Install dir: ${INSTALL_DIR}"
echo -e "Platform:    ${OS}"
echo ""

# ── Check Node.js ───────────────────────────────────────────────────────

if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js not found. Install Node.js 18+ first:${NC}"
    if [ "$OS" = "Darwin" ]; then
        echo "  brew install node"
    else
        echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
        echo "  sudo apt-get install -y nodejs"
    fi
    echo "  or: https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Node.js 18+ required. Found: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}[+]${NC} Node.js $(node -v)"

# ── Linux: Check Puppeteer system dependencies ─────────────────────────

if [ "$OS" = "Linux" ]; then
    echo -e "${BLUE}[*]${NC} Checking Linux system dependencies for Puppeteer..."

    MISSING=""
    for lib in libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libgbm1 libasound2; do
        if ! dpkg -s "$lib" &>/dev/null 2>&1 && ! rpm -q "$lib" &>/dev/null 2>&1; then
            MISSING="$MISSING $lib"
        fi
    done

    if [ -n "$MISSING" ]; then
        echo -e "${YELLOW}[!]${NC} Missing system libraries detected."
        if command -v apt-get &>/dev/null; then
            echo -e "${BLUE}[*]${NC} Installing via apt-get..."
            sudo apt-get install -y \
                libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
                libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
                libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
                2>&1 | tail -3
            echo -e "${GREEN}[+]${NC} System dependencies installed"
        elif command -v dnf &>/dev/null; then
            echo -e "${BLUE}[*]${NC} Installing via dnf..."
            sudo dnf install -y \
                nss atk at-spi2-atk cups-libs libdrm libxkbcommon \
                libXcomposite libXdamage libXrandr mesa-libgbm pango cairo alsa-lib \
                2>&1 | tail -3
            echo -e "${GREEN}[+]${NC} System dependencies installed"
        elif command -v pacman &>/dev/null; then
            echo -e "${BLUE}[*]${NC} Installing via pacman..."
            sudo pacman -S --noconfirm nss atk at-spi2-atk cups libdrm libxkbcommon \
                libxcomposite libxdamage libxrandr mesa pango cairo alsa-lib \
                2>&1 | tail -3
            echo -e "${GREEN}[+]${NC} System dependencies installed"
        else
            echo -e "${RED}[-]${NC} Unknown package manager. Install Puppeteer dependencies manually."
            echo "    See: https://github.com/JoasASantos/terminal-mcp#linux-prerequisites"
        fi
    else
        echo -e "${GREEN}[+]${NC} System dependencies OK"
    fi
fi

# ── Install dependencies ───────────────────────────────────────────────

echo -e "${BLUE}[*]${NC} Installing npm dependencies..."
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

# ── Register with MCP clients ──────────────────────────────────────────

MCP_JSON='{
  "mcpServers": {
    "terminal-mcp": {
      "command": "node",
      "args": ["'"${INSTALL_DIR}"'/dist/index.js"],
      "env": {
        "TERMINAL_MCP_DIR": "'"${SCREENSHOTS_DIR}"'"
      }
    }
  }
}'

REGISTERED=false

# Claude Code
if command -v claude &> /dev/null; then
    echo -e "${BLUE}[*]${NC} Registering with Claude Code..."
    claude mcp remove terminal-mcp --scope user 2>/dev/null || true
    claude mcp add terminal-mcp --scope user -e TERMINAL_MCP_DIR="$SCREENSHOTS_DIR" -- node "$INSTALL_DIR/dist/index.js"
    echo -e "${GREEN}[+]${NC} Claude Code: registered (restart to load)"
    REGISTERED=true
fi

# Cursor
CURSOR_DIR="$HOME/.cursor"
if [ -d "$CURSOR_DIR" ]; then
    echo -e "${BLUE}[*]${NC} Registering with Cursor..."
    mkdir -p "$CURSOR_DIR"
    CURSOR_MCP="$CURSOR_DIR/mcp.json"
    if [ -f "$CURSOR_MCP" ]; then
        node -e "
            const fs = require('fs');
            const cfg = JSON.parse(fs.readFileSync('$CURSOR_MCP','utf8'));
            if (!cfg.mcpServers) cfg.mcpServers = {};
            cfg.mcpServers['terminal-mcp'] = {
                command: 'node',
                args: ['$INSTALL_DIR/dist/index.js'],
                env: { TERMINAL_MCP_DIR: '$SCREENSHOTS_DIR' }
            };
            fs.writeFileSync('$CURSOR_MCP', JSON.stringify(cfg, null, 2));
        "
    else
        echo "$MCP_JSON" > "$CURSOR_MCP"
    fi
    echo -e "${GREEN}[+]${NC} Cursor: registered ($CURSOR_MCP)"
    REGISTERED=true
fi

# Windsurf
WINDSURF_DIR="$HOME/.windsurf"
if [ -d "$WINDSURF_DIR" ]; then
    echo -e "${BLUE}[*]${NC} Registering with Windsurf..."
    WINDSURF_MCP="$WINDSURF_DIR/mcp.json"
    if [ -f "$WINDSURF_MCP" ]; then
        node -e "
            const fs = require('fs');
            const cfg = JSON.parse(fs.readFileSync('$WINDSURF_MCP','utf8'));
            if (!cfg.mcpServers) cfg.mcpServers = {};
            cfg.mcpServers['terminal-mcp'] = {
                command: 'node',
                args: ['$INSTALL_DIR/dist/index.js'],
                env: { TERMINAL_MCP_DIR: '$SCREENSHOTS_DIR' }
            };
            fs.writeFileSync('$WINDSURF_MCP', JSON.stringify(cfg, null, 2));
        "
    else
        echo "$MCP_JSON" > "$WINDSURF_MCP"
    fi
    echo -e "${GREEN}[+]${NC} Windsurf: registered ($WINDSURF_MCP)"
    REGISTERED=true
fi

# Codex
CODEX_DIR="$HOME/.codex"
if [ -d "$CODEX_DIR" ]; then
    echo -e "${BLUE}[*]${NC} Registering with Codex..."
    CODEX_MCP="$CODEX_DIR/mcp.json"
    if [ -f "$CODEX_MCP" ]; then
        node -e "
            const fs = require('fs');
            const cfg = JSON.parse(fs.readFileSync('$CODEX_MCP','utf8'));
            if (!cfg.mcpServers) cfg.mcpServers = {};
            cfg.mcpServers['terminal-mcp'] = {
                command: 'node',
                args: ['$INSTALL_DIR/dist/index.js'],
                env: { TERMINAL_MCP_DIR: '$SCREENSHOTS_DIR' }
            };
            fs.writeFileSync('$CODEX_MCP', JSON.stringify(cfg, null, 2));
        "
    else
        echo "$MCP_JSON" > "$CODEX_MCP"
    fi
    echo -e "${GREEN}[+]${NC} Codex: registered ($CODEX_MCP)"
    REGISTERED=true
fi

# Continue
CONTINUE_DIR="$HOME/.continue"
if [ -d "$CONTINUE_DIR" ]; then
    echo -e "${BLUE}[*]${NC} Registering with Continue..."
    CONTINUE_CFG="$CONTINUE_DIR/config.json"
    if [ -f "$CONTINUE_CFG" ]; then
        node -e "
            const fs = require('fs');
            const cfg = JSON.parse(fs.readFileSync('$CONTINUE_CFG','utf8'));
            if (!cfg.experimental) cfg.experimental = {};
            if (!cfg.experimental.mcpServers) cfg.experimental.mcpServers = {};
            cfg.experimental.mcpServers['terminal-mcp'] = {
                command: 'node',
                args: ['$INSTALL_DIR/dist/index.js'],
                env: { TERMINAL_MCP_DIR: '$SCREENSHOTS_DIR' }
            };
            fs.writeFileSync('$CONTINUE_CFG', JSON.stringify(cfg, null, 2));
        "
        echo -e "${GREEN}[+]${NC} Continue: registered ($CONTINUE_CFG)"
        REGISTERED=true
    fi
fi

if [ "$REGISTERED" = false ]; then
    echo -e "${YELLOW}[!]${NC} No MCP client detected. Add manually to your client's MCP config:"
    echo ""
    echo "$MCP_JSON"
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
echo -e "Available tools after client restart:"
echo -e "  ${BOLD}terminal_exec${NC}             - Execute command, capture output"
echo -e "  ${BOLD}terminal_screenshot${NC}        - Render capture as PNG"
echo -e "  ${BOLD}terminal_exec_screenshot${NC}   - Execute + screenshot in one step"
echo -e "  ${BOLD}terminal_screenshot_text${NC}   - Screenshot arbitrary text"
echo -e "  ${BOLD}terminal_list_captures${NC}     - List session captures"
echo -e "  ${BOLD}terminal_list_screenshots${NC}  - List saved PNGs"
echo -e "  ${BOLD}terminal_themes${NC}            - List available themes"
echo ""
echo -e "Themes: tokyonight, dracula, monokai, catppuccin, hacker, macos, kali"
echo -e "Screenshots saved to: ${SCREENSHOTS_DIR}"
