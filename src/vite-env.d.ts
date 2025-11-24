/// <reference types="vite/client" />
/// <reference types="../electron/electron-env" />

interface ProcessedDesktopSource {
  id: string;
  name: string;
  display_id: string;
  thumbnail: string | null;
  appIcon: string | null;
}

interface SelectedSource extends ProcessedDesktopSource {
  cameraId?: string | null;
  microphoneId?: string | null;
  systemAudio?: boolean;
}

interface Window {
  electronAPI: {
    getSources: (opts: Electron.SourcesOptions) => Promise<ProcessedDesktopSource[]>
    switchToEditor: () => Promise<void>
    openSourceSelector: () => Promise<void>
    selectSource: (source: any) => Promise<any>
    getSelectedSource: () => Promise<any>
    startMouseTracking: () => Promise<{ success: boolean; startTime?: number }>
    stopMouseTracking: () => Promise<{ success: boolean; data?: any }>
    setSourceBounds: (bounds: { x: number; y: number; width: number; height: number }) => Promise<{ success: boolean }>
    getDisplayBounds: (displayId: string) => Promise<{
      success: boolean
      bounds: { x: number; y: number; width: number; height: number }
      scaleFactor: number
      isPrimary?: boolean
    }>
    storeRecordedVideo: (videoData: ArrayBuffer, fileName: string) => Promise<{
      success: boolean
      path?: string
      message: string
      error?: string
    }>
    storeMouseTrackingData: (fileName: string) => Promise<{
      success: boolean
      path?: string
      eventCount?: number
      message: string
      error?: string
    }>
    getRecordedVideoPath: () => Promise<{
      success: boolean
      path?: string
      message?: string
      error?: string
    }>
    getMouseTrackingData: () => Promise<{
      success: boolean
      data: Array<{
        type: 'move' | 'down' | 'up' | 'click'
        timestamp: number
        x: number
        y: number
        button?: number
        clicks?: number
      }>
      sourceBounds: { x: number; y: number; width: number; height: number } | null
      message?: string
      error?: string
    }>
    getAssetBasePath: () => Promise<string | null>
    setRecordingState: (recording: boolean) => Promise<void>
    onStopRecordingFromTray: (callback: () => void) => () => void
    openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>
    saveExportedVideo: (videoData: ArrayBuffer, fileName: string) => Promise<{
      success: boolean
      path?: string
      message?: string
    }>
  }
}