import * as PIXI from 'pixi.js';
import type { CameraOverlaySettings, CameraPosition, CameraShape } from '../types';

const CORNER_MARGIN = 0.05; // 5% margin from edges

export class CameraRenderer {
  private container: PIXI.Container;
  private cameraContainer: PIXI.Container;
  private cameraSprite: PIXI.Sprite | null = null;
  private maskGraphics: PIXI.Graphics;
  private borderGraphics: PIXI.Graphics;
  private shadowGraphics: PIXI.Graphics;
  private settings: CameraOverlaySettings;
  private stageSize = { width: 0, height: 0 };
  private videoTexture: PIXI.Texture | null = null;
  private videoSource: PIXI.VideoSource | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private previousShape: CameraShape | null = null; // Track shape changes

  constructor(parentContainer: PIXI.Container, settings: CameraOverlaySettings) {
    this.settings = settings;

    // Create main container for camera overlay
    this.container = new PIXI.Container();
    this.container.zIndex = 900; // Below cursor (1000) but above video
    this.container.sortableChildren = true; // Enable z-index sorting
    parentContainer.addChild(this.container);

    // Shadow layer (behind camera)
    this.shadowGraphics = new PIXI.Graphics();
    this.shadowGraphics.zIndex = 0;
    this.container.addChild(this.shadowGraphics);

    // Camera container (holds sprite)
    this.cameraContainer = new PIXI.Container();
    this.cameraContainer.zIndex = 1;
    this.container.addChild(this.cameraContainer);

    // Mask graphics for shape (circle, rounded-rect, etc.)
    this.maskGraphics = new PIXI.Graphics();
    // Mask doesn't need zIndex as it's not rendered directly, but adding it for consistency
    this.container.addChild(this.maskGraphics);
    this.cameraContainer.mask = this.maskGraphics;

    // Border graphics (on top of camera)
    this.borderGraphics = new PIXI.Graphics();
    this.borderGraphics.zIndex = 2;
    this.container.addChild(this.borderGraphics);

    this.setVisible(settings.enabled);
  }

  setSettings(settings: CameraOverlaySettings) {
    const visibilityChanged = this.settings.enabled !== settings.enabled;
    this.settings = settings;

    // Only update visibility if it actually changed
    if (visibilityChanged) {
      this.setVisible(settings.enabled);
    }

    if (settings.enabled) {
      this.updateLayout();
    }
  }

  setVideoElement(videoElement: HTMLVideoElement) {
    // Skip if same video element is already connected and working
    if (this.videoElement === videoElement && this.cameraSprite) {
      console.log('Camera: Same video element already connected, skipping');
      return;
    }

    // Clean up existing PIXI resources first (before changing video element reference)
    if (this.cameraSprite) {
      this.cameraContainer.removeChild(this.cameraSprite);
      this.cameraSprite.destroy();
      this.cameraSprite = null;
    }
    if (this.videoTexture) {
      this.videoTexture.destroy(false); // Don't destroy source via texture
      this.videoTexture = null;
    }
    if (this.videoSource) {
      try {
        this.videoSource.destroy();
      } catch (err) {
        // Ignore - video element may be in bad state
      }
      this.videoSource = null;
    }

    // Validate video element before storing reference
    if (!videoElement) {
      this.videoElement = null;
      return;
    }

    // Validate that video element has a valid src attribute
    // Check both getAttribute and the src property for flexibility
    const srcAttribute = videoElement.getAttribute('src');
    const srcProperty = videoElement.src;
    const hasValidSrc = (srcAttribute && srcAttribute.startsWith('file://')) ||
      (srcProperty && srcProperty.startsWith('file://'));

    if (!hasValidSrc) {
      console.error('Camera: Video element has invalid src, skipping setup', {
        srcAttribute,
        srcProperty: srcProperty?.substring(0, 100),
      });
      this.videoElement = null;
      return;
    }

    // Now safe to set video element reference
    this.videoElement = videoElement;

    // Track retry count to prevent infinite loops
    let retryCount = 0;
    const MAX_RETRIES = 50; // ~0.8 seconds at 60fps
    let setupAttempted = false;

    // Wait for video to be ready with valid dimensions
    const setupTexture = () => {
      if (setupAttempted && this.cameraSprite) {
        console.log('Camera: Already set up, skipping');
        return;
      }

      if (!this.videoElement) {
        console.log('Camera: No video element');
        return;
      }

      const vw = this.videoElement.videoWidth;
      const vh = this.videoElement.videoHeight;

      if (vw === 0 || vh === 0) {
        retryCount++;
        if (retryCount > MAX_RETRIES) {
          console.error('Camera: Video dimensions never became ready after', MAX_RETRIES, 'retries');
          return; // Give up after too many retries
        }
        // Try again on next frame
        requestAnimationFrame(setupTexture);
        return;
      }

      setupAttempted = true;
      console.log('Camera: Setting up VideoSource texture', {
        videoWidth: vw,
        videoHeight: vh,
      });

      try {
        // Clean up any partial setup
        if (this.cameraSprite) {
          this.cameraContainer.removeChild(this.cameraSprite);
          this.cameraSprite.destroy();
          this.cameraSprite = null;
        }
        if (this.videoTexture) {
          this.videoTexture.destroy(false);
          this.videoTexture = null;
        }
        if (this.videoSource) {
          try {
            this.videoSource.destroy();
          } catch (e) {
            // Ignore error
          }
          this.videoSource = null;
        }

        // Use VideoSource exactly like main video playback does
        const source = PIXI.VideoSource.from(this.videoElement);
        this.videoSource = source as unknown as PIXI.VideoSource;

        // Disable autoPlay since we control playback via the video element
        if ('autoPlay' in this.videoSource) {
          (this.videoSource as unknown as { autoPlay?: boolean }).autoPlay = false;
        }
        // Enable autoUpdate so texture updates automatically when video plays
        if ('autoUpdate' in this.videoSource) {
          (this.videoSource as unknown as { autoUpdate?: boolean }).autoUpdate = true;
        }

        this.videoTexture = PIXI.Texture.from(this.videoSource);
        this.cameraSprite = new PIXI.Sprite(this.videoTexture);

        // Add sprite
        // Note: Mirror effect is handled in updateLayout() which is called below
        this.cameraContainer.addChild(this.cameraSprite);

        // Force initial texture update to capture the first frame
        if (this.videoSource) {
          this.videoSource.update();
        }

        this.updateLayout();
      } catch (err) {
        console.error('Camera: Failed to create texture', err);
        setupAttempted = false; // Allow retry on error
      }
    };

    // Use multiple events for reliability
    const handleReady = () => {
      setupTexture();
    };

    // Try immediately if video is ready
    if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
      setupTexture();
    } else {
      // Listen for multiple events to maximize chances of catching when video is ready
      videoElement.addEventListener('loadedmetadata', handleReady, { once: true });
      videoElement.addEventListener('loadeddata', handleReady, { once: true });
      videoElement.addEventListener('canplay', handleReady, { once: true });

      // Also try after a small delay as fallback
      setTimeout(() => {
        if (!this.cameraSprite && this.videoElement) {
          setupTexture();
        }
      }, 500);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setVideoLayout(_scale: number, _offsetX: number, _offsetY: number) {
    // Camera overlay uses fixed stage position, doesn't zoom with video
    // This method exists for API consistency with CursorRenderer
    this.updateLayout();
  }

  setStageSize(width: number, height: number) {
    const changed = this.stageSize.width !== width || this.stageSize.height !== height;
    this.stageSize = { width, height };
    if (changed) {
      console.log('CameraRenderer.setStageSize:', { width, height, hasCameraSprite: !!this.cameraSprite });
    }
    this.updateLayout();
  }

  // Track last logged reason to avoid spam
  private lastLoggedReason: string | null = null;

  private updateLayout() {
    if (!this.cameraSprite || !this.videoElement || this.stageSize.width === 0) {
      // Debug: Log why we're early returning (only once per reason to avoid spam)
      const reason = !this.cameraSprite ? 'no-sprite' : !this.videoElement ? 'no-video' : 'no-stage-size';
      if (this.lastLoggedReason !== reason) {
        this.lastLoggedReason = reason;
        console.log('CameraRenderer.updateLayout: skipped -', reason, {
          hasCameraSprite: !!this.cameraSprite,
          hasVideoElement: !!this.videoElement,
          stageSize: this.stageSize,
          enabled: this.settings.enabled,
          visible: this.container.visible,
        });
      }

      // Important: Hide camera if layout isn't ready to prevent flickering
      if (this.settings.enabled && this.container.visible) {
        console.log('Camera: Hiding until layout is ready');
        this.container.visible = false;
      }
      return;
    }

    // Reset logged reason on successful layout
    this.lastLoggedReason = null;

    // Now that layout is ready, ensure visibility matches settings
    if (this.settings.enabled && !this.container.visible) {
      console.log('Camera: Showing now that layout is ready');
      this.container.visible = true;
    }

    const { width: stageWidth } = this.stageSize;
    const { size, position, customX, customY, shape, borderRadius, borderWidth, borderColor, showShadow } = this.settings;

    // Camera size relative to stage
    const cameraWidth = stageWidth * size;
    const cameraHeight = cameraWidth * (this.videoElement.videoHeight / this.videoElement.videoWidth);

    // Calculate position based on setting
    const { x: posX, y: posY } = this.calculatePosition(position, customX, customY, cameraWidth, cameraHeight);

    // Update camera sprite size
    this.cameraSprite.width = cameraWidth;
    this.cameraSprite.height = cameraHeight;

    // Apply mirror effect via sprite scale (negates scale.x after width is set)
    if (this.settings.mirror) {
      this.cameraSprite.scale.x *= -1;
      this.cameraSprite.anchor.set(1, 0);
      // Adjust position for right-anchored sprite
      this.cameraSprite.position.set(posX + cameraWidth, posY);
    } else {
      this.cameraSprite.anchor.set(0, 0);
      this.cameraSprite.position.set(posX, posY);
    }

    // Draw mask based on shape
    this.drawMask(posX, posY, cameraWidth, cameraHeight, shape, borderRadius);

    // Only reassign mask when shape actually changes (not on every layout update)
    // This prevents video content from disappearing during size/position adjustments
    if (this.previousShape !== shape) {
      console.log('Camera: Shape changed, reassigning mask', { from: this.previousShape, to: shape });
      this.cameraContainer.mask = null;
      this.cameraContainer.mask = this.maskGraphics;
      this.previousShape = shape;
    }

    // Draw border
    this.drawBorder(posX, posY, cameraWidth, cameraHeight, shape, borderRadius, borderWidth, borderColor);

    // Draw shadow if enabled
    if (showShadow) {
      this.drawShadow(posX, posY, cameraWidth, cameraHeight, shape, borderRadius);
    } else {
      this.shadowGraphics.clear();
    }

    // Layout successful - only log on first success to avoid spam
    // (logging removed to reduce console noise during normal operation)
  }

  private calculatePosition(
    position: CameraPosition,
    customX: number,
    customY: number,
    cameraWidth: number,
    cameraHeight: number
  ): { x: number; y: number } {
    const { width: stageWidth, height: stageHeight } = this.stageSize;
    const marginX = stageWidth * CORNER_MARGIN;
    const marginY = stageHeight * CORNER_MARGIN;

    switch (position) {
      case 'bottom-right':
        return {
          x: stageWidth - cameraWidth - marginX,
          y: stageHeight - cameraHeight - marginY,
        };
      case 'bottom-left':
        return {
          x: marginX,
          y: stageHeight - cameraHeight - marginY,
        };
      case 'top-right':
        return {
          x: stageWidth - cameraWidth - marginX,
          y: marginY,
        };
      case 'top-left':
        return {
          x: marginX,
          y: marginY,
        };
      case 'custom':
        return {
          x: customX * stageWidth - cameraWidth / 2,
          y: customY * stageHeight - cameraHeight / 2,
        };
      default:
        return {
          x: stageWidth - cameraWidth - marginX,
          y: stageHeight - cameraHeight - marginY,
        };
    }
  }

  private drawMask(x: number, y: number, width: number, height: number, shape: CameraShape, borderRadius: number) {
    const g = this.maskGraphics;
    g.clear();

    switch (shape) {
      case 'circle': {
        const radius = Math.min(width, height) / 2;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        g.circle(centerX, centerY, radius);
        break;
      }
      case 'squircle': {
        // iOS-style squircle approximation using rounded rect with ~27% corner radius
        const squircleRadius = Math.min(width, height) * 0.27;
        g.roundRect(x, y, width, height, squircleRadius);
        break;
      }
      case 'rounded-rect': {
        g.roundRect(x, y, width, height, borderRadius);
        break;
      }
      default:
        g.rect(x, y, width, height);
        break;
    }

    g.fill({ color: 0xffffff, alpha: 1 });
  }

  private drawBorder(
    x: number,
    y: number,
    width: number,
    height: number,
    shape: CameraShape,
    borderRadius: number,
    borderWidth: number,
    borderColor: string
  ) {
    const g = this.borderGraphics;
    g.clear();

    if (borderWidth <= 0) return;

    switch (shape) {
      case 'circle': {
        const radius = Math.min(width, height) / 2;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        g.circle(centerX, centerY, radius);
        break;
      }
      case 'squircle': {
        const squircleRadius = Math.min(width, height) * 0.27;
        g.roundRect(x, y, width, height, squircleRadius);
        break;
      }
      case 'rounded-rect': {
        g.roundRect(x, y, width, height, borderRadius);
        break;
      }
      default:
        g.rect(x, y, width, height);
        break;
    }

    const color = this.hexToNumber(borderColor);
    g.stroke({ color, width: borderWidth, alpha: 1 });
  }

  private drawShadow(
    x: number,
    y: number,
    width: number,
    height: number,
    shape: CameraShape,
    borderRadius: number
  ) {
    const g = this.shadowGraphics;
    g.clear();

    // Draw multiple shadow layers for depth
    const shadowOffsetY = 8;
    const shadowBlurLayers = [
      { offset: 2, alpha: 0.15 },
      { offset: 4, alpha: 0.1 },
      { offset: 8, alpha: 0.05 },
    ];

    for (const layer of shadowBlurLayers) {
      const shadowX = x;
      const shadowY = y + shadowOffsetY * (layer.offset / 8);

      switch (shape) {
        case 'circle': {
          const radius = Math.min(width, height) / 2 + layer.offset;
          const centerX = shadowX + width / 2;
          const centerY = shadowY + height / 2;
          g.circle(centerX, centerY, radius);
          break;
        }
        case 'squircle': {
          const baseSquircleRadius = Math.min(width, height) * 0.27;
          g.roundRect(
            shadowX - layer.offset / 2,
            shadowY - layer.offset / 2,
            width + layer.offset,
            height + layer.offset,
            baseSquircleRadius + layer.offset / 2
          );
          break;
        }
        case 'rounded-rect': {
          g.roundRect(
            shadowX - layer.offset / 2,
            shadowY - layer.offset / 2,
            width + layer.offset,
            height + layer.offset,
            borderRadius + layer.offset / 2
          );
          break;
        }
        default:
          g.rect(
            shadowX - layer.offset / 2,
            shadowY - layer.offset / 2,
            width + layer.offset,
            height + layer.offset
          );
          break;
      }

      g.fill({ color: 0x000000, alpha: layer.alpha });
    }
  }

  private hexToNumber(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
  }

  updateForTime() {
    // Force VideoSource to update texture each frame
    // This is needed because autoUpdate only works when the video is playing,
    // but when seeking while paused, we need to manually trigger the update
    if (this.videoSource) {
      try {
        this.videoSource.update();
      } catch {
        // Ignore - video may not be ready
      }
    }
  }

  setVisible(visible: boolean) {
    // Only update if visibility actually changed to prevent flicker
    if (this.container.visible !== visible) {
      console.log('Camera: Visibility changed:', { from: this.container.visible, to: visible });
      this.container.visible = visible;
    }
  }

  destroy() {
    // Clear video element first to prevent PIXI from accessing it during cleanup
    this.videoElement = null;

    if (this.cameraSprite) {
      this.cameraSprite.destroy();
      this.cameraSprite = null;
    }
    if (this.videoTexture) {
      // Don't destroy source via texture (pass false) - we handle it separately
      this.videoTexture.destroy(false);
      this.videoTexture = null;
    }
    if (this.videoSource) {
      // Wrap in try-catch as VideoSource.destroy() may try to access null video element
      try {
        this.videoSource.destroy();
      } catch (err) {
        // Ignore errors during cleanup - video element may already be gone
        console.log('Camera: VideoSource cleanup (ignored):', err);
      }
      this.videoSource = null;
    }
    this.maskGraphics.destroy();
    this.borderGraphics.destroy();
    this.shadowGraphics.destroy();
    this.cameraContainer.destroy({ children: true });
    this.container.destroy({ children: true });
  }
}
