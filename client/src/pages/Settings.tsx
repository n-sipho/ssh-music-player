import { useState, useEffect, useCallback } from 'react';
import { sourcesApi } from '../api';
import { usePlayer, type Source } from '../store/player';
import { formatDistanceToNow } from 'date-fns';

interface SourceStatus {
  status: 'idle' | 'scanning' | 'complete' | 'error';
  progress: number;
  totalFiles: number;
  scannedFiles: number;
  lastError?: string;
  lastScan?: string;
}

interface SourceWithStatus extends Source {
  status?: SourceStatus;
}

const ProgressBar = ({ status }: { status: SourceStatus }) => (
  <div className="mt-2">
    <div className="flex justify-between text-[10px] text-spotify-gray mb-1">
      <span className="font-bold uppercase tracking-wider">
        {status.status === 'scanning' ? `Syncing Library (${status.scannedFiles} / ${status.totalFiles})` : 'Library Up to Date'}
      </span>
      <span>{Math.round(status.progress)}%</span>
    </div>
    <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
      <div 
        className={`h-full transition-all duration-700 ${status.status === 'scanning' ? 'bg-spotify-green animate-pulse' : 'bg-spotify-green'}`} 
        style={{ width: `${status.progress}%` }}
      ></div>
    </div>
  </div>
);

export default function Settings() {
  const [sources, setSources] = useState<SourceWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Source> | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const { clearTracksBySource } = usePlayer();
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message?: string } | null>(null);
  const [scanningAll, setScanningAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discoveredServices, setDiscoveredServices] = useState<any[]>([]);

  const loadSources = useCallback(async () => {
    try {
      const res = await sourcesApi.getAll();
      setSources(res.data);
    } catch (err) {
      console.error('Failed to load sources:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSources(); }, [loadSources]);

  // Poll for discovery
  useEffect(() => {
    const fetchDiscovery = async () => {
      try {
        const res = await sourcesApi.discover();
        setDiscoveredServices(res.data);
      } catch { /* ignore */ }
    };
    fetchDiscovery();
    const interval = setInterval(fetchDiscovery, 5000);
    return () => clearInterval(interval);
  }, []);

  // Real-time UI polling
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await sourcesApi.getAll();
        setSources(res.data);
      } catch { /* silent fail */ }
    }, 4000);

    return () => clearInterval(interval);
  }, []);
  
  const saveSource = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      // Pick only the fields we want to save to avoid 400 errors from extra data
      const dataToSave = {
        name: editing.name,
        type: editing.type,
        host: editing.host,
        port: editing.port,
        username: editing.username,
        password: editing.password,
        share: editing.share,
        basePath: editing.basePath,
        enabled: editing.enabled,
      };

      if (editing.id) {
        await sourcesApi.update(editing.id, dataToSave);
      } else {
        await sourcesApi.create(dataToSave);
      }
      setEditing(null);
      loadSources();
    } catch (err: any) {
      console.error('Save failed:', err);
      const details = err.response?.data?.error;
      const message = Array.isArray(details) 
        ? details.map((d: any) => `${d.path.join('.')}: ${d.message}`).join(', ')
        : (typeof details === 'string' ? details : err.message);
      alert(`Save failed: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteSource = async (id: string) => {
    if (!confirm('Permanently remove this source and all its music from the library?')) return;
    try {
      await sourcesApi.delete(id);
      clearTracksBySource(id);
      loadSources();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const testSource = async (id: string) => {
    setTesting(id);
    setTestResult(null);
    try {
      const res = await sourcesApi.test(id);
      setTestResult({ id, ...res.data });
    } catch (err: any) {
      setTestResult({ id, success: false, message: err.response?.data?.error || err.message });
    } finally {
      setTesting(null);
    }
  };

  const scanAll = async () => {
    setScanningAll(true);
    try {
      await sourcesApi.scanAll();
      loadSources();
    } catch (err) {
      console.error('Scan all failed:', err);
    } finally {
      setTimeout(() => setScanningAll(false), 2000);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-spotify-gray">Accessing settings...</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-none p-6 pb-0">
        <h1 className="text-3xl font-bold mb-8">⚙️ Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="max-w-4xl">
          <section className="mb-12">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-semibold">📡 Sources</h2>
              <div className="flex gap-3">
                <button 
                  onClick={scanAll}
                  disabled={scanningAll}
                  className={`px-6 py-2 border border-white/10 text-white font-bold rounded-full hover:bg-white/5 transition-all flex items-center gap-2 ${scanningAll ? 'opacity-50' : ''}`}
                >
                  {scanningAll ? 'Starting Scan...' : 'Scan for Music'}
                </button>
                <button 
                  onClick={() => setEditing({ type: 'ssh', basePath: '/', enabled: true })} 
                  className="px-6 py-2 bg-spotify-green text-black font-bold rounded-full hover:scale-105 transition-transform"
                >
                  Add Source
                </button>
              </div>
            </div>

            {sources.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center text-spotify-gray">
                No sources configured.
              </div>
            ) : (
              <div className="space-y-4">
                {sources.map(source => (
                  <div key={source.id} className="bg-white/5 border border-white/10 rounded-xl p-5">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white text-lg truncate">{source.name}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${source.enabled ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-spotify-gray'}`}>
                            {source.enabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <div className="text-xs text-spotify-gray opacity-60 font-mono truncate">
                           {source.type.toUpperCase()} • {source.host} • {source.basePath}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        {testResult?.id === source.id && (
                          <span className={`text-xs font-bold mr-2 ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                            {testResult.success ? '✓ Ready' : `✗ ${testResult.message}`}
                          </span>
                        )}
                        <button onClick={() => testSource(source.id)} disabled={testing === source.id} className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white font-bold rounded-md transition-colors">
                          Test
                        </button>
                        <button onClick={() => setEditing(source)} className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white font-bold rounded-md transition-colors">
                          Edit
                        </button>
                        <button onClick={() => deleteSource(source.id)} className="px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-md transition-colors">
                          Remove
                        </button>
                      </div>
                    </div>

                    {source.status && (
                      <div className="pt-4 border-t border-white/5">
                        {source.status.status === 'error' && (
                          <p className="text-red-400 text-[10px] font-bold mb-2 uppercase">Sync Error: {source.status.lastError}</p>
                        )}
                        <ProgressBar status={source.status} />
                        {source.status.lastScan && (
                          <p className="text-[10px] text-spotify-gray font-bold uppercase tracking-[0.15em] mt-2 opacity-30">
                            Auto-sync completed {formatDistanceToNow(new Date(source.status.lastScan))} ago
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {discoveredServices.length > 0 && (
            <section className="mb-12">
              <h2 className="text-xl font-semibold mb-8 flex items-center gap-2">
                📡 Discovered on Network
                <span className="text-[10px] bg-spotify-green/20 text-spotify-green px-2 py-0.5 rounded-full animate-pulse">New</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {discoveredServices.map((service, idx) => (
                  <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between group">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white truncate">{service.name}</span>
                        <span className="text-[10px] font-bold text-spotify-gray uppercase bg-white/5 px-1.5 py-0.5 rounded">{service.type}</span>
                      </div>
                      <div className="text-xs text-spotify-gray opacity-60 font-mono truncate">
                        {service.host} • Port {service.port}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setEditing({
                          name: service.name,
                          type: service.type,
                          host: service.addresses[0] || service.host,
                          port: service.port,
                          basePath: '/',
                          enabled: true
                        })}
                        className="px-4 py-2 bg-white/10 hover:bg-spotify-green hover:text-black text-white text-xs font-bold rounded-full transition-all"
                      >
                        Connect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="bg-white/5 border border-white/5 rounded-2xl p-8 opacity-40">
            <p className="text-spotify-gray text-xs leading-relaxed font-medium">
              HomeMusic indexes your library when the application starts. 
              You can also manually trigger a scan if you've added new music.
            </p>
          </section>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="bg-spotify-dark border border-white/10 rounded-2xl p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-bold mb-6 text-white">{editing.id ? 'Edit' : 'Add'} Source</h3>
            
            {!editing.id && discoveredServices.length > 0 && (
              <div className="mb-6">
                <label className="block text-[10px] font-bold text-spotify-green uppercase tracking-widest mb-2 ml-1">📡 Use Discovered Device</label>
                <select 
                  className="w-full px-4 py-3 bg-white/10 border border-white/10 focus:border-spotify-green outline-none rounded-lg text-white text-sm transition-all appearance-none cursor-pointer"
                  onChange={(e) => {
                    const service = discoveredServices.find(s => s.name === e.target.value);
                    if (service) {
                      setEditing({
                        ...editing,
                        name: service.name,
                        type: service.type,
                        host: service.addresses[0] || service.host,
                        port: service.port,
                      });
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Select a device to pre-fill...</option>
                  {discoveredServices.map((service, idx) => (
                    <option key={idx} value={service.name} className="bg-spotify-dark">
                      {service.name} ({service.type.toUpperCase()} • {service.host})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-spotify-gray uppercase tracking-widest mb-2 ml-1">Friendly Name</label>
                <input value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="My Music" className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-spotify-green outline-none rounded-lg text-white text-sm transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-spotify-gray uppercase tracking-widest mb-2 ml-1">Protocol</label>
                  <select value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value as 'ssh' | 'smb' })} className="w-full px-4 py-3 bg-white/5 border border-white/10 outline-none rounded-lg text-white text-sm transition-colors">
                    <option value="ssh">SSH / SFTP</option>
                    <option value="smb">SMB / Windows</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-spotify-gray uppercase tracking-widest mb-2 ml-1">Host IP</label>
                  <input value={editing.host || ''} onChange={e => setEditing({ ...editing, host: e.target.value })} placeholder="192.168.10.55" className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-spotify-green outline-none rounded-lg text-white text-sm transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-spotify-gray uppercase tracking-widest mb-2 ml-1">Port (Optional)</label>
                <input type="number" value={editing.port || ''} onChange={e => setEditing({ ...editing, port: parseInt(e.target.value) || undefined })} placeholder={editing.type === 'ssh' ? '22' : '445'} className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-spotify-green outline-none rounded-lg text-white text-sm transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-spotify-gray uppercase tracking-widest mb-2 ml-1">Username</label>
                  <input value={editing.username || ''} onChange={e => setEditing({ ...editing, username: e.target.value })} placeholder="user" className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-spotify-green outline-none rounded-lg text-white text-sm transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-spotify-gray uppercase tracking-widest mb-2 ml-1">Password</label>
                  <input type="password" value={editing.password || ''} onChange={e => setEditing({ ...editing, password: e.target.value })} placeholder="••••••••" className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-spotify-green outline-none rounded-lg text-white text-sm transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-spotify-gray uppercase tracking-widest mb-2 ml-1">Music Path</label>
                <input value={editing.basePath || '/'} onChange={e => setEditing({ ...editing, basePath: e.target.value })} placeholder="/home/thabiso/Music" className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-spotify-green outline-none rounded-lg text-white text-sm transition-all" />
              </div>
              {editing.type === 'smb' && (
                <div>
                  <label className="block text-[10px] font-bold text-spotify-gray uppercase tracking-widest mb-2 ml-1">SMB Share Name</label>
                  <input value={editing.share || ''} onChange={e => setEditing({ ...editing, share: e.target.value })} placeholder="Music" className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-spotify-green outline-none rounded-lg text-white text-sm transition-all" />
                </div>
              )}
              <div className="flex items-center gap-3 pt-2 ml-1">
                <input type="checkbox" id="source-enabled" checked={editing.enabled} onChange={e => setEditing({ ...editing, enabled: e.target.checked })} className="w-5 h-5 accent-spotify-green" />
                <label htmlFor="source-enabled" className="text-xs font-bold text-white uppercase tracking-widest cursor-pointer">Auto-sync this source</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-10">
              <button onClick={() => setEditing(null)} disabled={saving} className="px-6 py-2 text-xs text-spotify-gray hover:text-white font-bold uppercase transition-colors disabled:opacity-50">Cancel</button>
              <button 
                onClick={saveSource} 
                disabled={saving}
                className="px-10 py-3 bg-spotify-green text-black rounded-full font-bold uppercase text-xs hover:scale-105 transition-transform shadow-xl disabled:opacity-50 disabled:scale-100"
              >
                {saving ? 'Saving...' : 'Save Source'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
