import { useState, useEffect } from 'react';
import { tracksApi, sourcesApi } from '../api';
import { type Track, type Source } from '../store/player';
import TrackList from '../components/TrackList';
import { Home as HomeIcon, Radio, Music, Lock, Folder } from 'lucide-react';

export default function Home() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tracksRes, sourcesRes] = await Promise.all([
        tracksApi.getAll(),
        sourcesApi.getAll(),
      ]);
      setTracks(tracksRes.data);
      setSources(sourcesRes.data);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async (sourceId: string) => {
    setScanning(sourceId);
    try {
      await sourcesApi.scan(sourceId);
      // Reload tracks after a delay (scan runs in background)
      setTimeout(loadData, 3000);
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setScanning(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-spotify-gray">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-none p-6 pb-0">
        <div className="flex items-center gap-3 mb-6">
          <HomeIcon size={32} className="text-spotify-green" />
          <h1 className="text-3xl font-bold text-white">Welcome to HomeMusic</h1>
        </div>

        {/* Sources Section */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Radio size={24} className="text-spotify-gray" />
            <h2 className="text-xl font-semibold text-white">Connected Sources</h2>
          </div>
          {sources.length === 0 ? (
            <div className="bg-spotify-light/30 rounded-lg p-6 text-center">
              <p className="text-spotify-gray mb-4">No sources configured yet.</p>
              <a href="/settings" className="text-spotify-green hover:underline">
                Add a source →
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sources.map((source) => (
                <div key={source.id} className="bg-spotify-light/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-spotify-gray">
                      {source.type === 'ssh' ? <Lock size={20} /> : <Folder size={20} />}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      source.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {source.enabled ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <h3 className="font-medium text-white">{source.name}</h3>
                  <p className="text-sm text-spotify-gray">{source.host}</p>
                  <button
                    onClick={() => handleScan(source.id)}
                    disabled={scanning === source.id}
                    className="mt-2 text-sm text-spotify-green hover:underline disabled:opacity-50"
                  >
                    {scanning === source.id ? 'Scanning...' : 'Scan for music'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex items-center gap-2 mb-4">
          <Music size={24} className="text-spotify-gray" />
          <h2 className="text-xl font-semibold text-white">Recently Added</h2>
        </div>
      </div>

      {/* Recent Tracks */}
      <div className="flex-1 overflow-hidden px-6 pb-8">
        {tracks.length === 0 ? (
          <div className="bg-spotify-light/30 rounded-lg p-6 text-center">
            <p className="text-spotify-gray">No tracks found. Scan a source to add music!</p>
          </div>
        ) : (
          <TrackList tracks={tracks.slice(0, 20)} />
        )}
      </div>
    </div>
  );
}