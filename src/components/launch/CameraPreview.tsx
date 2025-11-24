import { useEffect, useRef, useState } from "react";
import styles from "./SourceSelector.module.css";

export type CameraShape = 'circle' | 'squircle' | 'rounded-rect';

export function CameraPreview() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [shape, setShape] = useState<CameraShape>('squircle');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Force transparent background on html and body for this window
  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    const root = document.getElementById('root');
    if (root) root.style.background = 'transparent';
  }, []);

  // Get device ID and shape from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('deviceId');
    const shapeParam = params.get('shape') as CameraShape;
    setDeviceId(id);
    if (shapeParam) setShape(shapeParam);
  }, []);

  // Start camera stream when deviceId is available
  useEffect(() => {
    if (!deviceId) return;

    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId! } },
          audio: false,
        });
        setStream(mediaStream);
      } catch (error) {
        console.error('Failed to start camera:', error);
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [deviceId]);

  // Connect video element to stream
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Get border radius based on shape
  // Squircle uses ~27% border-radius which creates an iOS-style superellipse appearance
  const getBorderRadius = (): string => {
    switch (shape) {
      case 'circle':
        return '50%';
      case 'rounded-rect':
        return '24px';
      case 'squircle':
      default:
        return '27%'; // iOS-style squircle approximation
    }
  };

  return (
    <div
      className={styles.electronDrag}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        cursor: 'grab',
      }}
    >
      <div
        style={{
          width: 150,
          height: 150,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 4px rgba(255,255,255,0.15)',
          background: '#1a1a1a',
          borderRadius: getBorderRadius(),
        }}
      >
        {stream ? (
          <video
            ref={videoRef}
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
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666',
              fontSize: 12,
            }}
          >
            Loading...
          </div>
        )}
      </div>
    </div>
  );
}
