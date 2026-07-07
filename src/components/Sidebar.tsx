import { LayoutDashboard, Activity, CloudUpload, Settings, Youtube, Plus, Rocket, LogOut } from 'lucide-react';
import { getAuthUrl, exchangeAuthCode, logout } from '../api';
import { AppState } from '../db/db';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  users: AppState['users'];
}

export default function Sidebar({ activeTab, setActiveTab, users }: SidebarProps) {
  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out of the system?')) {
      await logout();
      window.location.reload();
    }
  };

  const handleConnectYouTube = async () => {
    try {
      const { url } = await getAuthUrl();
      // Since it's an iframe, we typically open it in a popup or new tab, but for demo we can redirect top
      window.open(url, '_blank', 'width=500,height=600');
    } catch (e) {
      console.error(e);
    }
  };

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'rules', icon: Activity, label: 'Rules Engine' },
    { id: 'queue', icon: CloudUpload, label: 'Data Queue' },
    { id: 'pipeline', icon: Rocket, label: 'Pipeline Analytics' },
    { id: 'settings', icon: Settings, label: 'Settings & Logs' },
  ];

  return (
    <div className="w-64 glass-panel border-y-0 border-l-0 flex flex-col z-20">
      <div className="h-16 flex items-center px-6 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-black border border-neon-blue flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.4)] relative overflow-hidden group">
             <div className="absolute inset-0 bg-neon-blue/20 group-hover:bg-neon-blue/40 transition-colors" />
            <Youtube className="w-5 h-5 text-neon-blue relative z-10" />
          </div>
          <span className="font-bold text-lg tracking-[0.2em] uppercase neon-text-blue">
            NEXUS
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-2">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 border ${
              activeTab === item.id 
                ? 'bg-neon-blue/10 text-neon-blue border-neon-blue/50 shadow-[0_0_15px_rgba(0,240,255,0.2)]' 
                : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5 hover:border-white/10'
            }`}
          >
            <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-neon-blue animate-pulse' : ''}`} />
            <span className="font-medium text-sm tracking-wider uppercase">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="p-4 border-t border-white/5 bg-black/20">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2">Connected Accounts</h3>
        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
          {users.map(user => (
            <div key={user.id} className="flex items-center gap-3 px-2 py-2 rounded bg-white/5">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-6 h-6 rounded-full" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs">
                  {user.name.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{user.name}</div>
              </div>
            </div>
          ))}
          <button 
            onClick={handleConnectYouTube}
            className="flex items-center justify-center gap-2 px-2 py-2 mt-2 rounded border border-dashed border-slate-600 text-slate-400 hover:text-neon-blue hover:border-neon-blue hover:bg-neon-blue/5 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> Add Channel
          </button>
        </div>
        <div className="mt-6 pt-6 border-t border-white/5">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 border border-transparent text-slate-400 hover:text-red-400 hover:bg-red-400/5 hover:border-red-400/20"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm tracking-wider uppercase">Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
