import { useCallback } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { TimelineContext } from "dnd-timeline";
import type { DragEndEvent, Range, ResizeEndEvent, Span } from "dnd-timeline";
import type { ZoomRegion, ClipRegion } from "../types";

// Snap threshold in milliseconds - items will snap when within this distance
const SNAP_THRESHOLD_MS = 50;

interface TimelineWrapperProps {
  children: ReactNode;
  range: Range;
  videoDuration: number;
  hasOverlap: (newSpan: Span, excludeId?: string) => boolean;
  onRangeChange: Dispatch<SetStateAction<Range>>;
  minItemDurationMs: number;
  minVisibleRangeMs: number;
  gridSizeMs: number;
  onItemSpanChange: (id: string, span: Span) => void;
  // For snapping
  clipRegions: ClipRegion[];
  zoomRegions: ZoomRegion[];
}

export default function TimelineWrapper({
  children,
  range,
  videoDuration,
  hasOverlap,
  onRangeChange,
  minItemDurationMs,
  minVisibleRangeMs,
  gridSizeMs: _gridSizeMs,
  onItemSpanChange,
  clipRegions,
  zoomRegions,
}: TimelineWrapperProps) {
  const totalMs = Math.max(0, Math.round(videoDuration * 1000));

  // Get all snap points (edges of all items) for a given item type
  const getSnapPoints = useCallback((activeItemId: string): number[] => {
    const isClipItem = activeItemId.startsWith('clip-');
    const regions = isClipItem ? clipRegions : zoomRegions;

    const points: number[] = [0, totalMs]; // Include timeline boundaries

    regions.forEach((region) => {
      if (region.id !== activeItemId) {
        points.push(region.startMs, region.endMs);
      }
    });

    return points;
  }, [clipRegions, zoomRegions, totalMs]);

  // Snap a span to nearby edges
  const snapSpan = useCallback((span: Span, activeItemId: string): Span => {
    const snapPoints = getSnapPoints(activeItemId);
    const duration = span.end - span.start;

    let snappedStart = span.start;
    let snappedEnd = span.end;
    let startSnapped = false;
    let endSnapped = false;

    // Try to snap start edge
    for (const point of snapPoints) {
      const distanceToStart = Math.abs(span.start - point);
      if (distanceToStart <= SNAP_THRESHOLD_MS) {
        snappedStart = point;
        startSnapped = true;
        break;
      }
    }

    // Try to snap end edge
    for (const point of snapPoints) {
      const distanceToEnd = Math.abs(span.end - point);
      if (distanceToEnd <= SNAP_THRESHOLD_MS) {
        snappedEnd = point;
        endSnapped = true;
        break;
      }
    }

    // If only one edge snapped during a drag (not resize), maintain duration
    // For drag operations, we want to move the whole item
    if (startSnapped && !endSnapped) {
      snappedEnd = snappedStart + duration;
    } else if (endSnapped && !startSnapped) {
      snappedStart = snappedEnd - duration;
    }

    return { start: snappedStart, end: snappedEnd };
  }, [getSnapPoints]);

  // Snap a span during resize (only snap the edge being resized)
  const snapSpanResize = useCallback((span: Span, activeItemId: string, resizeEdge: 'start' | 'end'): Span => {
    const snapPoints = getSnapPoints(activeItemId);

    let snappedStart = span.start;
    let snappedEnd = span.end;

    if (resizeEdge === 'start') {
      for (const point of snapPoints) {
        const distance = Math.abs(span.start - point);
        if (distance <= SNAP_THRESHOLD_MS) {
          snappedStart = point;
          break;
        }
      }
    } else {
      for (const point of snapPoints) {
        const distance = Math.abs(span.end - point);
        if (distance <= SNAP_THRESHOLD_MS) {
          snappedEnd = point;
          break;
        }
      }
    }

    return { start: snappedStart, end: snappedEnd };
  }, [getSnapPoints]);

  const clampSpanToBounds = useCallback(
    (span: Span): Span => {
      const rawDuration = Math.max(span.end - span.start, 0);
      const normalizedStart = Number.isFinite(span.start) ? span.start : 0;

      if (totalMs === 0) {
        const minDuration = Math.max(minItemDurationMs, 1);
        const duration = Math.max(rawDuration, minDuration);
        const start = Math.max(0, normalizedStart);
        return {
          start,
          end: start + duration,
        };
      }

      const minDuration = Math.min(Math.max(minItemDurationMs, 1), totalMs);
      const duration = Math.min(Math.max(rawDuration, minDuration), totalMs);

      const start = Math.max(0, Math.min(normalizedStart, totalMs - duration));
      const end = start + duration;

      return { start, end };
    },
    [minItemDurationMs, totalMs],
  );

  const clampRange = useCallback(
    (candidate: Range): Range => {
      if (totalMs === 0) {
        const minSpan = Math.max(minVisibleRangeMs, 1);
        const span = Math.max(candidate.end - candidate.start, minSpan);
        const start = Math.max(0, Math.min(candidate.start, candidate.end - span));
        return { start, end: start + span };
      }

      const rawStart = Math.max(0, candidate.start);
      const rawEnd = candidate.end;
      const clampedEnd = Math.min(rawEnd, totalMs);
      
      const minSpan = Math.min(Math.max(minVisibleRangeMs, 1), totalMs);
      const desiredSpan = clampedEnd - rawStart;
      const span = Math.min(Math.max(desiredSpan, minSpan), totalMs);
      
      let finalStart = rawStart;
      let finalEnd = finalStart + span;
      
      if (finalEnd > totalMs) {
        finalEnd = totalMs;
        finalStart = Math.max(0, finalEnd - span);
      }

      return { start: finalStart, end: finalEnd };
    },
    [minVisibleRangeMs, totalMs],
  );

  const onResizeEnd = useCallback(
    (event: ResizeEndEvent) => {
      const updatedSpan = event.active.data.current.getSpanFromResizeEvent?.(event);
      if (!updatedSpan) return;

      const activeItemId = event.active.id as string;

      // Determine which edge is being resized by comparing to original span
      const originalSpan = event.active.data.current.span as Span | undefined;
      const resizeEdge: 'start' | 'end' = originalSpan && Math.abs(updatedSpan.start - originalSpan.start) > Math.abs(updatedSpan.end - originalSpan.end) ? 'start' : 'end';

      // Apply snapping first, then clamp
      const snappedSpan = snapSpanResize(updatedSpan, activeItemId, resizeEdge);
      const clampedSpan = clampSpanToBounds(snappedSpan);

      if (clampedSpan.end - clampedSpan.start < Math.min(minItemDurationMs, totalMs || minItemDurationMs)) {
        return;
      }

      if (hasOverlap(clampedSpan, activeItemId)) {
        return;
      }

      onItemSpanChange(activeItemId, clampedSpan);
    },
    [clampSpanToBounds, hasOverlap, minItemDurationMs, onItemSpanChange, totalMs, snapSpanResize]
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeRowId = event.over?.id as string;
      const updatedSpan = event.active.data.current.getSpanFromDragEvent?.(event);
      if (!updatedSpan || !activeRowId) return;

      const activeItemId = event.active.id as string;

      // Apply snapping first, then clamp
      const snappedSpan = snapSpan(updatedSpan, activeItemId);
      const clampedSpan = clampSpanToBounds(snappedSpan);

      if (hasOverlap(clampedSpan, activeItemId)) {
        return;
      }

      onItemSpanChange(activeItemId, clampedSpan);
    },
    [clampSpanToBounds, hasOverlap, onItemSpanChange, snapSpan]
  );

  const handleRangeChange = useCallback(
    (updater: (previous: Range) => Range) => {
      onRangeChange((prev) => {
        const normalized = totalMs > 0 ? clampRange(prev) : prev;
        const desired = updater(normalized);
        
        if (totalMs > 0) {
          const clamped = clampRange(desired);
          
          if (clamped.end > totalMs) {
            const span = Math.min(clamped.end - clamped.start, totalMs);
            return {
              start: Math.max(0, totalMs - span),
              end: totalMs,
            };
          }
          
          return clamped;
        }
        
        return desired;
      });
    },
    [clampRange, onRangeChange, totalMs],
  );

  return (
    <TimelineContext
      range={range}
      onRangeChanged={handleRangeChange}
      onResizeEnd={onResizeEnd}
      onDragEnd={onDragEnd}
      autoScroll={{ enabled: false }}
    >
      {children}
    </TimelineContext>
  );
}