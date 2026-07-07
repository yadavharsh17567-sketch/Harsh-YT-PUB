import { AppState } from '../db/db';
import { updateSettings } from '../api';
import { useState } from 'react';
import { Terminal, Save, Check } from 'lucide-react';

export default function SettingsLog({ state, refresh }: { state: AppState, refresh: () => void }) {
  const [formData, setFormData] = useState(state.settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await updateSettings(formData);
    setSaving(false);
    setSaved(true);
    refresh();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold">System Configuration</h3>
            <button 
              onClick={handleSave}
              disabled={saving}
              className={`px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-all ${
                saved ? 'bg-neon-green text-slate-900 shadow-[0_0_15px_rgba(0,255,102,0.4)]' : 
                'bg-neon-blue text-slate-900 hover:bg-white shadow-[0_0_15px_rgba(0,240,255,0.4)]'
              }`}
            >
              {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? 'Saved' : 'Save Changes'}
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Gemini API Key</label>
              <input type="password" value={formData.geminiApiKey} onChange={e => setFormData({...formData, geminiApiKey: e.target.value})} className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-purple transition-colors font-mono" placeholder="AI Studio Secret..." />
              <p className="text-[10px] text-slate-500 mt-1 italic">Required for "Auto-Optimize SEO" feature. Get your key from Google AI Studio.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">OpenAI API Key</label>
              <input type="password" value={formData.openaiApiKey || ''} onChange={e => setFormData({...formData, openaiApiKey: e.target.value})} className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-purple transition-colors font-mono" placeholder="sk-..." />
              <p className="text-[10px] text-slate-500 mt-1 italic">Alternative AI provider for SEO optimization. Required if Gemini is unavailable.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Video Quality</label>
                <select value={formData.videoQuality} onChange={e => setFormData({...formData, videoQuality: e.target.value})} className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors text-slate-200">
                  <option value="720p">720p Standard</option>
                  <option value="1080p">1080p Full HD</option>
                  <option value="1440p">1440p 2K</option>
                  <option value="2160p">4K Ultra HD</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Auto-Clear History</label>
                <select value={formData.autoClearHistoryDays} onChange={e => setFormData({...formData, autoClearHistoryDays: parseInt(e.target.value)})} className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors text-slate-200">
                  <option value={0}>Never</option>
                  <option value={1}>After 24 Hours</option>
                  <option value={7}>After 7 Days</option>
                  <option value={30}>After 30 Days</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Max Concurrent Uploads</label>
                <input type="number" min="1" max="5" value={formData.maxConcurrentUploads} onChange={e => setFormData({...formData, maxConcurrentUploads: parseInt(e.target.value)})} className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Max Retries</label>
                <input type="number" min="0" max="10" value={formData.maxRetries} onChange={e => setFormData({...formData, maxRetries: parseInt(e.target.value)})} className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors" />
              </div>
            </div>

            <div className="space-y-1 pt-4 border-t border-white/5">
              <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider flex items-center gap-2">YouTube Client ID <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">OAuth Override</span></label>
              <input type="text" value={formData.googleClientId} onChange={e => setFormData({...formData, googleClientId: e.target.value})} className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider flex items-center gap-2">YouTube Client Secret <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">OAuth Override</span></label>
              <input type="password" value={formData.googleClientSecret} onChange={e => setFormData({...formData, googleClientSecret: e.target.value})} className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors font-mono" />
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <h4 className="text-xs font-semibold text-neon-green uppercase tracking-wider flex items-center gap-2">
                <Check className="w-4 h-4" /> YouTube Bot-Detection Bypass (Optional)
              </h4>
              <p className="text-xs text-slate-400">
                Use these options to bypass "Sign in to confirm you're not a bot" errors caused by hosting/cloud network rate-limits.
              </p>
              
              <div className="space-y-1">
                <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">YouTube Browser Cookies (Netscape Format)</label>
                <textarea 
                  value={formData.youtubeCookies || ''} 
                  onChange={e => setFormData({...formData, youtubeCookies: e.target.value})} 
                  className="w-full h-24 bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors font-mono resize-y" 
                  placeholder="# Netscape HTTP Cookie File..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">YouTube PO Token</label>
                <input 
                  type="text" 
                  value={formData.youtubePoToken || ''} 
                  onChange={e => setFormData({...formData, youtubePoToken: e.target.value})} 
                  className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors font-mono" 
                  placeholder="Proof of Origin Token (PO Token)" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Visitor Data</label>
                <input 
                  type="text" 
                  value={formData.youtubeVisitorData || ''} 
                  onChange={e => setFormData({...formData, youtubeVisitorData: e.target.value})} 
                  className="w-full bg-slate-800/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-neon-blue transition-colors font-mono" 
                  placeholder="Visitor Data parameter" 
                />
              </div>
            </div>

            <div className="mt-4 p-3 rounded bg-neon-blue/5 border border-neon-blue/20">
              <h4 className="text-xs font-semibold text-neon-blue uppercase tracking-wider mb-2">OAuth Redirect URIs Config</h4>
              <p className="text-xs text-slate-400 mb-2">Add these exact URIs to your Google Cloud Console OAuth Client configuration:</p>
              <div className="space-y-2">
                <div className="bg-black/40 p-2 rounded flex justify-between items-center group">
                  <code className="text-[10px] text-slate-300 font-mono break-all select-all">
                    https://ais-dev-rm4pstgvdyamxeb7o7tfsq-287628165268.asia-east1.run.app/api/auth/callback
                  </code>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 whitespace-nowrap ml-2">Development</span>
                </div>
                <div className="bg-black/40 p-2 rounded flex justify-between items-center group">
                  <code className="text-[10px] text-slate-300 font-mono break-all select-all">
                    https://ais-pre-rm4pstgvdyamxeb7o7tfsq-287628165268.asia-east1.run.app/api/auth/callback
                  </code>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 whitespace-nowrap ml-2">Shared</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-xl border border-white/10 flex flex-col h-[500px]">
          <div className="p-4 border-b border-white/5 flex items-center gap-2 bg-black/20 rounded-t-xl">
            <Terminal className="w-5 h-5 text-slate-400" />
            <h3 className="font-bold text-sm tracking-widest text-slate-300 uppercase">System Audit Log</h3>
            <div className="ml-auto flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-slate-700"></div>
              <div className="w-3 h-3 rounded-full bg-slate-700"></div>
              <div className="w-3 h-3 rounded-full bg-neon-blue shadow-[0_0_8px_#00f0ff] animate-pulse"></div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 bg-[#050505] font-mono text-[13px] leading-relaxed selection:bg-white/20">
            {state.logs.map(log => (
              <div key={log.id} className="mb-2">
                <span className="text-slate-500">[{new Date(log.timestamp).toISOString().split('T')[1].replace('Z','')}]</span>{' '}
                <span className={`font-bold ${
                  log.level === 'info' ? 'text-neon-blue' :
                  log.level === 'success' ? 'text-neon-green' :
                  log.level === 'warn' ? 'text-yellow-400' :
                  'text-neon-red'
                }`}>[{log.level.toUpperCase()}]</span>{' '}
                <span className="text-slate-300">{log.message}</span>
                {log.details && (
                  <pre className="mt-1 ml-24 text-[11px] text-slate-500 bg-white/[0.02] p-2 rounded border border-white/5 overflow-x-auto">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
            {state.logs.length === 0 && (
              <div className="text-slate-500 italic mt-4 text-center">System initialized. Awaiting events...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
