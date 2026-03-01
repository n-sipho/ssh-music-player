import { usePlayer, type Track } from '../store/player';
import { Music, Play } from 'lucide-react';

interface TrackListProps {
  tracks: Track[];
  showAlbum?: boolean;
}

export default function TrackList({ tracks }: TrackListProps) {
  const { playTrack, currentTrack, addToQueue } = usePlayer();

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlay = (track: Track) => {
    playTrack(track, tracks);
  };

  const handleDoubleClick = (track: Track) => {
    addToQueue(track);
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[16px_4fr_3fr_2fr_1fr] gap-4 px-4 py-2 text-xs text-spotify-gray border-b border-spotify-light/30 flex-none">
        <span>#</span>
        <span>Title</span>
        <span>Album</span>
        {/* <span>Artist</span> */}
        <span className="text-right">Duration</span>
      </div>

      {/* Tracks */}
      <div className="flex-1 overflow-y-auto divide-y divide-spotify-light/10">
        {tracks.map((track, index) => (
          <div
            key={track.id}
            onClick={() => handlePlay(track)}
            onDoubleClick={() => handleDoubleClick(track)}
            className={`grid grid-cols-[16px_4fr_3fr_2fr_1fr] gap-4 px-4 py-3 hover:bg-spotify-light/30 cursor-pointer transition-colors group ${
              currentTrack?.id === track.id ? 'bg-spotify-light/50' : ''
            }`}
          >
            <span className="text-sm text-spotify-gray group-hover:hidden">
              {index + 1}
            </span>
            <span className="text-sm text-spotify-green hidden group-hover:block">
              <Play size={16} />
            </span>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-spotify-light rounded flex items-center justify-center text-lg text-spotify-gray overflow-hidden">
                {(track.imageUrl || track.album?.imageUrl) ? (
                  <img 
                    src={track.imageUrl || track.album?.imageUrl} 
                    alt={track.album?.name || track.title} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <Music size={20} />
                )}
              </div>
              <div>
                <p className={`text-sm ${currentTrack?.id === track.id ? 'text-spotify-green' : 'text-white'}`}>
                  {track.title}
                </p>
               <p className="text-xs text-spotify-gray">{track.artistsDisplay || track.artist || track.artistObj?.name || 'Unknown'}</p>
              </div>
            </div>
            <span className="text-sm text-spotify-gray self-center">
              {track.album || track.albumObj?.name || '--'}
            </span>
            {/* <span className="text-sm text-spotify-gray self-center">
              {track.artistsDisplay || track.artist || track.artistObj?.name || 'Unknown'}
            </span> */}
            <span className="text-sm text-spotify-gray self-center text-right">
              {formatDuration(track.duration)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}