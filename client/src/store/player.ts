import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Artist {
  id: string;
  name: string;
}

export interface Album {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface Track {
  id: string;
  title: string;
  artist?: Artist;
  album?: Album;
  trackNumber?: number;
  duration?: number;
  format?: string;
  size?: number;
  sourceId: string;
  imageUrl?: string;
}

export interface Source {
  id: string;
  name: string;
  type: 'ssh' | 'smb';
  host: string;
  port?: number;
  username?: string;
  password?: string;
  share?: string;
  basePath: string;
  enabled: boolean;
}

interface PlayerState {
  // Queue
  queue: Track[];
  currentIndex: number;
  
  // Current track
  currentTrack: Track | null;
  
  // Playback state
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  isQueueOpen: boolean;
  
  // Audio element ref
  audioRef: HTMLAudioElement | null;
  
  // Actions
  setAudioRef: (ref: HTMLAudioElement | null) => void;
  setQueue: (tracks: Track[], startIndex?: number) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  playNext: () => void;
  playPrevious: () => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  toggleQueue: () => void;
  setVolume: (volume: number) => void;
  seek: (time: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  playTrack: (track: Track, queue?: Track[]) => void;
  clearTracksBySource: (sourceId: string) => void;

  // Notification
  notification: { message: string; type: 'success' | 'error' | 'info'; visible: boolean };
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideNotification: () => void;
}

export const usePlayer = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      currentIndex: -1,
      currentTrack: null,
      isPlaying: false,
      volume: 1,
      currentTime: 0,
      duration: 0,
      isQueueOpen: false,
      audioRef: null,

      setAudioRef: (ref) => set({ audioRef: ref }),

      setQueue: (tracks, startIndex = 0) => {
        set({
          queue: tracks,
          currentIndex: startIndex,
          currentTrack: tracks[startIndex] || null,
          currentTime: 0,
        });
        if (tracks[startIndex]) {
          get().play();
        }
      },

      addToQueue: (track) => set((state) => ({
        queue: [...state.queue, track],
      })),

      removeFromQueue: (index) => set((state) => {
        const newQueue = state.queue.filter((_, i) => i !== index);
        let newIndex = state.currentIndex;
        if (index < state.currentIndex) {
          newIndex--;
        } else if (index === state.currentIndex) {
          newIndex = Math.min(state.currentIndex, newQueue.length - 1);
        }
        return {
          queue: newQueue,
          currentIndex: newIndex,
          currentTrack: newQueue[newIndex] || null,
        };
      }),

      clearQueue: () => set({
        queue: [],
        currentIndex: -1,
        currentTrack: null,
        currentTime: 0,
      }),

      playNext: () => {
        const { queue, currentIndex } = get();
        if (currentIndex < queue.length - 1) {
          const nextIndex = currentIndex + 1;
          set({ 
            currentIndex: nextIndex, 
            currentTrack: queue[nextIndex], 
            currentTime: 0,
            isPlaying: true 
          });
        }
      },

      playPrevious: () => {
        const { currentIndex, queue } = get();
        if (currentIndex > 0) {
          const prevIndex = currentIndex - 1;
          set({ 
            currentIndex: prevIndex, 
            currentTrack: queue[prevIndex], 
            currentTime: 0,
            isPlaying: true 
          });
        }
      },

      play: () => {
        const { audioRef } = get();
        audioRef?.play();
        set({ isPlaying: true });
      },

      pause: () => {
        const { audioRef } = get();
        audioRef?.pause();
        set({ isPlaying: false });
      },

      toggle: () => {
        const { isPlaying, play, pause } = get();
        if (isPlaying) pause();
        else play();
      },

      toggleQueue: () => set((state) => ({ isQueueOpen: !state.isQueueOpen })),

      setVolume: (volume) => {
        const { audioRef } = get();
        if (audioRef) audioRef.volume = volume;
        set({ volume });
      },

      seek: (time) => {
        const { audioRef } = get();
        if (audioRef) audioRef.currentTime = time;
      },

      setCurrentTime: (time) => set({ currentTime: time }),
      setDuration: (duration) => set({ duration }),

      playTrack: (track, queue) => {
        const trackQueue = queue || [track];
        const index = trackQueue.findIndex(t => t.id === track.id);

        if (get().currentTrack?.id === track.id) {
          if (!get().isPlaying) {
            get().play();
          }
          return;
        }

        set({
          queue: trackQueue,
          currentIndex: index >= 0 ? index : 0,
          currentTrack: track,
          isPlaying: true,
          currentTime: 0,
          duration: 0,
        });
      },

      clearTracksBySource: (sourceId: string) => {
        const { queue, currentTrack, audioRef } = get();
        
        // Check if current track belongs to this source
        if (currentTrack?.sourceId === sourceId) {
          audioRef?.pause();
          set({ 
            currentTrack: null, 
            isPlaying: false, 
            currentTime: 0, 
            currentIndex: -1 
          });
        }

        // Remove any tracks from this source from the queue
        const newQueue = queue.filter(t => t.sourceId !== sourceId);
        if (newQueue.length !== queue.length) {
          set({ queue: newQueue });
          
          // Fix currentIndex if it changed
          if (get().currentTrack) {
            const newIndex = newQueue.findIndex(t => t.id === get().currentTrack?.id);
            set({ currentIndex: newIndex });
          }
        }
      },

      notification: { message: '', type: 'info', visible: false },
      showNotification: (message, type = 'info') => {
        set({ notification: { message, type, visible: true } });
        
        // Only auto-hide for success and info messages
        if (type !== 'error') {
          setTimeout(() => get().hideNotification(), 5000);
        }
      },
      hideNotification: () => set((state) => ({ 
        notification: { ...state.notification, visible: false } 
      })),
    }),
    {
      name: 'homemusic-player-v1',
      partialize: (state) => ({
        queue: state.queue,
        currentIndex: state.currentIndex,
        currentTrack: state.currentTrack,
        volume: state.volume,
        currentTime: state.currentTime,
        isQueueOpen: state.isQueueOpen,
      }),
    }
  )
);