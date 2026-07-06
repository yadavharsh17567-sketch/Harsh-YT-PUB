import { AppState } from '../db/db';
import { Sparkles, Trash2, RefreshCw, AlertCircle, Check, Loader2 } from 'lucide-react';
import { optimizeVideo } from '../api';
import { useState } from 'react';

export default function QueueTracker({ state, refresh }: { state: AppState, refresh: () => void }) {
  const [optimizing, setOptimizing] = useState<string | null>(null);

  const handleOptimize = async (id: string) => {
    setOptimizing(id);
    try {
      await optimizeVideo(id);
      refresh();
    } finally {
      setOptimizing(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Publishing Queue</h2>
      </div>

      <div className="glass-panel rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/10 text-slate-400">
              <tr>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Video</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Status</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">AI Optimize</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Target</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {state.videos.map(video => (
                <tr key={video.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 max-w-xs">
                    <div className="font-semibold text-slate-200 truncate" title={video.title}>{video.title}</div>
                    <div className="text-xs text-slate-500 truncate mt-1">ID: {video.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {video.status === 'queued' && <div className="w-2 h-2 rounded-full bg-slate-500" />}
                      {video.status === 'downloading' && <Loader2 className="w-4 h-4 text-neon-blue animate-spin" />}
                      {video.status === 'uploading' && <Loader2 className="w-4 h-4 text-neon-purple animate-spin" />}
                      {video.status === 'completed' && <Check className="w-4 h-4 text-neon-green" />}
                      {video.status === 'failed' && <AlertCircle className="w-4 h-4 text-neon-red" />}
                      <span className="capitalize font-medium text-slate-300">{video.status}</span>
                    </div>
                    {['downloading', 'uploading'].includes(video.status) && (
                      <div className="w-24 h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                        <div className={`h-full ${video.status === 'downloading' ? 'bg-neon-blue' : 'bg-neon-purple'}`} style={{ width: `${video.progress}%` }} />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {video.cpsPrediction ? (
                      <div className="flex items-center gap-2">
                        <div className="text-xl font-black text-neon-purple tracking-tighter">{video.cpsPrediction.score}</div>
                        <div className="text-xs text-slate-400 flex flex-col">
                          <span>CPS</span>
                          <span className="text-neon-green">CTR: {video.cpsPrediction.ctr}%</span>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleOptimize(video.id)}
                        disabled={optimizing === video.id || video.status !== 'queued'}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
                          video.status !== 'queued' 
                            ? 'border-slate-700 text-slate-600 cursor-not-allowed'
                            : 'border-neon-purple/50 text-neon-purple hover:bg-neon-purple/10 hover:shadow-[0_0_10px_rgba(176,38,255,0.3)]'
                        }`}
                      >
                        {optimizing === video.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        Optimize
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {state.users.find(u => u.id === video.targetUserId)?.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button className="p-1.5 text-slate-500 hover:text-white rounded hover:bg-white/10 transition-colors" title="Retry">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-slate-500 hover:text-neon-red rounded hover:bg-neon-red/10 transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {state.videos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No videos in the queue.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
