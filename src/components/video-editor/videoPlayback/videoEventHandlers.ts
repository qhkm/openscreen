import type React from 'react';
import type { ClipRegion } from '../types';
import { findClipAtSourceTime, getNextClipStart, sortClips } from '../clipUtils';

interface VideoEventHandlersParams {
  video: HTMLVideoElement;
  isSeekingRef: React.MutableRefObject<boolean>;
  isPlayingRef: React.MutableRefObject<boolean>;
  allowPlaybackRef: React.MutableRefObject<boolean>;
  currentTimeRef: React.MutableRefObject<number>;
  timeUpdateAnimationRef: React.MutableRefObject<number | null>;
  clipRegionsRef: React.MutableRefObject<ClipRegion[]>;
  onPlayStateChange: (playing: boolean) => void;
  onTimeUpdate: (time: number) => void;
}

export function createVideoEventHandlers(params: VideoEventHandlersParams) {
  const {
    video,
    isSeekingRef,
    isPlayingRef,
    allowPlaybackRef,
    currentTimeRef,
    timeUpdateAnimationRef,
    clipRegionsRef,
    onPlayStateChange,
    onTimeUpdate,
  } = params;

  const emitTime = (timeValue: number) => {
    currentTimeRef.current = timeValue * 1000;
    onTimeUpdate(timeValue);
  };

  // Track if we're doing a programmatic skip (to avoid pausing during gap jumps)
  let isSkippingGap = false;

  function updateTime() {
    if (!video) return;

    const currentMs = video.currentTime * 1000;
    const clips = clipRegionsRef.current;

    // Check if we're inside a clip or need to skip
    if (clips.length > 0) {
      const currentClip = findClipAtSourceTime(currentMs, clips);

      if (!currentClip) {
        // We're in a gap - skip to next clip
        const nextClipStart = getNextClipStart(currentMs, clips);

        if (nextClipStart !== null) {
          // Mark that we're skipping - don't schedule next frame until seeked
          isSkippingGap = true;
          video.currentTime = nextClipStart / 1000;
          // Don't schedule next frame here - let handleSeeked do it
          return;
        } else {
          // No more clips - we've reached the end
          video.pause();
          // Seek to end of last clip
          const sorted = sortClips(clips);
          const lastClip = sorted[sorted.length - 1];
          if (lastClip) {
            video.currentTime = lastClip.endMs / 1000;
            emitTime(video.currentTime);
          }
          return;
        }
      }

      // Check if we've passed the end of current clip
      if (currentMs >= currentClip.endMs) {
        const nextClipStart = getNextClipStart(currentMs, clips);

        if (nextClipStart !== null) {
          isSkippingGap = true;
          video.currentTime = nextClipStart / 1000;
          // Don't schedule next frame here - let handleSeeked do it
          return;
        } else {
          // No more clips - end playback
          video.pause();
          emitTime(currentClip.endMs / 1000);
          return;
        }
      }
    }

    emitTime(video.currentTime);
    if (!video.paused && !video.ended) {
      timeUpdateAnimationRef.current = requestAnimationFrame(updateTime);
    }
  }

  const handlePlay = () => {
    if (isSeekingRef.current) {
      video.pause();
      return;
    }

    if (!allowPlaybackRef.current) {
      video.pause();
      return;
    }

    // Before starting playback, check if current position is valid (inside a clip)
    const clips = clipRegionsRef.current;
    if (clips.length > 0) {
      const currentMs = video.currentTime * 1000;
      const currentClip = findClipAtSourceTime(currentMs, clips);

      if (!currentClip) {
        // Current position is outside any clip - seek to valid position
        const nextClipStart = getNextClipStart(currentMs, clips);
        if (nextClipStart !== null) {
          // Seek to next clip start
          video.currentTime = nextClipStart / 1000;
          emitTime(video.currentTime);
        } else {
          // No clips ahead - seek to first clip start
          const sorted = sortClips(clips);
          if (sorted.length > 0) {
            video.currentTime = sorted[0].startMs / 1000;
            emitTime(video.currentTime);
          }
        }
      }
    }

    isPlayingRef.current = true;
    onPlayStateChange(true);
    if (timeUpdateAnimationRef.current) {
      cancelAnimationFrame(timeUpdateAnimationRef.current);
    }
    timeUpdateAnimationRef.current = requestAnimationFrame(updateTime);
  };

    const handlePause = () => {
    isPlayingRef.current = false;
    onPlayStateChange(false);
    if (timeUpdateAnimationRef.current) {
      cancelAnimationFrame(timeUpdateAnimationRef.current);
      timeUpdateAnimationRef.current = null;
    }
    emitTime(video.currentTime);
  };

  const handleSeeked = () => {
    isSeekingRef.current = false;

    // If we were skipping a gap, resume playback
    if (isSkippingGap) {
      isSkippingGap = false;
      emitTime(video.currentTime);
      // Resume animation loop if still playing
      if (isPlayingRef.current && !video.paused && !video.ended) {
        timeUpdateAnimationRef.current = requestAnimationFrame(updateTime);
      }
      return;
    }

    if (!isPlayingRef.current && !video.paused) {
      video.pause();
    }
    emitTime(video.currentTime);
  };

  const handleSeeking = () => {
    isSeekingRef.current = true;

    // Don't pause or emit time during gap skips - let it complete smoothly
    if (isSkippingGap) {
      return;
    }

    if (!isPlayingRef.current && !video.paused) {
      video.pause();
    }
    emitTime(video.currentTime);
  };

  return {
    handlePlay,
    handlePause,
    handleSeeked,
    handleSeeking,
  };
}
