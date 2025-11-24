import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// Timeout for osascript calls (ms) - increased for reliability
const OSASCRIPT_TIMEOUT = 5000;

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
      { timeout: OSASCRIPT_TIMEOUT }
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
 * Find window bounds by matching window name from desktopCapturer source
 *
 * Uses optimized JXA script that searches for specific window name
 * instead of enumerating all windows (much faster).
 */
export async function getWindowBoundsByName(windowName: string): Promise<WindowBounds | null> {
  if (process.platform !== 'darwin') {
    console.log('Window bounds API only available on macOS');
    return null;
  }

  console.log(`Searching for window: "${windowName}"`);

  const match = await getWindowByNameMacOS(windowName);

  if (match) {
    console.log(`Found window match: "${match.name}" (${match.process})`, match.bounds);
    return match.bounds;
  }

  console.log('No matching window found for:', windowName);
  return null;
}

/**
 * Get all windows for debugging
 */
export async function getAllWindows(): Promise<WindowInfo[]> {
  if (process.platform !== 'darwin') {
    return [];
  }
  // Not implemented yet - returns empty array
  return [];
}
