import { useState, useRef, useEffect } from "react";
import { fixWebmDuration } from "@fix-webm-duration/fix";

type UseScreenRecorderReturn = {
  recording: boolean;
  initializing: boolean;
  toggleRecording: () => void;
};

export function useScreenRecorder(): UseScreenRecorderReturn {
  const [recording, setRecording] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const micStream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startTime = useRef<number>(0);

  const stopRecording = useRef(() => {
    if (mediaRecorder.current?.state === "recording") {
      if (stream.current) {
        stream.current.getTracks().forEach(track => track.stop());
      }
      if (cameraStream.current) {
        cameraStream.current.getTracks().forEach(track => track.stop());
        cameraStream.current = null;
      }
      if (micStream.current) {
        micStream.current.getTracks().forEach(track => track.stop());
        micStream.current = null;
      }
      mediaRecorder.current.stop();
      setRecording(false);
      window.electronAPI.stopMouseTracking();
      window.electronAPI?.setRecordingState(false);
    }
  });

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (window.electronAPI?.onStopRecordingFromTray) {
      cleanup = window.electronAPI.onStopRecordingFromTray(() => {
        stopRecording.current();
      });
    }

    return () => {
      if (cleanup) cleanup();

      if (mediaRecorder.current?.state === "recording") {
        mediaRecorder.current.stop();
      }
      if (stream.current) {
        stream.current.getTracks().forEach(track => track.stop());
        stream.current = null;
      }
      if (cameraStream.current) {
        cameraStream.current.getTracks().forEach(track => track.stop());
        cameraStream.current = null;
      }
      if (micStream.current) {
        micStream.current.getTracks().forEach(track => track.stop());
        micStream.current = null;
      }
    };
  }, []);

  const startRecording = async () => {
    setInitializing(true);
    try {
      const selectedSource = await window.electronAPI.getSelectedSource();
      if (!selectedSource) {
        alert("Please select a source to record");
        setInitializing(false);
        return;
      }
      // Get screen capture stream
      const screenStream = await (navigator.mediaDevices as any).getUserMedia({
        audio: selectedSource.systemAudio ? {
          mandatory: {
            chromeMediaSource: "desktop",
          },
        } : false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: selectedSource.id,
          },
        },
      });

      // Create combined stream starting with screen video
      const combinedTracks: MediaStreamTrack[] = [...screenStream.getVideoTracks()];

      // Add system audio if enabled and available
      if (selectedSource.systemAudio) {
        const systemAudioTracks = screenStream.getAudioTracks();
        if (systemAudioTracks.length > 0) {
          combinedTracks.push(...systemAudioTracks);
          console.log('Added system audio track');
        }
      }

      // Get microphone stream if selected
      if (selectedSource.microphoneId) {
        try {
          const micStreamResult = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: selectedSource.microphoneId } },
            video: false,
          });
          micStream.current = micStreamResult;
          combinedTracks.push(...micStreamResult.getAudioTracks());
          console.log('Added microphone track:', selectedSource.microphoneId);
        } catch (err) {
          console.warn('Failed to get microphone:', err);
        }
      }

      // Get camera stream if selected (stored separately for potential picture-in-picture)
      if (selectedSource.cameraId) {
        try {
          const cameraStreamResult = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { deviceId: { exact: selectedSource.cameraId } },
          });
          cameraStream.current = cameraStreamResult;
          // Note: Camera track is stored but not combined into main recording
          // This allows for future picture-in-picture implementation
          console.log('Camera stream ready:', selectedSource.cameraId);
        } catch (err) {
          console.warn('Failed to get camera:', err);
        }
      }

      // Create final combined stream
      stream.current = new MediaStream(combinedTracks);

      if (!stream.current) {
        throw new Error("Media stream is not available.");
      }

      const videoTrack = stream.current.getVideoTracks()[0];
      const { width = 1920, height = 1080 } = videoTrack.getSettings();

      // Set source bounds for cursor coordinate mapping
      // For screen recordings: include display origin for accurate mapping
      // For window recordings: get actual window bounds via native API
      const isScreenRecording = selectedSource.id.startsWith('screen:');

      if (isScreenRecording) {
        // Screen recording: get display bounds for accurate cursor mapping
        let displayX = 0;
        let displayY = 0;

        if (selectedSource.display_id) {
          try {
            const displayInfo = await window.electronAPI.getDisplayBounds(selectedSource.display_id);
            if (displayInfo.success) {
              displayX = displayInfo.bounds.x;
              displayY = displayInfo.bounds.y;
              console.log('Got display bounds:', displayInfo.bounds);
            }
          } catch (err) {
            console.warn('Failed to get display bounds:', err);
          }
        }

        await window.electronAPI.setSourceBounds({
          x: displayX,
          y: displayY,
          width: width,
          height: height,
        });
        console.log('Set source bounds for screen:', { x: displayX, y: displayY, width, height });
      } else {
        // Window recording: try to get actual window bounds via native API
        let windowBoundsResult = null;
        try {
          windowBoundsResult = await window.electronAPI.getWindowBounds(selectedSource.name);
          console.log('Got window bounds result:', windowBoundsResult);
        } catch (err) {
          console.warn('Failed to get window bounds:', err);
        }

        if (windowBoundsResult?.success && windowBoundsResult.bounds) {
          // Native bounds available - use them for accurate cursor mapping
          const bounds = windowBoundsResult.bounds;
          await window.electronAPI.setSourceBounds({
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            isWindowRecording: true,
          });
          console.log('Set source bounds for window:', bounds);
        } else {
          // Fallback to heuristic mode
          await window.electronAPI.setSourceBounds({
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            isWindowRecording: true,
          });
          console.log('Window recording: using heuristic mode (native bounds unavailable)');
        }
      }

      const totalPixels = width * height;
      let bitrate = 150_000_000;
      if (totalPixels > 1920 * 1080 && totalPixels <= 2560 * 1440) {
        bitrate = 250_000_000;
      } else if (totalPixels > 2560 * 1440) {
        bitrate = 400_000_000;
      }
      chunks.current = [];
      const mimeType = "video/webm;codecs=vp9";
      const recorder = new MediaRecorder(stream.current, { mimeType, videoBitsPerSecond: bitrate });
      mediaRecorder.current = recorder;
      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunks.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.current = null;
        if (chunks.current.length === 0) return;
        const duration = Date.now() - startTime.current;
        const buggyBlob = new Blob(chunks.current, { type: mimeType });
        const timestamp = Date.now();
        const videoFileName = `recording-${timestamp}.webm`;
        const trackingFileName = `recording-${timestamp}_tracking.json`;
        try {
          const videoBlob = await fixWebmDuration(buggyBlob, duration);
          const arrayBuffer = await videoBlob.arrayBuffer();
          const videoResult = await window.electronAPI.storeRecordedVideo(arrayBuffer, videoFileName);
          if (!videoResult.success) {
            console.error('Failed to store video:', videoResult.message);
            return;
          }
          const trackingResult = await window.electronAPI.storeMouseTrackingData(trackingFileName);
          if (!trackingResult.success) {
            console.warn('Failed to store mouse tracking:', trackingResult.message);
          }
          await window.electronAPI.switchToEditor();
        } catch (error) {
          console.error('Error saving recording:', error);
        }
      };
      recorder.onerror = () => setRecording(false);
      // Start mouse tracking right before video recording to sync timestamps
      await window.electronAPI.startMouseTracking();
      recorder.start(1000);
      startTime.current = Date.now();
      setInitializing(false);
      setRecording(true);
      window.electronAPI?.setRecordingState(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setInitializing(false);
      setRecording(false);
      if (stream.current) {
        stream.current.getTracks().forEach(track => track.stop());
        stream.current = null;
      }
    }
  };

  const toggleRecording = () => {
    if (initializing) return; // Prevent double-click while initializing
    recording ? stopRecording.current() : startRecording();
  };

  return { recording, initializing, toggleRecording };
}
