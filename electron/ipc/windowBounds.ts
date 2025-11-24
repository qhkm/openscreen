import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { app } from 'electron';

const execAsync = promisify(exec);

// Timeout for script calls (ms) - increased for reliability
const SCRIPT_TIMEOUT = 5000;

/**
 * Get the path to the PowerShell script for Windows
 * Works in both dev and production (packaged) modes
 * ONLY call this function on Windows!
 */
function getWindowsScriptPath(): string {
  // Safety check - should never be called on non-Windows
  if (process.platform !== 'win32') {
    throw new Error('getWindowsScriptPath should only be called on Windows');
  }

  if (app.isPackaged) {
    // In production, scripts are in resources folder
    // process.resourcesPath uses backslashes on Windows, path.join handles this
    return path.join(process.resourcesPath, 'scripts', 'get-window-bounds.ps1');
  } else {
    // In development, __dirname is dist-electron/ (compiled JS location)
    // Scripts are in electron/scripts/, so use app.getAppPath() for reliable resolution
    return path.join(app.getAppPath(), 'electron', 'scripts', 'get-window-bounds.ps1');
  }
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowInfo {
  name: string;
  process: string;
  bounds: WindowBounds;
}

/**
 * Get window bounds for a specific window by name using JXA
 * This is faster than enumerating all windows
 */
async function getWindowByNameMacOS(windowName: string): Promise<WindowInfo | null> {
  // Escape the window name for use in JXA
  const escapedName = windowName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const script = `
var sysEvents = Application("System Events");
var procs = sysEvents.applicationProcesses.whose({backgroundOnly: false});
var result = null;
var searchName = "${escapedName}";

for (var i = 0; i < procs.length && !result; i++) {
  try {
    var proc = procs[i];
    var wins = proc.windows();
    for (var j = 0; j < wins.length; j++) {
      var w = wins[j];
      var wName = w.name();
      if (wName === searchName || wName.indexOf(searchName) >= 0 || searchName.indexOf(wName) >= 0) {
        var pos = w.position();
        var size = w.size();
        result = {
          name: wName,
          process: proc.name(),
          x: pos[0],
          y: pos[1],
          width: size[0],
          height: size[1]
        };
        break;
      }
    }
  } catch(e) {}
}
JSON.stringify(result);
`;

  try {
    const { stdout } = await execAsync(
      `osascript -l JavaScript -e '${script.replace(/'/g, "'\\''")}'`,
      { timeout: SCRIPT_TIMEOUT }
    );
    const window = JSON.parse(stdout.trim());
    if (window) {
      return {
        name: window.name || '',
        process: window.process || '',
        bounds: {
          x: window.x,
          y: window.y,
          width: window.width,
          height: window.height,
        },
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to get window via JXA:', error);
    return null;
  }
}

/**
 * Get window bounds for a specific window by name using PowerShell (Windows 10/11)
 * Uses a separate script file with Win32 API via .NET
 * More reliable than inline script - works across all Windows hardware configurations
 */
async function getWindowByNameWindows(windowName: string): Promise<WindowInfo | null> {
  const scriptPath = getWindowsScriptPath();
  // Escape the window name for PowerShell argument
  const escapedName = windowName.replace(/"/g, '""');

  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}" "${escapedName}"`,
      { timeout: SCRIPT_TIMEOUT }
    );

    const trimmed = stdout.trim();
    if (trimmed && trimmed !== 'null') {
      const window = JSON.parse(trimmed);
      if (window) {
        return {
          name: window.name || '',
          process: window.process || '',
          bounds: {
            x: window.x,
            y: window.y,
            width: window.width,
            height: window.height,
          },
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to get window via PowerShell:', error);
    return null;
  }
}

/**
 * Find window bounds by matching window name from desktopCapturer source
 *
 * Platform-specific implementations:
 * - macOS: Uses JXA (JavaScript for Automation) via osascript
 * - Windows: Uses PowerShell with Win32 API (works on Windows 10/11)
 */
export async function getWindowBoundsByName(windowName: string): Promise<WindowBounds | null> {
  console.log(`Searching for window: "${windowName}" on ${process.platform}`);

  let match: WindowInfo | null = null;

  if (process.platform === 'darwin') {
    match = await getWindowByNameMacOS(windowName);
  } else if (process.platform === 'win32') {
    match = await getWindowByNameWindows(windowName);
  } else {
    console.log('Window bounds API not available on this platform');
    return null;
  }

  if (match) {
    console.log(`Found window match: "${match.name}" (${match.process})`, match.bounds);
    return match.bounds;
  }

  console.log('No matching window found for:', windowName);
  return null;
}

/**
 * Get all windows for debugging
 * Note: Not implemented yet - returns empty array on all platforms
 */
export async function getAllWindows(): Promise<WindowInfo[]> {
  // Not implemented yet - returns empty array
  // Can be implemented if needed for debugging
  return [];
}
