/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { fetchState } from './api';
import { AppState } from './db/db';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import RulesEngine from './components/RulesEngine';
import QueueTracker from './components/QueueTracker';
import SettingsLog from './components/SettingsLog';
import Pipeline from './components/Pipeline';
import { Activity, CloudUpload, Menu, Rocket, Settings, TrendingUp, X } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [state, setState] = useState<AppState | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    fetchState().then(setState);
    const interval = setInterval(() => {
      fetchState().then(setState);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Rocket className="w-12 h-12 text-neon-blue animate-spaceship" />
      </div>
    );
  }

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

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
        
        <header className="h-16 glass-panel border-x-0 border-t-0 flex items-center justify-between px-4 lg:px-8 z-10">
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
             <div className="hidden lg:flex items-center gap-2 text-xs font-mono bg-black/30 px-3 py-1.5 rounded-full border border-neon-green/30 text-neon-green">
               <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" /> SYSTEM ONLINE
             </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 z-10 relative scroll-smooth">
          {activeTab === 'dashboard' && <Dashboard state={state} />}
          {activeTab === 'rules' && <RulesEngine state={state} refresh={() => fetchState().then(setState)} />}
          {activeTab === 'queue' && <QueueTracker state={state} refresh={() => fetchState().then(setState)} />}
          {activeTab === 'pipeline' && <Pipeline state={state} refresh={() => fetchState().then(setState)} />}
          {activeTab === 'settings' && <SettingsLog state={state} refresh={() => fetchState().then(setState)} />}
        </main>
      </div>
    </div>
  );
}
