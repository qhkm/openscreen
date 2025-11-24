import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./LaunchWindow.module.css";
import { useScreenRecorder } from "../../hooks/useScreenRecorder";
import { Button } from "../ui/button";
import { BsRecordCircle } from "react-icons/bs";
import { FaRegStopCircle } from "react-icons/fa";
import { MdMonitor } from "react-icons/md";
import { Video, Mic, Volume2, Loader2 } from "lucide-react";

export function LaunchWindow() {
  const { recording, initializing, toggleRecording } = useScreenRecorder();
  const [selectedSource, setSelectedSource] = useState("Screen");
  const [hasSelectedSource, setHasSelectedSource] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [hasMic, setHasMic] = useState(false);
  const [hasSystemAudio, setHasSystemAudio] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);

  // Start camera preview when camera is selected
  const startCameraPreview = useCallback(async (deviceId: string) => {
    try {
      // Stop existing stream
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false,
      });

      setCameraStream(stream);

      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        cameraVideoRef.current.play().catch(() => {});
      }
    } catch (error) {
      console.error('Failed to start camera preview:', error);
    }
  }, [cameraStream]);

  // Stop camera preview
  const stopCameraPreview = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
  }, [cameraStream]);

  useEffect(() => {
    const checkSelectedSource = async () => {
      if (window.electronAPI) {
        const source = await window.electronAPI.getSelectedSource();
        if (source) {
          setSelectedSource(source.name);
          setHasSelectedSource(true);
          const newCameraId = source.cameraId || null;
          const hadCamera = hasCamera;
          setHasCamera(!!source.cameraId);
          setCameraId(newCameraId);
          setHasMic(!!source.microphoneId);
          setHasSystemAudio(!!source.systemAudio);

          // Start camera preview if camera was just selected
          if (newCameraId && !hadCamera) {
            startCameraPreview(newCameraId);
          } else if (!newCameraId && hadCamera) {
            stopCameraPreview();
          }
        } else {
          setSelectedSource("Screen");
          setHasSelectedSource(false);
          if (hasCamera) {
            stopCameraPreview();
          }
          setHasCamera(false);
          setCameraId(null);
          setHasMic(false);
          setHasSystemAudio(false);
        }
      }
    };

    checkSelectedSource();

    const interval = setInterval(checkSelectedSource, 500);
    return () => clearInterval(interval);
  }, [hasCamera, startCameraPreview, stopCameraPreview]);

  // Start camera preview when cameraId changes
  useEffect(() => {
    if (cameraId && !cameraStream) {
      startCameraPreview(cameraId);
    }
    return () => {
      // Cleanup on unmount
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraId]);

  // Connect video element to stream when ref is ready
  useEffect(() => {
    if (cameraVideoRef.current && cameraStream) {
      cameraVideoRef.current.srcObject = cameraStream;
      cameraVideoRef.current.play().catch(() => {});
    }
  }, [cameraStream]);

  const truncateText = (text: string, maxLength: number = 6) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const openSourceSelector = () => {
    if (window.electronAPI) {
      window.electronAPI.openSourceSelector();
    }
  };

  return (
    <div className="w-full h-full flex flex-col justify-end bg-transparent relative">
      {/* Camera Preview - shown when camera is selected */}
      {hasCamera && cameraStream && (
        <div
          className={`absolute ${styles.electronNoDrag}`}
          style={{
            right: 16,
            top: 8,
            width: 120,
            height: 120,
            borderRadius: '50%',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 3px rgba(255,255,255,0.2)',
            background: '#000',
          }}
        >
          <video
            ref={cameraVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)', // Mirror effect
            }}
          />
        </div>
      )}

      <div
        className={`w-full max-w-2xl mx-auto flex items-center justify-between px-3 py-1.5 mb-4 ${styles.electronDrag}`}
        style={{
          borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(30,30,40,0.85) 0%, rgba(20,20,30,0.75) 100%)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          boxShadow: '0 4px 16px 0 rgba(0,0,0,0.24), 0 1px 3px 0 rgba(0,0,0,0.12) inset',
          border: '1px solid rgba(80,80,120,0.18)',
          minHeight: 36,
        }}
      >
        <Button
          variant="link"
          size="sm"
          className={`gap-1 text-white bg-transparent hover:bg-transparent px-0 flex-1 text-left text-xs ${styles.electronNoDrag}`}
          onClick={openSourceSelector}
        >
          <MdMonitor size={13} className="text-white" />
          {truncateText(selectedSource)}
        </Button>

        {/* Media indicators */}
        {(hasCamera || hasMic || hasSystemAudio) && (
          <div className="flex items-center gap-1.5 px-2">
            {hasCamera && <Video size={12} className="text-emerald-400" />}
            {hasMic && <Mic size={12} className="text-emerald-400" />}
            {hasSystemAudio && <Volume2 size={12} className="text-emerald-400" />}
          </div>
        )}

        <div className="w-px h-5 bg-white/30" />

        <Button
          variant="link"
          size="sm"
          onClick={hasSelectedSource ? toggleRecording : openSourceSelector}
          disabled={initializing || (!hasSelectedSource && !recording)}
          className={`gap-1 bg-transparent hover:bg-transparent px-0 flex-1 text-right text-xs ${styles.electronNoDrag}`}
        >
          {initializing ? (
            <>
              <Loader2 size={13} className="text-white animate-spin" />
              <span className="text-white">Starting...</span>
            </>
          ) : recording ? (
            <>
              <FaRegStopCircle size={13} className="text-red-400" />
              <span className="text-red-400">Stop</span>
            </>
          ) : (
            <>
              <BsRecordCircle size={13} className={hasSelectedSource ? "text-white" : "text-white/50"} />
              <span className={hasSelectedSource ? "text-white" : "text-white/50"}>Record</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
