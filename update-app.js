import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const importStatement = "import { Activity, CloudUpload, Menu, Rocket, Settings, TrendingUp, X, Bell } from 'lucide-react';";
content = content.replace("import { Activity, CloudUpload, Menu, Rocket, Settings, TrendingUp, X } from 'lucide-react';", importStatement);

const stateStatements = `
  const [activeTab, setActiveTab] = useState('dashboard');
  const [state, setState] = useState<AppState | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lastVideoCount, setLastVideoCount] = useState(0);
  const [notification, setNotification] = useState<{message: string, id: number} | null>(null);
`;
content = content.replace(`
  const [activeTab, setActiveTab] = useState('dashboard');
  const [state, setState] = useState<AppState | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);`, stateStatements);


const effectStatement = `
  useEffect(() => {
    fetchState().then(s => {
      setState(s);
      setLastVideoCount(s.videos.length);
    });
    
    const interval = setInterval(() => {
      fetchState().then(s => {
        setState(prev => {
          if (prev && s.videos.length > prev.videos.length) {
            const newVideo = s.videos[s.videos.length - 1];
            setNotification({ message: \`New video '\${newVideo.title}' is in queue now\`, id: Date.now() });
            setTimeout(() => setNotification(null), 5000);
          }
          return s;
        });
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);
`;
content = content.replace(`
  useEffect(() => {
    fetchState().then(setState);
    
    const interval = setInterval(() => {
      fetchState().then(setState);
    }, 5000);

    return () => clearInterval(interval);
  }, []);`, effectStatement);

// Adding notification UI before return
const notificationUI = `
        {/* Notification Capsule */}
        {notification && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-10 fade-in duration-300">
            <div className="bg-slate-900 border border-neon-blue/50 text-white px-6 py-3 rounded-full shadow-[0_0_15px_rgba(0,240,255,0.3)] flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-neon-blue/20 flex items-center justify-center relative">
                <Bell className="w-4 h-4 text-neon-blue" />
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-neon-green rounded-full border-2 border-slate-900"></span>
              </div>
              <span className="text-sm font-medium">{notification.message}</span>
            </div>
          </div>
        )}

        <header`;

content = content.replace('        <header', notificationUI);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Updated App.tsx with Notifications');
