import { useState, useEffect } from 'react';
import { tracksApi } from '../api';
import { type Track } from '../store/player';
import TrackList from '../components/TrackList';
import { Library as LibraryIcon } from 'lucide-react';

export default function Library({ hasSources }: { hasSources: boolean | null }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [filtered, setFiltered] = useState<Track[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hasSources === null) return;
    if (hasSources) {
      loadTracks();
    } else {
      setLoading(false);
    }
  }, [hasSources]);

  useEffect(() => {
    if (search) {
      const query = search.toLowerCase();
      setFiltered(tracks.filter(t => 
        t.title.toLowerCase().includes(query) ||
        (t.artist?.name && t.artist.name.toLowerCase().includes(query)) ||
        (t.album?.name && t.album.name.toLowerCase().includes(query))
      ));
    } else {
      setFiltered(tracks);
    }
  }, [search, tracks]);

  const loadTracks = async () => {
    try {
      const res = await tracksApi.getAll();
      setTracks(res.data);
      setFiltered(res.data);
    } catch (err) {
      console.error('Failed to load tracks:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-spotify-gray">Loading library...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-none p-6 pb-0">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <LibraryIcon size={32} className="text-spotify-green" />
            <h1 className="text-3xl font-bold text-white">Library</h1>
          </div>
          <span className="text-spotify-gray">{tracks.length} tracks</span>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search tracks, artists, albums..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2 bg-spotify-light rounded-full text-white placeholder-spotify-gray focus:outline-none focus:ring-2 focus:ring-spotify-green"
          />
        </div>
      </div>

      {/* Track List */}
      <div className="flex-1 overflow-hidden px-6 pb-8">
        {filtered.length === 0 ? (
          <div className="text-center text-spotify-gray py-12">
            {search ? 'No tracks match your search.' : 'No tracks in library.'}
          </div>
        ) : (
          <TrackList tracks={filtered} />
        )}
      </div>
    </div>
  );
}