import { ipcMain, desktopCapturer, BrowserWindow, shell, app } from 'electron'
import { startMouseTracking, stopMouseTracking, setSourceBounds, getTrackingDataWithMetadata, type SourceBounds } from './mouseTracking'
import fs from 'node:fs/promises'
import path from 'node:path'
import { RECORDINGS_DIR } from '../main'

let selectedSource: any = null

export function registerIpcHandlers(
  createEditorWindow: () => void,
  createSourceSelectorWindow: () => BrowserWindow,
  getMainWindow: () => BrowserWindow | null,
  getSourceSelectorWindow: () => BrowserWindow | null,
  onRecordingStateChange?: (recording: boolean, sourceName: string) => void
) {
  ipcMain.handle('get-sources', async (_, opts) => {
    try {
      console.log('Getting sources with opts:', opts)
      const sources = await desktopCapturer.getSources(opts)
      console.log('Got sources:', sources.length)
      return sources.map(source => ({
        id: source.id,
        name: source.name,
        display_id: source.display_id,
        thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
        appIcon: source.appIcon ? source.appIcon.toDataURL() : null
      }))
    } catch (error) {
      console.error('desktopCapturer.getSources failed:', error)
      throw error
    }
  })

  ipcMain.handle('select-source', (_, source) => {
    selectedSource = source
    const sourceSelectorWin = getSourceSelectorWindow()
    if (sourceSelectorWin) {
      sourceSelectorWin.close()
    }
    return selectedSource
  })

  ipcMain.handle('get-selected-source', () => {
    return selectedSource
  })

  ipcMain.handle('open-source-selector', () => {
    const sourceSelectorWin = getSourceSelectorWindow()
    if (sourceSelectorWin) {
      sourceSelectorWin.focus()
      return
    }
    createSourceSelectorWindow()
  })

  ipcMain.handle('switch-to-editor', () => {
    const mainWin = getMainWindow()
    if (mainWin) {
      mainWin.close()
    }
    createEditorWindow()
  })

  ipcMain.handle('start-mouse-tracking', () => {
    // Source bounds will be set by the renderer using video stream dimensions
    // This provides the most accurate mapping since video dimensions = capture dimensions
    return startMouseTracking()
  })

  ipcMain.handle('stop-mouse-tracking', () => {
    return stopMouseTracking()
  })

  ipcMain.handle('set-source-bounds', (_, bounds: SourceBounds) => {
    setSourceBounds(bounds)
    return { success: true }
  })

  ipcMain.handle('store-recorded-video', async (_, videoData: ArrayBuffer, fileName: string) => {
    try {
      const videoPath = path.join(RECORDINGS_DIR, fileName)
      await fs.writeFile(videoPath, Buffer.from(videoData))
      
      return {
        success: true,
        path: videoPath,
        message: 'Video stored successfully'
      }
    } catch (error) {
      console.error('Failed to store video:', error)
      return {
        success: false,
        message: 'Failed to store video',
        error: String(error)
      }
    }
  })

  ipcMain.handle('store-mouse-tracking-data', async (_, fileName: string) => {
    try {
      const trackingDataWithMeta = getTrackingDataWithMetadata()

      if (trackingDataWithMeta.events.length === 0) {
        return { success: false, message: 'No tracking data to save' }
      }

      const trackingPath = path.join(RECORDINGS_DIR, fileName)
      // Save as object with events array and sourceBounds metadata
      await fs.writeFile(trackingPath, JSON.stringify(trackingDataWithMeta, null, 2), 'utf-8')

      return {
        success: true,
        path: trackingPath,
        eventCount: trackingDataWithMeta.events.length,
        message: 'Mouse tracking data stored successfully'
      }
    } catch (error) {
      console.error('Failed to store mouse tracking data:', error)
      return {
        success: false,
        message: 'Failed to store mouse tracking data',
        error: String(error)
      }
    }
  })

  ipcMain.handle('get-recorded-video-path', async () => {
    try {
      const files = await fs.readdir(RECORDINGS_DIR)
      const videoFiles = files.filter(file => file.endsWith('.webm'))

      if (videoFiles.length === 0) {
        return { success: false, message: 'No recorded video found' }
      }

      const latestVideo = videoFiles.sort().reverse()[0]
      const videoPath = path.join(RECORDINGS_DIR, latestVideo)

      return { success: true, path: videoPath }
    } catch (error) {
      console.error('Failed to get video path:', error)
      return { success: false, message: 'Failed to get video path', error: String(error) }
    }
  })

  ipcMain.handle('get-mouse-tracking-data', async () => {
    try {
      const files = await fs.readdir(RECORDINGS_DIR)
      const trackingFiles = files.filter(file => file.endsWith('_tracking.json'))

      if (trackingFiles.length === 0) {
        return { success: false, message: 'No tracking data found', data: [], sourceBounds: null }
      }

      const latestTracking = trackingFiles.sort().reverse()[0]
      const trackingPath = path.join(RECORDINGS_DIR, latestTracking)
      const content = await fs.readFile(trackingPath, 'utf-8')
      const parsed = JSON.parse(content)

      // Handle both old format (array) and new format (object with events and sourceBounds)
      if (Array.isArray(parsed)) {
        // Old format: just an array of events
        return { success: true, data: parsed, sourceBounds: null }
      } else {
        // New format: object with events and sourceBounds
        return { success: true, data: parsed.events || [], sourceBounds: parsed.sourceBounds || null }
      }
    } catch (error) {
      console.error('Failed to get tracking data:', error)
      return { success: false, message: 'Failed to get tracking data', error: String(error), data: [], sourceBounds: null }
    }
  })

  ipcMain.handle('set-recording-state', (_, recording: boolean) => {
    const source = selectedSource || { name: 'Screen' }
    if (onRecordingStateChange) {
      onRecordingStateChange(recording, source.name)
    }
  })

  ipcMain.handle('open-external-url', async (_, url: string) => {
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      console.error('Failed to open URL:', error)
      return { success: false, error: String(error) }
    }
  })

  // Return base path for assets so renderer can resolve file:// paths in production
  ipcMain.handle('get-asset-base-path', () => {
    try {
      if (app.isPackaged) {
        return path.join(process.resourcesPath, 'assets')
      }
      return path.join(app.getAppPath(), 'public', 'assets')
    } catch (err) {
      console.error('Failed to resolve asset base path:', err)
      return null
    }
  })

  ipcMain.handle('save-exported-video', async (_, videoData: ArrayBuffer, fileName: string) => {
    try {
      const downloadsPath = app.getPath('downloads')
      const videoPath = path.join(downloadsPath, fileName)
      await fs.writeFile(videoPath, Buffer.from(videoData))
      
      return {
        success: true,
        path: videoPath,
        message: 'Video exported successfully'
      }
    } catch (error) {
      console.error('Failed to save exported video:', error)
      return {
        success: false,
        message: 'Failed to save exported video',
        error: String(error)
      }
    }
  })
}
