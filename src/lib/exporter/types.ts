import type { CursorSettings, MouseTrackingEvent, SourceBounds } from '@/components/video-editor/types';

export interface ExportConfig {
  width: number;
  height: number;
  frameRate: number;
  bitrate: number;
  codec?: string;
}

export interface CursorConfig {
  cursorSettings: CursorSettings;
  mouseTrackingData: MouseTrackingEvent[];
  sourceBounds: SourceBounds | null;
}

export interface ExportProgress {
  currentFrame: number;
  totalFrames: number;
  percentage: number;
  estimatedTimeRemaining: number; // in seconds
}

export interface ExportResult {
  success: boolean;
  blob?: Blob;
  error?: string;
}

export interface VideoFrameData {
  frame: VideoFrame;
  timestamp: number; // in microseconds
  duration: number; // in microseconds
}
