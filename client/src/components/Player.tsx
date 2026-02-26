import { useEffect, useRef } from 'react';
import { usePlayer } from '../store/player';
import { getStreamUrl } from '../api';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, ListMusic } from 'lucide-react';

export default function Player() {
  const {
    currentTrack,
    isPlaying,
    volume,
    currentTime,
    duration,
    queue,
    currentIndex,
    isQueueOpen,
    setAudioRef,
    playNext,
    playPrevious,
    toggle,
    toggleQueue,
    setVolume,
    seek,
    setCurrentTime,
    setDuration,
  } = usePlayer();

  const audioRef = useRef<HTMLAudioElement>(null);

  // Implement MediaSession API for physical media buttons
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        usePlayer.setState({ isPlaying: true });
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        usePlayer.setState({ isPlaying: false });
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        playPrevious();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        playNext();
      });
    }

    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
      }
    };
  }, [playNext, playPrevious]);

  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist?.name || 'Unknown Artist',
        album: currentTrack.album?.name || '',
        artwork: [
          {
            src: currentTrack.imageUrl || currentTrack.album?.imageUrl || '',
            sizes: '512x512',
            type: 'image/jpeg',
          },
        ],
      });
    }
  }, [currentTrack]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  // This is the key fix: Use an effect to react to song changes
  useEffect(() => {
    if (audioRef.current && currentTrack) {
      audioRef.current.load();
      // Only play if isPlaying is true, avoiding play() on initialization if paused
      if (isPlaying) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Audio playback error:", error);
            usePlayer.setState({ isPlaying: false });
          });
        }
      }
    }
  }, [currentTrack?.id]); 

  // This effect handles play/pause state changes
  useEffect(() => {
    if (audioRef.current && currentTrack) { // Only attempt if we have a track
      if (isPlaying) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => usePlayer.setState({ isPlaying: false }));
        }
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]); 

  useEffect(() => {
    if (audioRef.current) {
      setAudioRef(audioRef.current);
      // Initialize volume immediately if audio element exists
      audioRef.current.volume = volume;
    }
  }, [setAudioRef]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    seek(time);
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    setDuration(e.currentTarget.duration);
    // Restore saved position on initial load
    if (currentTime > 0 && e.currentTarget.currentTime === 0) {
      e.currentTarget.currentTime = currentTime;
    }
  };

  const nextTrack = queue[currentIndex + 1];
  const albumArtUrl = currentTrack?.imageUrl || currentTrack?.album?.imageUrl;

  return (
    <>
      <div className="h-20 bg-gradient-to-b from-spotify-light/95 to-black/95 border-t border-white/10 flex items-center px-4 gap-4 backdrop-blur-md z-10 w-full flex-none">
        <audio
          ref={audioRef}
          src={currentTrack ? getStreamUrl(currentTrack.id) : undefined}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => {
            if (currentIndex < queue.length - 1) {
              playNext();
            } else {
              usePlayer.setState({ isPlaying: false });
            }
          }}
          onPlay={() => usePlayer.setState({ isPlaying: true })}
          onPause={(e) => {
            // Only set isPlaying to false if the song didn't just end
            // This prevents a race condition where onPause fires before onEnded
            if (e.currentTarget.currentTime < e.currentTarget.duration - 0.5) {
              usePlayer.setState({ isPlaying: false });
            }
          }}
          onCanPlay={(e) => { e.currentTarget.volume = volume; }}
          autoPlay={isPlaying}
        />

        <div className="flex items-center gap-3 w-72">
          <div className="w-12 h-12 bg-spotify-light rounded flex items-center justify-center text-spotify-gray overflow-hidden">
            {albumArtUrl ? <img src={albumArtUrl} alt="Album Art" className="w-full h-full object-cover" /> : <Music size={24} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{currentTrack?.title || 'No track selected'}</p>
            <p className="text-xs text-spotify-gray truncate">
              {currentTrack?.artist?.name || 'Unknown Artist'}
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center gap-1">
          <div className="flex items-center gap-4">
            <button
              onClick={playPrevious}
              className="text-spotify-gray hover:text-white transition-colors disabled:opacity-30"
              disabled={currentIndex <= 0}
            >
              <SkipBack size={20} />
            </button>
            <button
              onClick={toggle}
              className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform disabled:opacity-50"
              disabled={!currentTrack}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              onClick={playNext}
              className="text-spotify-gray hover:text-white transition-colors disabled:opacity-30"
              disabled={currentIndex >= queue.length - 1 || queue.length === 0}
            >
              <SkipForward size={20} />
            </button>
          </div>

          <div className="flex items-center gap-2 w-full max-w-md">
            <span className="text-xs text-spotify-gray w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1 bg-spotify-light rounded-full appearance-none cursor-pointer accent-spotify-green"
              disabled={!currentTrack}
            />
            <span className="text-xs text-spotify-gray w-10">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 w-72 justify-end">
          {nextTrack && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-spotify-gray">Next:</span>
              <span className="text-white truncate max-w-[120px]">{nextTrack.title}</span>
            </div>
          )}

          <button 
            onClick={toggleQueue}
            className={`transition-colors ${isQueueOpen ? 'text-spotify-green' : 'text-spotify-gray hover:text-white'}`}
            title="Queue"
          >
            <ListMusic size={20} />
          </button>

          <div className="flex items-center gap-2">
            <Volume2 size={16} className="text-spotify-gray" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-20 h-1 bg-spotify-light rounded-full appearance-none cursor-pointer accent-spotify-green"
            />
          </div>
        </div>
      </div>
    </>
  );
}
