import { usePlayer } from '../store/player';
import { Music, X } from 'lucide-react';

export default function Queue() {
  const { queue, currentIndex, currentTrack, isQueueOpen, toggleQueue, playTrack } = usePlayer();

  if (!isQueueOpen) return null;

  const upNext = queue.slice(currentIndex + 1);

  return (
    <div className="relative w-80 h-full bg-black/40 backdrop-blur-xl border-l border-white/10 z-40 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 flex-none">
      <div className="flex items-center justify-between p-6 flex-none">
        <h2 className="text-xl font-bold text-white">Queue</h2>
        <button 
          onClick={toggleQueue}
          className="text-spotify-gray hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
        {/* Now Playing */}
        <section className="mb-8">
          <h3 className="text-xs font-bold text-spotify-gray uppercase tracking-widest mb-4">Now Playing</h3>
          {currentTrack ? (
            <div className="flex items-center gap-4 group">
              <div className="w-12 h-12 bg-spotify-light rounded flex items-center justify-center text-spotify-gray overflow-hidden flex-none">
                {(currentTrack.imageUrl || currentTrack.album?.imageUrl) ? (
                  <img 
                    src={currentTrack.imageUrl || currentTrack.album?.imageUrl} 
                    alt={currentTrack.title} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <Music size={24} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-spotify-green truncate">{currentTrack.title}</p>
                <p className="text-xs text-spotify-gray truncate">{currentTrack.artist?.name || 'Unknown Artist'}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-spotify-gray italic">Nothing playing</p>
          )}
        </section>

        {/* Up Next */}
        <section>
          <h3 className="text-xs font-bold text-spotify-gray uppercase tracking-widest mb-4">Up Next</h3>
          {upNext.length === 0 ? (
            <p className="text-sm text-spotify-gray italic">Queue is empty</p>
          ) : (
            <div className="space-y-4">
              {upNext.map((track, i) => (
                <div 
                  key={`${track.id}-${i}`} 
                  className="flex items-center gap-4 cursor-pointer group"
                  onClick={() => playTrack(track, queue)}
                >
                  <div className="w-10 h-10 bg-spotify-light rounded flex items-center justify-center text-spotify-gray overflow-hidden flex-none">
                    {(track.imageUrl || track.album?.imageUrl) ? (
                      <img 
                        src={track.imageUrl || track.album?.imageUrl} 
                        alt={track.title} 
                        className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" 
                      />
                    ) : (
                      <Music size={20} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate group-hover:text-spotify-green transition-colors">{track.title}</p>
                    <p className="text-xs text-spotify-gray truncate">{track.artist?.name || 'Unknown Artist'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
