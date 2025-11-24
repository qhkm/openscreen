import { useEffect, useState } from "react";
import { RecordingPanel } from "./components/launch/RecordingPanel";
import { CameraPreview } from "./components/launch/CameraPreview";
import VideoEditor from "./components/video-editor/VideoEditor";

export default function App() {
  const [windowType, setWindowType] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('windowType') || '';
    setWindowType(type);
    if (type === 'hud-overlay' || type === 'source-selector' || type === 'recording-panel' || type === 'camera-preview') {
      document.body.style.background = 'transparent';
      document.documentElement.style.background = 'transparent';
      document.getElementById('root')?.style.setProperty('background', 'transparent');
    }
  }, []);

  switch (windowType) {
    case 'hud-overlay':
    case 'source-selector':
    case 'recording-panel':
      return <RecordingPanel />;
    case 'camera-preview':
      return <CameraPreview />;
    case 'editor':
      return <VideoEditor />;
    default:
      return (
        <div className="w-full h-full bg-background text-foreground">
          <h1>Openscreen</h1>
        </div>
      );
  }
}
