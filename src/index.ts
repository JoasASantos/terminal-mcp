#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { spawn, execSync } from "child_process";
import { writeFile, mkdir, readdir, readFile, stat } from "fs/promises";
import { join, resolve, basename, dirname } from "path";
import { existsSync } from "fs";
import { homedir } from "os";

// ── Types ──────────────────────────────────────────────────────────────

interface Capture {
  id: string;
  command: string;
  output: string;
  exitCode: number | null;
  timestamp: string;
  cwd: string;
  duration: number;
  stderr: string;
}

interface Theme {
  name: string;
  bg: string;
  fg: string;
  titlebarBg: string;
  titlebarFg: string;
  promptColor: string;
  commandColor: string;
  timestampColor: string;
  borderColor: string;
  colors: Record<number, string>;
}

// ── Themes ─────────────────────────────────────────────────────────────

const THEMES: Record<string, Theme> = {
  tokyonight: {
    name: "Tokyo Night",
    bg: "#1a1b26",
    fg: "#a9b1d6",
    titlebarBg: "#16161e",
    titlebarFg: "#565f89",
    promptColor: "#7aa2f7",
    commandColor: "#c0caf5",
    timestampColor: "#565f89",
    borderColor: "#292e42",
    colors: {
      0: "#414868", 1: "#f7768e", 2: "#9ece6a", 3: "#e0af68",
      4: "#7aa2f7", 5: "#bb9af7", 6: "#7dcfff", 7: "#a9b1d6",
      8: "#414868", 9: "#f7768e", 10: "#9ece6a", 11: "#e0af68",
      12: "#7aa2f7", 13: "#bb9af7", 14: "#7dcfff", 15: "#c0caf5",
    },
  },
  dracula: {
    name: "Dracula",
    bg: "#282a36",
    fg: "#f8f8f2",
    titlebarBg: "#21222c",
    titlebarFg: "#6272a4",
    promptColor: "#bd93f9",
    commandColor: "#f8f8f2",
    timestampColor: "#6272a4",
    borderColor: "#44475a",
    colors: {
      0: "#21222c", 1: "#ff5555", 2: "#50fa7b", 3: "#f1fa8c",
      4: "#bd93f9", 5: "#ff79c6", 6: "#8be9fd", 7: "#f8f8f2",
      8: "#6272a4", 9: "#ff6e6e", 10: "#69ff94", 11: "#ffffa5",
      12: "#d6acff", 13: "#ff92df", 14: "#a4ffff", 15: "#ffffff",
    },
  },
  monokai: {
    name: "Monokai",
    bg: "#272822",
    fg: "#f8f8f2",
    titlebarBg: "#1e1f1c",
    titlebarFg: "#75715e",
    promptColor: "#66d9ef",
    commandColor: "#f8f8f2",
    timestampColor: "#75715e",
    borderColor: "#3e3d32",
    colors: {
      0: "#272822", 1: "#f92672", 2: "#a6e22e", 3: "#f4bf75",
      4: "#66d9ef", 5: "#ae81ff", 6: "#a1efe4", 7: "#f8f8f2",
      8: "#75715e", 9: "#f92672", 10: "#a6e22e", 11: "#f4bf75",
      12: "#66d9ef", 13: "#ae81ff", 14: "#a1efe4", 15: "#f9f8f5",
    },
  },
  catppuccin: {
    name: "Catppuccin Mocha",
    bg: "#1e1e2e",
    fg: "#cdd6f4",
    titlebarBg: "#181825",
    titlebarFg: "#6c7086",
    promptColor: "#89b4fa",
    commandColor: "#cdd6f4",
    timestampColor: "#6c7086",
    borderColor: "#313244",
    colors: {
      0: "#45475a", 1: "#f38ba8", 2: "#a6e3a1", 3: "#f9e2af",
      4: "#89b4fa", 5: "#cba6f7", 6: "#94e2d5", 7: "#bac2de",
      8: "#585b70", 9: "#f38ba8", 10: "#a6e3a1", 11: "#f9e2af",
      12: "#89b4fa", 13: "#cba6f7", 14: "#94e2d5", 15: "#a6adc8",
    },
  },
  macos: {
    name: "macOS Terminal",
    bg: "#1e1e1e",
    fg: "#cccccc",
    titlebarBg: "#3c3c3c",
    titlebarFg: "#9a9a9a",
    promptColor: "#4fc3f7",
    commandColor: "#e0e0e0",
    timestampColor: "#6e6e6e",
    borderColor: "#3c3c3c",
    colors: {
      0: "#000000", 1: "#ff6b6b", 2: "#67f86f", 3: "#fffc67",
      4: "#6a76fb", 5: "#fd7cfc", 6: "#68fdfe", 7: "#cccccc",
      8: "#808080", 9: "#ff6b6b", 10: "#67f86f", 11: "#fffc67",
      12: "#6a76fb", 13: "#fd7cfc", 14: "#68fdfe", 15: "#ffffff",
    },
  },
  kali: {
    name: "Kali Linux",
    bg: "#1a1a2e",
    fg: "#d4d4d4",
    titlebarBg: "#16213e",
    titlebarFg: "#6272a4",
    promptColor: "#4db8ff",
    commandColor: "#ffffff",
    timestampColor: "#5c6370",
    borderColor: "#0f3460",
    colors: {
      0: "#1a1a2e", 1: "#e94560", 2: "#2ecc71", 3: "#f1c40f",
      4: "#3498db", 5: "#9b59b6", 6: "#1abc9c", 7: "#d4d4d4",
      8: "#5c6370", 9: "#e74c3c", 10: "#2ecc71", 11: "#f39c12",
      12: "#2980b9", 13: "#8e44ad", 14: "#16a085", 15: "#ffffff",
    },
  },
  hacker: {
    name: "Hacker",
    bg: "#0a0a0a",
    fg: "#00ff00",
    titlebarBg: "#0d0d0d",
    titlebarFg: "#006600",
    promptColor: "#00ff00",
    commandColor: "#00ff41",
    timestampColor: "#006600",
    borderColor: "#003300",
    colors: {
      0: "#0a0a0a", 1: "#ff0000", 2: "#00ff00", 3: "#ffff00",
      4: "#00aaff", 5: "#ff00ff", 6: "#00ffff", 7: "#00ff00",
      8: "#006600", 9: "#ff3333", 10: "#33ff33", 11: "#ffff33",
      12: "#3399ff", 13: "#ff33ff", 14: "#33ffff", 15: "#00ff41",
    },
  },
  nord: {
    name: "Nord",
    bg: "#2e3440",
    fg: "#d8dee9",
    titlebarBg: "#272c36",
    titlebarFg: "#4c566a",
    promptColor: "#88c0d0",
    commandColor: "#eceff4",
    timestampColor: "#4c566a",
    borderColor: "#3b4252",
    colors: {
      0: "#3b4252", 1: "#bf616a", 2: "#a3be8c", 3: "#ebcb8b",
      4: "#81a1c1", 5: "#b48ead", 6: "#88c0d0", 7: "#e5e9f0",
      8: "#4c566a", 9: "#bf616a", 10: "#a3be8c", 11: "#ebcb8b",
      12: "#81a1c1", 13: "#b48ead", 14: "#8fbcbb", 15: "#eceff4",
    },
  },
  gruvbox: {
    name: "Gruvbox Dark",
    bg: "#282828",
    fg: "#ebdbb2",
    titlebarBg: "#1d2021",
    titlebarFg: "#665c54",
    promptColor: "#83a598",
    commandColor: "#fbf1c7",
    timestampColor: "#665c54",
    borderColor: "#3c3836",
    colors: {
      0: "#282828", 1: "#cc241d", 2: "#98971a", 3: "#d79921",
      4: "#458588", 5: "#b16286", 6: "#689d6a", 7: "#a89984",
      8: "#928374", 9: "#fb4934", 10: "#b8bb26", 11: "#fabd2f",
      12: "#83a598", 13: "#d3869b", 14: "#8ec07c", 15: "#ebdbb2",
    },
  },
  solarized: {
    name: "Solarized Dark",
    bg: "#002b36",
    fg: "#839496",
    titlebarBg: "#001e26",
    titlebarFg: "#586e75",
    promptColor: "#268bd2",
    commandColor: "#93a1a1",
    timestampColor: "#586e75",
    borderColor: "#073642",
    colors: {
      0: "#073642", 1: "#dc322f", 2: "#859900", 3: "#b58900",
      4: "#268bd2", 5: "#d33682", 6: "#2aa198", 7: "#eee8d5",
      8: "#002b36", 9: "#cb4b16", 10: "#586e75", 11: "#657b83",
      12: "#839496", 13: "#6c71c4", 14: "#93a1a1", 15: "#fdf6e3",
    },
  },
  onedark: {
    name: "One Dark",
    bg: "#282c34",
    fg: "#abb2bf",
    titlebarBg: "#21252b",
    titlebarFg: "#5c6370",
    promptColor: "#61afef",
    commandColor: "#e5e5e5",
    timestampColor: "#5c6370",
    borderColor: "#3e4451",
    colors: {
      0: "#282c34", 1: "#e06c75", 2: "#98c379", 3: "#e5c07b",
      4: "#61afef", 5: "#c678dd", 6: "#56b6c2", 7: "#abb2bf",
      8: "#5c6370", 9: "#e06c75", 10: "#98c379", 11: "#e5c07b",
      12: "#61afef", 13: "#c678dd", 14: "#56b6c2", 15: "#ffffff",
    },
  },
  material: {
    name: "Material Dark",
    bg: "#263238",
    fg: "#eeffff",
    titlebarBg: "#1e272c",
    titlebarFg: "#546e7a",
    promptColor: "#82aaff",
    commandColor: "#eeffff",
    timestampColor: "#546e7a",
    borderColor: "#37474f",
    colors: {
      0: "#546e7a", 1: "#ff5370", 2: "#c3e88d", 3: "#ffcb6b",
      4: "#82aaff", 5: "#c792ea", 6: "#89ddff", 7: "#eeffff",
      8: "#546e7a", 9: "#ff5370", 10: "#c3e88d", 11: "#ffcb6b",
      12: "#82aaff", 13: "#c792ea", 14: "#89ddff", 15: "#ffffff",
    },
  },
  ayu: {
    name: "Ayu Dark",
    bg: "#0b0e14",
    fg: "#bfbdb6",
    titlebarBg: "#07090d",
    titlebarFg: "#565b66",
    promptColor: "#39bae6",
    commandColor: "#e6e1cf",
    timestampColor: "#565b66",
    borderColor: "#11151c",
    colors: {
      0: "#01060e", 1: "#ea6c73", 2: "#91b362", 3: "#f9af4f",
      4: "#53bdfa", 5: "#fae994", 6: "#90e1c6", 7: "#c7c7c7",
      8: "#686868", 9: "#f07178", 10: "#c2d94c", 11: "#ffb454",
      12: "#59c2ff", 13: "#ffee99", 14: "#95e6cb", 15: "#ffffff",
    },
  },
  github: {
    name: "GitHub Dark",
    bg: "#0d1117",
    fg: "#c9d1d9",
    titlebarBg: "#010409",
    titlebarFg: "#484f58",
    promptColor: "#58a6ff",
    commandColor: "#f0f6fc",
    timestampColor: "#484f58",
    borderColor: "#21262d",
    colors: {
      0: "#484f58", 1: "#ff7b72", 2: "#3fb950", 3: "#d29922",
      4: "#58a6ff", 5: "#bc8cff", 6: "#39c5cf", 7: "#b1bac4",
      8: "#6e7681", 9: "#ffa198", 10: "#56d364", 11: "#e3b341",
      12: "#79c0ff", 13: "#d2a8ff", 14: "#56d4dd", 15: "#f0f6fc",
    },
  },
  cobalt: {
    name: "Cobalt",
    bg: "#132738",
    fg: "#ffffff",
    titlebarBg: "#0d1f2d",
    titlebarFg: "#4f6d7a",
    promptColor: "#ffc600",
    commandColor: "#ffffff",
    timestampColor: "#4f6d7a",
    borderColor: "#1a3448",
    colors: {
      0: "#000000", 1: "#ff0000", 2: "#38de21", 3: "#ffe50a",
      4: "#1460d2", 5: "#ff005d", 6: "#00bbbb", 7: "#bbbbbb",
      8: "#555555", 9: "#f40e17", 10: "#3bd01d", 11: "#edc809",
      12: "#5555ff", 13: "#ff55ff", 14: "#6ae3fa", 15: "#ffffff",
    },
  },
  parrot: {
    name: "Parrot OS",
    bg: "#181a1f",
    fg: "#d4d4d4",
    titlebarBg: "#101215",
    titlebarFg: "#5c6370",
    promptColor: "#00d4aa",
    commandColor: "#ffffff",
    timestampColor: "#5c6370",
    borderColor: "#282c34",
    colors: {
      0: "#1b1d23", 1: "#e55561", 2: "#00d4aa", 3: "#e2b86b",
      4: "#4fa6ed", 5: "#bf68d9", 6: "#48b0bd", 7: "#a0a8b7",
      8: "#535965", 9: "#e55561", 10: "#00d4aa", 11: "#e2b86b",
      12: "#4fa6ed", 13: "#bf68d9", 14: "#48b0bd", 15: "#ffffff",
    },
  },
  ubuntu: {
    name: "Ubuntu",
    bg: "#300a24",
    fg: "#eeeeec",
    titlebarBg: "#240820",
    titlebarFg: "#8a6d85",
    promptColor: "#4e9a06",
    commandColor: "#eeeeec",
    timestampColor: "#8a6d85",
    borderColor: "#3c0f30",
    colors: {
      0: "#2e3436", 1: "#cc0000", 2: "#4e9a06", 3: "#c4a000",
      4: "#3465a4", 5: "#75507b", 6: "#06989a", 7: "#d3d7cf",
      8: "#555753", 9: "#ef2929", 10: "#8ae234", 11: "#fce94f",
      12: "#729fcf", 13: "#ad7fa8", 14: "#34e2e2", 15: "#eeeeec",
    },
  },
  powershell: {
    name: "PowerShell",
    bg: "#012456",
    fg: "#cccccc",
    titlebarBg: "#001b3e",
    titlebarFg: "#4e6f8b",
    promptColor: "#ffff00",
    commandColor: "#ffffff",
    timestampColor: "#4e6f8b",
    borderColor: "#013567",
    colors: {
      0: "#000000", 1: "#ff0000", 2: "#00ff00", 3: "#ffff00",
      4: "#6495ed", 5: "#ff00ff", 6: "#00ffff", 7: "#ffffff",
      8: "#808080", 9: "#ff6347", 10: "#98fb98", 11: "#fffacd",
      12: "#87ceeb", 13: "#ee82ee", 14: "#afeeee", 15: "#ffffff",
    },
  },
  retro: {
    name: "Retro Amber",
    bg: "#0c0c0c",
    fg: "#ffb000",
    titlebarBg: "#0a0a0a",
    titlebarFg: "#664600",
    promptColor: "#ffb000",
    commandColor: "#ffc840",
    timestampColor: "#664600",
    borderColor: "#1a1200",
    colors: {
      0: "#0c0c0c", 1: "#ff3300", 2: "#ffb000", 3: "#ffc840",
      4: "#cc8800", 5: "#ff6600", 6: "#ffcc00", 7: "#ffb000",
      8: "#664600", 9: "#ff4400", 10: "#ffc000", 11: "#ffd860",
      12: "#dda000", 13: "#ff7700", 14: "#ffdd00", 15: "#ffe080",
    },
  },
  light: {
    name: "Light",
    bg: "#ffffff",
    fg: "#24292e",
    titlebarBg: "#f0f0f0",
    titlebarFg: "#8b949e",
    promptColor: "#0366d6",
    commandColor: "#24292e",
    timestampColor: "#8b949e",
    borderColor: "#e1e4e8",
    colors: {
      0: "#24292e", 1: "#d73a49", 2: "#22863a", 3: "#b08800",
      4: "#0366d6", 5: "#6f42c1", 6: "#1b7c83", 7: "#6a737d",
      8: "#959da5", 9: "#cb2431", 10: "#28a745", 11: "#dbab09",
      12: "#2188ff", 13: "#8a63d2", 14: "#3192aa", 15: "#24292e",
    },
  },
};

// ── ANSI Parser ────────────────────────────────────────────────────────

function ansiToHtml(text: string, theme: Theme): string {
  let result = "";
  let i = 0;
  let currentStyles: string[] = [];

  const colorMap: Record<number, string> = {
    30: theme.colors[0], 31: theme.colors[1], 32: theme.colors[2],
    33: theme.colors[3], 34: theme.colors[4], 35: theme.colors[5],
    36: theme.colors[6], 37: theme.colors[7],
    90: theme.colors[8], 91: theme.colors[9], 92: theme.colors[10],
    93: theme.colors[11], 94: theme.colors[12], 95: theme.colors[13],
    96: theme.colors[14], 97: theme.colors[15],
  };

  const bgColorMap: Record<number, string> = {
    40: theme.colors[0], 41: theme.colors[1], 42: theme.colors[2],
    43: theme.colors[3], 44: theme.colors[4], 45: theme.colors[5],
    46: theme.colors[6], 47: theme.colors[7],
    100: theme.colors[8], 101: theme.colors[9], 102: theme.colors[10],
    103: theme.colors[11], 104: theme.colors[12], 105: theme.colors[13],
    106: theme.colors[14], 107: theme.colors[15],
  };

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function closeSpan(): string {
    if (currentStyles.length > 0) {
      currentStyles = [];
      return "</span>";
    }
    return "";
  }

  function openSpan(): string {
    if (currentStyles.length > 0) {
      return `<span style="${currentStyles.join(";")}">`;
    }
    return "";
  }

  while (i < text.length) {
    if (text[i] === "\x1b" && text[i + 1] === "[") {
      const end = text.indexOf("m", i);
      if (end === -1) { i++; continue; }

      const seq = text.substring(i + 2, end);
      const codes = seq.split(";").map(Number);

      result += closeSpan();

      let j = 0;
      while (j < codes.length) {
        const code = codes[j];
        if (code === 0) {
          currentStyles = [];
        } else if (code === 1) {
          currentStyles.push("font-weight:bold");
        } else if (code === 2) {
          currentStyles.push("opacity:0.7");
        } else if (code === 3) {
          currentStyles.push("font-style:italic");
        } else if (code === 4) {
          currentStyles.push("text-decoration:underline");
        } else if (code === 7) {
          currentStyles.push(`background:${theme.fg};color:${theme.bg}`);
        } else if (code === 9) {
          currentStyles.push("text-decoration:line-through");
        } else if (colorMap[code]) {
          currentStyles.push(`color:${colorMap[code]}`);
        } else if (bgColorMap[code]) {
          currentStyles.push(`background:${bgColorMap[code]}`);
        } else if (code === 38 && codes[j + 1] === 5) {
          const colorIdx = codes[j + 2];
          currentStyles.push(`color:${xterm256Color(colorIdx)}`);
          j += 2;
        } else if (code === 48 && codes[j + 1] === 5) {
          const colorIdx = codes[j + 2];
          currentStyles.push(`background:${xterm256Color(colorIdx)}`);
          j += 2;
        } else if (code === 38 && codes[j + 1] === 2) {
          const r = codes[j + 2], g = codes[j + 3], b = codes[j + 4];
          currentStyles.push(`color:rgb(${r},${g},${b})`);
          j += 4;
        } else if (code === 48 && codes[j + 1] === 2) {
          const r = codes[j + 2], g = codes[j + 3], b = codes[j + 4];
          currentStyles.push(`background:rgb(${r},${g},${b})`);
          j += 4;
        }
        j++;
      }

      result += openSpan();
      i = end + 1;
    } else if (text[i] === "\r") {
      i++;
    } else {
      result += escapeHtml(text[i]);
      i++;
    }
  }

  result += closeSpan();
  return result;
}

function xterm256Color(idx: number): string {
  if (idx < 16) {
    const basic = [
      "#000000", "#aa0000", "#00aa00", "#aa5500",
      "#0000aa", "#aa00aa", "#00aaaa", "#aaaaaa",
      "#555555", "#ff5555", "#55ff55", "#ffff55",
      "#5555ff", "#ff55ff", "#55ffff", "#ffffff",
    ];
    return basic[idx] || "#ffffff";
  }
  if (idx < 232) {
    const i = idx - 16;
    const r = Math.floor(i / 36) * 51;
    const g = Math.floor((i % 36) / 6) * 51;
    const b = (i % 6) * 51;
    return `rgb(${r},${g},${b})`;
  }
  const gray = (idx - 232) * 10 + 8;
  return `rgb(${gray},${gray},${gray})`;
}

// ── HTML Template ──────────────────────────────────────────────────────

function buildTerminalHtml(
  capture: Capture | { command: string; output: string; timestamp: string },
  theme: Theme,
  options: {
    showChrome?: boolean;
    fontSize?: number;
    title?: string;
    prompt?: string;
    showTimestamp?: boolean;
    showExitCode?: boolean;
    maxWidth?: number;
    watermark?: string;
    padding?: number;
    lineHeight?: number;
    maxLines?: number;
    width?: number;
    compact?: boolean;
  } = {},
): string {
  const {
    showChrome = true,
    fontSize = 14,
    title,
    prompt = "$ ",
    showTimestamp = true,
    showExitCode = true,
    maxWidth = 980,
    watermark,
    padding = 16,
    lineHeight = 1.4,
    maxLines,
    width,
    compact = false,
  } = options;

  const cap = capture as Capture;
  let outputText = capture.output;
  if (maxLines) {
    const lines = outputText.split("\n");
    if (lines.length > maxLines) {
      outputText = lines.slice(0, maxLines).join("\n") + `\n... [${lines.length - maxLines} lines truncated]`;
    }
  }
  const outputHtml = ansiToHtml(outputText, theme);
  const windowTitle = title || capture.command.split(" ")[0];
  const termWidth = width ? `width: ${width}px;` : "";
  const contentPad = compact ? 10 : 16;
  const exitCode = cap.exitCode ?? 0;
  const duration = cap.duration ? `${(cap.duration / 1000).toFixed(2)}s` : "";

  const metaItems: string[] = [];
  if (showTimestamp && capture.timestamp) {
    metaItems.push(capture.timestamp);
  }
  if (showExitCode && exitCode !== undefined && exitCode !== 0) {
    metaItems.push(`exit: ${exitCode}`);
  }
  if (duration) {
    metaItems.push(duration);
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: transparent;
    display: inline-block;
    padding: ${padding}px;
    max-width: ${maxWidth + padding * 2}px;
  }

  .terminal {
    background: ${theme.bg};
    border-radius: ${compact ? 6 : 10}px;
    overflow: hidden;
    box-shadow: 0 ${compact ? 10 : 20}px ${compact ? 40 : 68}px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.05);
    min-width: ${compact ? 300 : 500}px;
    max-width: ${maxWidth}px;
    ${termWidth}
  }

  ${showChrome ? `
  .titlebar {
    background: ${theme.titlebarBg};
    padding: ${compact ? "8px 12px" : "12px 16px"};
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid ${theme.borderColor};
    user-select: none;
  }
  .dots { display: flex; gap: 8px; }
  .dot { width: 12px; height: 12px; border-radius: 50%; }
  .dot-close { background: #ff5f57; }
  .dot-minimize { background: #febc2e; }
  .dot-maximize { background: #28c840; }
  .title {
    color: ${theme.titlebarFg};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    flex: 1;
    text-align: center;
    margin-right: 52px;
  }
  ` : ""}

  .content {
    padding: ${contentPad}px ${compact ? 14 : 20}px;
    font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace;
    font-size: ${fontSize}px;
    line-height: ${lineHeight};
    color: ${theme.fg};
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-x: auto;
  }

  .prompt-line {
    margin-bottom: ${compact ? 2 : 4}px;
  }

  .prompt { color: ${theme.promptColor}; font-weight: bold; }
  .command { color: ${theme.commandColor}; font-weight: bold; }
  .output-block { margin-top: 2px; }

  .meta {
    color: ${theme.timestampColor};
    font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
    font-size: ${Math.max(fontSize - 2, 10)}px;
    padding: ${compact ? 6 : 10}px ${compact ? 14 : 20}px;
    border-top: 1px solid ${theme.borderColor};
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .exit-error { color: #f7768e; font-weight: bold; }

  ${watermark ? `
  .watermark {
    color: ${theme.timestampColor};
    font-family: -apple-system, sans-serif;
    font-size: 11px;
    opacity: 0.5;
  }
  ` : ""}
</style>
</head>
<body>
  <div class="terminal">
    ${showChrome ? `
    <div class="titlebar">
      <div class="dots">
        <div class="dot dot-close"></div>
        <div class="dot dot-minimize"></div>
        <div class="dot dot-maximize"></div>
      </div>
      <span class="title">${escapeHtmlBasic(windowTitle)}</span>
    </div>
    ` : ""}

    <div class="content"><div class="prompt-line"><span class="prompt">${escapeHtmlBasic(prompt)}</span><span class="command">${escapeHtmlBasic(capture.command)}</span></div><div class="output-block">${outputHtml}</div></div>

    ${metaItems.length > 0 || watermark ? `
    <div class="meta">
      <span${exitCode !== 0 ? ' class="exit-error"' : ""}>${metaItems.join(" • ")}</span>
      ${watermark ? `<span class="watermark">${escapeHtmlBasic(watermark)}</span>` : ""}
    </div>
    ` : ""}
  </div>
</body>
</html>`;
}

function escapeHtmlBasic(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Command Execution ──────────────────────────────────────────────────

async function executeCommand(
  command: string,
  cwd?: string,
  timeout: number = 30000,
  env?: Record<string, string>,
): Promise<Capture> {
  const id = `cap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = new Date().toISOString().replace("T", " ").replace(/\.\d+Z/, " UTC");
  const workingDir = cwd || process.cwd();
  const startTime = Date.now();

  return new Promise((resolvePromise) => {
    let output = "";
    let stderr = "";
    let timedOut = false;

    const shellEnv = {
      ...process.env,
      FORCE_COLOR: "1",
      CLICOLOR_FORCE: "1",
      TERM: "xterm-256color",
      COLUMNS: "120",
      ...env,
    };

    const child = spawn("/bin/bash", ["-c", command], {
      cwd: workingDir,
      env: shellEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2000);
    }, timeout);

    child.stdout?.on("data", (data: Buffer) => {
      output += data.toString();
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const duration = Date.now() - startTime;

      if (timedOut) {
        output += `\n[TIMEOUT: command killed after ${timeout / 1000}s]`;
      }

      const merged = stderr ? output + stderr : output;

      const capture: Capture = {
        id,
        command,
        output: cleanOutput(merged),
        exitCode: code,
        timestamp,
        cwd: workingDir,
        duration,
        stderr: cleanOutput(stderr),
      };

      resolvePromise(capture);
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      const duration = Date.now() - startTime;

      const capture: Capture = {
        id,
        command,
        output: `Error: ${err.message}`,
        exitCode: 1,
        timestamp,
        cwd: workingDir,
        duration,
        stderr: err.message,
      };

      resolvePromise(capture);
    });

    child.stdin?.end();
  });
}

function cleanOutput(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "")
    .replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, "")
    .replace(/\x1b\[?[0-9;]*[HJKsu]/g, "")
    .replace(/\x1b\]0;[^\x07]*\x07/g, "")
    .replace(/\n$/, "");
}

// ── Renderer ───────────────────────────────────────────────────────────

let browserInstance: any = null;

async function getBrowser() {
  if (!browserInstance) {
    const puppeteer = await import("puppeteer");
    browserInstance = await puppeteer.default.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }
  return browserInstance;
}

async function renderScreenshot(
  html: string,
  savePath: string,
  scale: number = 2,
): Promise<{ path: string; width: number; height: number; size: number }> {
  const dir = dirname(savePath);
  await mkdir(dir, { recursive: true });

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 10000 });

    await page.evaluate(() => {
      document.body.style.display = "inline-block";
    });

    const body = await page.$("body");
    const box = await body!.boundingBox();

    await page.setViewport({
      width: Math.ceil(box!.width + box!.x * 2),
      height: Math.ceil(box!.height + box!.y * 2),
      deviceScaleFactor: scale,
    });

    await page.screenshot({
      path: savePath,
      type: "png",
      omitBackground: true,
      fullPage: true,
    });

    const stats = await stat(savePath);
    return {
      path: savePath,
      width: Math.ceil(box!.width),
      height: Math.ceil(box!.height),
      size: stats.size,
    };
  } finally {
    await page.close();
  }
}

// ── Screenshot Storage ─────────────────────────────────────────────────

const DEFAULT_DIR = process.env.TERMINAL_MCP_DIR || join(homedir(), "terminal-screenshots");
const captures = new Map<string, Capture>();
let lastCaptureId: string | null = null;

function getScreenshotDir(): string {
  return DEFAULT_DIR;
}

function generateFilename(command: string, ext: string = "png"): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  const cmd = command
    .split(" ")[0]
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .slice(0, 30);
  return `${ts}_${cmd}.${ext}`;
}

// ── MCP Server ─────────────────────────────────────────────────────────

const server = new Server(
  { name: "terminal-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "terminal_exec",
      description:
        "Execute any shell command and capture its full output with ANSI colors. Returns output text and a capture ID for later screenshot. Use terminal_exec_screenshot instead if you want the image immediately.",
      inputSchema: {
        type: "object" as const,
        properties: {
          command: { type: "string", description: "Shell command to execute" },
          cwd: { type: "string", description: "Working directory (optional)" },
          timeout: {
            type: "number",
            description: "Timeout in milliseconds (default: 30000)",
          },
        },
        required: ["command"],
      },
    },
    {
      name: "terminal_screenshot",
      description:
        "Render a captured command output as a terminal-styled PNG screenshot. Uses the last capture if no ID given.",
      inputSchema: {
        type: "object" as const,
        properties: {
          capture_id: {
            type: "string",
            description: "ID of the capture to render (default: last capture)",
          },
          save_path: {
            type: "string",
            description: "Full path to save the PNG (default: auto-generated in ~/terminal-screenshots/)",
          },
          theme: {
            type: "string",
            enum: ["tokyonight", "dracula", "monokai", "catppuccin", "hacker", "macos", "kali", "nord", "gruvbox", "solarized", "onedark", "material", "ayu", "github", "cobalt", "parrot", "ubuntu", "powershell", "retro", "light"],
            description: "Terminal color theme (default: tokyonight)",
          },
          show_chrome: {
            type: "boolean",
            description: "Show macOS window chrome with traffic lights (default: true)",
          },
          font_size: {
            type: "number",
            description: "Font size in pixels (default: 14)",
          },
          title: {
            type: "string",
            description: "Custom window title (default: command name)",
          },
          prompt: {
            type: "string",
            description: "Custom prompt string (default: '$ ')",
          },
          show_timestamp: {
            type: "boolean",
            description: "Show timestamp in footer (default: true)",
          },
          watermark: {
            type: "string",
            description: "Watermark text in bottom-right corner",
          },
          width: {
            type: "number",
            description: "Fixed terminal width in pixels (default: auto, max 980)",
          },
          max_width: {
            type: "number",
            description: "Maximum terminal width in pixels (default: 980)",
          },
          max_lines: {
            type: "number",
            description: "Maximum output lines to render, truncates the rest",
          },
          line_height: {
            type: "number",
            description: "Line height multiplier (default: 1.4)",
          },
          scale: {
            type: "number",
            description: "Screenshot scale factor, 1 = 1x, 2 = 2x retina (default: 2)",
          },
          compact: {
            type: "boolean",
            description: "Compact mode: reduced padding and spacing (default: false)",
          },
        },
      },
    },
    {
      name: "terminal_exec_screenshot",
      description:
        "Execute a command and capture a single PNG screenshot of its full output. One command = one image. This is the primary tool — use it for any shell command (pentest, sysadmin, dev, networking, etc).",
      inputSchema: {
        type: "object" as const,
        properties: {
          command: { type: "string", description: "Shell command to execute" },
          cwd: { type: "string", description: "Working directory (optional)" },
          timeout: { type: "number", description: "Timeout in ms (default: 30000)" },
          save_path: { type: "string", description: "Full path for PNG output" },
          theme: {
            type: "string",
            enum: ["tokyonight", "dracula", "monokai", "catppuccin", "hacker", "macos", "kali", "nord", "gruvbox", "solarized", "onedark", "material", "ayu", "github", "cobalt", "parrot", "ubuntu", "powershell", "retro", "light"],
          },
          show_chrome: { type: "boolean" },
          font_size: { type: "number" },
          title: { type: "string" },
          prompt: { type: "string" },
          show_timestamp: { type: "boolean" },
          watermark: { type: "string" },
          width: { type: "number", description: "Fixed terminal width in pixels" },
          max_width: { type: "number", description: "Maximum terminal width (default: 980)" },
          max_lines: { type: "number", description: "Maximum output lines to render" },
          line_height: { type: "number", description: "Line height multiplier (default: 1.4)" },
          scale: { type: "number", description: "Scale factor 1-3 (default: 2)" },
          compact: { type: "boolean", description: "Compact mode: less padding" },
        },
        required: ["command"],
      },
    },
    {
      name: "terminal_screenshot_text",
      description:
        "Render arbitrary text as a terminal-styled PNG screenshot. Useful for manually composed output.",
      inputSchema: {
        type: "object" as const,
        properties: {
          text: { type: "string", description: "Text content to render" },
          title: { type: "string", description: "Window title (default: 'Terminal')" },
          command: { type: "string", description: "Command to show in prompt line (optional)" },
          save_path: { type: "string", description: "Full path for PNG output" },
          theme: {
            type: "string",
            enum: ["tokyonight", "dracula", "monokai", "catppuccin", "hacker", "macos", "kali", "nord", "gruvbox", "solarized", "onedark", "material", "ayu", "github", "cobalt", "parrot", "ubuntu", "powershell", "retro", "light"],
          },
          show_chrome: { type: "boolean" },
          font_size: { type: "number" },
          watermark: { type: "string" },
          width: { type: "number", description: "Fixed terminal width in pixels" },
          max_width: { type: "number", description: "Maximum terminal width (default: 980)" },
          max_lines: { type: "number", description: "Maximum output lines to render" },
          line_height: { type: "number", description: "Line height multiplier (default: 1.4)" },
          scale: { type: "number", description: "Scale factor 1-3 (default: 2)" },
          compact: { type: "boolean", description: "Compact mode: less padding" },
        },
        required: ["text"],
      },
    },
    {
      name: "terminal_list_captures",
      description: "List all captured command outputs in the current session.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "terminal_list_screenshots",
      description: "List all saved screenshot files from the screenshots directory.",
      inputSchema: {
        type: "object" as const,
        properties: {
          directory: {
            type: "string",
            description: "Directory to list (default: ~/terminal-screenshots/)",
          },
        },
      },
    },
    {
      name: "terminal_themes",
      description: "List all available terminal themes with preview colors.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case "terminal_exec": {
        const capture = await executeCommand(
          args.command as string,
          args.cwd as string | undefined,
          args.timeout as number | undefined,
        );
        captures.set(capture.id, capture);
        lastCaptureId = capture.id;

        const outputPreview =
          capture.output.length > 2000
            ? capture.output.slice(0, 2000) + `\n... [truncated, ${capture.output.length} chars total]`
            : capture.output;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  capture_id: capture.id,
                  command: capture.command,
                  exit_code: capture.exitCode,
                  duration_ms: capture.duration,
                  output_length: capture.output.length,
                  output: outputPreview,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "terminal_screenshot": {
        const captureId = (args.capture_id as string) || lastCaptureId;
        if (!captureId || !captures.has(captureId)) {
          return {
            content: [{ type: "text", text: "Error: no capture found. Run terminal_exec first." }],
            isError: true,
          };
        }

        const capture = captures.get(captureId)!;
        const theme = THEMES[(args.theme as string) || "tokyonight"];
        const savePath =
          (args.save_path as string) ||
          join(getScreenshotDir(), generateFilename(capture.command));

        const html = buildTerminalHtml(capture, theme, {
          showChrome: args.show_chrome as boolean | undefined,
          fontSize: args.font_size as number | undefined,
          title: args.title as string | undefined,
          prompt: args.prompt as string | undefined,
          showTimestamp: args.show_timestamp as boolean | undefined,
          watermark: args.watermark as string | undefined,
          width: args.width as number | undefined,
          maxWidth: (args.max_width as number | undefined) || 980,
          maxLines: args.max_lines as number | undefined,
          lineHeight: args.line_height as number | undefined,
          compact: args.compact as boolean | undefined,
        });

        const result = await renderScreenshot(html, savePath, (args.scale as number) || 2);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  screenshot_path: result.path,
                  dimensions: `${result.width}x${result.height}`,
                  file_size: `${(result.size / 1024).toFixed(1)} KB`,
                  theme: theme.name,
                  capture_id: captureId,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "terminal_exec_screenshot": {
        const capture = await executeCommand(
          args.command as string,
          args.cwd as string | undefined,
          args.timeout as number | undefined,
        );
        captures.set(capture.id, capture);
        lastCaptureId = capture.id;

        const theme = THEMES[(args.theme as string) || "tokyonight"];
        const savePath =
          (args.save_path as string) ||
          join(getScreenshotDir(), generateFilename(capture.command));

        const html = buildTerminalHtml(capture, theme, {
          showChrome: args.show_chrome as boolean | undefined,
          fontSize: args.font_size as number | undefined,
          title: args.title as string | undefined,
          prompt: args.prompt as string | undefined,
          showTimestamp: args.show_timestamp as boolean | undefined,
          watermark: args.watermark as string | undefined,
          width: args.width as number | undefined,
          maxWidth: (args.max_width as number | undefined) || 980,
          maxLines: args.max_lines as number | undefined,
          lineHeight: args.line_height as number | undefined,
          compact: args.compact as boolean | undefined,
        });

        const result = await renderScreenshot(html, savePath, (args.scale as number) || 2);

        const outputPreview =
          capture.output.length > 1500
            ? capture.output.slice(0, 1500) + `\n... [truncated]`
            : capture.output;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  capture_id: capture.id,
                  command: capture.command,
                  exit_code: capture.exitCode,
                  duration_ms: capture.duration,
                  screenshot_path: result.path,
                  dimensions: `${result.width}x${result.height}`,
                  file_size: `${(result.size / 1024).toFixed(1)} KB`,
                  theme: theme.name,
                  output: outputPreview,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "terminal_screenshot_text": {
        const theme = THEMES[(args.theme as string) || "tokyonight"];
        const savePath =
          (args.save_path as string) ||
          join(getScreenshotDir(), generateFilename(args.title as string || "text"));

        const pseudoCapture = {
          command: (args.command as string) || "",
          output: args.text as string,
          timestamp: new Date().toISOString().replace("T", " ").replace(/\.\d+Z/, " UTC"),
        };

        const html = buildTerminalHtml(pseudoCapture, theme, {
          showChrome: args.show_chrome as boolean | undefined,
          fontSize: args.font_size as number | undefined,
          title: args.title as string | undefined,
          watermark: args.watermark as string | undefined,
          width: args.width as number | undefined,
          maxWidth: (args.max_width as number | undefined) || 980,
          maxLines: args.max_lines as number | undefined,
          lineHeight: args.line_height as number | undefined,
          compact: args.compact as boolean | undefined,
        });

        const result = await renderScreenshot(html, savePath, (args.scale as number) || 2);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  screenshot_path: result.path,
                  dimensions: `${result.width}x${result.height}`,
                  file_size: `${(result.size / 1024).toFixed(1)} KB`,
                  theme: theme.name,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "terminal_list_captures": {
        const list = Array.from(captures.values()).map((c) => ({
          id: c.id,
          command: c.command,
          exit_code: c.exitCode,
          timestamp: c.timestamp,
          output_length: c.output.length,
          duration_ms: c.duration,
        }));

        return {
          content: [
            {
              type: "text",
              text: list.length > 0
                ? JSON.stringify(list, null, 2)
                : "No captures in current session. Run terminal_exec first.",
            },
          ],
        };
      }

      case "terminal_list_screenshots": {
        const dir = (args.directory as string) || getScreenshotDir();
        try {
          const files = await readdir(dir);
          const pngFiles = files.filter((f) => f.endsWith(".png")).sort().reverse();

          const details = await Promise.all(
            pngFiles.slice(0, 50).map(async (f) => {
              const s = await stat(join(dir, f));
              return {
                file: f,
                path: join(dir, f),
                size: `${(s.size / 1024).toFixed(1)} KB`,
                created: s.birthtime.toISOString(),
              };
            }),
          );

          return {
            content: [
              {
                type: "text",
                text: details.length > 0
                  ? JSON.stringify(details, null, 2)
                  : `No screenshots found in ${dir}`,
              },
            ],
          };
        } catch {
          return {
            content: [
              {
                type: "text",
                text: `Directory not found: ${dir}. Run a screenshot first to create it.`,
              },
            ],
          };
        }
      }

      case "terminal_themes": {
        const themeList = Object.entries(THEMES).map(([key, t]) => ({
          id: key,
          name: t.name,
          background: t.bg,
          foreground: t.fg,
          prompt_color: t.promptColor,
          accent: t.colors[4],
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(themeList, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}\n${error.stack || ""}`,
        },
      ],
      isError: true,
    };
  }
});

// ── Cleanup ────────────────────────────────────────────────────────────

async function cleanup() {
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch {}
  }
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// ── Start ──────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("terminal-mcp server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
