import type { ClipRegion } from './types';

/**
 * Utility functions for handling clip regions
 * Clips define which portions of the source video are included in playback/export.
 * Video outside of clips is cut out.
 */

/**
 * Sort clips by start time
 */
export function sortClips(clips: ClipRegion[]): ClipRegion[] {
  return [...clips].sort((a, b) => a.startMs - b.startMs);
}

/**
 * Calculate the total duration of all clips combined (in milliseconds)
 */
export function getTotalClipDuration(clips: ClipRegion[]): number {
  return clips.reduce((total, clip) => total + (clip.endMs - clip.startMs), 0);
}

/**
 * Convert "output time" (continuous playback time) to "source time" (position in original video)
 *
 * For example, if we have two clips:
 * - Clip 1: 0-3000ms (source), maps to 0-3000ms (output)
 * - Clip 2: 5000-8000ms (source), maps to 3000-6000ms (output)
 *
 * outputTimeToSourceTime(4000) would return 6000 (middle of clip 2 in source)
 */
export function outputTimeToSourceTime(outputTimeMs: number, clips: ClipRegion[]): number | null {
  if (clips.length === 0) return outputTimeMs; // No clips = pass through

  const sorted = sortClips(clips);
  let accumulatedOutput = 0;

  for (const clip of sorted) {
    const clipDuration = clip.endMs - clip.startMs;

    if (outputTimeMs < accumulatedOutput + clipDuration) {
      // Output time falls within this clip
      const offsetInClip = outputTimeMs - accumulatedOutput;
      return clip.startMs + offsetInClip;
    }

    accumulatedOutput += clipDuration;
  }

  // Output time is past all clips - return end of last clip
  const lastClip = sorted[sorted.length - 1];
  return lastClip ? lastClip.endMs : null;
}

/**
 * Convert "source time" (position in original video) to "output time" (continuous playback time)
 * Returns null if the source time is not within any clip (in a gap)
 */
export function sourceTimeToOutputTime(sourceTimeMs: number, clips: ClipRegion[]): number | null {
  if (clips.length === 0) return sourceTimeMs; // No clips = pass through

  const sorted = sortClips(clips);
  let accumulatedOutput = 0;

  for (const clip of sorted) {
    if (sourceTimeMs >= clip.startMs && sourceTimeMs <= clip.endMs) {
      // Source time is within this clip
      const offsetInClip = sourceTimeMs - clip.startMs;
      return accumulatedOutput + offsetInClip;
    }

    if (sourceTimeMs < clip.startMs) {
      // Source time is in a gap before this clip
      return null;
    }

    accumulatedOutput += (clip.endMs - clip.startMs);
  }

  // Source time is after all clips
  return null;
}

/**
 * Find the clip that contains the given source time
 * Returns null if the time is in a gap between clips
 */
export function findClipAtSourceTime(sourceTimeMs: number, clips: ClipRegion[]): ClipRegion | null {
  return clips.find(clip => sourceTimeMs >= clip.startMs && sourceTimeMs <= clip.endMs) || null;
}

/**
 * Get the next clip start time after the given source time
 * Useful for skipping gaps during playback
 */
export function getNextClipStart(sourceTimeMs: number, clips: ClipRegion[]): number | null {
  const sorted = sortClips(clips);

  for (const clip of sorted) {
    if (clip.startMs > sourceTimeMs) {
      return clip.startMs;
    }
  }

  return null;
}

/**
 * Check if a source time is within a gap (not inside any clip)
 */
export function isInGap(sourceTimeMs: number, clips: ClipRegion[]): boolean {
  return findClipAtSourceTime(sourceTimeMs, clips) === null;
}

/**
 * Generate frame times for export based on clips
 * Returns an array of source video times (in seconds) that should be rendered
 */
export function generateClipFrameTimes(clips: ClipRegion[], frameRate: number): number[] {
  if (clips.length === 0) return [];

  const sorted = sortClips(clips);
  const frameTimes: number[] = [];
  const frameIntervalMs = 1000 / frameRate;

  for (const clip of sorted) {
    let currentMs = clip.startMs;
    while (currentMs < clip.endMs) {
      frameTimes.push(currentMs / 1000); // Convert to seconds
      currentMs += frameIntervalMs;
    }
  }

  return frameTimes;
}

/**
 * Get the clip boundaries as output timestamps
 * Useful for timeline visualization
 */
export function getClipOutputRanges(clips: ClipRegion[]): Array<{ outputStartMs: number; outputEndMs: number; clip: ClipRegion }> {
  const sorted = sortClips(clips);
  const ranges: Array<{ outputStartMs: number; outputEndMs: number; clip: ClipRegion }> = [];
  let outputOffset = 0;

  for (const clip of sorted) {
    const duration = clip.endMs - clip.startMs;
    ranges.push({
      outputStartMs: outputOffset,
      outputEndMs: outputOffset + duration,
      clip,
    });
    outputOffset += duration;
  }

  return ranges;
}
