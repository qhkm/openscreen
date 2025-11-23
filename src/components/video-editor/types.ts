export type ZoomDepth = 1 | 2 | 3 | 4 | 5;

export interface ZoomFocus {
  cx: number; // normalized horizontal center (0-1)
  cy: number; // normalized vertical center (0-1)
}

export interface ZoomRegion {
  id: string;
  startMs: number;
  endMs: number;
  depth: ZoomDepth;
  focus: ZoomFocus;
}

export interface CropRegion {
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
  width: number; // 0-1 normalized
  height: number; // 0-1 normalized
}

export const DEFAULT_CROP_REGION: CropRegion = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

export const ZOOM_DEPTH_SCALES: Record<ZoomDepth, number> = {
  1: 1.25,
  2: 1.5,
  3: 1.8,
  4: 2.2,
  5: 3.5,
};

export const DEFAULT_ZOOM_DEPTH: ZoomDepth = 3;

export function clampFocusToDepth(focus: ZoomFocus, _depth: ZoomDepth): ZoomFocus {
  return {
    cx: clamp(focus.cx, 0, 1),
    cy: clamp(focus.cy, 0, 1),
  };
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

// =====================================
// Cursor Overlay Types
// =====================================

export type CursorStyle = 'none' | 'default' | 'circle' | 'dot' | 'crosshair';

export type ClickEffect = 'none' | 'ripple' | 'pulse' | 'ring';

export interface CursorSettings {
  style: CursorStyle;
  size: number; // Size multiplier (0.5 - 2.0)
  color: string; // Hex color for cursor
  clickEffect: ClickEffect;
  clickColor: string; // Hex color for click effect
}

export const DEFAULT_CURSOR_SETTINGS: CursorSettings = {
  style: 'default',
  size: 1,
  color: '#FFFFFF',
  clickEffect: 'ripple',
  clickColor: '#34B27B',
};

export const CURSOR_STYLE_OPTIONS: Array<{ value: CursorStyle; label: string }> = [
  { value: 'none', label: 'Hidden' },
  { value: 'default', label: 'Default' },
  { value: 'circle', label: 'Circle' },
  { value: 'dot', label: 'Dot' },
  { value: 'crosshair', label: 'Crosshair' },
];

export const CLICK_EFFECT_OPTIONS: Array<{ value: ClickEffect; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'ripple', label: 'Ripple' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'ring', label: 'Ring' },
];

// Mouse tracking event from recording
export interface MouseTrackingEvent {
  type: 'move' | 'down' | 'up' | 'click';
  timestamp: number; // ms since recording started
  x: number; // screen X coordinate
  y: number; // screen Y coordinate
  button?: number;
  clicks?: number;
}

// Source bounds for coordinate mapping
export interface SourceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
