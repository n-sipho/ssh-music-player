import { useState, useEffect } from 'react';
import { artistsApi } from '../api';
import { usePlayer, type Track } from '../store/player';
import { Mic2 } from 'lucide-react';

interface Artist {
  id: string;
  name: string;
  albumCount: number;
  trackCount: number;
}

interface ArtistDetail extends Artist {
  albums: { id: string; name: string; year?: number; trackCount: number; imageUrl?: string }[];
  topTracks: Track[];
}

export default function Artists() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<ArtistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { playTrack } = usePlayer();

  useEffect(() => {
    loadArtists();
  }, []);

  const loadArtists = async () => {
    try {
      const res = await artistsApi.getAll();
      setArtists(res.data);
    } catch (err) {
      console.error('Failed to load artists:', err);
    } finally {
      setLoading(false);
    }
  };

  const openArtist = async (artist: Artist) => {
    try {
      const res = await artistsApi.getOne(artist.id);
      setSelectedArtist(res.data);
    } catch (err) {
      console.error('Failed to load artist:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-spotify-gray">Loading artists...</div>
      </div>
    );
  }

  if (selectedArtist) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-none p-6 pb-0">
          <button
            onClick={() => setSelectedArtist(null)}
            className="text-spotify-gray hover:text-white mb-4"
          >
            ← Back to artists
          </button>
          <div className="flex gap-6 mb-6">
            <div className="w-48 h-48 bg-gradient-to-br from-spotify-green to-spotify-dark rounded-full flex items-center justify-center text-6xl">
              🎤
            </div>
            <div className="flex flex-col justify-end">
              <h1 className="text-4xl font-bold">{selectedArtist.name}</h1>
              <p className="text-spotify-gray mt-2">
                {selectedArtist.albumCount} albums • {selectedArtist.trackCount} tracks
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {/* Albums */}
          <h2 className="text-xl font-semibold mb-4">Albums</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {selectedArtist.albums.map((album) => (
              <div key={album.id} className="bg-spotify-light/30 rounded-lg p-4 hover:bg-spotify-light/50 cursor-pointer transition-colors">
                <div className="w-full aspect-square bg-spotify-light rounded mb-3 flex items-center justify-center text-3xl overflow-hidden">
                  {album.imageUrl ? (
                    <img src={album.imageUrl} alt={album.name} className="w-full h-full object-cover" />
                  ) : (
                    '💿'
                  )}
                </div>
                <h3 className="font-medium truncate">{album.name}</h3>
                <p className="text-sm text-spotify-gray">{album.year || ''}</p>
              </div>
            ))}
          </div>

          {/* Top Tracks */}
          <h2 className="text-xl font-semibold mb-4">Top Tracks</h2>
          <div className="divide-y divide-spotify-light/10">
            {selectedArtist.topTracks.map((track, i) => (
              <div
                key={track.id}
                onClick={() => playTrack(track, selectedArtist.topTracks)}
                className="flex items-center gap-4 px-4 py-3 hover:bg-spotify-light/30 cursor-pointer group"
              >
                <span className="w-6 text-center text-spotify-gray group-hover:hidden">{i + 1}</span>
                <span className="w-6 text-center text-spotify-green hidden group-hover:block">▶</span>
                <span className="flex-1 text-white">{track.title}</span>
                <span className="text-spotify-gray text-sm">{track.album?.name || ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-none p-6 pb-0">
        <div className="flex items-center gap-3 mb-6">
          <Mic2 size={32} className="text-spotify-green" />
          <h1 className="text-3xl font-bold text-white">Artists</h1>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {artists.length === 0 ? (
          <div className="text-center text-spotify-gray py-12">No artists found.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {artists.map((artist) => (
              <div
                key={artist.id}
                onClick={() => openArtist(artist)}
                className="bg-spotify-light/30 rounded-lg p-4 hover:bg-spotify-light/50 cursor-pointer transition-colors text-center"
              >
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-spotify-green to-spotify-dark rounded-full flex items-center justify-center text-3xl mb-3">
                  🎤
                </div>
                <h3 className="font-medium truncate">{artist.name}</h3>
                <p className="text-xs text-spotify-gray">{artist.trackCount} tracks</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}