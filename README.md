# terminal-mcp

MCP server that executes shell commands and captures terminal output as styled PNG screenshots — perfect for pentest reports, documentation, and any workflow where you need professional-looking terminal captures.

## Features

- **Execute & capture**: Run commands with full ANSI color preservation
- **Terminal-styled screenshots**: Renders output as PNG with macOS window chrome, proper colors, and metadata
- **5 built-in themes**: Tokyo Night, Dracula, Monokai, Catppuccin, Hacker (green matrix)
- **Report-ready**: Watermarks, timestamps, exit codes, custom titles
- **Full ANSI support**: 16 colors, 256-color palette, and 24-bit truecolor
- **Session capture management**: List, re-render, and manage captures

## Screenshot Examples

![Tokyo Night theme](https://raw.githubusercontent.com/JoasASantos/terminal-mcp/main/examples/tokyonight.png)

## Installation

```bash
git clone https://github.com/JoasASantos/terminal-mcp.git
cd terminal-mcp
npm install
npm run build
```

## Configuration

Add to your `~/.mcp.json` (global) or project `.mcp.json`:

```json
{
  "mcpServers": {
    "terminal-mcp": {
      "command": "node",
      "args": ["/path/to/terminal-mcp/dist/index.js"],
      "env": {
        "TERMINAL_MCP_DIR": "/path/to/screenshots"
      }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `terminal_exec` | Execute a command and capture output with ANSI colors |
| `terminal_screenshot` | Render a captured output as a terminal-styled PNG |
| `terminal_exec_screenshot` | Execute + screenshot in one step |
| `terminal_screenshot_text` | Render arbitrary text as a terminal PNG |
| `terminal_list_captures` | List all captures in the current session |
| `terminal_list_screenshots` | List saved PNG files |
| `terminal_themes` | List available themes |

## Themes

- **tokyonight** (default) — Dark blue, clean and modern
- **dracula** — Classic purple-accented dark theme
- **monokai** — Warm dark theme with vibrant colors
- **catppuccin** — Soft pastel dark theme
- **hacker** — Green-on-black matrix style

## Screenshot Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `theme` | string | `tokyonight` | Color theme |
| `show_chrome` | boolean | `true` | macOS window chrome with traffic lights |
| `font_size` | number | `14` | Font size in pixels |
| `title` | string | command name | Window title bar text |
| `prompt` | string | `$ ` | Shell prompt prefix |
| `show_timestamp` | boolean | `true` | Show timestamp in footer |
| `watermark` | string | — | Watermark text (bottom-right) |
| `save_path` | string | auto | Full path for the output PNG |

## Usage Examples

### Basic command screenshot
```
terminal_exec_screenshot({ command: "nmap -sV target.com", theme: "hacker" })
```

### Pentest report with watermark
```
terminal_exec_screenshot({
  command: "nikto -h https://target.com",
  theme: "tokyonight",
  watermark: "CONFIDENTIAL - Pentest Report 2024",
  title: "Nikto Web Scanner"
})
```

### Screenshot arbitrary text
```
terminal_screenshot_text({
  text: "Finding: SQL Injection in /api/users\nSeverity: Critical\nCVSS: 9.8",
  title: "Vulnerability Report",
  theme: "dracula"
})
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TERMINAL_MCP_DIR` | `~/terminal-screenshots` | Directory for saved screenshots |

## Requirements

- Node.js 18+
- Puppeteer (bundled — downloads Chromium on first run)

## License

MIT
