# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenScreen is a free, open-source screen recording and video editing desktop app (alternative to Screen Studio). It records screens/apps and allows adding zoom effects, crops, and wallpaper backgrounds before exporting.

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm run dev          # Start development (Vite + Electron)
pnpm run build        # Build for production (tsc + vite + electron-builder)
pnpm run build:mac    # Build macOS DMG specifically
pnpm run lint         # Run ESLint
```

**Important pnpm note:** pnpm v10+ blocks postinstall scripts by default. Electron requires its postinstall to download binaries. If Electron fails to install, ensure `pnpm-workspace.yaml` contains:
```yaml
onlyBuiltDependencies:
  - electron
```

## macOS Permissions

The app requires Screen Recording permission to capture sources. Grant permission via:
**System Settings → Privacy & Security → Screen Recording** → Enable for Electron/Terminal

## Architecture

### Electron Main Process (`electron/`)
- `main.ts` - App entry, window management, tray icon, recordings directory lifecycle
- `windows.ts` - Window factory functions (HUD overlay, source selector, editor)
- `ipc/handlers.ts` - All IPC handlers (screen capture, video storage, mouse tracking)
- `ipc/mouseTracking.ts` - Native mouse position tracking via uiohook-napi
- `preload.ts` - Exposes `electronAPI` to renderer

### React Frontend (`src/`)
Single React app serving 3 window types via URL param `?windowType=`:
- `hud-overlay` - Recording controls overlay (`components/launch/LaunchWindow.tsx`)
- `source-selector` - Screen/window picker (`components/launch/SourceSelector.tsx`)
- `editor` - Main video editor (`components/video-editor/VideoEditor.tsx`)

### Video Editor Components (`src/components/video-editor/`)
- `VideoPlayback.tsx` - PixiJS-based video renderer with zoom/pan effects
- `videoPlayback/` - Utilities for zoom transforms, focus calculation, layout
- `timeline/TimelineEditor.tsx` - Drag-and-drop zoom region timeline (uses dnd-timeline)
- `SettingsPanel.tsx` - Wallpaper, crop, shadow, blur controls
- `ExportDialog.tsx` - Export progress UI

### Video Export Pipeline (`src/lib/exporter/`)
- `videoExporter.ts` - Orchestrates frame-by-frame export
- `videoDecoder.ts` - WebCodecs-based frame extraction
- `frameRenderer.ts` - PixiJS offscreen rendering with effects
- `muxer.ts` - MP4 muxing via mp4-muxer

### Key Data Flow
1. Recording: `desktopCapturer.getSources()` → MediaRecorder → WebM saved to `~/Library/Application Support/openscreen/recordings/`
2. Editing: Load WebM → PixiJS preview with live zoom regions → Timeline manipulation
3. Export: Decode frames → Apply effects per-frame → Encode H.264 → Mux MP4 → Save to Downloads

## Path Alias

`@/` maps to `src/` directory (configured in vite.config.ts)
