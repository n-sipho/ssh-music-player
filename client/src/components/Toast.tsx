import { usePlayer } from '../store/player';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Toast() {
  const { notification, hideNotification } = usePlayer();
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (notification.visible) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 300); // Wait for fade out
      return () => clearTimeout(timer);
    }
  }, [notification.visible]);

  if (!shouldRender) return null;

  const icons = {
    success: <CheckCircle className="text-green-400" size={20} />,
    error: <AlertCircle className="text-red-400" size={20} />,
    info: <Info className="text-blue-400" size={20} />,
  };

  const bgColors = {
    success: 'border-green-500/20 bg-green-500/10',
    error: 'border-red-500/20 bg-red-500/10',
    info: 'border-blue-500/20 bg-blue-500/10',
  };

  return (
    <div 
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 transform ${
        notification.visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl min-w-[300px] max-w-[90vw] ${bgColors[notification.type]}`}>
        <div className="shrink-0">
          {icons[notification.type]}
        </div>
        <div className="flex-1 text-sm font-medium text-white pr-2">
          {notification.message}
        </div>
        <button 
          onClick={hideNotification}
          className="shrink-0 p-1 hover:bg-white/10 rounded-full transition-colors"
        >
          <X size={16} className="text-spotify-gray hover:text-white" />
        </button>
      </div>
    </div>
  );
}
