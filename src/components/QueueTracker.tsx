import * as React from 'react';
import { AppState } from '../db/db';
import { Sparkles, Trash2, RefreshCw, AlertCircle, Check, Loader2, Plus, Video } from 'lucide-react';
import { optimizeVideo, addManualVideo } from '../api';
import { useState } from 'react';

export default function QueueTracker({ state, refresh }: { state: AppState, refresh: () => void }) {
  const [optimizing, setOptimizing] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    sourceUrl: '',
    targetUserId: state.users[0]?.id || '',
    privacyStatus: 'private',
    description: '',
    tags: '',
    autoOptimizeSeo: true
  });

  const handleOpenModal = () => {
    setFormData({
      title: '',
      sourceUrl: '',
      targetUserId: state.users[0]?.id || '',
      privacyStatus: 'private',
      description: '',
      tags: '',
      autoOptimizeSeo: true
    });
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.sourceUrl.trim() || !formData.targetUserId) {
      setErrorMsg('Title, Source URL, and Target Channel are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const tagsArray = formData.tags
        ? formData.tags.split(',').map(t => t.trim()).filter(Boolean)
        : [];
      
      await addManualVideo({
        ...formData,
        tags: tagsArray
      });
      setIsModalOpen(false);
      refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add video to queue.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
      <div className="flex justify-between items-center gap-4">
        <h2 className="text-xl font-bold">Publishing Queue</h2>
        {state.users.length > 0 && (
          <button 
            onClick={handleOpenModal}
            className="whitespace-nowrap px-4 py-2 bg-neon-blue text-slate-900 font-bold rounded hover:bg-white transition-colors shadow-[0_0_15px_rgba(0,240,255,0.4)] flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Submit Video
          </button>
        )}
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="glass-panel w-full max-w-2xl rounded-xl border border-white/10 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-white/5 flex justify-between items-center">
              <h3 className="font-bold text-xl flex items-center gap-2">
                <Video className="w-5 h-5 text-neon-blue" /> Submit Video to Queue
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
              {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Video Title</label>
                <input 
                  type="text" 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                  className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors text-white" 
                  placeholder="e.g. My Amazing Short Video" 
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">YouTube Video Source URL</label>
                <input 
                  type="url" 
                  value={formData.sourceUrl} 
                  onChange={e => setFormData({...formData, sourceUrl: e.target.value})} 
                  className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors text-white" 
                  placeholder="https://www.youtube.com/watch?v=..." 
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Target Channel</label>
                  <select 
                    value={formData.targetUserId} 
                    onChange={e => setFormData({...formData, targetUserId: e.target.value})} 
                    className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors text-white"
                  >
                    {state.users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Privacy Status</label>
                  <select 
                    value={formData.privacyStatus} 
                    onChange={e => setFormData({...formData, privacyStatus: e.target.value})} 
                    className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors text-white"
                  >
                    <option value="private">Private</option>
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Description (Optional)</label>
                <textarea 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                  rows={3}
                  className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors text-white" 
                  placeholder="Video description..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Tags (Optional, comma separated)</label>
                <input 
                  type="text" 
                  value={formData.tags} 
                  onChange={e => setFormData({...formData, tags: e.target.value})} 
                  className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors text-white" 
                  placeholder="tag1, tag2, tag3" 
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="autoOptimizeSeo"
                  checked={formData.autoOptimizeSeo} 
                  onChange={e => setFormData({...formData, autoOptimizeSeo: e.target.checked})} 
                  className="rounded border-white/10 bg-slate-800 text-neon-blue focus:ring-0 focus:ring-offset-0" 
                />
                <label htmlFor="autoOptimizeSeo" className="text-xs text-slate-300 font-semibold cursor-pointer">
                  Automatically optimize metadata using AI (Title, Description, Tags)
                </label>
              </div>

              <div className="p-4 border-t border-white/5 mt-6 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded text-slate-300 text-sm hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-neon-blue text-slate-900 font-bold rounded hover:bg-white transition-colors text-sm flex items-center gap-2 disabled:opacity-50 shadow-[0_0_10px_rgba(0,240,255,0.2)]"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add to Queue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
