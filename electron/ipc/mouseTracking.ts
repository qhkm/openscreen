// uiohook-napi [WIP: scoping out mouse tracking with cross platform support for potential auto zoom/ post processing cursor effects]
// not currently being used.

import { uIOhook } from 'uiohook-napi'

let isMouseTrackingActive = false
let isHookStarted = false
let recordingStartTime: number = 0
let mouseEventData: MouseEvent[] = []
let sourceBounds: SourceBounds | null = null
let lastMoveTimestamp: number = 0
let initialMousePosition: { x: number; y: number } | null = null
const MOUSE_MOVE_THROTTLE_MS = 16 // ~60fps, capture at most every 16ms

export interface MouseEvent {
  type: 'move' | 'down' | 'up' | 'click'
  timestamp: number // milliseconds since recording started
  x: number
  y: number
  button?: unknown
  clicks?: number
}

export interface SourceBounds {
  x: number
  y: number
  width: number
  height: number
  isWindowRecording?: boolean
}

export interface MouseTrackingSession {
  startTime: number
  events: MouseEvent[]
  duration: number
  sourceBounds?: SourceBounds
}

export function startMouseTracking() {
  if (isMouseTrackingActive) {
    return { success: false, message: 'Already tracking' }
  }

  isMouseTrackingActive = true

  // Reset data for new recording session
  recordingStartTime = performance.now()
  mouseEventData = []
  lastMoveTimestamp = 0
  initialMousePosition = null // Will be set on first mouse event

  // Only start the hook once
  if (!isHookStarted) {
    setupMouseEventListeners()
    
    try {
      uIOhook.start()
      isHookStarted = true
      return { success: true, message: 'Mouse tracking started', startTime: recordingStartTime }
    } catch (error) {
      console.error('Failed to start mouse tracking:', error)
      isMouseTrackingActive = false
      return { success: false, message: 'Failed to start hook', error }
    }
  } else {
    return { success: true, message: 'Mouse tracking resumed', startTime: recordingStartTime }
  }
}

export function stopMouseTracking(): { success: boolean; message: string; data?: MouseTrackingSession } {
  if (!isMouseTrackingActive) {
    return { success: false, message: 'Not currently tracking' }
  }

  isMouseTrackingActive = false
  
  const duration = performance.now() - recordingStartTime
  
  const session: MouseTrackingSession = {
    startTime: recordingStartTime,
    events: mouseEventData,
    duration: duration
  }
  
  return { 
    success: true, 
    message: 'Mouse tracking stopped',
    data: session
  }
}

function setupMouseEventListeners() {
  // Track mouse movement (throttled to ~60fps)
  uIOhook.on('mousemove', (e) => {
    if (isMouseTrackingActive) {
      const now = performance.now()
      const timestamp = now - recordingStartTime

      // Capture initial mouse position on first event
      if (initialMousePosition === null) {
        initialMousePosition = { x: e.x, y: e.y }
        console.log('Initial mouse position captured:', initialMousePosition)
      }

      // Throttle mouse move events to reduce data size
      if (now - lastMoveTimestamp < MOUSE_MOVE_THROTTLE_MS) {
        return
      }
      lastMoveTimestamp = now

      const event: MouseEvent = {
        type: 'move',
        timestamp,
        x: e.x,
        y: e.y
      }
      mouseEventData.push(event)
    }
  })

  // Track mouse button press
  uIOhook.on('mousedown', (e) => {
    if (isMouseTrackingActive) {
      const timestamp = performance.now() - recordingStartTime
      const event: MouseEvent = {
        type: 'down',
        timestamp,
        x: e.x,
        y: e.y,
        button: e.button,
        clicks: e.clicks
      }
      mouseEventData.push(event)
    }
  })

  // Track mouse button release
  uIOhook.on('mouseup', (e) => {
    if (isMouseTrackingActive) {
      const timestamp = performance.now() - recordingStartTime
      const event: MouseEvent = {
        type: 'up',
        timestamp,
        x: e.x,
        y: e.y,
        button: e.button
      }
      mouseEventData.push(event)
    }
  })

  // Track complete click events
  uIOhook.on('click', (e) => {
    if (isMouseTrackingActive) {
      const timestamp = performance.now() - recordingStartTime
      const event: MouseEvent = {
        type: 'click',
        timestamp,
        x: e.x,
        y: e.y,
        button: e.button,
        clicks: e.clicks
      }
      mouseEventData.push(event)
    }
  })
}

export function getTrackingData(): MouseEvent[] {
  return [...mouseEventData]
}

export function setSourceBounds(bounds: SourceBounds) {
  sourceBounds = bounds
  console.log('Source bounds set:', bounds)
}

export function getSourceBounds(): SourceBounds | null {
  return sourceBounds
}

// Get tracking data with metadata for saving to JSON
export function getTrackingDataWithMetadata(): {
  events: MouseEvent[];
  sourceBounds: SourceBounds | null;
  initialMousePosition: { x: number; y: number } | null;
} {
  return {
    events: [...mouseEventData],
    sourceBounds: sourceBounds,
    initialMousePosition: initialMousePosition,
  }
}

export function cleanupMouseTracking() {
  if (isHookStarted) {
    try {
      uIOhook.stop()
      isHookStarted = false
      isMouseTrackingActive = false
      mouseEventData = []
    } catch (error) {
      console.error('Error cleaning up mouse tracking:', error)
    }
  }
}
