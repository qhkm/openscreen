import type { ExportOptions } from '@/components/video-editor/types';

export interface ExportEstimate {
  timeSeconds: number;
  fileSizeMB: number;
}

/**
 * Calculate estimated export time and file size based on options.
 *
 * Time estimation: encoding is roughly 1-3x realtime depending on resolution
 * Size estimation: bitrate * duration + ~10% overhead
 */
export function calculateExportEstimate(
  durationSeconds: number,
  options: ExportOptions
): ExportEstimate {
  const { resolution, compression, frameRate } = options;

  // Encoding time multipliers based on resolution and frame rate
  // Higher resolution = slower encoding
  let encodingMultiplier = 1.5; // base for 1080p @ 60fps

  if (resolution.key === '720p') {
    encodingMultiplier = 1.0;
  } else if (resolution.key === '4k') {
    encodingMultiplier = 3.0;
  }

  // Adjust for frame rate (higher = slower)
  if (frameRate === 30) {
    encodingMultiplier *= 0.7;
  } else if (frameRate === 24) {
    encodingMultiplier *= 0.6;
  }

  // Estimate time (encoding is roughly this many times slower than realtime)
  const timeSeconds = durationSeconds * encodingMultiplier;

  // Estimate file size
  // Formula: (bitrate * duration) / 8 / 1024 / 1024 = MB
  // Add ~15% overhead for container, metadata, etc.
  const baseSizeMB = (compression.bitrate * durationSeconds) / 8 / 1024 / 1024;
  const fileSizeMB = baseSizeMB * 1.15;

  return {
    timeSeconds: Math.max(1, Math.round(timeSeconds)),
    fileSizeMB: Math.round(fileSizeMB * 10) / 10, // Round to 1 decimal
  };
}

/**
 * Format estimated time as human-readable string
 */
export function formatEstimatedTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  return `${minutes} min ${remainingSeconds} sec`;
}

/**
 * Format estimated file size as human-readable string
 */
export function formatEstimatedSize(megabytes: number): string {
  if (megabytes < 1) {
    return `${Math.round(megabytes * 1024)}KB`;
  }

  if (megabytes >= 1024) {
    return `${(megabytes / 1024).toFixed(1)}GB`;
  }

  return `${megabytes.toFixed(1)}MB`;
}
