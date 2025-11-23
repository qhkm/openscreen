import * as PIXI from 'pixi.js';
import type { ZoomRegion, CropRegion, MouseTrackingEvent } from '@/components/video-editor/types';
import { ZOOM_DEPTH_SCALES } from '@/components/video-editor/types';
import { findDominantRegion } from '@/components/video-editor/videoPlayback/zoomRegionUtils';
import { applyZoomTransform } from '@/components/video-editor/videoPlayback/zoomTransform';
import { DEFAULT_FOCUS, SMOOTHING_FACTOR, MIN_DELTA, VIEWPORT_SCALE } from '@/components/video-editor/videoPlayback/constants';
import { clampFocusToStage as clampFocusToStageUtil } from '@/components/video-editor/videoPlayback/focusUtils';
import type { CursorConfig } from './types';

interface FrameRenderConfig {
  width: number;
  height: number;
  wallpaper: string;
  zoomRegions: ZoomRegion[];
  showShadow: boolean;
  showBlur: boolean;
  cropRegion: CropRegion;
  videoWidth: number;
  videoHeight: number;
  cursorConfig?: CursorConfig;
}

interface AnimationState {
  scale: number;
  focusX: number;
  focusY: number;
}

// Renders video frames with all effects (background, zoom, crop, blur, shadow) to an offscreen canvas for export.

export class FrameRenderer {
  private app: PIXI.Application | null = null;
  private cameraContainer: PIXI.Container | null = null;
  private videoContainer: PIXI.Container | null = null;
  private videoSprite: PIXI.Sprite | null = null;
  private backgroundSprite: PIXI.Sprite | null = null;
  private maskGraphics: PIXI.Graphics | null = null;
  private blurFilter: PIXI.BlurFilter | null = null;
  private shadowCanvas: HTMLCanvasElement | null = null;
  private shadowCtx: CanvasRenderingContext2D | null = null;
  private compositeCanvas: HTMLCanvasElement | null = null;
  private compositeCtx: CanvasRenderingContext2D | null = null;
  private config: FrameRenderConfig;
  private animationState: AnimationState;
  private layoutCache: any = null;
  private currentVideoTime = 0;

  // Cursor rendering state
  private normalizedTrackingData: MouseTrackingEvent[] = [];
  private cursorGraphics: PIXI.Graphics | null = null;
  private clickEffectsContainer: PIXI.Container | null = null;
  private lastClickTime = -1;
  private readonly CLICK_EFFECT_DURATION = 400; // ms
  private readonly BASE_CURSOR_SIZE = 24;

  constructor(config: FrameRenderConfig) {
    this.config = config;
    this.animationState = {
      scale: 1,
      focusX: DEFAULT_FOCUS.cx,
      focusY: DEFAULT_FOCUS.cy,
    };
  }

  async initialize(): Promise<void> {
    // Create offscreen canvas with sRGB color space for fidelity
    const canvas = document.createElement('canvas');
    canvas.width = this.config.width;
    canvas.height = this.config.height;
    
    // Try to set colorSpace if supported (may not be available on all platforms)
    try {
      if (canvas && 'colorSpace' in canvas) {
        // @ts-ignore
        canvas.colorSpace = 'srgb';
      }
    } catch (error) {
      // Silently ignore colorSpace errors on platforms that don't support it
      console.warn('[FrameRenderer] colorSpace not supported on this platform:', error);
    }

    // Initialize PixiJS app with transparent background (background rendered separately)
    this.app = new PIXI.Application();
    await this.app.init({
      canvas,
      width: this.config.width,
      height: this.config.height,
      backgroundAlpha: 0,
      antialias: true,
      resolution: 2,
      autoDensity: true,
    });

    // Setup containers
    this.cameraContainer = new PIXI.Container();
    this.videoContainer = new PIXI.Container();
    this.app.stage.addChild(this.cameraContainer);
    this.cameraContainer.addChild(this.videoContainer);

    // Setup background (render separately, not in PixiJS)
    await this.setupBackground();

    // Setup blur filter for video container
    this.blurFilter = new PIXI.BlurFilter();
    this.blurFilter.quality = 3;
    this.blurFilter.resolution = this.app.renderer.resolution;
    this.blurFilter.blur = 0;
    this.videoContainer.filters = [this.blurFilter];

    // Setup composite canvas for final output with shadows
    this.compositeCanvas = document.createElement('canvas');
    this.compositeCanvas.width = this.config.width;
    this.compositeCanvas.height = this.config.height;
    this.compositeCtx = this.compositeCanvas.getContext('2d', { willReadFrequently: false });
    
    if (!this.compositeCtx) {
      throw new Error('Failed to get 2D context for composite canvas');
    }

    // Setup shadow canvas if needed
    if (this.config.showShadow) {
      this.shadowCanvas = document.createElement('canvas');
      this.shadowCanvas.width = this.config.width;
      this.shadowCanvas.height = this.config.height;
      this.shadowCtx = this.shadowCanvas.getContext('2d', { willReadFrequently: false });
      
      if (!this.shadowCtx) {
        throw new Error('Failed to get 2D context for shadow canvas');
      }
    }

    // Setup mask
    this.maskGraphics = new PIXI.Graphics();
    this.videoContainer.addChild(this.maskGraphics);
    this.videoContainer.mask = this.maskGraphics;

    // Setup cursor overlay
    if (this.config.cursorConfig) {
      this.setupCursor();
    }
  }

  private async setupBackground(): Promise<void> {
    const wallpaper = this.config.wallpaper;

    // Create background canvas for separate rendering (not affected by zoom)
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = this.config.width;
    bgCanvas.height = this.config.height;
    const bgCtx = bgCanvas.getContext('2d')!;

    try {
      // Render background based on type
      if (wallpaper.startsWith('file://') || wallpaper.startsWith('data:') || wallpaper.startsWith('/') || wallpaper.startsWith('http')) {
        // Image background
        const img = new Image();
        // Don't set crossOrigin for same-origin images to avoid CORS taint
        // Only set it for cross-origin URLs
        let imageUrl: string;
        if (wallpaper.startsWith('http')) {
          imageUrl = wallpaper;
          if (!imageUrl.startsWith(window.location.origin)) {
            img.crossOrigin = 'anonymous';
          }
        } else if (wallpaper.startsWith('file://') || wallpaper.startsWith('data:')) {
          imageUrl = wallpaper;
        } else {
          imageUrl = window.location.origin + wallpaper;
        }
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = (err) => {
            console.error('[FrameRenderer] Failed to load background image:', imageUrl, err);
            reject(new Error(`Failed to load background image: ${imageUrl}`));
          };
          img.src = imageUrl;
        });
        
        // Draw the image using cover and center positioning
        const imgAspect = img.width / img.height;
        const canvasAspect = this.config.width / this.config.height;
        
        let drawWidth, drawHeight, drawX, drawY;
        
        if (imgAspect > canvasAspect) {
          drawHeight = this.config.height;
          drawWidth = drawHeight * imgAspect;
          drawX = (this.config.width - drawWidth) / 2;
          drawY = 0;
        } else {
          drawWidth = this.config.width;
          drawHeight = drawWidth / imgAspect;
          drawX = 0;
          drawY = (this.config.height - drawHeight) / 2;
        }
        
        bgCtx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      } else if (wallpaper.startsWith('#')) {
        bgCtx.fillStyle = wallpaper;
        bgCtx.fillRect(0, 0, this.config.width, this.config.height);
      } else if (wallpaper.startsWith('linear-gradient') || wallpaper.startsWith('radial-gradient')) {
        
        const gradientMatch = wallpaper.match(/(linear|radial)-gradient\((.+)\)/);
        if (gradientMatch) {
          const [, type, params] = gradientMatch;
          const parts = params.split(',').map(s => s.trim());
          
          let gradient: CanvasGradient;
          
          if (type === 'linear') {
            gradient = bgCtx.createLinearGradient(0, 0, 0, this.config.height);
            parts.forEach((part, index) => {
              if (part.startsWith('to ') || part.includes('deg')) return;
              
              const colorMatch = part.match(/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-z]+)/);
              if (colorMatch) {
                const color = colorMatch[1];
                const position = index / (parts.length - 1);
                gradient.addColorStop(position, color);
              }
            });
          } else {
            const cx = this.config.width / 2;
            const cy = this.config.height / 2;
            const radius = Math.max(this.config.width, this.config.height) / 2;
            gradient = bgCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            
            parts.forEach((part, index) => {
              const colorMatch = part.match(/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-z]+)/);
              if (colorMatch) {
                const color = colorMatch[1];
                const position = index / (parts.length - 1);
                gradient.addColorStop(position, color);
              }
            });
          }
          
          bgCtx.fillStyle = gradient;
          bgCtx.fillRect(0, 0, this.config.width, this.config.height);
        } else {
          console.warn('[FrameRenderer] Could not parse gradient, using black fallback');
          bgCtx.fillStyle = '#000000';
          bgCtx.fillRect(0, 0, this.config.width, this.config.height);
        }
      } else {
        bgCtx.fillStyle = wallpaper;
        bgCtx.fillRect(0, 0, this.config.width, this.config.height);
      }
    } catch (error) {
      console.error('[FrameRenderer] Error setting up background, using fallback:', error);
      bgCtx.fillStyle = '#000000';
      bgCtx.fillRect(0, 0, this.config.width, this.config.height);
    }

    // Store the background canvas for compositing
    this.backgroundSprite = bgCanvas as any;
  }

  async renderFrame(videoFrame: VideoFrame, timestamp: number): Promise<void> {
    if (!this.app || !this.videoContainer || !this.cameraContainer) {
      throw new Error('Renderer not initialized');
    }

    this.currentVideoTime = timestamp / 1000000;

    // Create or update video sprite from VideoFrame
    if (!this.videoSprite) {
      const texture = PIXI.Texture.from(videoFrame as any);
      this.videoSprite = new PIXI.Sprite(texture);
      this.videoContainer.addChild(this.videoSprite);
    } else {
      // Update texture with new frame
      const texture = PIXI.Texture.from(videoFrame as any);
      this.videoSprite.texture = texture;
    }

    // Apply layout
    this.updateLayout();

    const timeMs = this.currentVideoTime * 1000;
    const TICKS_PER_FRAME = 1;
    
    let maxMotionIntensity = 0;
    for (let i = 0; i < TICKS_PER_FRAME; i++) {
      const motionIntensity = this.updateAnimationState(timeMs);
      maxMotionIntensity = Math.max(maxMotionIntensity, motionIntensity);
    }
    
    // Apply transform once with maximum motion intensity from all ticks
    applyZoomTransform({
      cameraContainer: this.cameraContainer,
      blurFilter: this.blurFilter,
      stageSize: this.layoutCache.stageSize,
      baseMask: this.layoutCache.maskRect,
      zoomScale: this.animationState.scale,
      focusX: this.animationState.focusX,
      focusY: this.animationState.focusY,
      motionIntensity: maxMotionIntensity,
      isPlaying: true,
    });

    // Update cursor position for this frame
    if (this.config.cursorConfig) {
      this.updateCursorForFrame(timeMs);
    }

    // Render the PixiJS stage to its canvas (video only, transparent background)
    this.app.renderer.render(this.app.stage);

    // Composite with shadows to final output canvas
    this.compositeWithShadows();
  }

  private updateLayout(): void {
    if (!this.app || !this.videoSprite || !this.maskGraphics || !this.videoContainer) return;

    const { width, height } = this.config;
    const { cropRegion } = this.config;
    const videoWidth = this.config.videoWidth;
    const videoHeight = this.config.videoHeight;

    // Calculate cropped video dimensions
    const cropStartX = cropRegion.x;
    const cropStartY = cropRegion.y;
    const cropEndX = cropRegion.x + cropRegion.width;
    const cropEndY = cropRegion.y + cropRegion.height;

    const croppedVideoWidth = videoWidth * (cropEndX - cropStartX);
    const croppedVideoHeight = videoHeight * (cropEndY - cropStartY);

    // Calculate scale to fit in viewport
    const viewportWidth = width * VIEWPORT_SCALE;
    const viewportHeight = height * VIEWPORT_SCALE;
    const scale = Math.min(viewportWidth / croppedVideoWidth, viewportHeight / croppedVideoHeight);

    // Position video sprite
    this.videoSprite.width = videoWidth * scale;
    this.videoSprite.height = videoHeight * scale;

    const cropPixelX = cropStartX * videoWidth * scale;
    const cropPixelY = cropStartY * videoHeight * scale;
    this.videoSprite.x = -cropPixelX;
    this.videoSprite.y = -cropPixelY;

    // Position video container
    const croppedDisplayWidth = croppedVideoWidth * scale;
    const croppedDisplayHeight = croppedVideoHeight * scale;
    const centerOffsetX = (width - croppedDisplayWidth) / 2;
    const centerOffsetY = (height - croppedDisplayHeight) / 2;
    this.videoContainer.x = centerOffsetX;
    this.videoContainer.y = centerOffsetY;

    // Update mask
    const radius = Math.min(croppedDisplayWidth, croppedDisplayHeight) * 0.02;
    this.maskGraphics.clear();
    this.maskGraphics.roundRect(0, 0, croppedDisplayWidth, croppedDisplayHeight, radius);
    this.maskGraphics.fill({ color: 0xffffff });

    // Cache layout info
    this.layoutCache = {
      stageSize: { width, height },
      videoSize: { width: croppedVideoWidth, height: croppedVideoHeight },
      baseScale: scale,
      baseOffset: { x: centerOffsetX, y: centerOffsetY },
      maskRect: { x: 0, y: 0, width: croppedDisplayWidth, height: croppedDisplayHeight },
    };
  }

  private clampFocusToStage(focus: { cx: number; cy: number }, depth: number): { cx: number; cy: number } {
    if (!this.layoutCache) return focus;
    return clampFocusToStageUtil(focus, depth as any, this.layoutCache);
  }

  private updateAnimationState(timeMs: number): number {
    if (!this.cameraContainer || !this.layoutCache) return 0;

    const { region, strength } = findDominantRegion(this.config.zoomRegions, timeMs);
    
    const defaultFocus = DEFAULT_FOCUS;
    let targetScaleFactor = 1;
    let targetFocus = { ...defaultFocus };

    if (region && strength > 0) {
      const zoomScale = ZOOM_DEPTH_SCALES[region.depth];
      const regionFocus = this.clampFocusToStage(region.focus, region.depth);
      
      targetScaleFactor = 1 + (zoomScale - 1) * strength;
      targetFocus = {
        cx: defaultFocus.cx + (regionFocus.cx - defaultFocus.cx) * strength,
        cy: defaultFocus.cy + (regionFocus.cy - defaultFocus.cy) * strength,
      };
    }

    const state = this.animationState;

    const prevScale = state.scale;
    const prevFocusX = state.focusX;
    const prevFocusY = state.focusY;

    const scaleDelta = targetScaleFactor - state.scale;
    const focusXDelta = targetFocus.cx - state.focusX;
    const focusYDelta = targetFocus.cy - state.focusY;

    let nextScale = prevScale;
    let nextFocusX = prevFocusX;
    let nextFocusY = prevFocusY;

    if (Math.abs(scaleDelta) > MIN_DELTA) {
      nextScale = prevScale + scaleDelta * SMOOTHING_FACTOR;
    } else {
      nextScale = targetScaleFactor;
    }

    if (Math.abs(focusXDelta) > MIN_DELTA) {
      nextFocusX = prevFocusX + focusXDelta * SMOOTHING_FACTOR;
    } else {
      nextFocusX = targetFocus.cx;
    }

    if (Math.abs(focusYDelta) > MIN_DELTA) {
      nextFocusY = prevFocusY + focusYDelta * SMOOTHING_FACTOR;
    } else {
      nextFocusY = targetFocus.cy;
    }

    state.scale = nextScale;
    state.focusX = nextFocusX;
    state.focusY = nextFocusY;

    return Math.max(
      Math.abs(nextScale - prevScale),
      Math.abs(nextFocusX - prevFocusX),
      Math.abs(nextFocusY - prevFocusY)
    );
  }

  private compositeWithShadows(): void {
    if (!this.compositeCanvas || !this.compositeCtx || !this.app) return;

    const videoCanvas = this.app.canvas as HTMLCanvasElement;
    const ctx = this.compositeCtx;
    const w = this.compositeCanvas.width;
    const h = this.compositeCanvas.height;

    // Clear composite canvas
    ctx.clearRect(0, 0, w, h);

    // Step 1: Draw background layer (with optional blur, not affected by zoom)
    if (this.backgroundSprite) {
      const bgCanvas = this.backgroundSprite as any as HTMLCanvasElement;
      
      if (this.config.showBlur) {
        ctx.save();
        ctx.filter = 'blur(2px)';
        ctx.drawImage(bgCanvas, 0, 0, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(bgCanvas, 0, 0, w, h);
      }
    } else {
      console.warn('[FrameRenderer] No background sprite found during compositing!');
    }

    // Step 2: Draw video layer with shadows on top of background
    if (this.config.showShadow && this.shadowCanvas && this.shadowCtx) {
      const shadowCtx = this.shadowCtx;
      shadowCtx.clearRect(0, 0, w, h);
      shadowCtx.save();
      shadowCtx.filter = 'drop-shadow(0 12px 48px rgba(0,0,0,0.7)) drop-shadow(0 4px 16px rgba(0,0,0,0.5)) drop-shadow(0 2px 8px rgba(0,0,0,0.3))';
      shadowCtx.drawImage(videoCanvas, 0, 0, w, h);
      shadowCtx.restore();
      ctx.drawImage(this.shadowCanvas, 0, 0, w, h);
    } else {
      ctx.drawImage(videoCanvas, 0, 0, w, h);
    }
  }

  getCanvas(): HTMLCanvasElement {
    if (!this.compositeCanvas) {
      throw new Error('Renderer not initialized');
    }
    return this.compositeCanvas;
  }

  updateConfig(config: Partial<FrameRenderConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.wallpaper) {
      this.setupBackground();
    }
  }

  // === Cursor Rendering Methods ===

  private setupCursor(): void {
    const cursorConfig = this.config.cursorConfig;
    if (!cursorConfig || !this.app) return;

    // Create cursor graphics container (added to stage so it's on top of video)
    this.clickEffectsContainer = new PIXI.Container();
    this.clickEffectsContainer.zIndex = 999;
    this.app.stage.addChild(this.clickEffectsContainer);

    this.cursorGraphics = new PIXI.Graphics();
    this.cursorGraphics.zIndex = 1000;
    this.app.stage.addChild(this.cursorGraphics);

    // Sort by zIndex
    this.app.stage.sortableChildren = true;

    // Normalize tracking data
    this.normalizeTrackingData();
  }

  private normalizeTrackingData(): void {
    const cursorConfig = this.config.cursorConfig;
    if (!cursorConfig) return;

    const { mouseTrackingData, sourceBounds } = cursorConfig;
    const { videoWidth, videoHeight } = this.config;

    if (mouseTrackingData.length === 0) {
      this.normalizedTrackingData = [];
      return;
    }

    const firstTimestamp = mouseTrackingData[0].timestamp;

    // Use the same DPR logic as cursorRenderer.ts
    // During export, we're running in a browser context where we can check devicePixelRatio
    const dpr = window.devicePixelRatio || 2;

    if (sourceBounds && sourceBounds.width > 0 && sourceBounds.height > 0) {
      // Convert source bounds from physical to logical pixels
      const logicalSourceWidth = sourceBounds.width / dpr;
      const logicalSourceHeight = sourceBounds.height / dpr;

      // Scale from logical mouse coords to video coords
      const scaleX = videoWidth / logicalSourceWidth;
      const scaleY = videoHeight / logicalSourceHeight;

      console.log('[FrameRenderer] Cursor coordinate mapping:', {
        sourceBounds,
        videoSize: { width: videoWidth, height: videoHeight },
        dpr,
        logicalSource: { width: logicalSourceWidth, height: logicalSourceHeight },
        scaleFactors: { x: scaleX, y: scaleY },
      });

      this.normalizedTrackingData = mouseTrackingData.map(event => ({
        ...event,
        timestamp: (event.timestamp - firstTimestamp) * 1000, // Convert to ms
        x: (event.x - sourceBounds.x / dpr) * scaleX,
        y: (event.y - sourceBounds.y / dpr) * scaleY,
      }));
    } else {
      // Fallback: use mouse range heuristic
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;

      for (const event of mouseTrackingData) {
        if (event.x < minX) minX = event.x;
        if (event.y < minY) minY = event.y;
        if (event.x > maxX) maxX = event.x;
        if (event.y > maxY) maxY = event.y;
      }

      const mouseRangeX = maxX - minX;
      const mouseRangeY = maxY - minY;
      const scaleX = videoWidth / Math.max(mouseRangeX, 1);
      const scaleY = videoHeight / Math.max(mouseRangeY, 1);

      this.normalizedTrackingData = mouseTrackingData.map(event => ({
        ...event,
        timestamp: (event.timestamp - firstTimestamp) * 1000,
        x: (event.x - minX) * scaleX,
        y: (event.y - minY) * scaleY,
      }));
    }
  }

  private interpolateCursorPosition(timeMs: number): { x: number; y: number } | null {
    if (this.normalizedTrackingData.length === 0) return null;

    let before: MouseTrackingEvent | null = null;
    let after: MouseTrackingEvent | null = null;

    for (let i = 0; i < this.normalizedTrackingData.length; i++) {
      const event = this.normalizedTrackingData[i];
      if (event.timestamp <= timeMs) {
        before = event;
      } else {
        after = event;
        break;
      }
    }

    if (!before) {
      const first = this.normalizedTrackingData[0];
      return { x: first.x, y: first.y };
    }

    if (!after) {
      return { x: before.x, y: before.y };
    }

    // Interpolate between events
    const t = (timeMs - before.timestamp) / (after.timestamp - before.timestamp);
    return {
      x: before.x + (after.x - before.x) * t,
      y: before.y + (after.y - before.y) * t,
    };
  }

  private drawCursorAtPosition(x: number, y: number): void {
    const cursorConfig = this.config.cursorConfig;
    if (!cursorConfig || !this.cursorGraphics) return;

    const { cursorSettings } = cursorConfig;
    const g = this.cursorGraphics;
    g.clear();

    if (cursorSettings.style === 'none') return;

    const size = this.BASE_CURSOR_SIZE * cursorSettings.size;
    const color = this.hexToNumber(cursorSettings.color);

    // Position the cursor graphics
    g.position.set(x, y);

    switch (cursorSettings.style) {
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

  private drawDefaultCursor(g: PIXI.Graphics, size: number, color: number): void {
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

  private drawCircleCursor(g: PIXI.Graphics, size: number, color: number): void {
    const radius = size / 2;
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

  private drawDotCursor(g: PIXI.Graphics, size: number, color: number): void {
    const radius = size / 4;
    g.fill({ color, alpha: 1 });
    g.circle(0, 0, radius);
    g.fill();

    // Subtle glow
    g.fill({ color, alpha: 0.3 });
    g.circle(0, 0, radius * 2);
    g.fill();
  }

  private drawCrosshairCursor(g: PIXI.Graphics, size: number, color: number): void {
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

  private updateCursorForFrame(timeMs: number): void {
    if (!this.layoutCache || !this.cursorGraphics) return;

    const position = this.interpolateCursorPosition(timeMs);
    if (!position) return;

    // Convert video coordinates to stage coordinates
    // Apply the same transform as the video (scale and offset)
    const { baseScale, baseOffset } = this.layoutCache;
    const stageX = position.x * baseScale + baseOffset.x;
    const stageY = position.y * baseScale + baseOffset.y;

    this.drawCursorAtPosition(stageX, stageY);

    // Check for click events
    this.checkClickEvents(timeMs, stageX, stageY);
  }

  private checkClickEvents(timeMs: number, _x: number, _y: number): void {
    const cursorConfig = this.config.cursorConfig;
    if (!cursorConfig || cursorConfig.cursorSettings.clickEffect === 'none') return;

    // Look for click events in the time window since last check
    for (const event of this.normalizedTrackingData) {
      if ((event.type === 'click' || event.type === 'down')) {
        if (event.timestamp > this.lastClickTime && event.timestamp <= timeMs) {
          // Draw click effect at event position
          const { baseScale, baseOffset } = this.layoutCache;
          const clickX = event.x * baseScale + baseOffset.x;
          const clickY = event.y * baseScale + baseOffset.y;
          this.drawClickEffect(clickX, clickY, timeMs - event.timestamp);
        }
      }
    }

    this.lastClickTime = timeMs;
  }

  private drawClickEffect(x: number, y: number, elapsedMs: number): void {
    const cursorConfig = this.config.cursorConfig;
    if (!cursorConfig || !this.clickEffectsContainer) return;

    const { cursorSettings } = cursorConfig;
    const progress = Math.min(elapsedMs / this.CLICK_EFFECT_DURATION, 1);
    if (progress >= 1) return;

    const color = this.hexToNumber(cursorSettings.clickColor);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const fadeOut = 1 - progress;

    const g = new PIXI.Graphics();

    switch (cursorSettings.clickEffect) {
      case 'ripple': {
        const maxRadius = 40 * cursorSettings.size;
        const radius = maxRadius * easeOut;
        g.stroke({ color, width: 3, alpha: fadeOut * 0.8 });
        g.circle(x, y, radius);
        g.stroke();

        const innerRadius = maxRadius * 0.6 * easeOut;
        g.stroke({ color, width: 2, alpha: fadeOut * 0.5 });
        g.circle(x, y, innerRadius);
        g.stroke();
        break;
      }
      case 'pulse': {
        const maxRadius = 30 * cursorSettings.size;
        const radius = maxRadius * (0.5 + easeOut * 0.5);
        g.fill({ color, alpha: fadeOut * 0.4 });
        g.circle(x, y, radius);
        g.fill();
        break;
      }
      case 'ring': {
        const maxRadius = 35 * cursorSettings.size;
        const radius = maxRadius * easeOut;
        const thickness = 4 * (1 - progress * 0.5);
        g.stroke({ color, width: thickness, alpha: fadeOut });
        g.circle(x, y, radius);
        g.stroke();
        break;
      }
    }

    this.clickEffectsContainer.addChild(g);
    // Clean up immediately after render
    setTimeout(() => {
      this.clickEffectsContainer?.removeChild(g);
      g.destroy();
    }, 0);
  }

  private hexToNumber(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
  }

  destroy(): void {
    if (this.videoSprite) {
      this.videoSprite.destroy();
      this.videoSprite = null;
    }
    this.backgroundSprite = null;

    // Clean up cursor resources
    if (this.cursorGraphics) {
      this.cursorGraphics.destroy();
      this.cursorGraphics = null;
    }
    if (this.clickEffectsContainer) {
      this.clickEffectsContainer.destroy({ children: true });
      this.clickEffectsContainer = null;
    }
    this.normalizedTrackingData = [];

    if (this.app) {
      this.app.destroy(true, { children: true, texture: true, textureSource: true });
      this.app = null;
    }
    this.cameraContainer = null;
    this.videoContainer = null;
    this.maskGraphics = null;
    this.blurFilter = null;
    this.shadowCanvas = null;
    this.shadowCtx = null;
    this.compositeCanvas = null;
    this.compositeCtx = null;
  }
}
