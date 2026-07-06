import { useState } from 'react';
import { AppState } from '../db/db';
import { Activity, CheckCircle, Clock, Video, TrendingUp, Youtube, Plus, RefreshCw, ChevronDown } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { getAuthUrl } from '../api';

export default function Dashboard({ state }: { state: AppState }) {
  const [selectedUserId, setSelectedUserId] = useState<string>(state.users[0]?.id || '');

  const handleConnectYouTube = async () => {
    try {
      const { url } = await getAuthUrl();
      window.open(url, '_blank', 'width=500,height=600');
    } catch (e) {
      console.error(e);
    }
  };

  const stats = [
    { label: 'Videos Processed', value: state.processedVideoIds.length, icon: Video, color: 'text-neon-blue' },
    { label: 'Active Rules', value: state.scheduleRules.filter(r => r.enabled).length, icon: Activity, color: 'text-neon-green' },
    { label: 'Pending Queue', value: state.videos.filter(v => ['queued', 'downloading', 'uploading'].includes(v.status)).length, icon: Clock, color: 'text-neon-purple' },
    { label: 'Success Uploads', value: state.videos.filter(v => v.status === 'completed').length, icon: CheckCircle, color: 'text-neon-green' },
  ];

  // Dummy chart data for UI purposes
  const chartData = [
    { name: 'Mon', videos: 4 },
    { name: 'Tue', videos: 7 },
    { name: 'Wed', videos: 5 },
    { name: 'Thu', videos: 12 },
    { name: 'Fri', videos: 8 },
    { name: 'Sat', videos: 15 },
    { name: 'Sun', videos: 20 },
  ];

  const connectedUser = state.users.find(u => u.id === selectedUserId) || state.users[0];
  const activeVideos = state.videos.filter(v => ['queued', 'downloading', 'downloaded', 'uploading'].includes(v.status));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {state.users.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 border border-neon-blue/30 relative overflow-hidden group">
          <div className="absolute inset-0 bg-neon-blue/5 group-hover:bg-neon-blue/10 transition-colors pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <Youtube className="w-6 h-6 text-neon-blue" /> Connect Your Channel
              </h2>
              <p className="text-slate-400 max-w-xl text-sm">
                To start automating your YouTube pipeline, connect your channel. You need to configure your Client ID and Secret in Settings first if you haven't already.
              </p>
            </div>
            <button 
              onClick={handleConnectYouTube}
              className="whitespace-nowrap px-6 py-3 bg-neon-blue text-slate-900 font-bold rounded hover:bg-white transition-colors shadow-[0_0_15px_rgba(0,240,255,0.4)] flex items-center gap-2"
            >
              <Plus className="w-5 h-5" /> Authenticate YouTube
            </button>
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-xl p-6 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 relative">
          <div className="flex items-center gap-4">
            {connectedUser?.avatarUrl ? (
              <img src={connectedUser.avatarUrl} alt={connectedUser.name} className="w-12 h-12 rounded-full border border-neon-blue/50" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-neon-blue/20 border border-neon-blue/50 flex items-center justify-center text-neon-blue font-bold text-xl">
                {connectedUser?.name.charAt(0)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-white">{connectedUser?.name}</h2>
                <div className="relative group">
                  <select 
                    value={connectedUser?.id}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  >
                    {state.users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  <button className="flex items-center gap-1 text-xs px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-colors text-slate-300">
                    <RefreshCw className="w-3 h-3" /> Switch
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </button>
                </div>
              </div>
              <p className="text-slate-400 text-sm flex items-center gap-1 mt-1">
                <CheckCircle className="w-3 h-3 text-neon-green" /> Connected via YouTube
              </p>
            </div>
          </div>
          <button 
            onClick={handleConnectYouTube}
            className="whitespace-nowrap px-4 py-2 border border-white/20 text-white font-medium rounded hover:bg-white/5 transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Add Channel
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="glass-panel rounded-xl p-6 relative overflow-hidden group hover:border-white/20 transition-colors">
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${stat.color}`}>
              <stat.icon className="w-16 h-16" />
            </div>
            <div className={`w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mb-4 ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div className="text-3xl font-bold mb-1">{stat.value}</div>
            <div className="text-sm text-slate-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {activeVideos.length > 0 && (
        <div className="glass-panel rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-neon-blue" />
            Working Pipeline
          </h3>
          <div className="space-y-4">
            {activeVideos.map(video => (
              <div key={video.id} className="p-4 bg-white/5 rounded-lg border border-white/5">
                <div className="flex flex-col md:flex-row justify-between gap-4 mb-3">
                  <div className="flex gap-4 items-start flex-1 min-w-0">
                    <div className="w-24 h-16 bg-black/40 rounded flex-shrink-0 border border-white/10 overflow-hidden">
                      {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium truncate" title={video.title}>{video.title || 'Untitled Video'}</h4>
                      <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                        {video.status === 'queued' && <span className="px-2 py-0.5 bg-white/10 rounded text-slate-300 text-xs uppercase tracking-wider">Queued</span>}
                        {video.status === 'downloading' && <span className="px-2 py-0.5 bg-neon-purple/20 text-neon-purple rounded text-xs uppercase tracking-wider animate-pulse">Downloading</span>}
                        {video.status === 'downloaded' && <span className="px-2 py-0.5 bg-neon-blue/20 text-neon-blue rounded text-xs uppercase tracking-wider">Processing</span>}
                        {video.status === 'uploading' && <span className="px-2 py-0.5 bg-yellow-400/20 text-yellow-400 rounded text-xs uppercase tracking-wider animate-pulse">Uploading</span>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white mb-1">{video.progress}%</div>
                  </div>
                </div>
                <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 rounded-full ${
                      video.status === 'downloading' ? 'bg-neon-purple' :
                      video.status === 'uploading' ? 'bg-yellow-400' : 'bg-neon-blue'
                    }`}
                    style={{ width: `${video.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-neon-blue" />
            Publishing Volume
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVideos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00f0ff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#13151f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#00f0ff' }}
                />
                <Area type="monotone" dataKey="videos" stroke="#00f0ff" strokeWidth={2} fillOpacity={1} fill="url(#colorVideos)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-6 flex flex-col">
          <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {state.logs.slice(0, 5).map(log => (
              <div key={log.id} className="flex gap-3 text-sm pb-4 border-b border-white/5 last:border-0">
                <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                  log.level === 'success' ? 'bg-neon-green shadow-[0_0_8px_#00ff66]' :
                  log.level === 'error' ? 'bg-neon-red shadow-[0_0_8px_#ff2a2a]' :
                  log.level === 'warn' ? 'bg-yellow-400' : 'bg-neon-blue shadow-[0_0_8px_#00f0ff]'
                }`} />
                <div>
                  <p className="text-slate-300">{log.message}</p>
                  <p className="text-slate-500 text-xs mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {state.logs.length === 0 && (
              <div className="text-slate-500 text-sm text-center py-8">No recent activity</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
