import axios from 'axios';
import type { Track, Source } from '../store/player';

const api = axios.create({
  baseURL: '/api',
});

export const tracksApi = {
  getAll: () => api.get<Track[]>('/tracks'),
  getOne: (id: string) => api.get<Track>(`/tracks/${id}`),
  search: (query: string) => api.get<Track[]>(`/tracks/search?q=${encodeURIComponent(query)}`),
};

export const albumsApi = {
  getAll: () => api.get<any[]>('/albums'),
  getOne: (id: string) => api.get<any>(`/albums/${id}`),
};

export const artistsApi = {
  getAll: () => api.get<any[]>('/artists'),
  getOne: (id: string) => api.get<any>(`/artists/${id}`),
};

export const foldersApi = {
  getAll: () => api.get<any[]>('/folders'),
  getTracks: (path: string) => api.get<any[]>(`/folders/tracks?path=${encodeURIComponent(path)}`),
};

export const sourcesApi = {
  getAll: () => api.get<Source[]>('/sources'),
  create: (data: Partial<Source>) => api.post<Source>('/sources', data),
  update: (id: string, data: Partial<Source>) => api.patch<Source>(`/sources/${id}`, data),
  delete: (id: string) => api.delete(`/sources/${id}`),
  scan: (id: string) => api.post(`/sources/${id}/scan`),
  scanAll: () => api.post('/scan'),
  discover: () => api.get<any[]>('/discover'),
  getStatus: (id: string) => api.get<any>(`/sources/${id}/status`),
  test: (source: string | Partial<Source>) => {
    if (typeof source === 'string') {
      return api.post<{ success: boolean; message?: string }>(`/sources/${source}/test`);
    }
    return api.post<{ success: boolean; message?: string }>('/sources/test', source);
  },
  enumerateShares: (data: { host: string; username?: string; password?: string; domain?: string }) => 
    api.post<string[]>('/smb/enumerate-shares', data),
};

export const playlistsApi = {
  getAll: () => api.get<any[]>('/playlists'),
  create: (name: string) => api.post<any>('/playlists', { name }),
  getOne: (id: string) => api.get<any>(`/playlists/${id}`),
  delete: (id: string) => api.delete(`/playlists/${id}`),
  addTrack: (playlistId: string, trackId: string) => 
    api.post(`/playlists/${playlistId}/tracks`, { trackId }),
  removeTrack: (playlistId: string, trackId: string) => 
    api.delete(`/playlists/${playlistId}/tracks/${trackId}`),
};

export function getStreamUrl(trackId: string) {
  return `/api/stream/${trackId}`;
}

export default api;