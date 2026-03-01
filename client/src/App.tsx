import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { sourcesApi } from './api';
import Sidebar from './components/Sidebar';
import Player from './components/Player';
import Queue from './components/Queue';
import Toast from './components/Toast';
import Home from './pages/Home';
import Library from './pages/Library';
import Folders from './pages/Folders';
import Artists from './pages/Artists';
import Playlists from './pages/Playlists';
import Settings from './pages/Settings';

function App() {
  const [hasSources, setHasSources] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const init = async () => {
      try {
        const res = await sourcesApi.getAll();
        const exists = res.data && res.data.length > 0;
        setHasSources(exists);

        if (!exists && location.pathname === '/') {
          navigate('/settings');
        }
      } catch (err) {
        setHasSources(false);
      }
    };
    init();
  }, []);

  // Poll only if NO sources exist, to detect when one is added
  useEffect(() => {
    if (hasSources !== false) return;

    const interval = setInterval(async () => {
      try {
        const res = await sourcesApi.getAll();
        if (res.data && res.data.length > 0) {
          setHasSources(true);
          clearInterval(interval);
        }
      } catch (e) {}
    }, 10000);

    return () => clearInterval(interval);
  }, [hasSources]);

  return (
    <div className="flex h-screen bg-spotify-dark">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Notifications */}
      <Toast />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/" element={<Home hasSources={hasSources} />} />
              <Route path="/library" element={<Library hasSources={hasSources} />} />
              <Route path="/folders" element={<Folders hasSources={hasSources} />} />
              <Route path="/artists" element={<Artists hasSources={hasSources} />} />
              <Route path="/playlists" element={<Playlists hasSources={hasSources} />} />
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
