import { cn } from "@/lib/utils";
import { useEffect, useRef, useState, useMemo, memo } from "react";
import { getAssetPath } from "@/lib/assetPath";
import Colorful from '@uiw/react-color-colorful';
import { hsvaToHex } from '@uiw/color-convert';
import {
  Download,
  Crop,
  X,
  Bug,
  Upload,
  MousePointer2,
  ZoomIn,
  Zap,
  Palette,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Trash2,
  Monitor,
  Camera,
  Circle,
  RectangleHorizontal
} from "lucide-react";
import { toast } from "sonner";
import type { ZoomDepth, CropRegion, CursorSettings, CameraOverlaySettings} from "./types";
import { CURSOR_STYLE_OPTIONS, CLICK_EFFECT_OPTIONS, CAMERA_SHAPE_OPTIONS } from "./types";
import { CropControl } from "./CropControl";

const WALLPAPER_COUNT = 23;
const WALLPAPER_RELATIVE = Array.from({ length: WALLPAPER_COUNT }, (_, i) => `wallpapers/wallpaper${i + 1}.jpg`);
const GRADIENTS = [
  "linear-gradient( 111.6deg,  rgba(114,167,232,1) 9.4%, rgba(253,129,82,1) 43.9%, rgba(253,129,82,1) 54.8%, rgba(249,202,86,1) 86.3% )",
  "linear-gradient(120deg, #d4fc79 0%, #96e6a1 100%)",
  "radial-gradient( circle farthest-corner at 3.2% 49.6%,  rgba(80,12,139,0.87) 0%, rgba(161,10,144,0.72) 83.6% )",
  "linear-gradient( 111.6deg,  rgba(0,56,68,1) 0%, rgba(163,217,185,1) 51.5%, rgba(231, 148, 6, 1) 88.6% )",
  "linear-gradient( 107.7deg,  rgba(235,230,44,0.55) 8.4%, rgba(252,152,15,1) 90.3% )",
  "linear-gradient( 91deg,  rgba(72,154,78,1) 5.2%, rgba(251,206,70,1) 95.9% )",
  "radial-gradient( circle farthest-corner at 10% 20%,  rgba(2,37,78,1) 0%, rgba(4,56,126,1) 19.7%, rgba(85,245,221,1) 100.2% )",
  "linear-gradient( 109.6deg,  rgba(15,2,2,1) 11.2%, rgba(36,163,190,1) 91.1% )",
  "linear-gradient(135deg, #FBC8B4, #2447B1)",
  "linear-gradient(109.6deg, #F635A6, #36D860)",
  "linear-gradient(90deg, #FF0101, #4DFF01)",
  "linear-gradient(315deg, #EC0101, #5044A9)",
  "linear-gradient(45deg, #ff9a9e 0%, #fad0c4 99%, #fad0c4 100%)",
  "linear-gradient(to top, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(to right, #ff8177 0%, #ff867a 0%, #ff8c7f 21%, #f99185 52%, #cf556c 78%, #b12a5b 100%)",
  "linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)",
  "linear-gradient(to right, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(to top, #fcc5e4 0%, #fda34b 15%, #ff7882 35%, #c8699e 52%, #7046aa 71%, #0c1db8 87%, #020f75 100%)",
  "linear-gradient(to right, #fa709a 0%, #fee140 100%)",
  "linear-gradient(to top, #30cfd0 0%, #330867 100%)",
  "linear-gradient(to top, #c471f5 0%, #fa71cd 100%)",
  "linear-gradient(to right, #f78ca0 0%, #f9748f 19%, #fd868c 60%, #fe9a8b 100%)",
  "linear-gradient(to top, #48c6ef 0%, #6f86d6 100%)",
  "linear-gradient(to right, #0acffe 0%, #495aff 100%)",
];

interface SettingsPanelProps {
  selected: string;
  onWallpaperChange: (path: string) => void;
  selectedZoomDepth?: ZoomDepth | null;
  onZoomDepthChange?: (depth: ZoomDepth) => void;
  selectedZoomId?: string | null;
  onZoomDelete?: (id: string) => void;
  showShadow?: boolean;
  onShadowChange?: (showShadow: boolean) => void;
  showBlur?: boolean;
  onBlurChange?: (showBlur: boolean) => void;
  cropRegion?: CropRegion;
  onCropChange?: (region: CropRegion) => void;
  videoElement?: HTMLVideoElement | null;
  onExport?: () => void;
  cursorSettings?: CursorSettings;
  onCursorSettingsChange?: (settings: CursorSettings) => void;
  cameraSettings?: CameraOverlaySettings;
  onCameraSettingsChange?: (settings: CameraOverlaySettings) => void;
  hasCameraRecording?: boolean;
}

export default SettingsPanel;

const ZOOM_DEPTH_OPTIONS: Array<{ depth: ZoomDepth; label: string }> = [
  { depth: 1, label: "1.0x" },
  { depth: 2, label: "1.25x" },
  { depth: 3, label: "1.5x" },
  { depth: 4, label: "2.0x" },
  { depth: 5, label: "3.5x" },
];

// Tab Button Component
const TabButton = ({
  active,
  onClick,
  label,
  icon
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center justify-center gap-2 rounded-md py-2 text-xs font-medium transition-all",
      active
        ? "bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700"
        : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
    )}
  >
    {icon}
    {label}
  </button>
);

// Toggle Item Component
const ToggleItem = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <div
    className="flex cursor-pointer items-center justify-between rounded-lg border border-transparent px-2 py-2 transition-colors hover:bg-zinc-900"
    onClick={onClick}
  >
    <span className="text-xs font-medium text-zinc-300">{label}</span>
    <div className={cn("relative h-5 w-9 rounded-full transition-colors", active ? 'bg-emerald-600' : 'bg-zinc-700')}>
      <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform", active ? 'left-[18px]' : 'left-0.5')} />
    </div>
  </div>
);

// Option Button Component
const OptionButton = ({
  label,
  icon,
  active,
  onClick
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex h-10 items-center justify-center gap-2 rounded-lg border text-xs font-medium transition-all active:scale-95",
      active
        ? "border-emerald-600/50 bg-emerald-900/20 text-emerald-400 shadow-sm"
        : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-200"
    )}
  >
    {icon}
    {label}
  </button>
);

// Memoized Wallpaper Item with lazy loading
const WallpaperItem = memo(({ path, isSelected, onClick }: { path: string; isSelected: boolean; onClick: () => void }) => (
  <div
    className={cn(
      "aspect-square rounded-lg border-2 overflow-hidden cursor-pointer bg-zinc-900",
      isSelected
        ? "border-emerald-500 ring-2 ring-emerald-500/30"
        : "border-zinc-800 hover:border-zinc-600"
    )}
    onClick={onClick}
  >
    <img
      src={path}
      alt=""
      loading="lazy"
      decoding="async"
      className="w-full h-full object-cover"
    />
  </div>
));
WallpaperItem.displayName = 'WallpaperItem';

// Memoized Gradient Item
const GradientItem = memo(({ gradient, isSelected, onClick }: { gradient: string; isSelected: boolean; onClick: () => void }) => (
  <div
    className={cn(
      "aspect-square rounded-lg border-2 overflow-hidden cursor-pointer",
      isSelected
        ? "border-emerald-500 ring-2 ring-emerald-500/30"
        : "border-zinc-800 hover:border-zinc-600"
    )}
    style={{ background: gradient }}
    onClick={onClick}
  />
));
GradientItem.displayName = 'GradientItem';

export function SettingsPanel({
  selected,
  onWallpaperChange,
  selectedZoomDepth,
  onZoomDepthChange,
  selectedZoomId,
  onZoomDelete,
  showShadow,
  onShadowChange,
  showBlur,
  onBlurChange,
  cropRegion,
  onCropChange,
  videoElement,
  onExport,
  cursorSettings,
  onCursorSettingsChange,
  cameraSettings,
  onCameraSettingsChange,
  hasCameraRecording
}: SettingsPanelProps) {
  const [wallpaperPaths, setWallpaperPaths] = useState<string[]>([]);
  const [customImages, setCustomImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hsva, setHsva] = useState({ h: 0, s: 0, v: 68, a: 1 });
  const [gradient, setGradient] = useState<string>(GRADIENTS[0]);
  const [showCropDropdown, setShowCropDropdown] = useState(false);
  const [bgMode, setBgMode] = useState<'image' | 'color' | 'gradient'>('image');
  const [activeTab, setActiveTab] = useState<'canvas' | 'cursor' | 'camera'>('canvas');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resolved = await Promise.all(WALLPAPER_RELATIVE.map(p => getAssetPath(p)));
        if (mounted) setWallpaperPaths(resolved);
      } catch {
        if (mounted) setWallpaperPaths(WALLPAPER_RELATIVE.map(p => `/${p}`));
      }
    })();
    return () => { mounted = false };
  }, []);

  // Memoize the final wallpaper list to avoid recomputation
  const finalWallpaperPaths = useMemo(() => {
    return wallpaperPaths.length > 0 ? wallpaperPaths : WALLPAPER_RELATIVE.map(p => `/${p}`);
  }, [wallpaperPaths]);

  // Memoize selection check function
  const isWallpaperSelected = useMemo(() => {
    if (!selected) return () => false;
    const selectedFilename = selected.split('/').pop() || '';
    return (path: string) => {
      if (selected === path) return true;
      return path.includes(selectedFilename);
    };
  }, [selected]);

  const zoomEnabled = Boolean(selectedZoomDepth);

  const handleDeleteClick = () => {
    if (selectedZoomId && onZoomDelete) {
      onZoomDelete(selectedZoomId);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    const validTypes = ['image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type', {
        description: 'Please upload a JPG or JPEG image file.',
      });
      event.target.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        setCustomImages(prev => [...prev, dataUrl]);
        onWallpaperChange(dataUrl);
        toast.success('Custom image uploaded successfully!');
      }
    };

    reader.onerror = () => {
      toast.error('Failed to upload image', {
        description: 'There was an error reading the file.',
      });
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleRemoveCustomImage = (imageUrl: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setCustomImages(prev => prev.filter(img => img !== imageUrl));
    if (selected === imageUrl) {
      onWallpaperChange(wallpaperPaths[0] || WALLPAPER_RELATIVE[0]);
    }
  };

  return (
    <aside className="flex-[3] min-w-0 flex h-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-100">Properties</h2>
        <button className="text-zinc-500 hover:text-zinc-300">
          <Layers size={16} />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="grid grid-cols-3 gap-1 border-b border-zinc-800 bg-zinc-900/30 p-2">
        <TabButton
          active={activeTab === 'canvas'}
          onClick={() => setActiveTab('canvas')}
          label="Canvas"
          icon={<LayoutTemplate size={14} />}
        />
        <TabButton
          active={activeTab === 'cursor'}
          onClick={() => setActiveTab('cursor')}
          label="Cursor"
          icon={<MousePointer2 size={14} />}
        />
        <TabButton
          active={activeTab === 'camera'}
          onClick={() => setActiveTab('camera')}
          label="Camera"
          icon={<Camera size={14} />}
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">

        {/* --- CANVAS TAB CONTENT --- */}
        {activeTab === 'canvas' && (
          <div className="space-y-8">

            {/* Section: Viewport / Zoom */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <ZoomIn size={12} /> Viewport
                </label>
                {zoomEnabled && selectedZoomDepth && (
                  <span className="text-xs text-emerald-400">
                    {ZOOM_DEPTH_OPTIONS.find(o => o.depth === selectedZoomDepth)?.label}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-5 gap-1 rounded-lg bg-zinc-900 p-1 ring-1 ring-zinc-800">
                {ZOOM_DEPTH_OPTIONS.map((option) => (
                  <button
                    key={option.depth}
                    disabled={!zoomEnabled}
                    onClick={() => onZoomDepthChange?.(option.depth)}
                    className={cn(
                      "flex h-8 items-center justify-center rounded-md text-xs font-medium transition-all",
                      !zoomEnabled && "opacity-40 cursor-not-allowed",
                      selectedZoomDepth === option.depth
                        ? "bg-zinc-700 text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-tight text-zinc-600">
                {zoomEnabled
                  ? "Adjust timeline depth focus region."
                  : "Select a zoom region in the timeline to adjust depth."}
              </p>

              {zoomEnabled && (
                <button
                  onClick={handleDeleteClick}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 py-2 text-xs font-medium text-red-400 transition-all hover:bg-red-500/20 hover:border-red-500/30 active:scale-[0.98]"
                >
                  <Trash2 size={14} />
                  Delete Zoom Region
                </button>
              )}
            </section>

            {/* Section: Background */}
            <section>
              <label className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                <Monitor size={12} /> Background
              </label>

              {/* Background Mode Switcher */}
              <div className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-zinc-900 p-1">
                <button
                  onClick={() => setBgMode('image')}
                  className={cn(
                    "flex h-8 items-center justify-center gap-2 rounded-md text-xs font-medium transition-all",
                    bgMode === 'image' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  <ImageIcon size={14} /> Img
                </button>
                <button
                  onClick={() => setBgMode('color')}
                  className={cn(
                    "flex h-8 items-center justify-center gap-2 rounded-md text-xs font-medium transition-all",
                    bgMode === 'color' ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  <Palette size={14} /> Color
                </button>
                <button
                  onClick={() => setBgMode('gradient')}
                  className={cn(
                    "flex h-8 items-center justify-center gap-2 rounded-md text-xs font-medium transition-all",
                    bgMode === 'gradient' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  <Layers size={14} /> Grad
                </button>
              </div>

              {/* Background Content based on mode */}
              {bgMode === 'image' && (
                <div className="space-y-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept=".jpg,.jpeg,image/jpeg"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="group flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 py-3 text-xs font-medium text-zinc-400 transition-all hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                  >
                    <Upload size={14} />
                    Upload Custom Image
                  </button>

                  <div className="grid grid-cols-5 gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                    {customImages.map((imageUrl, idx) => (
                      <div
                        key={`custom-${idx}`}
                        className={cn(
                          "aspect-square rounded-lg border-2 overflow-hidden cursor-pointer relative group bg-zinc-900",
                          selected === imageUrl
                            ? "border-emerald-500 ring-2 ring-emerald-500/30"
                            : "border-zinc-800 hover:border-zinc-600"
                        )}
                        onClick={() => onWallpaperChange(imageUrl)}
                      >
                        <img
                          src={imageUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={(e) => handleRemoveCustomImage(imageUrl, e)}
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500/90 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                      </div>
                    ))}

                    {finalWallpaperPaths.map((path) => (
                      <WallpaperItem
                        key={path}
                        path={path}
                        isSelected={isWallpaperSelected(path)}
                        onClick={() => onWallpaperChange(path)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {bgMode === 'color' && (
                <div className="p-1">
                  <Colorful
                    color={hsva}
                    disableAlpha={true}
                    onChange={(color) => {
                      setHsva(color.hsva);
                      onWallpaperChange(hsvaToHex(color.hsva));
                    }}
                    style={{ width: '100%', borderRadius: '12px' }}
                  />
                </div>
              )}

              {bgMode === 'gradient' && (
                <div className="grid grid-cols-5 gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                  {GRADIENTS.map((g) => (
                    <GradientItem
                      key={g}
                      gradient={g}
                      isSelected={gradient === g}
                      onClick={() => { setGradient(g); onWallpaperChange(g); }}
                    />
                  ))}
                </div>
              )}

              {/* Visual Effects Toggles */}
              <div className="mt-4 space-y-3">
                <ToggleItem
                  label="Drop Shadow"
                  active={showShadow || false}
                  onClick={() => onShadowChange?.(!showShadow)}
                />
                <ToggleItem
                  label="Blur Background"
                  active={showBlur || false}
                  onClick={() => onBlurChange?.(!showBlur)}
                />
              </div>
            </section>

            {/* Section: Crop */}
            <section>
              <button
                onClick={() => setShowCropDropdown(!showCropDropdown)}
                className="group flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 py-3 text-xs font-medium text-zinc-400 transition-all hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <Crop size={14} />
                Crop Canvas Area
              </button>
            </section>
          </div>
        )}

        {/* --- CURSOR TAB CONTENT --- */}
        {activeTab === 'cursor' && cursorSettings && onCursorSettingsChange && (
          <div className="space-y-8">

            {/* Section: Cursor Style */}
            <section>
              <label className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                <MousePointer2 size={12} /> Pointer Style
              </label>

              <div className="grid grid-cols-2 gap-3">
                {CURSOR_STYLE_OPTIONS.map((option) => (
                  <OptionButton
                    key={option.value}
                    active={cursorSettings.style === option.value}
                    onClick={() => onCursorSettingsChange({ ...cursorSettings, style: option.value })}
                    icon={option.value === 'default' ? <MousePointer2 size={14} /> : undefined}
                    label={option.label}
                  />
                ))}
              </div>
            </section>

            {/* Section: Click Effects */}
            <section>
              <label className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                <Zap size={12} /> Click Interactions
              </label>

              <div className="mb-4 grid grid-cols-4 gap-1 rounded-lg bg-zinc-900 p-1 ring-1 ring-zinc-800">
                {CLICK_EFFECT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onCursorSettingsChange({ ...cursorSettings, clickEffect: option.value })}
                    className={cn(
                      "flex h-8 items-center justify-center rounded-md text-[11px] font-medium transition-all",
                      cursorSettings.clickEffect === option.value
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Color Picker */}
              {cursorSettings.clickEffect !== 'none' && (
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5">
                  <span className="text-xs text-zinc-400">Interaction Color</span>
                  <div className="flex cursor-pointer items-center gap-2 rounded-md bg-zinc-950 px-2 py-1 ring-1 ring-zinc-800 hover:ring-zinc-700">
                    <input
                      type="color"
                      value={cursorSettings.clickColor}
                      onChange={(e) => onCursorSettingsChange({ ...cursorSettings, clickColor: e.target.value })}
                      className="h-3 w-3 cursor-pointer rounded-full border-0 bg-transparent p-0"
                      style={{ WebkitAppearance: 'none' }}
                    />
                    <span className="font-mono text-[10px] text-zinc-400">{cursorSettings.clickColor}</span>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* Fallback if no cursor settings */}
        {activeTab === 'cursor' && (!cursorSettings || !onCursorSettingsChange) && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MousePointer2 size={32} className="mb-3 text-zinc-700" />
            <p className="text-xs text-zinc-500">Cursor settings not available</p>
            <p className="mt-1 text-[10px] text-zinc-600">Record a video to enable cursor overlay</p>
          </div>
        )}

        {/* --- CAMERA TAB CONTENT --- */}
        {activeTab === 'camera' && cameraSettings && onCameraSettingsChange && hasCameraRecording && (
          <div className="space-y-8">

            {/* Section: Camera Shape */}
            <section>
              <label className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                <Camera size={12} /> Camera Shape
              </label>

              <div className="grid grid-cols-3 gap-3">
                {CAMERA_SHAPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onCameraSettingsChange({ ...cameraSettings, shape: option.value })}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-xs font-medium transition-all active:scale-95",
                      cameraSettings.shape === option.value
                        ? "border-emerald-600/50 bg-emerald-900/20 text-emerald-400 shadow-sm"
                        : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-200"
                    )}
                  >
                    {option.value === 'circle' && <Circle size={24} />}
                    {option.value === 'squircle' && (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2C17.5 2 22 6.5 22 12C22 17.5 17.5 22 12 22C6.5 22 2 17.5 2 12C2 6.5 6.5 2 12 2Z" strokeLinecap="round" />
                      </svg>
                    )}
                    {option.value === 'rounded-rect' && <RectangleHorizontal size={24} />}
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Section: Visibility Toggle */}
            <section>
              <ToggleItem
                label="Show Camera Overlay"
                active={cameraSettings.enabled}
                onClick={() => onCameraSettingsChange({ ...cameraSettings, enabled: !cameraSettings.enabled })}
              />
              <ToggleItem
                label="Mirror Camera"
                active={cameraSettings.mirror}
                onClick={() => onCameraSettingsChange({ ...cameraSettings, mirror: !cameraSettings.mirror })}
              />
              <ToggleItem
                label="Show Shadow"
                active={cameraSettings.showShadow}
                onClick={() => onCameraSettingsChange({ ...cameraSettings, showShadow: !cameraSettings.showShadow })}
              />
            </section>

            {/* Section: Size */}
            <section>
              <label className="mb-3 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-zinc-500">
                <span>Size</span>
                <span className="text-emerald-400">{Math.round(cameraSettings.size * 100)}%</span>
              </label>
              <input
                type="range"
                min="10"
                max="40"
                value={cameraSettings.size * 100}
                onChange={(e) => onCameraSettingsChange({ ...cameraSettings, size: Number(e.target.value) / 100 })}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </section>

            {/* Section: Brightness */}
            <section>
              <label className="mb-3 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-zinc-500">
                <span>Brightness</span>
                <span className="text-emerald-400">{Math.round((cameraSettings.brightness ?? 1) * 100)}%</span>
              </label>
              <input
                type="range"
                min="50"
                max="200"
                value={(cameraSettings.brightness ?? 1) * 100}
                onChange={(e) => onCameraSettingsChange({ ...cameraSettings, brightness: Number(e.target.value) / 100 })}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </section>

          </div>
        )}

        {/* Fallback if no camera recording */}
        {activeTab === 'camera' && !hasCameraRecording && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Camera size={32} className="mb-3 text-zinc-700" />
            <p className="text-xs text-zinc-500">No camera recording available</p>
            <p className="mt-1 text-[10px] text-zinc-600">Record with camera enabled to add overlay</p>
          </div>
        )}

      </div>

      {/* Footer: Primary Action */}
      <div className="border-t border-zinc-800 bg-zinc-950 p-5">
        <button
          onClick={onExport}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition-all hover:brightness-110 active:scale-[0.98]"
        >
          <Download size={16} />
          Export Video
        </button>
        <button
          type="button"
          onClick={() => {
            window.electronAPI?.openExternalUrl('https://github.com/siddharthvaddem/openscreen/issues/new');
          }}
          className="w-full mt-3 flex items-center justify-center gap-2 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors py-1"
        >
          <Bug size={10} />
          <span>Report a Bug</span>
        </button>
      </div>

      {/* Crop Modal */}
      {showCropDropdown && cropRegion && onCropChange && (
        <>
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-in fade-in duration-200"
            onClick={() => setShowCropDropdown(false)}
          />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[60] bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-800 p-8 w-[90vw] max-w-5xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-xl font-bold text-zinc-100">Crop Video</span>
                <p className="text-sm text-zinc-400 mt-2">Drag on each side to adjust the crop area</p>
              </div>
              <button
                onClick={() => setShowCropDropdown(false)}
                className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <CropControl
              videoElement={videoElement || null}
              cropRegion={cropRegion}
              onCropChange={onCropChange}
            />
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowCropDropdown(false)}
                className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
