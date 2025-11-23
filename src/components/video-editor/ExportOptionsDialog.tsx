import { useState, useMemo } from 'react';
import { X, Upload, Clipboard, ChevronDown, Monitor, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  type ExportOptions,
  RESOLUTION_OPTIONS,
  COMPRESSION_OPTIONS,
  FRAME_RATE_OPTIONS,
  DEFAULT_EXPORT_OPTIONS,
} from './types';
import {
  calculateExportEstimate,
  formatEstimatedTime,
  formatEstimatedSize,
} from '@/lib/exporter/estimator';

interface ExportOptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  videoDuration: number; // in seconds
}

export function ExportOptionsDialog({
  isOpen,
  onClose,
  onExport,
  videoDuration,
}: ExportOptionsDialogProps) {
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [showFrameRateDropdown, setShowFrameRateDropdown] = useState(false);

  const estimate = useMemo(() => {
    return calculateExportEstimate(videoDuration, options);
  }, [videoDuration, options]);

  if (!isOpen) return null;

  const handleExport = () => {
    onExport(options);
  };

  const updateOption = <K extends keyof ExportOptions>(
    key: K,
    value: ExportOptions[K]
  ) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[60] bg-[#09090b] rounded-2xl shadow-2xl border border-white/10 p-8 w-[90vw] max-w-lg animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="hover:bg-white/10 text-slate-400 hover:text-white rounded-full"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Format & Frame Rate Row */}
        <div className="flex gap-8 mb-8">
          {/* Format */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Monitor className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-200">Format</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => updateOption('format', 'mp4')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  options.format === 'mp4'
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10'
                }`}
              >
                MP4
              </button>
              <button
                disabled
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-slate-500 border border-white/5 opacity-50 cursor-not-allowed"
                title="Coming soon"
              >
                GIF
              </button>
            </div>
          </div>

          {/* Frame Rate */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Gauge className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-200">Frame rate</span>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowFrameRateDropdown(!showFrameRateDropdown)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-slate-300 border border-white/5 hover:bg-white/10 transition-all"
              >
                <span>{options.frameRate}</span>
                <span className="text-slate-500">FPS</span>
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </button>
              {showFrameRateDropdown && (
                <div className="absolute top-full mt-1 left-0 bg-[#1a1a1d] border border-white/10 rounded-lg shadow-xl z-10 overflow-hidden">
                  {FRAME_RATE_OPTIONS.map(fps => (
                    <button
                      key={fps}
                      onClick={() => {
                        updateOption('frameRate', fps);
                        setShowFrameRateDropdown(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors ${
                        options.frameRate === fps
                          ? 'text-[#34B27B] bg-white/5'
                          : 'text-slate-300'
                      }`}
                    >
                      {fps} FPS
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Resolution */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 border border-slate-400 rounded-sm flex items-center justify-center">
              <div className="w-2 h-2 border border-slate-400 rounded-sm" />
            </div>
            <span className="text-sm font-medium text-slate-200">Resolution</span>
          </div>
          <div className="flex gap-2 mb-2">
            {RESOLUTION_OPTIONS.map(res => (
              <button
                key={res.key}
                onClick={() => updateOption('resolution', res)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  options.resolution.key === res.key
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10'
                }`}
              >
                {res.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-500">{options.resolution.description}</span>
        </div>

        {/* Compression */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span className="text-sm font-medium text-slate-200">Compression</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {COMPRESSION_OPTIONS.map(comp => (
              <button
                key={comp.key}
                onClick={() => updateOption('compression', comp)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  options.compression.key === comp.key
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10'
                }`}
              >
                {comp.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">{options.compression.description}</p>
          <p className="text-xs text-slate-600 mt-1">Quality setting does not impact export speed.</p>
        </div>

        {/* Export To */}
        <div className="mb-8">
          <span className="text-sm font-medium text-slate-200 block mb-3">Export to</span>
          <div className="flex gap-2">
            <button
              onClick={() => updateOption('destination', 'file')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                options.destination === 'file'
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10'
              }`}
            >
              <Upload className="w-4 h-4" />
              File
            </button>
            <button
              disabled
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-slate-500 border border-white/5 opacity-50 cursor-not-allowed"
              title="Coming soon"
            >
              <Clipboard className="w-4 h-4" />
              Clipboard
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Estimation &mdash; Export time {formatEstimatedTime(estimate.timeSeconds)} &mdash; Output size {formatEstimatedSize(estimate.fileSizeMB)}
          </div>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-slate-400 hover:text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-6 flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Export to file...
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
