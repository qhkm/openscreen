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

export class CursorRenderer {
  private container: PIXI.Container;
  private cursorGraphics: PIXI.Graphics;
  private clickEffectsContainer: PIXI.Container;
  private activeClickEffects: ClickEffectInstance[] = [];
  private settings: CursorSettings;
  private trackingData: MouseTrackingEvent[] = [];
  private screenBounds = { width: 1920, height: 1080 };
  private videoLayout = { scale: 1, offsetX: 0, offsetY: 0 };

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

  setTrackingData(data: MouseTrackingEvent[], videoWidth: number, videoHeight: number, sourceBounds?: SourceBounds | null) {
    // Normalize timestamps and map coordinates from screen space to video space
    // sourceBounds: the recorded video dimensions (in physical pixels)
    // Mouse coordinates from uiohook are in logical/screen coordinates (CSS points on macOS)
    // We need to apply device pixel ratio to convert logical → physical pixels

    if (data.length > 0) {
      const firstTimestamp = data[0].timestamp;

      // If we have source bounds (video stream dimensions), calculate the proper scale
      if (sourceBounds && sourceBounds.width > 0 && sourceBounds.height > 0) {
        // sourceBounds = video stream dimensions (may be physical pixels on Retina)
        // videoWidth/videoHeight = actual encoded video dimensions
        // Mouse coordinates are in logical screen pixels
        //
        // The key insight: sourceBounds may be 2x the actual video dimensions on Retina
        // because the stream reports physical pixels but video encodes at logical resolution
        //
        // Scale factor = videoWidth / (sourceBounds.width / dpr) = videoWidth * dpr / sourceBounds.width
        // But if video is at logical resolution, this simplifies to just: videoWidth / logicalWidth
        //
        // Since mouse coords are logical and video is also at logical resolution (1470x956),
        // we need: scaleX = videoWidth / (sourceBounds.width / dpr)

        const dpr = window.devicePixelRatio || 2;
        // Convert source bounds from physical to logical pixels
        const logicalSourceWidth = sourceBounds.width / dpr;
        const logicalSourceHeight = sourceBounds.height / dpr;

        // Scale from logical mouse coords to video coords
        const scaleX = videoWidth / logicalSourceWidth;
        const scaleY = videoHeight / logicalSourceHeight;

        console.log('Tracking data with source bounds:', {
          sourceBounds,
          videoSize: { width: videoWidth, height: videoHeight },
          dpr,
          logicalSource: { width: logicalSourceWidth, height: logicalSourceHeight },
          scaleFactors: { x: scaleX, y: scaleY },
        });

        this.trackingData = data.map(event => ({
          ...event,
          timestamp: (event.timestamp - firstTimestamp) * 1000,
          // Map logical screen coordinates to video coordinates
          x: (event.x - sourceBounds.x / dpr) * scaleX,
          y: (event.y - sourceBounds.y / dpr) * scaleY,
        }));
      } else {
        // No source bounds - use heuristic based on mouse movement range
        // Find the bounding box of all mouse positions
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const event of data) {
          if (event.x < minX) minX = event.x;
          if (event.y < minY) minY = event.y;
          if (event.x > maxX) maxX = event.x;
          if (event.y > maxY) maxY = event.y;
        }

        const mouseRangeX = maxX - minX;
        const mouseRangeY = maxY - minY;

        // Calculate scale factors to map mouse range to video dimensions
        const scaleX = videoWidth / Math.max(mouseRangeX, 1);
        const scaleY = videoHeight / Math.max(mouseRangeY, 1);

        console.log('Tracking data without source bounds (heuristic):', {
          mouseRange: { minX, maxX, minY, maxY, rangeX: mouseRangeX, rangeY: mouseRangeY },
          videoSize: { width: videoWidth, height: videoHeight },
          scaleFactors: { x: scaleX, y: scaleY },
        });

        this.trackingData = data.map(event => ({
          ...event,
          timestamp: (event.timestamp - firstTimestamp) * 1000,
          // Map using bounding box as estimated source bounds
          x: (event.x - minX) * scaleX,
          y: (event.y - minY) * scaleY,
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
    this.screenBounds = { width: videoWidth, height: videoHeight };
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

    // Find the mouse position at current time using interpolation
    const position = this.interpolatePosition(currentTimeMs);

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

      // Check for click events near current time
      this.checkForClicks(currentTimeMs, scale, offsetX, offsetY);
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
    // Look for click events within a small window around current time
    const windowStart = this.lastCheckedTime;
    const windowEnd = currentTimeMs;

    if (windowEnd <= windowStart) return;

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
