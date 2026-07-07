/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { fetchState, checkAuthStatus } from './api';
import { AppState } from './db/db';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import RulesEngine from './components/RulesEngine';
import QueueTracker from './components/QueueTracker';
import SettingsLog from './components/SettingsLog';
import Pipeline from './components/Pipeline';
import LoginPage from './components/LoginPage';
import { 
  Activity, 
  CloudUpload, 
  Menu, 
  Rocket, 
  Settings, 
  TrendingUp, 
  X, 
  Bell, 
  ChevronDown, 
  ChevronUp, 
  Globe, 
  Plus, 
  Trash2, 
  Check 
} from 'lucide-react';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [state, setState] = useState<AppState | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [activeChannelDropdown, setActiveChannelDropdown] = useState(false);
  const [notification, setNotification] = useState<{ message: string; id: string } | null>(null);
  
  const prevVideosLengthRef = useRef<number | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('nexus_auth_token');
      if (!token) {
        setIsAuthenticated(false);
        return;
      }
      try {
        const { isAuthenticated: isValid } = await checkAuthStatus();
        setIsAuthenticated(isValid);
      } catch (err) {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated === true) {
      fetchState().then(s => {
        setState(s);
        prevVideosLengthRef.current = s.videos.length;
      }).catch(() => {
        setIsAuthenticated(false);
      });

      const interval = setInterval(() => {
        fetchState().then(s => {
          setState(prev => {
            if (prev && prevVideosLengthRef.current !== null && s.videos.length > prevVideosLengthRef.current) {
              // Find newly added videos
              const prevIds = prev.videos.map(v => v.id);
              const newVideos = s.videos.filter(v => !prevIds.includes(v.id));
              if (newVideos.length > 0) {
                const latestVideo = newVideos[newVideos.length - 1];
                const isRuleFetched = latestVideo.id.startsWith('sched_');
                const message = isRuleFetched 
                  ? `Scheduler fetched recent video "${latestVideo.title}" and moved to queue!`
                  : `Your video "${latestVideo.title}" is in queue now!`;
                
                setNotification({ message, id: latestVideo.id + Date.now() });
                setTimeout(() => setNotification(null), 6000);
              }
            }
            prevVideosLengthRef.current = s.videos.length;
            return s;
          });
        }).catch(() => {
          // Silent catch for interval, fetchState handles 401
        });
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Rocket className="w-12 h-12 text-cyan-400 animate-pulse" />
      </div>
    );
  }

  if (isAuthenticated === false) {
    return <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Rocket className="w-12 h-12 text-neon-blue animate-spaceship" />
      </div>
    );
  }

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleConnectYouTube = async () => {
    try {
      const response = await fetch('/api/auth/url');
      const data = await response.json();
      window.open(data.url, '_blank', 'width=500,height=600');
    } catch (e) {
      console.error('Failed to get auth URL:', e);
    }
  };

  const handleDisconnectChannel = async (userId: string, userName: string) => {
    if (confirm(`Are you sure you want to disconnect ${userName}?`)) {
      try {
        const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
        if (response.ok) {
          fetchState().then(s => {
            setState(s);
            prevVideosLengthRef.current = s.videos.length;
            if (selectedUserId === userId) {
              setSelectedUserId('');
            }
          });
        }
      } catch (err) {
        console.error('Failed to disconnect channel:', err);
      }
    }
  };

  const getDisplayChannelId = (user: any) => {
    if (user.id === '105019774043863797778') return 'UC4qIRrK6MN5U59e5Cqlm7w';
    if (user.id === '100365574453673810775') return 'UCMwrGgjyY6PM2H310C8IKGQ';
    return 'UC' + user.id.slice(0, 20);
  };

  const activeUser = state.users.find(u => u.id === selectedUserId);

  // Filter application state by the chosen active channel
  const filteredState = {
    ...state,
    videos: selectedUserId === '' 
      ? state.videos 
      : state.videos.filter(v => v.targetUserId === selectedUserId),
    scheduleRules: selectedUserId === '' 
      ? state.scheduleRules 
      : state.scheduleRules.filter(r => r.targetUserId === selectedUserId)
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900 text-slate-200 selection:bg-neon-purple selection:bg-opacity-30">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={toggleSidebar} />
      )}
      
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 transition-transform duration-300 z-50 flex`}>
        <Sidebar activeTab={activeTab} setActiveTab={(tab) => { setActiveTab(tab); setIsSidebarOpen(false); }} users={state.users} />
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Glow Effects in Background */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-neon-purple/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-neon-blue/5 rounded-full blur-[120px] pointer-events-none" />
        
        {/* Floating Notification Capsule */}
        {notification && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-10 fade-in duration-300">
            <div className="bg-slate-900/95 border border-neon-blue/40 text-white px-6 py-3 rounded-full shadow-[0_0_20px_rgba(0,240,255,0.4)] flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-neon-blue/20 flex items-center justify-center relative">
                <Bell className="w-4 h-4 text-neon-blue animate-bounce" />
                <span className="absolute top-0 right-0 w-2 h-2 bg-neon-green rounded-full border border-slate-900" />
              </div>
              <span className="text-sm font-semibold tracking-wide">{notification.message}</span>
            </div>
          </div>
        )}

        <header className="h-16 glass-panel border-x-0 border-t-0 flex items-center justify-between px-4 lg:px-8 z-30 relative">
          <div className="flex items-center gap-3">
            <button onClick={toggleSidebar} className="lg:hidden p-2 text-neon-blue hover:bg-neon-blue/10 rounded">
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg lg:text-xl font-bold flex items-center gap-3 text-neon-blue neon-text-blue tracking-wider">
              {activeTab === 'dashboard' && <><TrendingUp className="w-5 h-5" /> COMMAND CENTER</>}
              {activeTab === 'rules' && <><Activity className="w-5 h-5 text-neon-green" /> AUTOMATION MATRIX</>}
              {activeTab === 'queue' && <><CloudUpload className="w-5 h-5 text-neon-purple" /> DATA QUEUE</>}
              {activeTab === 'pipeline' && <><Rocket className="w-5 h-5 text-neon-blue" /> PROCESSING PIPELINE</>}
              {activeTab === 'settings' && <><Settings className="w-5 h-5 text-slate-400" /> SYSTEM CONFIG</>}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Active Channel Selector */}
            <div className="relative">
              <button 
                onClick={() => setActiveChannelDropdown(!activeChannelDropdown)}
                className="flex items-center gap-3 bg-slate-950/40 border border-white/10 hover:border-neon-blue/40 px-4 py-1.5 rounded-xl transition-all cursor-pointer shadow-[0_2px_10px_rgba(0,0,0,0.2)]"
              >
                {activeUser?.avatarUrl ? (
                  <img src={activeUser.avatarUrl} alt={activeUser.name} className="w-5 h-5 rounded-full" />
                ) : selectedUserId === '' ? (
                  <Globe className="w-5 h-5 text-neon-blue" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-neon-blue/20 flex items-center justify-center text-[10px] text-neon-blue font-bold">
                    {activeUser?.name?.charAt(0)}
                  </div>
                )}
                <div className="text-left hidden sm:block">
                  <div className="text-[8px] uppercase tracking-wider text-slate-500 font-bold leading-none">Active Channel</div>
                  <div className="text-xs font-semibold text-white mt-0.5 max-w-[120px] truncate">
                    {selectedUserId === '' ? 'All Channels' : activeUser?.name}
                  </div>
                </div>
                {activeChannelDropdown ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {activeChannelDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setActiveChannelDropdown(false)} />
                  <div className="absolute right-0 mt-2 w-72 bg-slate-950/95 backdrop-blur-md border border-white/10 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-3 px-1">
                      Select Workspace Channel
                    </h3>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {/* All Channels Option */}
                      <button 
                        onClick={() => { setSelectedUserId(''); setActiveChannelDropdown(false); }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors text-left ${
                          selectedUserId === '' ? 'bg-neon-blue/10 border border-neon-blue/20 text-white' : 'hover:bg-white/5 border border-transparent text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-neon-blue/20 border border-neon-blue/30 flex items-center justify-center text-neon-blue">
                            <Globe className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold">All Channels</div>
                            <div className="text-[10px] text-slate-500">Unified statistics view</div>
                          </div>
                        </div>
                        {selectedUserId === '' && <Check className="w-4 h-4 text-neon-blue" />}
                      </button>

                      {/* Individual Users */}
                      {state.users.map(u => {
                        const isSelected = selectedUserId === u.id;
                        return (
                          <div key={u.id} className="relative group/item">
                            <button 
                              onClick={() => { setSelectedUserId(u.id); setActiveChannelDropdown(false); }}
                              className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors text-left ${
                                isSelected ? 'bg-neon-blue/10 border border-neon-blue/20 text-white' : 'hover:bg-white/5 border border-transparent text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-3 pr-8">
                                {u.avatarUrl ? (
                                  <img src={u.avatarUrl} alt={u.name} className="w-8 h-8 rounded-full border border-white/10" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-neon-blue/20 border border-neon-blue/30 flex items-center justify-center text-neon-blue font-bold">
                                    {u.name.charAt(0)}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold truncate">{u.name}</div>
                                  <div className="text-[9px] font-mono text-slate-500 truncate mt-0.5">{getDisplayChannelId(u)}</div>
                                </div>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-neon-blue" />}
                            </button>
                            
                            {/* Hover Disconnect Button */}
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDisconnectChannel(u.id, u.name); }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-md opacity-0 group-hover/item:opacity-100 transition-opacity hover:bg-red-500/20"
                              title="Disconnect Channel"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-white/5 mt-3 pt-3">
                      <button 
                        onClick={() => { handleConnectYouTube(); setActiveChannelDropdown(false); }}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-neon-blue text-slate-900 font-bold rounded-lg hover:bg-white transition-colors text-xs shadow-[0_0_10px_rgba(0,240,255,0.2)]"
                      >
                        <Plus className="w-4 h-4" /> Add New Channel
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-2 text-xs font-mono bg-black/30 px-3 py-1.5 rounded-full border border-neon-green/30 text-neon-green">
              <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" /> SYSTEM ONLINE
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 z-10 relative scroll-smooth">
          {activeTab === 'dashboard' && <Dashboard state={filteredState} selectedUserId={selectedUserId} setSelectedUserId={setSelectedUserId} />}
          {activeTab === 'rules' && <RulesEngine state={filteredState} refresh={() => fetchState().then(setState)} />}
          {activeTab === 'queue' && <QueueTracker state={filteredState} refresh={() => fetchState().then(setState)} />}
          {activeTab === 'pipeline' && <Pipeline state={filteredState} refresh={() => fetchState().then(setState)} />}
          {activeTab === 'settings' && <SettingsLog state={state} refresh={() => fetchState().then(setState)} />}
        </main>
      </div>
    </div>
  );
                      }
