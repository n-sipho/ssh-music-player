import { useState, useEffect, useMemo } from 'react';
import { tracksApi } from '../api';
import { type Track } from '../store/player';
import TrackList from '../components/TrackList';
import { Library as LibraryIcon, ListFilter } from 'lucide-react';

type SortOption = 'date' | 'title' | 'artist';

export default function Library({ hasSources }: { hasSources: boolean | null }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hasSources === null) return;
    if (hasSources) {
      loadTracks();
    } else {
      setLoading(false);
    }
  }, [hasSources]);

  const sortedAndFiltered = useMemo(() => {
    let result = [...tracks];

    // 1. Search
    if (search) {
      const query = search.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(query) ||
        (t.artist && t.artist.toLowerCase().includes(query)) ||
        (t.album && t.album.toLowerCase().includes(query))
      );
    }

    // 2. Sort
    result.sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'artist') {
        return (a.artist || '').localeCompare(b.artist || '');
      } else {
        // Date added (source machine mtime) - newest first
        const dateA = a.sourceMtime ? new Date(a.sourceMtime).getTime() : 0;
        const dateB = b.sourceMtime ? new Date(b.sourceMtime).getTime() : 0;
        return dateB - dateA;
      }
    });

    return result;
  }, [tracks, search, sortBy]);

  const loadTracks = async () => {
    try {
      const res = await tracksApi.getAll();
      setTracks(res.data);
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
          <div className="flex items-center gap-4">
            <span className="text-spotify-gray text-sm">{tracks.length} tracks</span>
          </div>
        </div>

        {/* Search & Sort */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <input
            type="text"
            placeholder="Search tracks, artists, albums..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 max-w-md px-4 py-2 bg-spotify-light rounded-full text-white placeholder-spotify-gray focus:outline-none focus:ring-2 focus:ring-spotify-green"
          />
          
          <div className="flex items-center gap-2 bg-spotify-light rounded-full px-4 py-2 self-start md:self-auto">
            <ListFilter size={16} className="text-spotify-gray" />
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent text-sm font-medium text-white outline-none cursor-pointer appearance-none pr-4"
            >
              <option value="date" className="bg-spotify-dark">Recently Added</option>
              <option value="title" className="bg-spotify-dark">Title (A-Z)</option>
              <option value="artist" className="bg-spotify-dark">Artist</option>
            </select>
          </div>
        </div>
      </div>

      {/* Track List */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {sortedAndFiltered.length === 0 ? (
          <div className="text-center text-spotify-gray py-12">
            {search ? 'No tracks match your search.' : 'No tracks in library.'}
          </div>
        ) : (
          <TrackList tracks={sortedAndFiltered} />
        )}
      </div>
    </div>
  );
}