import type React from "react";
import { useEffect, useLayoutEffect, useRef, useImperativeHandle, forwardRef, useState, useMemo, useCallback } from "react";
import { getAssetPath } from "@/lib/assetPath";
import * as PIXI from 'pixi.js';
import { ZOOM_DEPTH_SCALES, type ZoomRegion, type ZoomFocus, type ZoomDepth, type CursorSettings, type MouseTrackingEvent, type SourceBounds, type ClipRegion, type CameraOverlaySettings } from "./types";
import { DEFAULT_FOCUS, SMOOTHING_FACTOR, MIN_DELTA } from "./videoPlayback/constants";
import { clamp01 } from "./videoPlayback/mathUtils";
import { findDominantRegion } from "./videoPlayback/zoomRegionUtils";
import { clampFocusToStage as clampFocusToStageUtil } from "./videoPlayback/focusUtils";
import { updateOverlayIndicator } from "./videoPlayback/overlayUtils";
import { layoutVideoContent as layoutVideoContentUtil } from "./videoPlayback/layoutUtils";
import { applyZoomTransform } from "./videoPlayback/zoomTransform";
import { createVideoEventHandlers } from "./videoPlayback/videoEventHandlers";
import { CursorRenderer } from "./videoPlayback/cursorRenderer";
import { CameraRenderer } from "./videoPlayback/cameraRenderer";
import { DEFAULT_CURSOR_SETTINGS, DEFAULT_CAMERA_SETTINGS } from "./types";

interface VideoPlaybackProps {
  videoPath: string;
  cameraVideoPath?: string | null;
  onDurationChange: (duration: number) => void;
  onTimeUpdate: (time: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  onError: (error: string) => void;
  wallpaper?: string;
  zoomRegions: ZoomRegion[];
  clipRegions: ClipRegion[];
  selectedZoomId: string | null;
  onSelectZoom: (id: string | null) => void;
  onZoomFocusChange: (id: string, focus: ZoomFocus) => void;
  isPlaying: boolean;
  showShadow?: boolean;
  showBlur?: boolean;
  cropRegion?: import('./types').CropRegion;
  cursorSettings?: CursorSettings;
  mouseTrackingData?: MouseTrackingEvent[];
  sourceBounds?: SourceBounds | null;
  initialMousePosition?: { x: number; y: number } | null;
  cameraSettings?: CameraOverlaySettings;
}

export interface VideoPlaybackRef {
  video: HTMLVideoElement | null;
  app: PIXI.Application | null;
  videoSprite: PIXI.Sprite | null;
  videoContainer: PIXI.Container | null;
  play: () => Promise<void>;
  pause: () => void;
}

const VideoPlayback = forwardRef<VideoPlaybackRef, VideoPlaybackProps>(({
  videoPath,
  cameraVideoPath,
  onDurationChange,
  onTimeUpdate,
  onPlayStateChange,
  onError,
  wallpaper,
  zoomRegions,
  clipRegions,
  selectedZoomId,
  onSelectZoom,
  onZoomFocusChange,
  isPlaying,
  showShadow,
  showBlur,
  cropRegion,
  cursorSettings,
  mouseTrackingData,
  sourceBounds,
  initialMousePosition,
  cameraSettings,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const videoSpriteRef = useRef<PIXI.Sprite | null>(null);
  const videoContainerRef = useRef<PIXI.Container | null>(null);
  const cameraContainerRef = useRef<PIXI.Container | null>(null);
  const timeUpdateAnimationRef = useRef<number | null>(null);
  const [pixiReady, setPixiReady] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const focusIndicatorRef = useRef<HTMLDivElement | null>(null);
  const currentTimeRef = useRef(0);
  const zoomRegionsRef = useRef<ZoomRegion[]>([]);
  const clipRegionsRef = useRef<ClipRegion[]>([]);
  const selectedZoomIdRef = useRef<string | null>(null);
  const animationStateRef = useRef({ scale: 1, focusX: DEFAULT_FOCUS.cx, focusY: DEFAULT_FOCUS.cy });
  const blurFilterRef = useRef<PIXI.BlurFilter | null>(null);
  const isDraggingFocusRef = useRef(false);
  const stageSizeRef = useRef({ width: 0, height: 0 });
  const videoSizeRef = useRef({ width: 0, height: 0 });
  const baseScaleRef = useRef(1);
  const baseOffsetRef = useRef({ x: 0, y: 0 });
  const baseMaskRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const cropBoundsRef = useRef({ startX: 0, endX: 0, startY: 0, endY: 0 });
  const maskGraphicsRef = useRef<PIXI.Graphics | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const isSeekingRef = useRef(false);
  const allowPlaybackRef = useRef(false);
  const lockedVideoDimensionsRef = useRef<{ width: number; height: number } | null>(null);
  const layoutVideoContentRef = useRef<(() => void) | null>(null);
  const cursorRendererRef = useRef<CursorRenderer | null>(null);
  const cameraRendererRef = useRef<CameraRenderer | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);

  const clampFocusToStage = useCallback((focus: ZoomFocus, depth: ZoomDepth) => {
    return clampFocusToStageUtil(focus, depth, stageSizeRef.current);
  }, []);

  const updateOverlayForRegion = useCallback((region: ZoomRegion | null, focusOverride?: ZoomFocus) => {
    const overlayEl = overlayRef.current;
    const indicatorEl = focusIndicatorRef.current;
    
    if (!overlayEl || !indicatorEl) {
      return;
    }

    // Update stage size from overlay dimensions
    const stageWidth = overlayEl.clientWidth;
    const stageHeight = overlayEl.clientHeight;
    if (stageWidth && stageHeight) {
      stageSizeRef.current = { width: stageWidth, height: stageHeight };
    }

    updateOverlayIndicator({
      overlayEl,
      indicatorEl,
      region,
      focusOverride,
      videoSize: videoSizeRef.current,
      baseScale: baseScaleRef.current,
      isPlaying: isPlayingRef.current,
    });
  }, []);

  const layoutVideoContent = useCallback(() => {
    const container = containerRef.current;
    const app = appRef.current;
    const videoSprite = videoSpriteRef.current;
    const maskGraphics = maskGraphicsRef.current;
    const videoElement = videoRef.current;
    const cameraContainer = cameraContainerRef.current;

    if (!container || !app || !videoSprite || !maskGraphics || !videoElement || !cameraContainer) {
      return;
    }

    // Lock video dimensions on first layout to prevent resize issues
    if (!lockedVideoDimensionsRef.current && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
      lockedVideoDimensionsRef.current = {
        width: videoElement.videoWidth,
        height: videoElement.videoHeight,
      };
    }

    const result = layoutVideoContentUtil({
      container,
      app,
      videoSprite,
      maskGraphics,
      videoElement,
      cropRegion,
      lockedVideoDimensions: lockedVideoDimensionsRef.current,
    });

    if (result) {
      stageSizeRef.current = result.stageSize;
      videoSizeRef.current = result.videoSize;
      baseScaleRef.current = result.baseScale;
      baseOffsetRef.current = result.baseOffset;
      baseMaskRef.current = result.maskRect;
      cropBoundsRef.current = result.cropBounds;

      // Reset camera container to identity
      cameraContainer.scale.set(1);
      cameraContainer.position.set(0, 0);

      const selectedId = selectedZoomIdRef.current;
      const activeRegion = selectedId
        ? zoomRegionsRef.current.find((region) => region.id === selectedId) ?? null
        : null;

      updateOverlayForRegion(activeRegion);
    }
  }, [updateOverlayForRegion, cropRegion]);

  useEffect(() => {
    layoutVideoContentRef.current = layoutVideoContent;
  }, [layoutVideoContent]);

  const selectedZoom = useMemo(() => {
    if (!selectedZoomId) return null;
    return zoomRegions.find((region) => region.id === selectedZoomId) ?? null;
  }, [zoomRegions, selectedZoomId]);

  useImperativeHandle(ref, () => ({
    video: videoRef.current,
    app: appRef.current,
    videoSprite: videoSpriteRef.current,
    videoContainer: videoContainerRef.current,
    play: async () => {
      const video = videoRef.current;
      if (!video) {
        allowPlaybackRef.current = false;
        return;
      }
      allowPlaybackRef.current = true;
      try {
        // If video has ended, seek back to start before playing
        // This resets video.ended to false and allows replay
        if (video.ended) {
          video.currentTime = 0;
        }
        await video.play();
      } catch (error) {
        allowPlaybackRef.current = false;
        throw error;
      }
    },
    pause: () => {
      const video = videoRef.current;
      allowPlaybackRef.current = false;
      if (!video) {
        return;
      }
      video.pause();
    },
  }));

  const updateFocusFromClientPoint = (clientX: number, clientY: number) => {
    const overlayEl = overlayRef.current;
    if (!overlayEl) return;

    const regionId = selectedZoomIdRef.current;
    if (!regionId) return;

    const region = zoomRegionsRef.current.find((r) => r.id === regionId);
    if (!region) return;

    const rect = overlayEl.getBoundingClientRect();
    const stageWidth = rect.width;
    const stageHeight = rect.height;

    if (!stageWidth || !stageHeight) {
      return;
    }

    stageSizeRef.current = { width: stageWidth, height: stageHeight };

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    const unclampedFocus: ZoomFocus = {
      cx: clamp01(localX / stageWidth),
      cy: clamp01(localY / stageHeight),
    };
    const clampedFocus = clampFocusToStage(unclampedFocus, region.depth);

    onZoomFocusChange(region.id, clampedFocus);
    updateOverlayForRegion({ ...region, focus: clampedFocus }, clampedFocus);
  };

  const handleOverlayPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isPlayingRef.current) return;
    const regionId = selectedZoomIdRef.current;
    if (!regionId) return;
    const region = zoomRegionsRef.current.find((r) => r.id === regionId);
    if (!region) return;
    onSelectZoom(region.id);
    event.preventDefault();
    isDraggingFocusRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFocusFromClientPoint(event.clientX, event.clientY);
  };

  const handleOverlayPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingFocusRef.current) return;
    event.preventDefault();
    updateFocusFromClientPoint(event.clientX, event.clientY);
  };

  const endFocusDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingFocusRef.current) return;
    isDraggingFocusRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      
    }
  };

  const handleOverlayPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    endFocusDrag(event);
  };

  const handleOverlayPointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
    endFocusDrag(event);
  };

  useEffect(() => {
    zoomRegionsRef.current = zoomRegions;
  }, [zoomRegions]);

  useEffect(() => {
    clipRegionsRef.current = clipRegions;

    // When clips change, validate current position and adjust if needed
    // IMPORTANT: Only auto-adjust if not currently seeking (allow manual scrubbing)
    const video = videoRef.current;
    if (video && clipRegions.length > 0 && !isPlayingRef.current && !isSeekingRef.current) {
      const currentMs = video.currentTime * 1000;

      // Check if current position is inside any clip
      const isInsideClip = clipRegions.some(
        clip => currentMs >= clip.startMs && currentMs <= clip.endMs
      );

      if (!isInsideClip) {
        // Find the nearest valid position
        // First, try to find the closest clip edge
        let nearestPosition = clipRegions[0].startMs;
        let minDistance = Math.abs(currentMs - nearestPosition);

        for (const clip of clipRegions) {
          const distToStart = Math.abs(currentMs - clip.startMs);
          const distToEnd = Math.abs(currentMs - clip.endMs);

          if (distToStart < minDistance) {
            minDistance = distToStart;
            nearestPosition = clip.startMs;
          }
          if (distToEnd < minDistance) {
            minDistance = distToEnd;
            nearestPosition = clip.endMs;
          }
        }

        // Seek to nearest valid position
        video.currentTime = nearestPosition / 1000;
        onTimeUpdate(video.currentTime);
      }
    }
  }, [clipRegions, onTimeUpdate]);

  useEffect(() => {
    selectedZoomIdRef.current = selectedZoomId;
  }, [selectedZoomId]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Update cursor settings when they change
  useEffect(() => {
    if (cursorRendererRef.current && cursorSettings) {
      cursorRendererRef.current.setSettings(cursorSettings);
    }
  }, [cursorSettings]);

  // Memoize effective camera settings to prevent unnecessary updates
  const effectiveCameraSettings = useMemo(() => {
    if (!cameraSettings) return null;
    return {
      ...cameraSettings,
      // Only enable if both user setting is enabled AND we have a camera video
      enabled: cameraSettings.enabled && !!cameraVideoPath,
    };
  }, [cameraSettings, cameraVideoPath]);

  // Track previous settings to prevent redundant updates
  const prevCameraSettingsRef = useRef<string | null>(null);

  // Update camera settings when they change
  // Only show camera overlay if we have both settings.enabled AND a camera video path
  useEffect(() => {
    if (!cameraRendererRef.current || !effectiveCameraSettings || !pixiReady) {
      return;
    }

    // Stringify to compare deep equality
    const settingsJson = JSON.stringify(effectiveCameraSettings);

    // Skip if settings haven't actually changed
    if (prevCameraSettingsRef.current === settingsJson) {
      return;
    }

    console.log('Camera settings changed, updating renderer:', {
      enabled: effectiveCameraSettings.enabled,
      position: effectiveCameraSettings.position,
      size: effectiveCameraSettings.size,
    });

    prevCameraSettingsRef.current = settingsJson;
    cameraRendererRef.current.setSettings(effectiveCameraSettings);
  }, [effectiveCameraSettings, pixiReady]);

  // Track if camera video is ready
  const [cameraVideoReady, setCameraVideoReady] = useState(false);
  const cameraInitializedRef = useRef(false);

  // Connect camera video to renderer when video is ready
  // This is called from the JSX video element's onCanPlay handler
  const handleCameraCanPlay = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    // Guard against infinite loop - only process once
    if (cameraInitializedRef.current) return;
    cameraInitializedRef.current = true;

    const camVideo = e.currentTarget;
    // Store the video element directly in the ref (don't rely on React's ref timing)
    cameraVideoRef.current = camVideo;

    console.log('Camera: canplay event fired (initializing)', {
      videoWidth: camVideo.videoWidth,
      videoHeight: camVideo.videoHeight,
      readyState: camVideo.readyState,
      hasCameraRenderer: !!cameraRendererRef.current,
    });
    // Seek to 0 to ensure first frame is decoded
    // Note: Don't pause here - the sync effect handles play/pause control
    camVideo.currentTime = 0;
    setCameraVideoReady(true);

    // Directly connect to renderer if available (don't wait for effect)
    if (cameraRendererRef.current) {
      console.log('Camera: Directly connecting to renderer from canplay handler');
      cameraRendererRef.current.setVideoElement(camVideo);
    }
  }, []);

  const handleCameraError = useCallback(() => {
    const camVideo = cameraVideoRef.current;
    // Log detailed info for debugging - check if src is actually set
    const srcValue = camVideo?.getAttribute('src');
    console.error('Camera: Failed to load video', {
      error: camVideo?.error,
      srcAttribute: srcValue,
      cameraVideoPath: cameraVideoPath, // from closure
      hasValidSrc: !!srcValue && srcValue.startsWith('file://'),
    });
    cameraInitializedRef.current = false;
    setCameraVideoReady(false);
  }, [cameraVideoPath]);

  // Reset camera initialization when video path changes
  // Use useLayoutEffect to ensure this runs synchronously before canplay can fire
  useLayoutEffect(() => {
    cameraInitializedRef.current = false;
    setCameraVideoReady(false);
  }, [cameraVideoPath]);

  // Connect camera to renderer when both PIXI and camera video are ready
  useEffect(() => {
    console.log('Camera: Connect effect running', {
      pixiReady,
      cameraVideoReady,
      hasCameraRenderer: !!cameraRendererRef.current,
      hasCameraVideoRef: !!cameraVideoRef.current,
    });

    if (!pixiReady || !cameraVideoReady || !cameraRendererRef.current || !cameraVideoRef.current) {
      console.log('Camera: Connect effect - conditions not met, skipping');
      return;
    }

    console.log('Camera: Connecting to renderer', {
      videoWidth: cameraVideoRef.current.videoWidth,
      videoHeight: cameraVideoRef.current.videoHeight,
    });
    cameraRendererRef.current.setVideoElement(cameraVideoRef.current);
  }, [pixiReady, cameraVideoReady]);

  // Sync camera video playback with main video
  useEffect(() => {
    const mainVideo = videoRef.current;
    const camVideo = cameraVideoRef.current;
    if (!mainVideo || !camVideo) return;

    const syncCameraTime = () => {
      if (camVideo && Math.abs(camVideo.currentTime - mainVideo.currentTime) > 0.1) {
        camVideo.currentTime = mainVideo.currentTime;
      }
    };

    const handleMainPlay = () => {
      if (camVideo && camVideo.readyState >= 2) {
        camVideo.currentTime = mainVideo.currentTime;
        camVideo.play().catch(() => {});
      }
    };

    const handleMainPause = () => {
      if (camVideo) {
        camVideo.pause();
      }
    };

    const handleMainSeeked = () => {
      syncCameraTime();
    };

    mainVideo.addEventListener('play', handleMainPlay);
    mainVideo.addEventListener('pause', handleMainPause);
    mainVideo.addEventListener('seeked', handleMainSeeked);

    return () => {
      mainVideo.removeEventListener('play', handleMainPlay);
      mainVideo.removeEventListener('pause', handleMainPause);
      mainVideo.removeEventListener('seeked', handleMainSeeked);
    };
  }, [cameraVideoPath]);

  // Update mouse tracking data when it changes or when video/pixi becomes ready
  useEffect(() => {
    if (cursorRendererRef.current && mouseTrackingData && mouseTrackingData.length > 0 && videoReady && pixiReady) {
      const video = videoRef.current;
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        console.log('Setting cursor tracking data:', {
          eventCount: mouseTrackingData.length,
          videoSize: { width: video.videoWidth, height: video.videoHeight },
          sourceBounds,
          initialMousePosition,
          firstEvent: mouseTrackingData[0],
          lastEvent: mouseTrackingData[mouseTrackingData.length - 1],
        });
        cursorRendererRef.current.setTrackingData(
          mouseTrackingData,
          video.videoWidth,
          video.videoHeight,
          sourceBounds,
          initialMousePosition
        );
      }
    }
  }, [mouseTrackingData, videoReady, pixiReady, sourceBounds, initialMousePosition]);

  // Reset click tracking when video is seeked (to avoid duplicate click effects)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleSeeked = () => {
      if (cursorRendererRef.current) {
        cursorRendererRef.current.resetClickTracking();
      }
    };

    video.addEventListener('seeked', handleSeeked);
    return () => video.removeEventListener('seeked', handleSeeked);
  }, []);

  useEffect(() => {
    if (!pixiReady || !videoReady) return;

    const app = appRef.current;
    const cameraContainer = cameraContainerRef.current;
    const video = videoRef.current;

    if (!app || !cameraContainer || !video) return;

    const tickerWasStarted = app.ticker?.started || false;
    if (tickerWasStarted && app.ticker) {
      app.ticker.stop();
    }

    const wasPlaying = !video.paused;
    if (wasPlaying) {
      video.pause();
    }

    animationStateRef.current = {
      scale: 1,
      focusX: DEFAULT_FOCUS.cx,
      focusY: DEFAULT_FOCUS.cy,
    };

    if (blurFilterRef.current) {
      blurFilterRef.current.blur = 0;
    }

    requestAnimationFrame(() => {
      const container = cameraContainerRef.current;
      const videoStage = videoContainerRef.current;
      const sprite = videoSpriteRef.current;
      const currentApp = appRef.current;
      if (!container || !videoStage || !sprite || !currentApp) {
        return;
      }

      container.scale.set(1);
      container.position.set(0, 0);
      videoStage.scale.set(1);
      videoStage.position.set(0, 0);
      sprite.scale.set(1);
      sprite.position.set(0, 0);

      layoutVideoContent();

      applyZoomTransform({
        cameraContainer: container,
        blurFilter: blurFilterRef.current,
        stageSize: stageSizeRef.current,
        baseMask: baseMaskRef.current,
        zoomScale: 1,
        focusX: DEFAULT_FOCUS.cx,
        focusY: DEFAULT_FOCUS.cy,
        motionIntensity: 0,
        isPlaying: false,
      });

      requestAnimationFrame(() => {
        const finalApp = appRef.current;
        if (wasPlaying && video) {
          video.play().catch(() => {
          });
        }
        if (tickerWasStarted && finalApp?.ticker) {
          finalApp.ticker.start();
        }
      });
    });
  }, [pixiReady, videoReady, layoutVideoContent, cropRegion]);

  useEffect(() => {
    if (!pixiReady || !videoReady) return;
    const container = containerRef.current;
    if (!container) return;

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      layoutVideoContent();
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [pixiReady, videoReady, layoutVideoContent]);

  useEffect(() => {
    if (!pixiReady || !videoReady) return;
    updateOverlayForRegion(selectedZoom);
  }, [selectedZoom, pixiReady, videoReady, updateOverlayForRegion]);

  useEffect(() => {
    const overlayEl = overlayRef.current;
    if (!overlayEl) return;
    if (!selectedZoom) {
      overlayEl.style.cursor = 'default';
      overlayEl.style.pointerEvents = 'none';
      return;
    }
    overlayEl.style.cursor = isPlaying ? 'not-allowed' : 'grab';
    overlayEl.style.pointerEvents = isPlaying ? 'none' : 'auto';
  }, [selectedZoom, isPlaying]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let mounted = true;
    let app: PIXI.Application | null = null;

    (async () => {
      app = new PIXI.Application();
      
      await app.init({
        width: container.clientWidth,
        height: container.clientHeight,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      app.ticker.maxFPS = 60;

      if (!mounted) {
        app.destroy(true, { children: true, texture: true, textureSource: true });
        return;
      }

      appRef.current = app;
      container.appendChild(app.canvas);

      // Camera container - this will be scaled/positioned for zoom
      const cameraContainer = new PIXI.Container();
      cameraContainer.sortableChildren = true; // Enable zIndex sorting for overlays
      cameraContainerRef.current = cameraContainer;
      app.stage.addChild(cameraContainer);

      // Video container - holds the masked video sprite
      const videoContainer = new PIXI.Container();
      videoContainerRef.current = videoContainer;
      cameraContainer.addChild(videoContainer);

      // Initialize cursor renderer on camera container so it zooms with video
      const cursorRenderer = new CursorRenderer(cameraContainer, cursorSettings || DEFAULT_CURSOR_SETTINGS);
      cursorRendererRef.current = cursorRenderer;

      // Initialize camera renderer on camera container (below cursor, above video)
      // Start with enabled=false, will be enabled when camera video is loaded
      const initialCameraSettings = {
        ...(cameraSettings || DEFAULT_CAMERA_SETTINGS),
        enabled: false, // Start hidden until camera video is loaded
      };
      const cameraRenderer = new CameraRenderer(cameraContainer, initialCameraSettings);
      cameraRendererRef.current = cameraRenderer;

      // Check if camera video is already ready (canplay fired before PIXI init completed)
      // If so, connect it immediately
      if (cameraVideoRef.current && cameraVideoRef.current.readyState >= 3) {
        console.log('Camera: Connecting to renderer during PIXI init (video already ready)', {
          videoWidth: cameraVideoRef.current.videoWidth,
          videoHeight: cameraVideoRef.current.videoHeight,
        });
        cameraRenderer.setVideoElement(cameraVideoRef.current);
      }

      setPixiReady(true);
    })();

    return () => {
      mounted = false;
      setPixiReady(false);
      if (cursorRendererRef.current) {
        cursorRendererRef.current.destroy();
        cursorRendererRef.current = null;
      }
      if (cameraRendererRef.current) {
        cameraRendererRef.current.destroy();
        cameraRendererRef.current = null;
      }
      if (cameraVideoRef.current) {
        cameraVideoRef.current.pause();
        // Don't remove from DOM - React handles JSX element cleanup
        cameraVideoRef.current = null;
      }
      if (app && app.renderer) {
        app.destroy(true, { children: true, texture: true, textureSource: true });
      }
      appRef.current = null;
      cameraContainerRef.current = null;
      videoContainerRef.current = null;
      videoSpriteRef.current = null;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
    allowPlaybackRef.current = false;
  }, [videoPath]);



  useEffect(() => {
    if (!pixiReady || !videoReady) return;

    const video = videoRef.current;
    const app = appRef.current;
    const videoContainer = videoContainerRef.current;
    
    if (!video || !app || !videoContainer) return;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    
    const source = PIXI.VideoSource.from(video);
    if ('autoPlay' in source) {
      (source as { autoPlay?: boolean }).autoPlay = false;
    }
    if ('autoUpdate' in source) {
      (source as { autoUpdate?: boolean }).autoUpdate = true;
    }
    const videoTexture = PIXI.Texture.from(source);
    
    const videoSprite = new PIXI.Sprite(videoTexture);
    videoSpriteRef.current = videoSprite;
    
    const maskGraphics = new PIXI.Graphics();
    videoContainer.addChild(videoSprite);
    videoContainer.addChild(maskGraphics);
    videoContainer.mask = maskGraphics;
    maskGraphicsRef.current = maskGraphics;

    animationStateRef.current = {
      scale: 1,
      focusX: DEFAULT_FOCUS.cx,
      focusY: DEFAULT_FOCUS.cy,
    };

    const blurFilter = new PIXI.BlurFilter();
    blurFilter.quality = 3;
    blurFilter.resolution = app.renderer.resolution;
    blurFilter.blur = 0;
    videoContainer.filters = [blurFilter];
    blurFilterRef.current = blurFilter;
    
    layoutVideoContent();
    video.pause();

    const { handlePlay, handlePause, handleSeeked, handleSeeking } = createVideoEventHandlers({
      video,
      isSeekingRef,
      isPlayingRef,
      allowPlaybackRef,
      currentTimeRef,
      timeUpdateAnimationRef,
      clipRegionsRef,
      onPlayStateChange,
      onTimeUpdate,
    });
    
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handlePause);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('seeking', handleSeeking);
    
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handlePause);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('seeking', handleSeeking);
      
      if (timeUpdateAnimationRef.current) {
        cancelAnimationFrame(timeUpdateAnimationRef.current);
      }
      
      if (videoSprite) {
        videoContainer.removeChild(videoSprite);
        videoSprite.destroy();
      }
      if (maskGraphics) {
        videoContainer.removeChild(maskGraphics);
        maskGraphics.destroy();
      }
      videoContainer.mask = null;
      maskGraphicsRef.current = null;
      if (blurFilterRef.current) {
        videoContainer.filters = [];
        blurFilterRef.current.destroy();
        blurFilterRef.current = null;
      }
      videoTexture.destroy(true);
      
      videoSpriteRef.current = null;
    };
  }, [pixiReady, videoReady, onTimeUpdate, updateOverlayForRegion]);

  useEffect(() => {
    if (!pixiReady || !videoReady) return;

    const app = appRef.current;
    const videoSprite = videoSpriteRef.current;
    const videoContainer = videoContainerRef.current;
    if (!app || !videoSprite || !videoContainer) return;

    const applyTransform = (motionIntensity: number) => {
      const cameraContainer = cameraContainerRef.current;
      if (!cameraContainer) return;

      const state = animationStateRef.current;

      applyZoomTransform({
        cameraContainer,
        blurFilter: blurFilterRef.current,
        stageSize: stageSizeRef.current,
        baseMask: baseMaskRef.current,
        zoomScale: state.scale,
        focusX: state.focusX,
        focusY: state.focusY,
        motionIntensity,
        isPlaying: isPlayingRef.current,
      });
    };

    const ticker = () => {
      const { region, strength } = findDominantRegion(zoomRegionsRef.current, currentTimeRef.current);
      
      const defaultFocus = DEFAULT_FOCUS;
      let targetScaleFactor = 1;
      let targetFocus = defaultFocus;

      // If a zoom is selected but video is not playing, show default unzoomed view
      // (the overlay will show where the zoom will be)
      const selectedId = selectedZoomIdRef.current;
      const hasSelectedZoom = selectedId !== null;
      const shouldShowUnzoomedView = hasSelectedZoom && !isPlayingRef.current;

      if (region && strength > 0 && !shouldShowUnzoomedView) {
        const zoomScale = ZOOM_DEPTH_SCALES[region.depth];
        const regionFocus = clampFocusToStage(region.focus, region.depth);
        
        // Interpolate scale and focus based on region strength
        targetScaleFactor = 1 + (zoomScale - 1) * strength;
        targetFocus = {
          cx: defaultFocus.cx + (regionFocus.cx - defaultFocus.cx) * strength,
          cy: defaultFocus.cy + (regionFocus.cy - defaultFocus.cy) * strength,
        };
      }

      const state = animationStateRef.current;

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

      const motionIntensity = Math.max(
        Math.abs(nextScale - prevScale),
        Math.abs(nextFocusX - prevFocusX),
        Math.abs(nextFocusY - prevFocusY)
      );

      applyTransform(motionIntensity);

      // Only update cursor/camera when layout has been calculated
      const layoutReady = stageSizeRef.current.width > 0 && stageSizeRef.current.height > 0;

      // Update cursor position for current video time
      if (cursorRendererRef.current && layoutReady) {
        // Update video layout for proper cursor positioning
        cursorRendererRef.current.setVideoLayout(
          baseScaleRef.current,
          baseOffsetRef.current.x,
          baseOffsetRef.current.y
        );
        cursorRendererRef.current.updateForTime(
          currentTimeRef.current // Already in milliseconds from videoEventHandlers
        );
      }

      // Update camera renderer stage size for proper positioning
      if (cameraRendererRef.current && layoutReady) {
        cameraRendererRef.current.setStageSize(
          stageSizeRef.current.width,
          stageSizeRef.current.height
        );
        cameraRendererRef.current.setVideoLayout(
          baseScaleRef.current,
          baseOffsetRef.current.x,
          baseOffsetRef.current.y
        );
        // Force camera texture update every frame (needed for seeking while paused)
        cameraRendererRef.current.updateForTime();

        // Sync camera video time if needed
        const camVideo = cameraVideoRef.current;
        const mainVideo = videoRef.current;
        if (camVideo && mainVideo) {
          const currentSec = currentTimeRef.current / 1000;
          // If drifted by more than 0.1s, sync it
          if (Math.abs(camVideo.currentTime - currentSec) > 0.1) {
            camVideo.currentTime = currentSec;
          }
          // Ensure camera playback state matches main video
          // Only try to play if main video is actually playing (not just isPlayingRef)
          if (!mainVideo.paused && camVideo.paused && camVideo.readyState >= 2) {
            camVideo.play().catch(() => {});
          }
          // Ensure camera is paused if main video is paused
          if (mainVideo.paused && !camVideo.paused) {
            camVideo.pause();
          }
        }
      }
    };

    app.ticker.add(ticker);
    return () => {
      if (app && app.ticker) {
        app.ticker.remove(ticker);
      }
    };
  }, [pixiReady, videoReady, clampFocusToStage]);

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    onDurationChange(video.duration);
    video.currentTime = 0;
    video.pause();
    allowPlaybackRef.current = false;
    currentTimeRef.current = 0;
    // Don't set videoReady here - wait for canplay event
    // to ensure video frame data is actually available for WebGL texture
  };

  const handleCanPlay = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    // Only set ready once, and ensure we have valid dimensions
    if (!videoReady && video.videoWidth > 0 && video.videoHeight > 0) {
      setVideoReady(true);
    }
  };

  const [resolvedWallpaper, setResolvedWallpaper] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        if (!wallpaper) {
          const def = await getAssetPath('wallpapers/wallpaper1.jpg')
          if (mounted) setResolvedWallpaper(def)
          return
        }

        if (wallpaper.startsWith('#') || wallpaper.startsWith('linear-gradient') || wallpaper.startsWith('radial-gradient')) {
          if (mounted) setResolvedWallpaper(wallpaper)
          return
        }

        // If it's a data URL (custom uploaded image), use as-is
        if (wallpaper.startsWith('data:')) {
          if (mounted) setResolvedWallpaper(wallpaper)
          return
        }

        // If it's an absolute web/http or file path, use as-is
        if (wallpaper.startsWith('http') || wallpaper.startsWith('file://') || wallpaper.startsWith('/')) {
          // If it's an absolute server path (starts with '/'), resolve via getAssetPath as well
          if (wallpaper.startsWith('/')) {
            const rel = wallpaper.replace(/^\//, '')
            const p = await getAssetPath(rel)
            if (mounted) setResolvedWallpaper(p)
            return
          }
          if (mounted) setResolvedWallpaper(wallpaper)
          return
        }
        const p = await getAssetPath(wallpaper.replace(/^\//, ''))
        if (mounted) setResolvedWallpaper(p)
      } catch (err) {
        if (mounted) setResolvedWallpaper(wallpaper || '/wallpapers/wallpaper1.jpg')
      }
    })()
    return () => { mounted = false }
  }, [wallpaper])

  const isImageUrl = Boolean(resolvedWallpaper && (resolvedWallpaper.startsWith('file://') || resolvedWallpaper.startsWith('http') || resolvedWallpaper.startsWith('/') || resolvedWallpaper.startsWith('data:')))
  const backgroundStyle = isImageUrl
    ? { backgroundImage: `url(${resolvedWallpaper || ''})` }
    : { background: resolvedWallpaper || '' };

  return (
    <div className="relative aspect-video rounded-sm overflow-hidden" style={{ width: '100%' }}>
      {/* Background layer - always render as DOM element with blur */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          ...backgroundStyle,
          filter: showBlur ? 'blur(2px)' : 'none',
        }}
      />
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{
          filter: showShadow
            ? 'drop-shadow(0 12px 48px rgba(0,0,0,0.7)) drop-shadow(0 4px 16px rgba(0,0,0,0.5)) drop-shadow(0 2px 8px rgba(0,0,0,0.3))'
            : 'none',
        }}
      />
      {/* Only render overlay after PIXI and video are fully initialized */}
      {pixiReady && videoReady && (
        <div
          ref={overlayRef}
          className="absolute inset-0 select-none"
          style={{ pointerEvents: 'none' }}
          onPointerDown={handleOverlayPointerDown}
          onPointerMove={handleOverlayPointerMove}
          onPointerUp={handleOverlayPointerUp}
          onPointerLeave={handleOverlayPointerLeave}
        >
          <div
            ref={focusIndicatorRef}
            className="absolute rounded-md border border-[#34B27B]/80 bg-[#34B27B]/20 shadow-[0_0_0_1px_rgba(52,178,123,0.35)]"
            style={{ display: 'none', pointerEvents: 'none' }}
          />
        </div>
      )}
      <video
        ref={videoRef}
        src={videoPath}
        className="hidden"
        preload="auto"
        playsInline
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onDurationChange={e => {
          onDurationChange(e.currentTarget.duration);
        }}
        onError={() => onError('Failed to load video')}
      />
      {/* Camera video element - hidden, rendered same as main video for proper file:// URL handling */}
      {cameraVideoPath && (
        <video
          ref={cameraVideoRef}
          src={cameraVideoPath}
          className="hidden"
          preload="auto"
          playsInline
          muted
          onCanPlay={handleCameraCanPlay}
          onError={handleCameraError}
        />
      )}
    </div>
  );
});

VideoPlayback.displayName = 'VideoPlayback';

export default VideoPlayback;
