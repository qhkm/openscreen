# Get window bounds by name for OpenScreen
# Usage: powershell -ExecutionPolicy Bypass -File get-window-bounds.ps1 "Window Title"
# Returns JSON: {"name":"...", "process":"...", "x":0, "y":0, "width":800, "height":600}

param(
    [Parameter(Mandatory=$true)]
    [string]$WindowName
)

$ErrorActionPreference = 'SilentlyContinue'

Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Diagnostics;

public class WindowFinder {
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
}
'@

$searchName = $WindowName.ToLower()
$foundWindow = $null

$callback = {
    param([IntPtr]$hWnd, [IntPtr]$lParam)

    if (-not [WindowFinder]::IsWindowVisible($hWnd)) {
        return $true
    }

    $length = [WindowFinder]::GetWindowTextLength($hWnd)
    if ($length -eq 0) {
        return $true
    }

    $sb = New-Object System.Text.StringBuilder($length + 1)
    [WindowFinder]::GetWindowText($hWnd, $sb, $sb.Capacity) | Out-Null
    $title = $sb.ToString()

    if ([string]::IsNullOrEmpty($title)) {
        return $true
    }

    $titleLower = $title.ToLower()
    $isMatch = $titleLower.Contains($searchName) -or $searchName.Contains($titleLower) -or $titleLower -eq $searchName

    if ($isMatch) {
        $rect = New-Object WindowFinder+RECT
        if ([WindowFinder]::GetWindowRect($hWnd, [ref]$rect)) {
            $processId = 0
            [WindowFinder]::GetWindowThreadProcessId($hWnd, [ref]$processId) | Out-Null

            $processName = ""
            try {
                $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
                if ($proc) {
                    $processName = $proc.ProcessName
                }
            } catch {}

            $script:foundWindow = @{
                name = $title
                process = $processName
                x = $rect.Left
                y = $rect.Top
                width = $rect.Right - $rect.Left
                height = $rect.Bottom - $rect.Top
            }
            return $false  # Stop enumeration
        }
    }
    return $true
}

# EnumWindows with callback
$callbackDelegate = [WindowFinder+EnumWindowsProc]$callback
[WindowFinder]::EnumWindows($callbackDelegate, [IntPtr]::Zero) | Out-Null

if ($foundWindow) {
    $foundWindow | ConvertTo-Json -Compress
} else {
    Write-Output "null"
}
