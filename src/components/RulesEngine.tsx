import { useState } from 'react';
import { AppState } from '../db/db';
import { Plus, Play, Trash2, Edit, Check, Settings2, RefreshCw } from 'lucide-react';
import { createRule, updateRule, deleteRule, runRule } from '../api';

export default function RulesEngine({ state, refresh }: { state: AppState, refresh: () => void }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [isRunningRule, setIsRunningRule] = useState<string | null>(null);
  
  const handleRun = async (id: string) => {
    setIsRunningRule(id);
    try {
      await runRule(id);
      refresh();
    } catch (err) {
      console.error('Failed to run rule:', err);
    } finally {
      setIsRunningRule(null);
    }
  };

  
  const [formData, setFormData] = useState({
    name: '',
    sourceChannelUrl: '',
    titlePrefix: '',
    titleSuffix: '',
    descriptionTemplate: '',
    tags: '',
    privacyStatus: 'private',
    intervalMinutes: 120,
    targetUserId: state.users[0]?.id || '',
    autoOptimizeSeo: true,
    maxLatestVideos: 4
  });

  const handleOpenModal = (rule?: any) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        ...rule,
        tags: rule.tags.join(', ')
      });
    } else {
      setEditingRule(null);
      setFormData({
        name: '',
        sourceChannelUrl: '',
        titlePrefix: '',
        titleSuffix: '',
        descriptionTemplate: '',
        tags: '',
        privacyStatus: 'private',
        intervalMinutes: 120,
        targetUserId: state.users[0]?.id || '',
        autoOptimizeSeo: true,
        maxLatestVideos: 4
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const ruleData = {
      ...formData,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      enabled: editingRule ? editingRule.enabled : true
    };
    
    if (editingRule) {
      await updateRule(editingRule.id, ruleData);
    } else {
      await createRule(ruleData);
    }
    setIsModalOpen(false);
    refresh();
  };

  const handleToggle = async (rule: any) => {
    await updateRule(rule.id, { enabled: !rule.enabled });
    refresh();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this rule forever?')) {
      await deleteRule(id);
      refresh();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Automation Rules</h2>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-neon-blue text-slate-900 px-4 py-2 rounded font-semibold hover:bg-white transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(0,240,255,0.4)]"
        >
          <Plus className="w-5 h-5" /> New Rule
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {state.scheduleRules.map(rule => (
          <div key={rule.id} className="glass-panel rounded-xl p-5 border border-white/10 hover:border-white/20 transition-all flex flex-col group relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${rule.enabled ? 'bg-neon-green shadow-[0_0_10px_#00ff66]' : 'bg-slate-600'}`} />
            
            <div className="flex justify-between items-start mb-4 pl-2">
              <div>
                <h3 className="font-bold text-lg text-white">{rule.name}</h3>
                <p className="text-xs text-slate-400 truncate max-w-[200px]">{rule.sourceChannelUrl}</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleToggle(rule)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${rule.enabled ? 'bg-neon-green/20' : 'bg-slate-700'}`}
                >
                  <div className={`w-3 h-3 rounded-full bg-white absolute top-1 transition-all ${rule.enabled ? 'left-6 shadow-[0_0_5px_#00ff66]' : 'left-1'}`} />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-3 text-sm text-slate-300 pl-2 mb-6">
              <div className="flex justify-between">
                <span className="text-slate-500">Interval</span>
                <span>{rule.intervalMinutes} mins</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Privacy</span>
                <span className="capitalize">{rule.privacyStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">AI SEO</span>
                <span>{rule.autoOptimizeSeo ? <span className="text-neon-purple font-medium flex items-center gap-1"><Check className="w-3 h-3"/> Enabled</span> : 'Disabled'}</span>
              </div>
              {rule.lastCheckedAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Last run</span>
                  <span>{new Date(rule.lastCheckedAt).toLocaleTimeString()}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pl-2 pt-4 border-t border-white/5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => handleRun(rule.id)}
                disabled={isRunningRule === rule.id}
                className="text-slate-400 hover:text-neon-blue flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-50"
                title="Run Now"
              >
                <Play className={`w-4 h-4 ${isRunningRule === rule.id ? 'animate-pulse text-neon-blue' : ''}`} /> 
                {isRunningRule === rule.id ? 'Running...' : 'Run'}
              </button>
              <div className="flex gap-2">
                <button onClick={() => handleOpenModal(rule)} className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-white/10 transition-colors">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(rule.id)} className="p-1.5 text-slate-400 hover:text-neon-red rounded hover:bg-neon-red/10 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="glass-panel w-full max-w-2xl rounded-xl border border-white/10 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-white/5 flex justify-between items-center">
              <h3 className="font-bold text-xl">{editingRule ? 'Edit Rule' : 'New Rule'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Rule Name</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors" placeholder="e.g. Daily Tech Shorts" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Source Channel URL</label>
                  <input type="text" value={formData.sourceChannelUrl} onChange={e => setFormData({...formData, sourceChannelUrl: e.target.value})} className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors" placeholder="https://youtube.com/@channel" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Title Prefix</label>
                  <input type="text" value={formData.titlePrefix} onChange={e => setFormData({...formData, titlePrefix: e.target.value})} className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors" placeholder="Optional" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Title Suffix</label>
                  <input type="text" value={formData.titleSuffix} onChange={e => setFormData({...formData, titleSuffix: e.target.value})} className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors" placeholder="#shorts" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Description Template</label>
                <textarea value={formData.descriptionTemplate} onChange={e => setFormData({...formData, descriptionTemplate: e.target.value})} className="w-full h-24 bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors resize-none" placeholder="Appended text..." />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Tags (comma separated)</label>
                <input type="text" value={formData.tags} onChange={e => setFormData({...formData, tags: e.target.value})} className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors" placeholder="tech, coding, ai" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Privacy</label>
                  <select value={formData.privacyStatus} onChange={e => setFormData({...formData, privacyStatus: e.target.value})} className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors">
                    <option value="private">Private</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="public">Public</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Interval (mins)</label>
                  <input type="number" min="5" value={formData.intervalMinutes} onChange={e => setFormData({...formData, intervalMinutes: parseInt(e.target.value)})} className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Max Videos</label>
                  <input type="number" min="1" max="15" value={formData.maxLatestVideos} onChange={e => setFormData({...formData, maxLatestVideos: parseInt(e.target.value)})} className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Target Channel</label>
                <select value={formData.targetUserId} onChange={e => setFormData({...formData, targetUserId: e.target.value})} className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors">
                  <option value="" disabled>Select a channel</option>
                  {state.users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-3 cursor-pointer mt-2 p-3 rounded bg-neon-purple/5 border border-neon-purple/20">
                <input type="checkbox" checked={formData.autoOptimizeSeo} onChange={e => setFormData({...formData, autoOptimizeSeo: e.target.checked})} className="w-4 h-4 accent-neon-purple" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-neon-purple">Gemini AI SEO Optimization</div>
                  <div className="text-xs text-slate-400">Automatically rewrite title and description to maximize CTR.</div>
                </div>
              </label>

            </div>
            
            <div className="p-5 border-t border-white/5 flex justify-end gap-3 bg-black/20 rounded-b-xl">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded text-sm text-slate-300 hover:bg-white/10 transition-colors">Cancel</button>
              <button onClick={handleSave} className="px-6 py-2 rounded text-sm bg-neon-blue text-slate-900 font-bold hover:bg-white transition-colors shadow-[0_0_15px_rgba(0,240,255,0.4)]">
                Save Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
