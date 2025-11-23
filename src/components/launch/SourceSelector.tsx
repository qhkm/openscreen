import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { MdCheck } from "react-icons/md";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Card } from "../ui/card";
import styles from "./SourceSelector.module.css";

interface DesktopSource {
  id: string;
  name: string;
  thumbnail: string | null;
  display_id: string;
  appIcon: string | null;
}

export function SourceSelector() {
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<DesktopSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(false);

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
        setSources(
          rawSources.map(source => ({
            id: source.id,
            name:
              source.id.startsWith('window:') && source.name.includes(' — ')
                ? source.name.split(' — ')[1] || source.name
                : source.name,
            thumbnail: source.thumbnail,
            display_id: source.display_id,
            appIcon: source.appIcon
          }))
        );
      } catch (error) {
        console.error('Error loading sources:', error);
        setPermissionError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchSources();
  }, []);

  const screenSources = sources.filter(s => s.id.startsWith('screen:'));
  const windowSources = sources.filter(s => s.id.startsWith('window:'));

  const handleSourceSelect = (source: DesktopSource) => setSelectedSource(source);
  const handleShare = async () => {
    if (selectedSource) await window.electronAPI.selectSource(selectedSource);
  };

  const handleOpenSettings = async () => {
    await window.electronAPI.openExternalUrl('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
  };

  if (loading) {
    return (
      <div className={`h-full flex items-center justify-center ${styles.glassContainer}`} style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-zinc-600 mx-auto mb-2" />
          <p className="text-xs text-zinc-300">Loading sources...</p>
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
          <div className="space-y-2">
            <Button
              onClick={handleOpenSettings}
              className="w-full bg-[#34B27B] text-white hover:bg-[#34B27B]/80"
            >
              Open System Settings
            </Button>
            <p className="text-xs text-zinc-500">
              After enabling, restart the app for changes to take effect.
            </p>
          </div>
        </div>
        <div className="border-t border-zinc-800 p-2 w-full max-w-xl mt-6">
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => window.close()} className="px-4 py-1 text-xs bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700">
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center ${styles.glassContainer}`}>
      <div className="flex-1 flex flex-col w-full max-w-xl" style={{ padding: 0 }}>
        <Tabs defaultValue="screens">
          <TabsList className="grid grid-cols-2 mb-3 bg-zinc-900/40 rounded-full">
            <TabsTrigger value="screens" className="data-[state=active]:bg-[#34B27B] data-[state=active]:text-white text-zinc-200 rounded-full text-xs py-1">Screens</TabsTrigger>
            <TabsTrigger value="windows" className="data-[state=active]:bg-[#34B27B] data-[state=active]:text-white text-zinc-200 rounded-full text-xs py-1">Windows</TabsTrigger>
          </TabsList>
            <div className="h-60 flex flex-col justify-stretch">
            <TabsContent value="screens" className="h-full">
              <div className="grid grid-cols-2 gap-2 h-full overflow-y-auto pr-1 relative">
                {screenSources.map(source => (
                  <Card
                    key={source.id}
                    className={`${styles.sourceCard} ${selectedSource?.id === source.id ? styles.selected : ''} cursor-pointer h-fit p-2 scale-95`}
                    style={{ margin: 8, width: '90%', maxWidth: 220 }}
                    onClick={() => handleSourceSelect(source)}
                  >
                    <div className="p-1">
                      <div className="relative mb-1">
                        <img
                          src={source.thumbnail || ''}
                          alt={source.name}
                          className="w-full aspect-video object-cover rounded border border-zinc-800"
                        />
                        {selectedSource?.id === source.id && (
                          <div className="absolute -top-1 -right-1">
                            <div className="w-4 h-4 bg-[#34B27B] rounded-full flex items-center justify-center shadow-md">
                              <MdCheck className={styles.icon} />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className={styles.name + " truncate"}>{source.name}</div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="windows" className="h-full">
              <div className="grid grid-cols-2 gap-2 h-full overflow-y-auto pr-1 relative">
                {windowSources.map(source => (
                  <Card
                    key={source.id}
                    className={`${styles.sourceCard} ${selectedSource?.id === source.id ? styles.selected : ''} cursor-pointer h-fit p-2 scale-95`}
                    style={{ margin: 8, width: '90%', maxWidth: 220 }}
                    onClick={() => handleSourceSelect(source)}
                  >
                    <div className="p-1">
                      <div className="relative mb-1">
                        <img
                          src={source.thumbnail || ''}
                          alt={source.name}
                          className="w-full aspect-video object-cover rounded border border-gray-700"
                        />
                        {selectedSource?.id === source.id && (
                          <div className="absolute -top-1 -right-1">
                            <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center shadow-md">
                              <MdCheck className={styles.icon} />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {source.appIcon && (
                          <img
                            src={source.appIcon}
                            alt="App icon"
                            className={styles.icon + " flex-shrink-0"}
                          />
                        )}
                        <div className={styles.name + " truncate"}>{source.name}</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
      <div className="border-t border-zinc-800 p-2 w-full max-w-xl">
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => window.close()} className="px-4 py-1 text-xs bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700">Cancel</Button>
          <Button onClick={handleShare} disabled={!selectedSource} className="px-4 py-1 text-xs bg-[#34B27B] text-white hover:bg-[#34B27B]/80 disabled:opacity-50 disabled:bg-zinc-700">Share</Button>
        </div>
      </div>
    </div>
  );
}
