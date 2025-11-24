# OpenScreen Architecture

## Video Editor Screen Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ● ● ●                                                          (Title Bar)     │
├────────────────────────────────────────────────┬────────────────────────────────┤
│                                                │                                │
│  ┌──────────────────────────────────────────┐  │  SETTINGS PANEL (Right)        │
│  │                                          │  │                                │
│  │        VIDEO PREVIEW (PixiJS)            │  │  Zoom Level                    │
│  │   - Shows recording with wallpaper       │  │  [1.25x][1.5x][1.8x][2.2x][3.5x]│
│  │   - Live zoom/pan effects                │  │                                │
│  │   - Drop shadow & blur applied here      │  │  Drop Shadow        [ON]       │
│  │                                          │  │  Blur Background    [ON]       │
│  └──────────────────────────────────────────┘  │                                │
│                                                │  [Crop Video]                  │
│  [▶ Play] ════●════════════════ 0:04 / 0:06   │                                │
│           (PLAYBACK CONTROLS)                  │  Background:                   │
│                                                │  [Image] [Color] [Gradient]    │
├────────────────────────────────────────────────┤                                │
│                                                │  [wallpaper thumbnails grid]   │
│  [+ Add Zoom]          [⌘+⌘+Scroll] [⌘+Scroll] │                                │
│                              Pan      Zoom     │                                │
│  ─────────────────────────────────────────────│                                │
│  0:00  0:01  0:02  0:03  0:04  0:05  0:06     │  [Export Video]                │
│        ┌─────────────────┐                     │                                │
│        │   🔍 1.25x      │  ← ZOOM REGION      │  [Report a Bug]                │
│        └─────────────────┘    (draggable)      │                                │
│            TIMELINE EDITOR                     │                                │
└────────────────────────────────────────────────┴────────────────────────────────┘
```

## Component Mapping

| UI Area | Component File | Purpose |
|---------|---------------|---------|
| **Video Preview** | `src/components/video-editor/VideoPlayback.tsx` | PixiJS canvas showing the recording with effects |
| **Playback Controls** | `src/components/video-editor/PlaybackControls.tsx` | Play/pause button, seek slider, time display |
| **Timeline Editor** | `src/components/video-editor/timeline/TimelineEditor.tsx` | Add/drag zoom regions, scrub through video |
| **Zoom Region** | `src/components/video-editor/timeline/Item.tsx` | The draggable "1.25x" box defining when zoom effect happens |
| **Settings Panel** | `src/components/video-editor/SettingsPanel.tsx` | Zoom depth, shadow, blur, crop, wallpaper selection |
| **Export Dialog** | `src/components/video-editor/ExportDialog.tsx` | Export progress UI triggered by "Export Video" button |
| **Crop Control** | `src/components/video-editor/CropControl.tsx` | Crop region adjustment UI |

## Source Selector Screen

This popup appears when choosing what to record:

```
┌─────────────────────────────────────────┐
│  [Screens]          [Windows]           │  ← Tab switcher
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────┐  ┌─────────┐               │
│  │ Screen 1│  │ Screen 2│               │  ← Thumbnails of available
│  │  thumb  │  │  thumb  │               │     screens/windows
│  └─────────┘  └─────────┘               │
│                                         │
├─────────────────────────────────────────┤
│      [Cancel]         [Share]           │  ← Action buttons
└─────────────────────────────────────────┘
```

| UI Area | Component File | Purpose |
|---------|---------------|---------|
| **Source Selector** | `src/components/launch/SourceSelector.tsx` | Screen/window picker popup |
| **Launch Window** | `src/components/launch/LaunchWindow.tsx` | Recording controls overlay (HUD) |

## Video Export Pipeline

```
┌─────────────┐    ┌──────────────┐    ┌───────────────┐    ┌─────────┐
│ VideoDecoder│ -> │ FrameRenderer│ -> │    Muxer      │ -> │  MP4    │
│  (WebCodecs)│    │   (PixiJS)   │    │ (mp4-muxer)   │    │  File   │
└─────────────┘    └──────────────┘    └───────────────┘    └─────────┘
      │                   │                    │
      │ Extract frames    │ Apply effects      │ Encode H.264
      │ from WebM         │ (zoom, shadow,     │ and mux to MP4
      │                   │  blur, wallpaper)  │
```

| Pipeline Stage | File | Purpose |
|---------------|------|---------|
| **Video Exporter** | `src/lib/exporter/videoExporter.ts` | Orchestrates frame-by-frame export |
| **Video Decoder** | `src/lib/exporter/videoDecoder.ts` | WebCodecs-based frame extraction |
| **Frame Renderer** | `src/lib/exporter/frameRenderer.ts` | PixiJS offscreen rendering with effects |
| **Muxer** | `src/lib/exporter/muxer.ts` | MP4 muxing via mp4-muxer library |

## Timeline Editor Glossary

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  0:00      0:01      0:02      0:03      0:04      0:05      0:06              │ ← TIME RULER
├───┬─────────────────────────────────────────────────────────────────────────────┤
│   │                                                                             │
│   │  ┌─────────────────────────────┐                                            │
│ P │  │                             │                                            │
│ L │  │      ZOOM REGION            │         EMPTY TRACK AREA                   │ ← TRACK ROW
│ A │  │      (1.8x zoom item)       │         (click to seek)                    │
│ Y │  │                             │                                            │
│ H │  └─────────────────────────────┘                                            │
│ E │                                                                             │
│ A ├─────────────────────────────────────────────────────────────────────────────┤
│ D │                                                                             │
│   │                            LOWER TRACK AREA                                 │ ← EMPTY SPACE
│   │                            (click to seek)                                  │
│   │                                                                             │
└───┴─────────────────────────────────────────────────────────────────────────────┘
  ↑
  PLAYHEAD (green vertical line showing current playback position)
```

### Terminology

| Term | Description |
|------|-------------|
| **Playhead** | The green vertical line with diamond top indicator. Shows current playback time. Click anywhere on timeline to move it. |
| **Time Ruler** | Top bar showing time markers (0:00, 0:01, etc.). Helps you see where you are in the video. |
| **Track Row** | The horizontal lane where zoom regions live. Grey background (`#18181b`). |
| **Zoom Region** | Green draggable box representing a zoom effect. Shows zoom level (e.g., "1.8x"). Can be resized by dragging edges, moved by dragging center. |
| **Empty Track Area** | Space in the track row not covered by a zoom region. Click here to move playhead. |
| **Lower Track Area** | Dark area below the track row. Also clickable to move playhead. |

### Interactions

| Action | Result |
|--------|--------|
| Click empty area | Moves playhead to that time position |
| Click zoom region | Selects the zoom region (shows in Settings Panel) |
| Drag zoom region center | Moves the zoom to different time |
| Drag zoom region edges | Resizes the zoom duration |
| Scroll (⌘ + scroll) | Zoom timeline in/out |
| Scroll (⇧ + ⌘ + scroll) | Pan timeline left/right |

## Electron Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MAIN PROCESS                             │
│  electron/main.ts        - App lifecycle, window management     │
│  electron/windows.ts     - Window factory functions             │
│  electron/ipc/handlers.ts - IPC handlers for all operations     │
│  electron/ipc/mouseTracking.ts - Native mouse tracking          │
├─────────────────────────────────────────────────────────────────┤
│                    PRELOAD SCRIPT                               │
│  electron/preload.ts     - Exposes electronAPI to renderer      │
├─────────────────────────────────────────────────────────────────┤
│                    RENDERER PROCESS                             │
│  src/App.tsx             - Routes to correct window component   │
│                            based on ?windowType= URL param      │
│                                                                 │
│  Window Types:                                                  │
│  - hud-overlay     → LaunchWindow (recording controls)          │
│  - source-selector → SourceSelector (screen picker)             │
│  - editor          → VideoEditor (main editing UI)              │
└─────────────────────────────────────────────────────────────────┘
```
