import { Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { sourcesApi } from './api';
import Sidebar from './components/Sidebar';
import Player from './components/Player';
import Queue from './components/Queue';
import Home from './pages/Home';
import Library from './pages/Library';
import Folders from './pages/Folders';
import Artists from './pages/Artists';
import Playlists from './pages/Playlists';
import Settings from './pages/Settings';

function App() {
  useEffect(() => {
    // Trigger a scan when the app is opened, only if there are sources
    const initialScan = async () => {
      try {
        const res = await sourcesApi.getAll();
        const hasEnabledSources = res.data.some(s => s.enabled);
        if (hasEnabledSources) {
          await sourcesApi.scanAll();
        }
      } catch (err) {
        console.error('Initial scan check failed:', err);
      }
    };
    initialScan();
  }, []);

  return (
    <div className="flex h-screen bg-spotify-dark">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/library" element={<Library />} />
              <Route path="/folders" element={<Folders />} />
              <Route path="/artists" element={<Artists />} />
              <Route path="/playlists" element={<Playlists />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
          <Queue />
        </div>
        
        {/* Bottom Player */}
        <Player />
      </main>
    </div>
  );
}

export default App;
