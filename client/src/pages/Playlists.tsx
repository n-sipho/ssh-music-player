import { useState, useEffect } from 'react';
import { playlistsApi } from '../api';
import { usePlayer, type Track } from '../store/player';

interface Playlist {
  id: string;
  name: string;
  trackCount: number;
}

interface PlaylistDetail extends Playlist {
  tracks: (Track & { position: number })[];
}

export default function Playlists({ hasSources }: { hasSources: boolean | null }) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selected, setSelected] = useState<PlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const { playTrack } = usePlayer();

  useEffect(() => { 
    if (hasSources === null) return;
    if (hasSources) {
      loadPlaylists(); 
    } else {
      setLoading(false);
    }
  }, [hasSources]);

  const loadPlaylists = async () => {
    try {
      const res = await playlistsApi.getAll();
      setPlaylists(res.data);
    } catch (err) {
      console.error('Failed to load playlists:', err);
    } finally {
      setLoading(false);
    }
  };

  const createPlaylist = async () => {
    if (!newName.trim()) return;
    try {
      await playlistsApi.create(newName.trim());
      setNewName('');
      setCreating(false);
      loadPlaylists();
    } catch (err) {
      console.error('Failed to create playlist:', err);
    }
  };

  const openPlaylist = async (pl: Playlist) => {
    try {
      const res = await playlistsApi.getOne(pl.id);
      setSelected(res.data);
    } catch (err) {
      console.error('Failed to load playlist:', err);
    }
  };

  const deletePlaylist = async (id: string) => {
    if (!confirm('Delete this playlist?')) return;
    try {
      await playlistsApi.delete(id);
      loadPlaylists();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-spotify-gray">Loading...</div>;
  }

  if (selected) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-none p-6 pb-0">
          <button onClick={() => setSelected(null)} className="text-spotify-gray hover:text-white mb-4">← Back</button>
          <h1 className="text-3xl font-bold mb-6">📝 {selected.name}</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {selected.tracks.length === 0 ? (
            <div className="text-center text-spotify-gray py-12">This playlist is empty. Add tracks from the library!</div>
          ) : (
            <div className="divide-y divide-spotify-light/10">
              {selected.tracks.map((track, i) => (
                <div key={track.id} onClick={() => playTrack(track, selected.tracks)} className="flex items-center gap-4 px-4 py-3 hover:bg-spotify-light/30 cursor-pointer group">
                  <span className="w-6 text-center text-spotify-gray">{i + 1}</span>
                  <div className="w-10 h-10 bg-spotify-light rounded flex items-center justify-center text-spotify-gray overflow-hidden">
                    {track.album?.imageUrl ? <img src={track.album.imageUrl} alt={track.album.name} className="w-full h-full object-cover" /> : '🎵'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white truncate">{track.title}</p>
                    <p className="text-xs text-spotify-gray truncate">{track.artist?.name || 'Unknown'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-none p-6 pb-0">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">📝 Playlists</h1>
          <button onClick={() => setCreating(true)} className="px-4 py-2 bg-spotify-green text-black rounded-full hover:scale-105 transition-transform">+ New</button>
        </div>
        {creating && (
          <div className="mb-6 flex gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Playlist name" className="px-4 py-2 bg-spotify-light rounded text-white placeholder-spotify-gray focus:outline-none focus:ring-2 focus:ring-spotify-green" />
            <button onClick={createPlaylist} className="px-4 py-2 bg-spotify-green text-black rounded">Create</button>
            <button onClick={() => { setCreating(false); setNewName(''); }} className="px-4 py-2 text-spotify-gray hover:text-white">Cancel</button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {playlists.length === 0 ? (
          <div className="text-center text-spotify-gray py-12">No playlists yet. Create one!</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {playlists.map(pl => (
              <div key={pl.id} onClick={() => openPlaylist(pl)} className="bg-spotify-light/30 rounded-lg p-4 hover:bg-spotify-light/50 cursor-pointer transition-colors group">
                <div className="w-full aspect-square bg-gradient-to-br from-purple-600 to-blue-600 rounded mb-3 flex items-center justify-center text-4xl">📝</div>
                <h3 className="font-medium truncate">{pl.name}</h3>
                <p className="text-sm text-spotify-gray">{pl.trackCount} tracks</p>
                <button onClick={e => { e.stopPropagation(); deletePlaylist(pl.id); }} className="mt-2 text-xs text-red-400 opacity-0 group-hover:opacity-100">Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}