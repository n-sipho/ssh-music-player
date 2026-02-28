import { useState, useEffect } from 'react';
import { foldersApi } from '../api';
import { type Track } from '../store/player';
import TrackList from '../components/TrackList';
import { Folder as FolderIcon } from 'lucide-react';

interface Folder {
  id: string;
  name: string;
  trackCount: number;
  imageUrl?: string;
}

interface FolderDetail extends Folder {
  tracks: Track[];
}

export default function Folders({ hasSources }: { hasSources: boolean | null }) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<FolderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hasSources === null) return;
    if (hasSources) {
      loadFolders();
    } else {
      setLoading(false);
    }
  }, [hasSources]);

  const loadFolders = async () => {
    try {
      const res = await foldersApi.getAll();
      setFolders(res.data);
    } catch (err) {
      console.error('Failed to load folders:', err);
    } finally {
      setLoading(false);
    }
  };

  const openFolder = async (folder: Folder) => {
    try {
      const res = await foldersApi.getTracks(folder.id);
      setSelectedFolder({ ...folder, tracks: res.data });
    } catch (err) {
      console.error('Failed to load folder:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-spotify-gray">Loading folders...</div>
      </div>
    );
  }

  if (selectedFolder) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-none p-6 pb-0">
          <button
            onClick={() => setSelectedFolder(null)}
            className="text-spotify-gray hover:text-white mb-4"
          >
            ← Back to folders
          </button>
          <div className="flex gap-6 mb-6">
            <div className="w-48 h-48 bg-spotify-light rounded-lg flex items-center justify-center text-6xl overflow-hidden">
              {selectedFolder.imageUrl ? (
                <img src={selectedFolder.imageUrl} alt={selectedFolder.name} className="w-full h-full object-cover" />
              ) : (
                <FolderIcon size={48} className="text-spotify-gray opacity-20" />
              )}
            </div>
            <div className="flex flex-col justify-end">
              <h1 className="text-4xl font-bold">{selectedFolder.name}</h1>
              <p className="text-spotify-gray mt-2">
                {selectedFolder.trackCount} tracks
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden px-6 pb-8">
          {selectedFolder.tracks.length > 0 ? (
            <TrackList tracks={selectedFolder.tracks} />
          ) : (
            <div className="text-center text-spotify-gray py-8">
              <p>Tracks in this folder are not yet loaded.</p>
              <p className="text-sm mt-2">Please run a full scan to populate all folder contents.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-none p-6 pb-0">
        <div className="flex items-center gap-3 mb-6">
          <FolderIcon size={32} className="text-spotify-green" />
          <h1 className="text-3xl font-bold text-white">Folders</h1>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {folders.length === 0 ? (
          <div className="text-center text-spotify-gray py-12">No folders found.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {folders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => openFolder(folder)}
                className="bg-spotify-light/30 rounded-lg p-4 hover:bg-spotify-light/50 cursor-pointer transition-colors"
              >
                <div className="w-full aspect-square bg-spotify-light rounded mb-3 flex items-center justify-center text-4xl overflow-hidden">
                  {folder.imageUrl ? (
                    <img src={folder.imageUrl} alt={folder.name} className="w-full h-full object-cover" />
                  ) : (
                    <FolderIcon size={48} className="text-spotify-gray opacity-20" />
                  )}
                </div>
                <h3 className="font-medium truncate">{folder.name}</h3>
                <p className="text-sm text-spotify-gray">{folder.trackCount} tracks</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
