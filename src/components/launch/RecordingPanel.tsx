import { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { MdCheck } from "react-icons/md";
import { BsRecordCircle } from "react-icons/bs";
import { FaRegStopCircle } from "react-icons/fa";
import styles from "./SourceSelector.module.css";
import {
  Monitor,
  AppWindow,
  Square,
  Smartphone,
  VideoOff,
  Video,
  MicOff,
  Mic,
  Volume2,
  VolumeX,
  Settings,
  X,
  Loader2
} from "lucide-react";
import { useScreenRecorder } from "../../hooks/useScreenRecorder";

interface DesktopSource {
  id: string;
  name: string;
  thumbnail: string | null;
  display_id: string;
  appIcon: string | null;
}

interface MediaDevice {
  deviceId: string;
  label: string;
  kind: string;
}

type SourceType = 'display' | 'window' | 'area' | 'device';

export function RecordingPanel() {
  const { recording, initializing, toggleRecording } = useScreenRecorder();

  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<DesktopSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(false);
  const [sourceType, setSourceType] = useState<SourceType>('display');

  // Media device states
  const [cameras, setCameras] = useState<MediaDevice[]>([]);
  const [microphones, setMicrophones] = useState<MediaDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [selectedMic, setSelectedMic] = useState<string | null>(null);
  const [systemAudioEnabled, setSystemAudioEnabled] = useState(false);

  // Dropdown states
  const [cameraDropdownOpen, setCameraDropdownOpen] = useState(false);
  const [micDropdownOpen, setMicDropdownOpen] = useState(false);

  const cameraRef = useRef<HTMLDivElement>(null);
  const micRef = useRef<HTMLDivElement>(null);

  // Fetch screen/window sources
  useEffect(() => {
    async function fetchSources() {
      setLoading(true);
      setPermissionError(false);
      try {
        const rawSources = await window.electronAPI.getSources({
          types: ['screen', 'window'],
          thumbnailSize: { width: 320, height: 180 },
          fetchWindowIcons: true
        });
        if (rawSources.length === 0) {
          setPermissionError(true);
        }
        const mappedSources = rawSources.map(source => ({
          id: source.id,
          name:
            source.id.startsWith('window:') && source.name.includes(' — ')
              ? source.name.split(' — ')[1] || source.name
              : source.name,
          thumbnail: source.thumbnail,
          display_id: source.display_id,
          appIcon: source.appIcon
        }));
        setSources(mappedSources);

        // Auto-select first display if none selected
        if (!selectedSource) {
          const firstDisplay = mappedSources.find(s => s.id.startsWith('screen:'));
          if (firstDisplay) {
            setSelectedSource(firstDisplay);
          }
        }
      } catch (error) {
        console.error('Error loading sources:', error);
        setPermissionError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchSources();
  }, []);

  // Fetch media devices
  useEffect(() => {
    async function fetchMediaDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();

        const videoDevices = devices
          .filter(d => d.kind === 'videoinput')
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}`, kind: d.kind }));

        const audioDevices = devices
          .filter(d => d.kind === 'audioinput')
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}`, kind: d.kind }));

        setCameras(videoDevices);
        setMicrophones(audioDevices);
      } catch (error) {
        console.error('Error fetching media devices:', error);
      }
    }
    fetchMediaDevices();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cameraRef.current && !cameraRef.current.contains(event.target as Node)) {
        setCameraDropdownOpen(false);
      }
      if (micRef.current && !micRef.current.contains(event.target as Node)) {
        setMicDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle camera selection
  const handleCameraSelect = (deviceId: string | null) => {
    setSelectedCamera(deviceId);
    setCameraDropdownOpen(false);

    if (deviceId) {
      // Show floating camera preview window
      window.electronAPI.showCameraPreview(deviceId);
    } else {
      // Hide floating camera preview window
      window.electronAPI.hideCameraPreview();
    }
  };

  // Cleanup on unmount - hide camera preview window
  useEffect(() => {
    return () => {
      window.electronAPI.hideCameraPreview();
    };
  }, []);

  const screenSources = sources.filter(s => s.id.startsWith('screen:'));
  const windowSources = sources.filter(s => s.id.startsWith('window:'));

  const displayedSources = sourceType === 'display' ? screenSources :
                           sourceType === 'window' ? windowSources :
                           [];

  const handleSourceSelect = (source: DesktopSource) => setSelectedSource(source);

  const handleRecord = async () => {
    if (!selectedSource) return;

    // Save the source selection first
    await window.electronAPI.selectSource({
      ...selectedSource,
      cameraId: selectedCamera,
      microphoneId: selectedMic,
      systemAudio: systemAudioEnabled
    });

    // Then toggle recording
    toggleRecording();
  };

  const handleOpenSettings = async () => {
    await window.electronAPI.openExternalUrl('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
  };

  if (loading) {
    return (
      <div className={`h-full flex items-center justify-center ${styles.glassContainer}`} style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-emerald-500 animate-spin mx-auto mb-3" />
          <p className="text-xs text-zinc-400">Loading sources...</p>
        </div>
      </div>
    );
  }

  if (permissionError) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${styles.glassContainer}`}>
        <div className="text-center px-8 max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-zinc-100 mb-2">Screen Recording Permission Required</h2>
          <p className="text-sm text-zinc-400 mb-4">
            OpenScreen needs permission to record your screen. Please enable Screen Recording for Electron in System Settings.
          </p>
          <Button
            onClick={handleOpenSettings}
            className="w-full bg-[#34B27B] text-white hover:bg-[#34B27B]/80"
          >
            Open System Settings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${styles.glassContainer}`}>
      {/* Top Toolbar - Draggable */}
      <div className={`flex items-center justify-center gap-3 px-3 py-2 border-b border-zinc-800 bg-zinc-900/50 ${styles.electronDrag}`}>
        {/* Left Section - Close + Source Types */}
        <div className="flex items-center gap-2">
          {/* Close Button */}
          <button
            onClick={() => window.close()}
            className={`w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-colors ${styles.electronNoDrag}`}
          >
            <X size={16} />
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-zinc-700 mx-1" />

          {/* Source Type Buttons */}
          <div className={`flex items-center bg-zinc-800/50 rounded-lg p-1 gap-1 ${styles.electronNoDrag}`}>
            <SourceTypeButton
              icon={<Monitor size={16} />}
              label="Display"
              active={sourceType === 'display'}
              onClick={() => setSourceType('display')}
            />
            <SourceTypeButton
              icon={<AppWindow size={16} />}
              label="Window"
              active={sourceType === 'window'}
              onClick={() => setSourceType('window')}
            />
            <SourceTypeButton
              icon={<Square size={16} />}
              label="Area"
              active={sourceType === 'area'}
              onClick={() => setSourceType('area')}
              disabled
            />
            <SourceTypeButton
              icon={<Smartphone size={16} />}
              label="Device"
              active={sourceType === 'device'}
              onClick={() => setSourceType('device')}
              disabled
            />
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-zinc-700" />

        {/* Right Section - Media Devices + Settings */}
        <div className={`flex items-center gap-2 ${styles.electronNoDrag}`}>
          {/* Media Devices Group */}
          <div className="flex items-center bg-zinc-800/50 rounded-lg p-1 gap-1">
            {/* Camera Dropdown */}
            <div ref={cameraRef} className="relative">
              <button
                onClick={() => {
                  setCameraDropdownOpen(!cameraDropdownOpen);
                  setMicDropdownOpen(false);
                }}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-medium transition-colors ${
                  selectedCamera
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
                }`}
              >
                {selectedCamera ? <Video size={16} /> : <VideoOff size={16} />}
                <span>Camera</span>
              </button>

              {cameraDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 w-56 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                  <DropdownItem
                    icon={<VideoOff size={14} />}
                    label="No camera"
                    selected={!selectedCamera}
                    onClick={() => handleCameraSelect(null)}
                  />
                  {cameras.map(cam => (
                    <DropdownItem
                      key={cam.deviceId}
                      icon={<Video size={14} />}
                      label={cam.label}
                      selected={selectedCamera === cam.deviceId}
                      onClick={() => handleCameraSelect(cam.deviceId)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Microphone Dropdown */}
            <div ref={micRef} className="relative">
              <button
                onClick={() => {
                  setMicDropdownOpen(!micDropdownOpen);
                  setCameraDropdownOpen(false);
                }}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-medium transition-colors ${
                  selectedMic
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
                }`}
              >
                {selectedMic ? <Mic size={16} /> : <MicOff size={16} />}
                <span>Mic</span>
              </button>

              {micDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 w-56 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                  <DropdownItem
                    icon={<MicOff size={14} />}
                    label="No microphone"
                    selected={!selectedMic}
                    onClick={() => { setSelectedMic(null); setMicDropdownOpen(false); }}
                  />
                  {microphones.map(mic => (
                    <DropdownItem
                      key={mic.deviceId}
                      icon={<Mic size={14} />}
                      label={mic.label}
                      selected={selectedMic === mic.deviceId}
                      onClick={() => { setSelectedMic(mic.deviceId); setMicDropdownOpen(false); }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* System Audio Toggle */}
            <button
              onClick={() => setSystemAudioEnabled(!systemAudioEnabled)}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-medium transition-colors ${
                systemAudioEnabled
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
              }`}
              title={systemAudioEnabled ? 'System audio enabled' : 'System audio disabled'}
            >
              {systemAudioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span>Audio</span>
            </button>
          </div>

          {/* Settings Button */}
          <button className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-colors">
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 overflow-hidden flex ${styles.electronNoDrag}`}>
        {/* Source Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {sourceType === 'area' ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
              <Square size={48} className="mb-3 opacity-50" />
              <p className="text-sm">Area selection coming soon</p>
            </div>
          ) : sourceType === 'device' ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
              <Smartphone size={48} className="mb-3 opacity-50" />
              <p className="text-sm">Device mirroring coming soon</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {displayedSources.map(source => (
                <Card
                  key={source.id}
                  className={`${styles.sourceCard} ${selectedSource?.id === source.id ? styles.selected : ''} cursor-pointer overflow-hidden`}
                  onClick={() => handleSourceSelect(source)}
                >
                  <div className="p-2">
                    <div className="relative mb-2">
                      <img
                        src={source.thumbnail || ''}
                        alt={source.name}
                        className="w-full aspect-video object-cover rounded-lg border border-zinc-800"
                      />
                      {selectedSource?.id === source.id && (
                        <div className="absolute -top-1 -right-1">
                          <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                            <MdCheck className="w-3 h-3 text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {source.appIcon && sourceType === 'window' && (
                        <img
                          src={source.appIcon}
                          alt=""
                          className="w-4 h-4 flex-shrink-0"
                        />
                      )}
                      <span className="text-xs text-zinc-300 truncate">{source.name}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Bottom Action Bar */}
      <div className={`border-t border-zinc-800 px-4 py-3 bg-zinc-900/50 ${styles.electronDrag}`}>
        <div className="flex items-center justify-between">
          <div className="text-xs text-zinc-500">
            {selectedSource ? (
              <span>Selected: <span className="text-zinc-300">{selectedSource.name}</span></span>
            ) : (
              <span>Select a source to record</span>
            )}
          </div>
          <div className={`flex gap-2 ${styles.electronNoDrag}`}>
            <Button
              variant="outline"
              onClick={() => window.close()}
              className="px-4 py-1.5 text-xs bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRecord}
              disabled={!selectedSource || initializing}
              className={`px-6 py-1.5 text-xs text-white disabled:opacity-50 ${
                recording
                  ? 'bg-red-600 hover:bg-red-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {initializing ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1" />
                  Starting...
                </>
              ) : recording ? (
                <>
                  <FaRegStopCircle size={14} className="mr-1" />
                  Stop
                </>
              ) : (
                <>
                  <BsRecordCircle size={14} className="mr-1" />
                  Record
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function SourceTypeButton({
  icon,
  label,
  active,
  onClick,
  disabled
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-medium transition-colors ${
        active
          ? 'bg-zinc-700 text-white'
          : disabled
            ? 'text-zinc-600 cursor-not-allowed'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function DropdownItem({
  icon,
  label,
  selected,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
        selected
          ? 'bg-emerald-600/20 text-emerald-400'
          : 'text-zinc-300 hover:bg-zinc-800'
      }`}
    >
      {icon}
      <span className="truncate flex-1 text-left">{label}</span>
      {selected && <MdCheck className="w-4 h-4 text-emerald-400" />}
    </button>
  );
}
