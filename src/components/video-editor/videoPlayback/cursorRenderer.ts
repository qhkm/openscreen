import * as PIXI from 'pixi.js';
import type { CursorSettings, MouseTrackingEvent, SourceBounds } from '../types';

const BASE_CURSOR_SIZE = 24;
const CLICK_EFFECT_DURATION = 400; // ms

interface ClickEffectInstance {
  startTime: number;
  x: number;
  y: number;
  graphics: PIXI.Graphics;
}

// Time offset for cursor sync (disabled for now - JXA approach unreliable)
// const WINDOW_RECORDING_TIME_OFFSET = -100; // ms

export class CursorRenderer {
  private container: PIXI.Container;
  private cursorGraphics: PIXI.Graphics;
  private clickEffectsContainer: PIXI.Container;
  private activeClickEffects: ClickEffectInstance[] = [];
  private settings: CursorSettings;
  private trackingData: MouseTrackingEvent[] = [];
  private videoLayout = { scale: 1, offsetX: 0, offsetY: 0 };
  private isWindowRecording = false;

  constructor(parentContainer: PIXI.Container, settings: CursorSettings) {
    this.settings = settings;

    // Create container for cursor overlay
    this.container = new PIXI.Container();
    this.container.zIndex = 1000;
    parentContainer.addChild(this.container);

    // Click effects layer (behind cursor)
    this.clickEffectsContainer = new PIXI.Container();
    this.container.addChild(this.clickEffectsContainer);

    // Cursor graphics
    this.cursorGraphics = new PIXI.Graphics();
    this.container.addChild(this.cursorGraphics);

    this.drawCursor();
  }

  setSettings(settings: CursorSettings) {
    this.settings = settings;
    this.drawCursor();
  }

  setTrackingData(data: MouseTrackingEvent[], videoWidth: number, videoHeight: number, sourceBounds?: SourceBounds | null, initialMousePosition?: { x: number; y: number } | null) {
    // Normalize timestamps and map coordinates from screen space to video space
    // sourceBounds: the recorded video dimensions (in physical pixels)
    // Mouse coordinates from uiohook are in logical/screen coordinates (CSS points on macOS)
    // We need to apply device pixel ratio to convert logical → physical pixels

    if (data.length > 0) {
      const firstTimestamp = data[0].timestamp;

      // If we have source bounds (video stream dimensions), calculate the proper scale
      if (sourceBounds && sourceBounds.width > 0 && sourceBounds.height > 0) {
        const dpr = window.devicePixelRatio || 2;
        const offsetX = sourceBounds.x;
        const offsetY = sourceBounds.y;

        // Store if this is a window recording for time offset compensation
        this.isWindowRecording = sourceBounds.isWindowRecording || false;

        if (this.isWindowRecording) {
          // Window recording: JXA returns bounds in LOGICAL pixels
          // sourceBounds.x/y = window origin (logical pixels)
          // sourceBounds.width/height = window size (logical pixels)
          // Mouse coordinates from uiohook = logical screen pixels
          // Video dimensions = physical pixels (logical * DPR)

          // For window: position in video = (mouseLogical - windowLogical) * DPR
          // Then scale to video output size
          const windowPhysicalWidth = sourceBounds.width * dpr;
          const windowPhysicalHeight = sourceBounds.height * dpr;
          const videoScaleX = videoWidth / windowPhysicalWidth;
          const videoScaleY = videoHeight / windowPhysicalHeight;

          console.log('Window recording with native bounds:', {
            sourceBounds,
            videoSize: { width: videoWidth, height: videoHeight },
            windowPhysical: { width: windowPhysicalWidth, height: windowPhysicalHeight },
            offset: { x: offsetX, y: offsetY },
            dpr,
            videoScale: { x: videoScaleX, y: videoScaleY },
          });

          this.trackingData = data.map(event => ({
            ...event,
            timestamp: event.timestamp - firstTimestamp,
            // Map mouse coordinates to video coordinates:
            // 1. Subtract window origin (both in logical pixels)
            // 2. Multiply by DPR to convert logical → physical
            // 3. Scale to video dimensions
            x: (event.x - offsetX) * dpr * videoScaleX,
            y: (event.y - offsetY) * dpr * videoScaleY,
          }));
        } else {
          // Screen recording: use display offset for proper mapping
          // sourceBounds.width/height = video stream dimensions (physical pixels, e.g. 2940x1912)
          // sourceBounds.x/y = display origin (logical pixels, 0,0 for primary display)
          // Mouse coordinates from uiohook = logical screen pixels (e.g. 1470x956)

          // Mouse coordinates from uiohook are in logical screen pixels
          // Video/sourceBounds dimensions are in physical pixels
          // To convert: (mouseLogical - offset) * dpr = physical position in video
          const videoScaleX = videoWidth / sourceBounds.width;
          const videoScaleY = videoHeight / sourceBounds.height;

          console.log('Screen recording with native bounds:', {
            sourceBounds,
            videoSize: { width: videoWidth, height: videoHeight },
            offset: { x: offsetX, y: offsetY },
            dpr,
            videoScale: { x: videoScaleX, y: videoScaleY },
          });

          this.trackingData = data.map(event => ({
            ...event,
            timestamp: event.timestamp - firstTimestamp,
            // Map mouse coordinates to video coordinates:
            // 1. Subtract display offset (both in logical pixels)
            // 2. Multiply by DPR to convert logical → physical
            // 3. Scale to video dimensions (usually 1:1)
            x: (event.x - offsetX) * dpr * videoScaleX,
            y: (event.y - offsetY) * dpr * videoScaleY,
          }));
        }
      } else {
        // Window recording: no source bounds from native API
        // Fall back to heuristic approach using mouse movement bounding box
        this.isWindowRecording = true;

        // For window recording, mouse coordinates are in logical pixels (CSS points)
        // Video dimensions are in physical pixels
        // We need to apply DPR to convert logical → physical
        const dpr = window.devicePixelRatio || 2;

        // Find the bounding box of mouse movement
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        for (const event of data) {
          if (event.x < minX) minX = event.x;
          if (event.y < minY) minY = event.y;
          if (event.x > maxX) maxX = event.x;
          if (event.y > maxY) maxY = event.y;
        }

        // Estimate window position: assume minX/minY is near the window origin
        // This works best when user moves cursor to corners during recording
        const estimatedWindowX = minX;
        const estimatedWindowY = minY;

        console.log('Window recording - using heuristic (no native bounds):', {
          videoSize: { width: videoWidth, height: videoHeight },
          mouseRange: { minX, maxX, minY, maxY },
          estimatedWindow: { x: estimatedWindowX, y: estimatedWindowY },
          dpr,
        });

        this.trackingData = data.map(event => ({
          ...event,
          timestamp: event.timestamp - firstTimestamp,
          // Map mouse coordinates to video coordinates:
          // 1. Subtract estimated window origin (both in logical pixels)
          // 2. Multiply by DPR to convert logical → physical
          x: (event.x - estimatedWindowX) * dpr,
          y: (event.y - estimatedWindowY) * dpr,
        }));
      }

      console.log('Normalized tracking data:', {
        originalFirst: { timestamp: data[0].timestamp, x: data[0].x, y: data[0].y },
        normalizedFirst: this.trackingData[0],
        normalizedLast: this.trackingData[this.trackingData.length - 1],
        eventCount: this.trackingData.length,
      });
    } else {
      this.trackingData = data;
    }
  }

  setVideoLayout(scale: number, offsetX: number, offsetY: number) {
    this.videoLayout = { scale, offsetX, offsetY };
  }

  private drawCursor() {
    const g = this.cursorGraphics;
    g.clear();

    if (this.settings.style === 'none') {
      return;
    }

    const size = BASE_CURSOR_SIZE * this.settings.size;
    const color = this.hexToNumber(this.settings.color);

    switch (this.settings.style) {
      case 'default':
        this.drawDefaultCursor(g, size, color);
        break;
      case 'circle':
        this.drawCircleCursor(g, size, color);
        break;
      case 'dot':
        this.drawDotCursor(g, size, color);
        break;
      case 'crosshair':
        this.drawCrosshairCursor(g, size, color);
        break;
    }
  }

  private drawDefaultCursor(g: PIXI.Graphics, size: number, color: number) {
    // Arrow pointer shape
    g.fill({ color, alpha: 1 });
    g.moveTo(0, 0);
    g.lineTo(0, size);
    g.lineTo(size * 0.3, size * 0.75);
    g.lineTo(size * 0.45, size * 1.1);
    g.lineTo(size * 0.6, size * 1.05);
    g.lineTo(size * 0.45, size * 0.7);
    g.lineTo(size * 0.75, size * 0.7);
    g.closePath();
    g.fill();

    // Black outline
    g.stroke({ color: 0x000000, width: 1.5, alpha: 0.8 });
    g.moveTo(0, 0);
    g.lineTo(0, size);
    g.lineTo(size * 0.3, size * 0.75);
    g.lineTo(size * 0.45, size * 1.1);
    g.lineTo(size * 0.6, size * 1.05);
    g.lineTo(size * 0.45, size * 0.7);
    g.lineTo(size * 0.75, size * 0.7);
    g.closePath();
    g.stroke();
  }

  private drawCircleCursor(g: PIXI.Graphics, size: number, color: number) {
    const radius = size / 2;
    // Filled circle with border
    g.fill({ color, alpha: 0.3 });
    g.stroke({ color, width: 2, alpha: 1 });
    g.circle(0, 0, radius);
    g.fill();
    g.stroke();

    // Center dot
    g.fill({ color, alpha: 1 });
    g.circle(0, 0, 3);
    g.fill();
  }

  private drawDotCursor(g: PIXI.Graphics, size: number, color: number) {
    const radius = size / 4;
    g.fill({ color, alpha: 1 });
    g.circle(0, 0, radius);
    g.fill();

    // Subtle glow
    g.fill({ color, alpha: 0.3 });
    g.circle(0, 0, radius * 2);
    g.fill();
  }

  private drawCrosshairCursor(g: PIXI.Graphics, size: number, color: number) {
    const halfSize = size / 2;
    const gap = 4;

    g.stroke({ color, width: 2, alpha: 1 });

    // Horizontal lines
    g.moveTo(-halfSize, 0);
    g.lineTo(-gap, 0);
    g.moveTo(gap, 0);
    g.lineTo(halfSize, 0);

    // Vertical lines
    g.moveTo(0, -halfSize);
    g.lineTo(0, -gap);
    g.moveTo(0, gap);
    g.lineTo(0, halfSize);

    g.stroke();

    // Center dot
    g.fill({ color, alpha: 1 });
    g.circle(0, 0, 2);
    g.fill();
  }

  private hexToNumber(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
  }

  updatePosition(x: number, y: number) {
    this.cursorGraphics.position.set(x, y);
  }

  triggerClickEffect(x: number, y: number) {
    if (this.settings.clickEffect === 'none') return;

    const g = new PIXI.Graphics();
    this.clickEffectsContainer.addChild(g);

    this.activeClickEffects.push({
      startTime: performance.now(),
      x,
      y,
      graphics: g,
    });
  }

  // Update cursor position based on current video time
  updateForTime(currentTimeMs: number) {
    if (this.trackingData.length === 0) return;

    // Apply time offset to compensate for recording latency
    // User-defined offset only - no automatic adjustment
    const userOffset = this.settings.timeOffset || 0;
    const adjustedTimeMs = currentTimeMs + userOffset;

    // Find the mouse position at current time using interpolation
    const position = this.interpolatePosition(adjustedTimeMs);

    if (position) {
      // Convert screen coordinates to video sprite coordinates
      // The cursor position in video space = (mouseX, mouseY) * videoScale + videoOffset
      const { scale, offsetX, offsetY } = this.videoLayout;

      const videoX = position.x * scale + offsetX;
      const videoY = position.y * scale + offsetY;

      // Debug logging (remove later)
      if (Math.random() < 0.01) { // Log 1% of updates to avoid spam
        console.log('Cursor update:', {
          time: currentTimeMs,
          rawPosition: position,
          layout: this.videoLayout,
          finalPosition: { videoX, videoY },
        });
      }

      this.updatePosition(videoX, videoY);

      // Check for click events near current time (using adjusted time)
      this.checkForClicks(adjustedTimeMs, scale, offsetX, offsetY);
    }

    // Update click effects animations
    this.updateClickEffects();
  }

  private interpolatePosition(timeMs: number): { x: number; y: number } | null {
    if (this.trackingData.length === 0) return null;

    // Find the two events surrounding the current time
    let before: MouseTrackingEvent | null = null;
    let after: MouseTrackingEvent | null = null;

    for (let i = 0; i < this.trackingData.length; i++) {
      const event = this.trackingData[i];
      if (event.timestamp <= timeMs) {
        before = event;
      } else {
        after = event;
        break;
      }
    }

    if (!before) {
      // Before first event, use first position
      const first = this.trackingData[0];
      return { x: first.x, y: first.y };
    }

    if (!after) {
      // After last event, use last position
      return { x: before.x, y: before.y };
    }

    // Interpolate between events
    const t = (timeMs - before.timestamp) / (after.timestamp - before.timestamp);
    return {
      x: before.x + (after.x - before.x) * t,
      y: before.y + (after.y - before.y) * t,
    };
  }

  private lastCheckedTime = -1;

  private checkForClicks(currentTimeMs: number, scale: number, offsetX: number, offsetY: number) {
    // Initialize lastCheckedTime on first call
    if (this.lastCheckedTime < 0) {
      this.lastCheckedTime = currentTimeMs;
      return;
    }

    const windowStart = this.lastCheckedTime;
    const windowEnd = currentTimeMs;

    // Skip if going backwards (seeking backwards)
    if (windowEnd <= windowStart) {
      this.lastCheckedTime = currentTimeMs;
      return;
    }

    // Skip if time jumped too much (scrubbing/seeking)
    // Note: timestamps are scaled by 1000, so normal playback ~16-33ms becomes ~16000-33000
    // Use 50000 as threshold (~50ms in real time)
    const timeDelta = windowEnd - windowStart;
    if (timeDelta > 50000) {
      this.lastCheckedTime = currentTimeMs;
      return;
    }

    for (const event of this.trackingData) {
      if (event.type === 'click' || event.type === 'down') {
        if (event.timestamp > windowStart && event.timestamp <= windowEnd) {
          const videoX = event.x * scale + offsetX;
          const videoY = event.y * scale + offsetY;
          this.triggerClickEffect(videoX, videoY);
        }
      }
    }

    this.lastCheckedTime = currentTimeMs;
  }

  private updateClickEffects() {
    const now = performance.now();
    const color = this.hexToNumber(this.settings.clickColor);

    // Update and clean up effects
    this.activeClickEffects = this.activeClickEffects.filter((effect) => {
      const elapsed = now - effect.startTime;
      const progress = elapsed / CLICK_EFFECT_DURATION;

      if (progress >= 1) {
        this.clickEffectsContainer.removeChild(effect.graphics);
        effect.graphics.destroy();
        return false;
      }

      // Draw the click effect based on type and progress
      this.drawClickEffect(effect.graphics, effect.x, effect.y, progress, color);
      return true;
    });
  }

  private drawClickEffect(g: PIXI.Graphics, x: number, y: number, progress: number, color: number) {
    g.clear();

    const easeOut = 1 - Math.pow(1 - progress, 3);
    const fadeOut = 1 - progress;

    switch (this.settings.clickEffect) {
      case 'ripple': {
        const maxRadius = 40 * this.settings.size;
        const radius = maxRadius * easeOut;
        g.stroke({ color, width: 3, alpha: fadeOut * 0.8 });
        g.circle(x, y, radius);
        g.stroke();

        // Inner ripple
        const innerRadius = maxRadius * 0.6 * easeOut;
        g.stroke({ color, width: 2, alpha: fadeOut * 0.5 });
        g.circle(x, y, innerRadius);
        g.stroke();
        break;
      }

      case 'pulse': {
        const maxRadius = 30 * this.settings.size;
        const radius = maxRadius * (0.5 + easeOut * 0.5);
        g.fill({ color, alpha: fadeOut * 0.4 });
        g.circle(x, y, radius);
        g.fill();
        break;
      }

      case 'ring': {
        const maxRadius = 35 * this.settings.size;
        const radius = maxRadius * easeOut;
        const thickness = 4 * (1 - progress * 0.5);
        g.stroke({ color, width: thickness, alpha: fadeOut });
        g.circle(x, y, radius);
        g.stroke();
        break;
      }
    }
  }

  setVisible(visible: boolean) {
    this.container.visible = visible;
  }

  resetClickTracking() {
    this.lastCheckedTime = -1;
    // Clean up existing effects
    for (const effect of this.activeClickEffects) {
      this.clickEffectsContainer.removeChild(effect.graphics);
      effect.graphics.destroy();
    }
    this.activeClickEffects = [];
  }

  destroy() {
    // Clean up click effects
    for (const effect of this.activeClickEffects) {
      effect.graphics.destroy();
    }
    this.activeClickEffects = [];

    this.cursorGraphics.destroy();
    this.clickEffectsContainer.destroy({ children: true });
    this.container.destroy({ children: true });
  }
}
