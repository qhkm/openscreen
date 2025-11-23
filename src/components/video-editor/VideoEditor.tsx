

import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

import VideoPlayback, { VideoPlaybackRef } from "./VideoPlayback";
import PlaybackControls from "./PlaybackControls";
import TimelineEditor from "./timeline/TimelineEditor";
import { SettingsPanel } from "./SettingsPanel";
import { ExportDialog } from "./ExportDialog";
import { ExportOptionsDialog } from "./ExportOptionsDialog";

import type { Span } from "dnd-timeline";
import {
  DEFAULT_ZOOM_DEPTH,
  clampFocusToDepth,
  DEFAULT_CROP_REGION,
  DEFAULT_CURSOR_SETTINGS,
  type ZoomDepth,
  type ZoomFocus,
  type ZoomRegion,
  type CropRegion,
  type CursorSettings,
  type MouseTrackingEvent,
  type SourceBounds,
  type ExportOptions,
} from "./types";
import { VideoExporter, type ExportProgress } from "@/lib/exporter";

const WALLPAPER_COUNT = 23;
const WALLPAPER_PATHS = Array.from({ length: WALLPAPER_COUNT }, (_, i) => `/wallpapers/wallpaper${i + 1}.jpg`);

export default function VideoEditor() {
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [wallpaper, setWallpaper] = useState<string>(WALLPAPER_PATHS[0]);
  const [showShadow, setShowShadow] = useState(false);
  const [showBlur, setShowBlur] = useState(false);
  const [cropRegion, setCropRegion] = useState<CropRegion>(DEFAULT_CROP_REGION);
  const [zoomRegions, setZoomRegions] = useState<ZoomRegion[]>([]);
  const [selectedZoomId, setSelectedZoomId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showExportOptionsDialog, setShowExportOptionsDialog] = useState(false);
  const [cursorSettings, setCursorSettings] = useState<CursorSettings>(DEFAULT_CURSOR_SETTINGS);
  const [mouseTrackingData, setMouseTrackingData] = useState<MouseTrackingEvent[]>([]);
  const [sourceBounds, setSourceBounds] = useState<SourceBounds | null>(null);

  const videoPlaybackRef = useRef<VideoPlaybackRef>(null);
  const nextZoomIdRef = useRef(1);
  const exporterRef = useRef<VideoExporter | null>(null);

  useEffect(() => {
    async function loadVideo() {
      try {
        const result = await window.electronAPI.getRecordedVideoPath();
        if (result.success && result.path) {
          setVideoPath(`file://${result.path}`);
        } else {
          setError(result.message || 'Failed to load video');
        }

        // Also load mouse tracking data
        const trackingResult = await window.electronAPI.getMouseTrackingData();
        if (trackingResult.success && trackingResult.data) {
          setMouseTrackingData(trackingResult.data);
          setSourceBounds(trackingResult.sourceBounds || null);
          console.log('Loaded mouse tracking data:', trackingResult.data.length, 'events', 'sourceBounds:', trackingResult.sourceBounds);
        }
      } catch (err) {
        setError('Error loading video: ' + String(err));
      } finally {
        setLoading(false);
      }
    }
    loadVideo();
  }, []);

  const togglePlayPause = useCallback(() => {
    const playback = videoPlaybackRef.current;
    const video = playback?.video;
    if (!playback || !video) return;

    if (isPlaying) {
      playback.pause();
    } else {
      playback.play().catch(err => console.error('Video play failed:', err));
    }
  }, [isPlaying]);

  // Keyboard shortcut: Space to toggle play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause]);

  function handleSeek(time: number) {
    const video = videoPlaybackRef.current?.video;
    if (!video) return;

    // Update UI immediately for responsive feel
    setCurrentTime(time);

    // Use fastSeek for quicker seeking when available (less precise but faster)
    if ('fastSeek' in video && typeof video.fastSeek === 'function') {
      video.fastSeek(time);
    } else {
      video.currentTime = time;
    }
  }

  const handleSelectZoom = useCallback((id: string | null) => {
    setSelectedZoomId(id);
  }, []);

  const handleZoomAdded = useCallback((span: Span) => {
    const id = `zoom-${nextZoomIdRef.current++}`;
    const newRegion: ZoomRegion = {
      id,
      startMs: Math.round(span.start),
      endMs: Math.round(span.end),
      depth: DEFAULT_ZOOM_DEPTH,
      focus: { cx: 0.5, cy: 0.5 },
    };
    console.log('Zoom region added:', newRegion);
    setZoomRegions((prev) => [...prev, newRegion]);
    setSelectedZoomId(id);
  }, []);

  const handleZoomSpanChange = useCallback((id: string, span: Span) => {
    console.log('Zoom span changed:', { id, start: Math.round(span.start), end: Math.round(span.end) });
    setZoomRegions((prev) =>
      prev.map((region) =>
        region.id === id
          ? {
              ...region,
              startMs: Math.round(span.start),
              endMs: Math.round(span.end),
            }
          : region,
      ),
    );
  }, []);

  const handleZoomFocusChange = useCallback((id: string, focus: ZoomFocus) => {
    setZoomRegions((prev) =>
      prev.map((region) =>
        region.id === id
          ? {
              ...region,
              focus: clampFocusToDepth(focus, region.depth),
            }
          : region,
      ),
    );
  }, []);

  const handleZoomDepthChange = useCallback((depth: ZoomDepth) => {
    if (!selectedZoomId) return;
    setZoomRegions((prev) =>
      prev.map((region) =>
        region.id === selectedZoomId
          ? {
              ...region,
              depth,
              focus: clampFocusToDepth(region.focus, depth),
            }
          : region,
      ),
    );
  }, [selectedZoomId]);

  const handleZoomDelete = useCallback((id: string) => {
    console.log('Zoom region deleted:', id);
    setZoomRegions((prev) => prev.filter((region) => region.id !== id));
    if (selectedZoomId === id) {
      setSelectedZoomId(null);
    }
  }, [selectedZoomId]);

  // Keyboard shortcut: Delete/Backspace to remove selected zoom region
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Delete/Backspace removes selected zoom region
      if ((e.code === 'Delete' || e.code === 'Backspace') && selectedZoomId) {
        e.preventDefault();
        handleZoomDelete(selectedZoomId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedZoomId, handleZoomDelete]);

  useEffect(() => {
    if (selectedZoomId && !zoomRegions.some((region) => region.id === selectedZoomId)) {
      setSelectedZoomId(null);
    }
  }, [selectedZoomId, zoomRegions]);

  const handleOpenExportOptions = useCallback(() => {
    if (!videoPath) {
      toast.error('No video loaded');
      return;
    }

    const video = videoPlaybackRef.current?.video;
    if (!video) {
      toast.error('Video not ready');
      return;
    }

    setShowExportOptionsDialog(true);
  }, [videoPath]);

  const handleExport = useCallback(async (options: ExportOptions) => {
    setShowExportOptionsDialog(false);
    setShowExportDialog(true);
    setIsExporting(true);
    setExportProgress(null);
    setExportError(null);

    try {
      const wasPlaying = isPlaying;
      if (wasPlaying) {
        videoPlaybackRef.current?.pause();
      }

      const { resolution, frameRate, compression } = options;

      const exporter = new VideoExporter({
        videoUrl: videoPath!,
        width: resolution.width,
        height: resolution.height,
        frameRate,
        bitrate: compression.bitrate,
        codec: 'avc1.640033',
        wallpaper,
        zoomRegions,
        showShadow,
        showBlur,
        cropRegion,
        cursorConfig: mouseTrackingData.length > 0 ? {
          cursorSettings,
          mouseTrackingData,
          sourceBounds,
        } : undefined,
        onProgress: (progress: ExportProgress) => {
          setExportProgress(progress);
        },
      });

      exporterRef.current = exporter;
      const result = await exporter.export();

      if (result.success && result.blob) {
        const arrayBuffer = await result.blob.arrayBuffer();
        const timestamp = Date.now();
        const fileName = `export-${timestamp}.mp4`;

        const saveResult = await window.electronAPI.saveExportedVideo(arrayBuffer, fileName);

        if (saveResult.success) {
          toast.success('Video exported successfully!');
        } else {
          setExportError(saveResult.message || 'Failed to save video');
          toast.error(saveResult.message || 'Failed to save video');
        }
      } else {
        setExportError(result.error || 'Export failed');
        toast.error(result.error || 'Export failed');
      }

      if (wasPlaying) {
        videoPlaybackRef.current?.play();
      }
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setExportError(errorMessage);
      toast.error(`Export failed: ${errorMessage}`);
    } finally {
      setIsExporting(false);
      exporterRef.current = null;
    }
  }, [videoPath, wallpaper, zoomRegions, showShadow, showBlur, cropRegion, isPlaying, cursorSettings, mouseTrackingData, sourceBounds]);

  const handleCancelExport = useCallback(() => {
    if (exporterRef.current) {
      exporterRef.current.cancel();
      toast.info('Export cancelled');
      setShowExportDialog(false);
      setIsExporting(false);
      setExportProgress(null);
      setExportError(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#09090b]">
        <div className="relative">
          {/* Animated spinner */}
          <div className="w-12 h-12 rounded-full border-2 border-zinc-800 border-t-emerald-500 animate-spin" />
        </div>
        <p className="mt-6 text-sm font-medium text-zinc-400">Loading your recording...</p>
        <p className="mt-2 text-xs text-zinc-600">Preparing video editor</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#09090b]">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-zinc-200 mb-2">Failed to load video</p>
        <p className="text-xs text-zinc-500 max-w-xs text-center mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const isMac = navigator.userAgent.includes('Mac');

  return (
    <div className="flex flex-col h-screen bg-[#09090b] text-slate-200 overflow-hidden selection:bg-[#34B27B]/30">
      {/* Drag region for window - more padding on macOS for traffic lights */}
      <div 
        className={`h-10 flex-shrink-0 bg-[#09090b]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between ${isMac ? 'pl-20 pr-4' : 'px-4'} z-50`}
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex-1" />

      </div>

      <div className="flex-1 p-4 gap-4 flex min-h-0 relative">
        {/* Left Column - Video & Timeline */}
        <div className="flex-[7] flex flex-col gap-3 min-w-0 h-full">
          {/* Video Preview Area */}
          <div className="flex-shrink-0 bg-black/40 rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
            <div className="flex flex-col">
              {/* Video Container - Fixed aspect ratio */}
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}> {/* 16:9 aspect ratio */}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="relative w-full h-full max-w-full max-h-full">
                    <VideoPlayback
                      ref={videoPlaybackRef}
                      videoPath={videoPath || ''}
                      onDurationChange={setDuration}
                      onTimeUpdate={setCurrentTime}
                      onPlayStateChange={setIsPlaying}
                      onError={setError}
                      wallpaper={wallpaper}
                      zoomRegions={zoomRegions}
                      selectedZoomId={selectedZoomId}
                      onSelectZoom={handleSelectZoom}
                      onZoomFocusChange={handleZoomFocusChange}
                      isPlaying={isPlaying}
                      showShadow={showShadow}
                      showBlur={showBlur}
                      cropRegion={cropRegion}
                      cursorSettings={cursorSettings}
                      mouseTrackingData={mouseTrackingData}
                      sourceBounds={sourceBounds}
                    />
                  </div>
                </div>
              </div>
              
              {/* Playback Controls - Below video */}
              <div className="px-4 pb-3 pt-2">
                <PlaybackControls
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  duration={duration}
                  onTogglePlayPause={togglePlayPause}
                  onSeek={handleSeek}
                />
              </div>
            </div>
          </div>

          {/* Timeline Area */}
          <div className="flex-1 min-h-[180px] bg-[#09090b] rounded-2xl border border-white/5 shadow-lg overflow-hidden flex flex-col">
            <TimelineEditor
              videoDuration={duration}
              currentTime={currentTime}
              onSeek={handleSeek}
              zoomRegions={zoomRegions}
              onZoomAdded={handleZoomAdded}
              onZoomSpanChange={handleZoomSpanChange}
              onZoomDelete={handleZoomDelete}
              selectedZoomId={selectedZoomId}
              onSelectZoom={handleSelectZoom}
            />
          </div>
        </div>

          {/* Right Column - Settings */}
        <SettingsPanel
          selected={wallpaper}
          onWallpaperChange={setWallpaper}
          selectedZoomDepth={selectedZoomId ? zoomRegions.find(z => z.id === selectedZoomId)?.depth : null}
          onZoomDepthChange={(depth) => selectedZoomId && handleZoomDepthChange(depth)}
          selectedZoomId={selectedZoomId}
          onZoomDelete={handleZoomDelete}
          showShadow={showShadow}
          onShadowChange={setShowShadow}
          showBlur={showBlur}
          onBlurChange={setShowBlur}
          cropRegion={cropRegion}
          onCropChange={setCropRegion}
          cursorSettings={cursorSettings}
          onCursorSettingsChange={setCursorSettings}
          videoElement={videoPlaybackRef.current?.video || null}
          onExport={handleOpenExportOptions}
        />
      </div>

      <Toaster theme="dark" className="pointer-events-auto" />
      
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        progress={exportProgress}
        isExporting={isExporting}
        error={exportError}
        onCancel={handleCancelExport}
      />

      <ExportOptionsDialog
        isOpen={showExportOptionsDialog}
        onClose={() => setShowExportOptionsDialog(false)}
        onExport={handleExport}
        videoDuration={duration}
      />
    </div>
  );
}