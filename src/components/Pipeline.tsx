import { AppState } from '../db/db';
import { Rocket, Video, CheckCircle, Clock, Zap, TrendingUp, BarChart2, Loader2, Play } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function Pipeline({ state }: { state: AppState, refresh: () => void }) {
  // Mock data for analytics
  const performanceData = [
    { name: 'Gaming', views: 4000, ctr: 8.4 },
    { name: 'Tech', views: 3000, ctr: 6.2 },
    { name: 'Vlogs', views: 2000, ctr: 9.1 },
    { name: 'Music', views: 2780, ctr: 5.5 },
    { name: 'News', views: 1890, ctr: 4.8 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      {/* Pipeline Visualizer */}
      <div className="glass-panel rounded-xl p-6 border border-white/10 relative overflow-hidden neon-pulse-panel">
        <h3 className="text-lg font-bold text-neon-blue mb-8 tracking-widest uppercase flex items-center gap-2">
          <Zap className="w-5 h-5" /> Pipeline Status
        </h3>
        
        <div className="flex flex-col lg:flex-row justify-between items-center relative z-10 gap-8 lg:gap-0">
          {/* Connecting Line */}
          <div className="hidden lg:block absolute top-1/2 left-[10%] right-[10%] h-0.5 bg-slate-800 -translate-y-1/2 z-0">
            <div className="h-full bg-neon-blue shadow-[0_0_10px_#00f0ff] w-2/3 animate-[pulse_2s_ease-in-out_infinite]" />
          </div>

          {[
             { step: 1, label: 'INGESTION', icon: Clock, count: state.videos.filter(v => v.status === 'queued').length, color: 'text-slate-400' },
             { step: 2, label: 'PROCESSING', icon: Loader2, count: state.videos.filter(v => ['downloading', 'uploading'].includes(v.status)).length, color: 'text-neon-purple', spin: true },
             { step: 3, label: 'AI OPTIMIZATION', icon: Zap, count: state.videos.filter(v => v.isRewritten).length, color: 'text-neon-blue' },
             { step: 4, label: 'DEPLOYED', icon: CheckCircle, count: state.videos.filter(v => v.status === 'completed').length, color: 'text-neon-green' }
          ].map((node, i) => (
            <div key={i} className="relative z-10 flex flex-col items-center group bg-slate-900 lg:bg-transparent px-4">
              <div className={`w-16 h-16 rounded-full border-2 border-slate-700 bg-slate-800 flex items-center justify-center mb-3 transition-all duration-300 ${
                node.count > 0 ? `border-opacity-50 border-${node.color.split('-')[1]}-${node.color.split('-')[2]} shadow-[0_0_20px_currentColor]` : ''
              } ${node.color}`}>
                <node.icon className={`w-8 h-8 ${node.spin && node.count > 0 ? 'animate-spin' : ''}`} />
              </div>
              <div className="text-xs font-bold tracking-widest uppercase text-slate-400 group-hover:text-white transition-colors">{node.label}</div>
              <div className={`text-2xl font-black mt-1 ${node.color}`}>{node.count}</div>
            </div>
          ))}
        </div>

        {/* Loading Spaceship */}
        {state.videos.some(v => ['downloading', 'uploading'].includes(v.status)) && (
          <div className="absolute inset-0 flex justify-center items-center pointer-events-none opacity-20">
            <Rocket className="w-64 h-64 text-neon-blue animate-spaceship" />
          </div>
        )}
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel rounded-xl p-6 border border-white/10">
           <h3 className="text-sm font-bold text-slate-300 mb-6 tracking-widest uppercase flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-neon-purple" /> Category Performance
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c1f2e" vertical={false} />
                <XAxis dataKey="name" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{fill: 'rgba(255,255,255,0.05)'}}
                  contentStyle={{ backgroundColor: '#13151f', border: '1px solid rgba(176, 38, 255, 0.3)', borderRadius: '8px' }}
                  itemStyle={{ color: '#b026ff' }}
                />
                <Bar dataKey="views" fill="#b026ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-6 border border-white/10 flex flex-col">
          <h3 className="text-sm font-bold text-slate-300 mb-4 tracking-widest uppercase flex items-center gap-2">
            <Video className="w-4 h-4 text-neon-green" /> Recently Deployed
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
             {state.videos.filter(v => v.status === 'completed').slice(0, 5).map(video => (
                <div key={video.id} className="bg-white/5 rounded p-3 flex gap-3 items-center hover:bg-white/10 transition-colors border border-white/5 hover:border-neon-green/30">
                  <div className="w-12 h-12 bg-slate-800 rounded flex items-center justify-center flex-shrink-0 text-neon-green border border-neon-green/20">
                     <Play className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-slate-200 truncate">{video.title}</div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span className="text-neon-green">Success</span>
                      {video.cpsPrediction && <span>CPS: {video.cpsPrediction.score}</span>}
                    </div>
                  </div>
                </div>
             ))}
             {state.videos.filter(v => v.status === 'completed').length === 0 && (
               <div className="flex-1 flex items-center justify-center text-sm text-slate-500 italic">No videos deployed yet.</div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
