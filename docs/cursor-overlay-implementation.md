# Cursor Overlay Implementation

## Overview

This document describes the cursor overlay feature that renders a custom cursor on top of recorded videos, synchronized with mouse tracking data captured during recording.

## Problem Solved

When recording a screen or window, the system cursor is often not captured or appears inconsistent. This feature:
1. Tracks mouse movements during recording using `uiohook-napi`
2. Renders a customizable cursor overlay during video playback
3. Handles coordinate mapping between screen space and video space

## Architecture

```
Recording Flow:
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ useScreenRecorder│────▶│ Mouse Tracking   │────▶│ JSON Storage    │
│ (renderer)      │     │ (main process)   │     │ (with bounds)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │
        ▼
┌─────────────────┐
│ setSourceBounds │  ◀── Video stream dimensions (physical pixels)
└─────────────────┘

Playback Flow:
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ VideoEditor     │────▶│ VideoPlayback    │────▶│ CursorRenderer  │
│ (loads data)    │     │ (passes props)   │     │ (PixiJS)        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Key Files Modified

### Main Process (Electron)

| File | Changes |
|------|---------|
| `electron/ipc/mouseTracking.ts` | Added `SourceBounds` interface, `setSourceBounds()`, `getTrackingDataWithMetadata()` |
| `electron/ipc/handlers.ts` | Added `set-source-bounds` IPC handler, updated tracking data storage/retrieval |
| `electron/preload.ts` | Exposed `setSourceBounds` to renderer |

### Renderer Process

| File | Changes |
|------|---------|
| `src/hooks/useScreenRecorder.ts` | Calls `setSourceBounds` with video stream dimensions |
| `src/components/video-editor/VideoEditor.tsx` | Loads and passes `sourceBounds` state |
| `src/components/video-editor/VideoPlayback.tsx` | Passes `sourceBounds` to CursorRenderer |
| `src/components/video-editor/videoPlayback/cursorRenderer.ts` | **New file** - PixiJS-based cursor rendering |

### Type Definitions

| File | Changes |
|------|---------|
| `src/components/video-editor/types.ts` | Added `SourceBounds`, `CursorSettings`, `MouseTrackingEvent` types |
| `src/vite-env.d.ts` | Added `setSourceBounds` and updated `getMouseTrackingData` return type |
| `electron/electron-env.d.ts` | Mirror of vite-env.d.ts for Electron |

## Coordinate Mapping Challenge

### The Problem

Mouse coordinates from `uiohook-napi` are in **logical screen pixels** (CSS points on macOS), while:
- Video stream reports dimensions in **physical pixels** (e.g., 2940x1912 on Retina)
- Actual encoded video is in **logical pixels** (e.g., 1470x956)

### The Solution

```typescript
// In cursorRenderer.ts
const dpr = window.devicePixelRatio || 2;

// Convert source bounds from physical to logical pixels
const logicalSourceWidth = sourceBounds.width / dpr;
const logicalSourceHeight = sourceBounds.height / dpr;

// Scale from logical mouse coords to video coords (usually 1:1)
const scaleX = videoWidth / logicalSourceWidth;
const scaleY = videoHeight / logicalSourceHeight;

// Map coordinates
x: (event.x - sourceBounds.x / dpr) * scaleX,
y: (event.y - sourceBounds.y / dpr) * scaleY,
```

### Example Values (Retina 2x Display)

| Metric | Value |
|--------|-------|
| Video stream (physical) | 2940 x 1912 |
| Encoded video (logical) | 1470 x 956 |
| Mouse coordinates | ~0-1470, ~0-956 |
| DPR | 2.0 |
| Scale factors | 1.0, 1.0 |

## Tracking Data Format

### New Format (with sourceBounds)
```json
{
  "events": [
    {
      "type": "move",
      "timestamp": 687.603,
      "x": 763,
      "y": 455
    },
    {
      "type": "click",
      "timestamp": 1234.567,
      "x": 800,
      "y": 500,
      "button": 1,
      "clicks": 1
    }
  ],
  "sourceBounds": {
    "x": 0,
    "y": 0,
    "width": 2940,
    "height": 1912
  }
}
```

### Backward Compatibility
Old format (array only) is still supported - falls back to heuristic-based coordinate mapping.

## CursorRenderer Features

### Cursor Styles
- `none` - Hidden
- `default` - Arrow pointer
- `circle` - Circle with center dot
- `dot` - Simple dot with glow
- `crosshair` - Crosshair with center dot

### Click Effects
- `none` - No effect
- `ripple` - Expanding rings
- `pulse` - Pulsing circle
- `ring` - Single expanding ring

### Configuration
```typescript
interface CursorSettings {
  style: CursorStyle;
  size: number;        // 0.5 - 2.0 multiplier
  color: string;       // Hex color for cursor
  clickEffect: ClickEffect;
  clickColor: string;  // Hex color for click effect
}
```

## Data Flow Summary

1. **Recording starts** → `useScreenRecorder` gets video stream
2. **Video dimensions captured** → `videoTrack.getSettings()` returns physical pixel dimensions
3. **Source bounds sent** → `setSourceBounds({ x: 0, y: 0, width, height })`
4. **Mouse events recorded** → uiohook captures logical pixel coordinates
5. **Recording stops** → Data saved with sourceBounds metadata
6. **Editor loads** → Both tracking data and sourceBounds retrieved
7. **Playback** → CursorRenderer maps coordinates using DPR calculation
8. **Cursor rendered** → Position updated each frame via PixiJS ticker

## Export with Cursor

The cursor overlay is also rendered in exported videos. The exporter uses the same coordinate mapping logic as the playback renderer.

### Export Data Flow
1. **VideoEditor** passes `cursorConfig` to `VideoExporter` (if tracking data exists)
2. **VideoExporter** passes `cursorConfig` to `FrameRenderer`
3. **FrameRenderer.setupCursor()** initializes cursor graphics and normalizes tracking data
4. **FrameRenderer.renderFrame()** calls `updateCursorForFrame(timeMs)` before rendering
5. **Cursor is rendered** on top of video using PixiJS, then composited with background/shadows

### Files Modified for Export
| File | Changes |
|------|---------|
| `src/lib/exporter/types.ts` | Added `CursorConfig` interface |
| `src/lib/exporter/videoExporter.ts` | Added `cursorConfig` to config, passes to FrameRenderer |
| `src/lib/exporter/frameRenderer.ts` | Added cursor rendering methods (similar to cursorRenderer.ts) |
| `src/components/video-editor/VideoEditor.tsx` | Passes cursor data to exporter |

## Future Improvements

- [x] Add cursor rendering to video exporter
- [ ] Support window-specific bounds (currently uses full screen bounds)
- [ ] Add smooth cursor interpolation options
- [ ] Support custom cursor images
