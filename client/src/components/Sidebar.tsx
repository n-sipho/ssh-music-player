import { NavLink } from 'react-router-dom';
import { Home, Library, Mic2, ListMusic, Settings, Music2, Folder } from 'lucide-react';

const navItems = [
  { to: '/', icon: <Home size={20} />, label: 'Home' },
  { to: '/library', icon: <Library size={20} />, label: 'Library' },
  { to: '/folders', icon: <Folder size={20} />, label: 'Folders' },
  { to: '/artists', icon: <Mic2 size={20} />, label: 'Artists' },
  { to: '/playlists', icon: <ListMusic size={20} />, label: 'Playlists' },
];

const settingsNav = { to: '/settings', icon: <Settings size={20} />, label: 'Settings' };

export default function Sidebar() {
  return (
    <aside className="w-64 bg-black p-4 flex flex-col">
      <div className="flex items-center gap-2 px-2 mb-6">
        <Music2 size={32} className="text-spotify-green" />
        <h1 className="text-xl font-bold text-white">HomeMusic</h1>
      </div>

      <nav className="flex-1 flex flex-col justify-between">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                    isActive
                      ? 'bg-spotify-light text-white'
                      : 'text-spotify-gray hover:text-white'
                  }`
                }
              >
                {item.icon}
                <span className="font-semibold">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        <ul>
           <li>
              <NavLink
                to={settingsNav.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                    isActive
                      ? 'bg-spotify-light text-white'
                      : 'text-spotify-gray hover:text-white'
                  }`
                }
              >
                {settingsNav.icon}
                <span className="font-semibold">{settingsNav.label}</span>
              </NavLink>
            </li>
        </ul>
      </nav>
    </aside>
  );
}