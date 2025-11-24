/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  electronAPI: {
    getSources: (opts: Electron.SourcesOptions) => Promise<ProcessedDesktopSource[]>
    switchToEditor: () => Promise<void>
    openSourceSelector: () => Promise<void>
    selectSource: (source: any) => Promise<any>
    getSelectedSource: () => Promise<any>
    startMouseTracking: () => Promise<void>
    stopMouseTracking: () => Promise<void>
    setSourceBounds: (bounds: { x: number; y: number; width: number; height: number; isWindowRecording?: boolean }) => Promise<{ success: boolean }>
    getDisplayBounds: (displayId: string) => Promise<{
      success: boolean
      bounds: { x: number; y: number; width: number; height: number }
      scaleFactor: number
      isPrimary?: boolean
    }>
    getWindowBounds: (windowName: string) => Promise<{
      success: boolean
      bounds?: { x: number; y: number; width: number; height: number }
      message?: string
      error?: string
    }>
    storeRecordedVideo: (videoData: ArrayBuffer, fileName: string) => Promise<{ success: boolean; path?: string; message?: string }>
    storeMouseTrackingData: (fileName: string) => Promise<{ success: boolean; path?: string; eventCount?: number; message?: string }>
    getRecordedVideoPath: () => Promise<{ success: boolean; path?: string; message?: string }>
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
      sourceBounds: { x: number; y: number; width: number; height: number; isWindowRecording?: boolean } | null
      initialMousePosition: { x: number; y: number } | null
      message?: string
      error?: string
    }>
    setRecordingState: (recording: boolean) => Promise<void>
    onStopRecordingFromTray: (callback: () => void) => () => void
    openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>
    saveExportedVideo: (videoData: ArrayBuffer, fileName: string) => Promise<{ success: boolean; path?: string; message?: string }>
  }
}

interface ProcessedDesktopSource {
  id: string
  name: string
  display_id: string
  thumbnail: string | null
  appIcon: string | null
}
