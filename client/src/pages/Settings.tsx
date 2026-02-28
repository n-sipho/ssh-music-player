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
  const [wizardStep, setWizardStep] = useState(1); // 1: Credentials, 2: Share & Path
  const [testing, setTesting] = useState<string | null>(null);
  const { clearTracksBySource, showNotification } = usePlayer();
  const [scanningAll, setScanningAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discoveredServices, setDiscoveredServices] = useState<any[]>([]);
  const [discoveredShares, setDiscoveredShares] = useState<string[]>([]);
  const [isEnumerating, setIsEnumerating] = useState(false);

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

  const resetWizard = (source: Partial<Source> | null = null) => {
    setEditing(source);
    setWizardStep(1);
    setDiscoveredShares([]);
  };

  // Poll for discovery - keep it at 10s and stop after 5 empty results to save resources
  useEffect(() => {
    let emptyCount = 0;
    const fetchDiscovery = async () => {
      try {
        const res = await sourcesApi.discover();
        setDiscoveredServices(res.data);
        if (res.data.length === 0) emptyCount++;
        else emptyCount = 0;
      } catch { /* ignore */ }
    };
    
    fetchDiscovery();
    const interval = setInterval(() => {
      if (emptyCount < 5) fetchDiscovery();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // Real-time UI polling - only when a source is actually scanning
  useEffect(() => {
    const anyScanning = sources.some(s => s.status?.status === 'scanning');
    if (!anyScanning) return;

    const interval = setInterval(async () => {
      try {
        const res = await sourcesApi.getAll();
        setSources(res.data);
      } catch { /* silent fail */ }
    }, 4000);

    return () => clearInterval(interval);
  }, [sources]);
  
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
        domain: editing.domain,
        share: editing.share,
        basePath: editing.basePath,
        enabled: editing.enabled,
      };

      if (editing.id) {
        await sourcesApi.update(editing.id, dataToSave);
        showNotification('Source updated successfully', 'success');
      } else {
        await sourcesApi.create(dataToSave);
        showNotification('New source added', 'success');
      }
      setEditing(null);
      loadSources();
    } catch (err: any) {
      console.error('Save failed:', err);
      const details = err.response?.data?.error;
      const message = Array.isArray(details) 
        ? details.map((d: any) => `${d.path.join('.')}: ${d.message}`).join(', ')
        : (typeof details === 'string' ? details : err.message);
      showNotification(`Save failed: ${message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteSource = async (id: string) => {
    if (!confirm('Permanently remove this source and all its music from the library?')) return;
    try {
      await sourcesApi.delete(id);
      clearTracksBySource(id);
      showNotification('Source removed', 'success');
      loadSources();
    } catch (err) {
      console.error('Delete failed:', err);
      showNotification('Failed to remove source', 'error');
    }
  };

  const testSource = async (id: string) => {
    setTesting(id);
    try {
      // If we're in the middle of editing (especially a new source), test with the local state
      const sourceToTest = (editing && (editing.id === id || id === 'temp')) ? editing : id;
      const res = await sourcesApi.test(sourceToTest);
      if (res.data.success) {
        showNotification('Connection successful', 'success');
      } else {
        showNotification(`Connection failed: ${res.data.message}`, 'error');
      }
    } catch (err: any) {
      showNotification(`Test failed: ${err.response?.data?.error || err.message}`, 'error');
    } finally {
      setTesting(null);
    }
  };

  const handleContinue = async () => {
    if (!editing?.host || !editing?.username || !editing?.password) {
      showNotification('Host, Username and Password are required', 'error');
      return;
    }

    if (editing.type === 'ssh') {
      setWizardStep(2);
      return;
    }

    // SMB - Enumerate shares
    setIsEnumerating(true);
    try {
      const res = await sourcesApi.enumerateShares({
        host: editing.host,
        username: editing.username || '',
        password: editing.password || '',
        domain: editing.domain || '.',
      });
      
      const shares = res.data;
      setDiscoveredShares(shares);
      
      if (shares.length === 0) {
        showNotification('Authenticated, but no shared folders were found.', 'info');
      } else if (shares.length === 1) {
        setEditing({ ...editing, share: shares[0] });
        showNotification(`Found and selected share: "${shares[0]}"`, 'success');
      } else {
        showNotification(`Discovered ${shares.length} shared folders.`, 'info');
      }
      
      setWizardStep(2);
    } catch (err: any) {
      console.error('Enumerate failed:', err);
      const msg = err.response?.data?.error || 'Failed to list shares on the server.';
      showNotification(msg, 'error');
    } finally {
      setIsEnumerating(false);
    }
  };

  const scanAll = async () => {
    setScanningAll(true);
    try {
      await sourcesApi.scanAll();
      showNotification('Library scan started', 'info');
      loadSources();
    } catch (err) {
      console.error('Scan all failed:', err);
      showNotification('Failed to start scan', 'error');
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
                  onClick={() => resetWizard({ type: 'smb', basePath: '/', enabled: true })} 
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
                        <button onClick={() => testSource(source.id)} disabled={testing === source.id} className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white font-bold rounded-md transition-colors">
                          {testing === source.id ? 'Testing...' : 'Test'}
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
                        onClick={() => resetWizard({
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => resetWizard(null)}>
          <div className="bg-spotify-dark border border-white/10 rounded-2xl p-6 w-full max-w-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">
                {editing.id ? 'Edit' : 'Connect to'} {editing.type === 'smb' ? 'Server' : 'SSH'}
              </h3>
              <div className="flex gap-2 text-[10px] font-bold uppercase tracking-widest">
                <span className={wizardStep === 1 ? 'text-spotify-green' : 'text-spotify-gray opacity-30'}>1. Auth</span>
                <span className="text-spotify-gray opacity-30">→</span>
                <span className={wizardStep === 2 ? 'text-spotify-green' : 'text-spotify-gray opacity-30'}>2. Share</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {wizardStep === 1 ? (
                <div className="space-y-6">
                  {!editing.id && discoveredServices.length > 0 && (
                    <div className="bg-spotify-green/5 border border-spotify-green/20 rounded-xl p-3">
                      <label className="block text-[10px] font-bold text-spotify-green uppercase tracking-widest mb-2 ml-1">📡 Use Discovered Device</label>
                      <select 
                        className="w-full px-3 py-2 bg-black/40 border border-white/10 focus:border-spotify-green outline-none rounded-lg text-white text-sm transition-all appearance-none cursor-pointer"
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-spotify-gray uppercase tracking-widest mb-1.5 ml-1">Friendly Name</label>
                        <input value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="My Source" className="w-full px-3 py-2 bg-white/5 border border-white/10 focus:border-spotify-green outline-none rounded-lg text-white text-sm transition-all" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-spotify-gray uppercase tracking-widest mb-1.5 ml-1">Host IP / Hostname</label>
                        <input value={editing.host || ''} onChange={e => setEditing({ ...editing, host: e.target.value })} placeholder="192.168.1.100" className="w-full px-3 py-2 bg-white/5 border border-white/10 focus:border-spotify-green outline-none rounded-lg text-white text-sm transition-all" />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-spotify-gray uppercase tracking-widest mb-1.5 ml-1">Username</label>
                        <input value={editing.username || ''} onChange={e => setEditing({ ...editing, username: e.target.value })} placeholder="user" className="w-full px-3 py-2 bg-white/5 border border-white/10 focus:border-spotify-green outline-none rounded-lg text-white text-sm transition-all" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-spotify-gray uppercase tracking-widest mb-1.5 ml-1">Password</label>
                        <input type="password" value={editing.password || ''} onChange={e => setEditing({ ...editing, password: e.target.value })} placeholder="••••••••" className="w-full px-3 py-2 bg-white/5 border border-white/10 focus:border-spotify-green outline-none rounded-lg text-white text-sm transition-all" />
                      </div>
                    </div>
                  </div>
                  {editing.type === 'smb' && (
                    <div className="p-4 bg-white/5 border border-white/5 rounded-xl">
                      <label className="block text-[10px] font-bold text-spotify-gray uppercase tracking-widest mb-2">Domain (Optional)</label>
                      <input value={editing.domain || ''} onChange={e => setEditing({ ...editing, domain: e.target.value })} placeholder="." className="w-full px-3 py-2 bg-black/20 border border-white/10 outline-none rounded-lg text-white text-sm transition-all" />
                      <p className="text-[10px] text-spotify-gray mt-2 italic opacity-50">Most home setups use "." or "WORKGROUP". If using a Mac, the username is usually your Account Name (short name).</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                   <div className="p-4 bg-spotify-green/5 border border-spotify-green/20 rounded-xl mb-4">
                     <p className="text-xs text-white mb-1 font-medium">Logged in to <span className="text-spotify-green">{editing.host}</span></p>
                     <p className="text-[10px] text-spotify-gray uppercase tracking-wider font-bold opacity-60">Now select your shared music folder.</p>
                   </div>

                   <div className="space-y-5">
                      {editing.type === 'smb' && (
                        <div>
                          <label className="block text-[10px] font-bold text-spotify-green uppercase tracking-widest mb-2 flex justify-between">
                            <span>SMB Share Name</span>
                            {discoveredShares.length > 0 && <span className="text-[9px] text-spotify-green">Discovered {discoveredShares.length} shares</span>}
                          </label>
                          
                          {discoveredShares.length > 0 ? (
                            <select 
                              value={editing.share || ''} 
                              onChange={e => setEditing({ ...editing, share: e.target.value })}
                              className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-spotify-green outline-none rounded-lg text-white text-sm transition-all appearance-none cursor-pointer"
                            >
                              <option value="" disabled>Select a share...</option>
                              {discoveredShares.map(s => <option key={s} value={s}>{s}</option>)}
                              <option value="custom">── Enter manually ──</option>
                            </select>
                          ) : (
                            <input 
                              value={editing.share || ''} 
                              onChange={e => setEditing({ ...editing, share: e.target.value })} 
                              placeholder="e.g. Music, Public, Shared" 
                              className="w-full px-4 py-3 bg-white/5 border border-yellow-500/30 focus:border-spotify-green outline-none rounded-lg text-white text-sm transition-all" 
                            />
                          )}

                          {editing.share === 'custom' && (
                            <input 
                              autoFocus
                              placeholder="Enter custom share name..."
                              className="w-full mt-2 px-4 py-3 bg-black/40 border border-spotify-green/50 outline-none rounded-lg text-white text-sm"
                              onChange={e => setEditing({ ...editing, share: e.target.value })}
                            />
                          )}
                        </div>
                      )}
                      <div>
                        <label className="block text-[10px] font-bold text-spotify-gray uppercase tracking-widest mb-2">Music Root Path</label>
                        <input value={editing.basePath || '/'} onChange={e => setEditing({ ...editing, basePath: e.target.value })} placeholder="/home/user/Music" className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-spotify-green outline-none rounded-lg text-white text-sm transition-all" />
                      </div>
                   </div>

                   <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                      <input type="checkbox" id="source-enabled" checked={editing.enabled} onChange={e => setEditing({ ...editing, enabled: e.target.checked })} className="w-5 h-5 accent-spotify-green cursor-pointer" />
                      <label htmlFor="source-enabled" className="text-[10px] font-bold text-white uppercase tracking-widest cursor-pointer select-none">Auto-sync library from this source</label>
                   </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mt-8 pt-4 border-t border-white/5">
              <div className="flex gap-3">
                <button onClick={() => resetWizard(null)} disabled={saving} className="px-6 py-2 text-xs text-spotify-gray hover:text-white font-bold uppercase transition-colors disabled:opacity-50">Cancel</button>
                {wizardStep === 2 && (
                  <button onClick={() => setWizardStep(1)} className="px-4 py-2 text-xs text-white/60 hover:text-white font-bold uppercase transition-colors flex items-center gap-2">← Back</button>
                )}
              </div>
              
              <div className="flex gap-3">
                {wizardStep === 1 ? (
                  <button 
                    onClick={handleContinue}
                    disabled={isEnumerating}
                    className="px-8 py-2.5 bg-spotify-green text-black rounded-full font-bold uppercase text-xs hover:scale-105 transition-transform shadow-xl disabled:opacity-50"
                  >
                    {isEnumerating ? 'Connecting...' : 'Continue'}
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => testSource(editing.id || 'temp')} 
                      disabled={testing === (editing.id || 'temp')}
                      className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-full transition-all"
                    >
                      {testing === (editing.id || 'temp') ? 'Testing...' : 'Test Connection'}
                    </button>
                    <button 
                      onClick={saveSource} 
                      disabled={saving}
                      className="px-10 py-2.5 bg-spotify-green text-black rounded-full font-bold uppercase text-xs hover:scale-105 transition-transform shadow-xl disabled:opacity-50 disabled:scale-100"
                    >
                      {saving ? 'Saving...' : 'Save Source'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
