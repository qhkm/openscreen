import { useState, useEffect } from "react";
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
  const [hasMic, setHasMic] = useState(false);
  const [hasSystemAudio, setHasSystemAudio] = useState(false);

  useEffect(() => {
    const checkSelectedSource = async () => {
      if (window.electronAPI) {
        const source = await window.electronAPI.getSelectedSource();
        if (source) {
          setSelectedSource(source.name);
          setHasSelectedSource(true);
          setHasCamera(!!source.cameraId);
          setHasMic(!!source.microphoneId);
          setHasSystemAudio(!!source.systemAudio);
        } else {
          setSelectedSource("Screen");
          setHasSelectedSource(false);
          setHasCamera(false);
          setHasMic(false);
          setHasSystemAudio(false);
        }
      }
    };

    checkSelectedSource();

    const interval = setInterval(checkSelectedSource, 500);
    return () => clearInterval(interval);
  }, []);

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
    <div className="w-full h-full flex items-center bg-transparent">
      <div
        className={`w-full max-w-2xl mx-auto flex items-center justify-between px-3 py-1.5 ${styles.electronDrag}`}
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
