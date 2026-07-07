import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Rocket, Shield, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import { login } from '../api';

interface LoginPageProps {
  onLoginSuccess: (token: string) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { token } = await login({ username, password });
      localStorage.setItem('nexus_auth_token', token);
      onLoginSuccess(token);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center relative overflow-hidden font-sans">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse delay-700" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-md px-6 relative z-10"
      >
        <div className="bg-slate-900/40 backdrop-blur-xl p-8 lg:p-10 rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          {/* Animated Accent Line */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="flex flex-col items-center mb-10">
            <motion.div 
              whileHover={{ rotate: 10, scale: 1.1 }}
              className="w-16 h-16 rounded-2xl bg-black border border-cyan-400 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.4)] mb-6"
            >
              <Rocket className="w-8 h-8 text-cyan-400" />
            </motion.div>
            <h1 className="text-3xl font-bold tracking-[0.2em] uppercase text-cyan-400 mb-2 text-center drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
              NEXUS
            </h1>
            <p className="text-slate-500 text-xs font-mono tracking-widest uppercase">
              System Authorization Required
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <User className="w-3 h-3" /> Identity Code
              </label>
              <div className="relative">
                <input 
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter Username"
                  className="w-full bg-slate-950/50 border border-white/10 focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 rounded-xl px-4 py-3 text-slate-200 outline-none transition-all placeholder:text-slate-700"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Lock className="w-3 h-3" /> Access Encryption
              </label>
              <div className="relative">
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter Password"
                  className="w-full bg-slate-950/50 border border-white/10 focus:border-purple-400/50 focus:ring-1 focus:ring-purple-400/20 rounded-xl px-4 py-3 text-slate-200 outline-none transition-all placeholder:text-slate-700"
                  required
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-3 text-red-400 text-xs"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full relative group overflow-hidden rounded-xl h-12 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-cyan-500 bg-[length:200%_100%] animate-pulse opacity-90 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10 flex items-center gap-2 text-white font-bold uppercase tracking-widest text-sm">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                {isLoading ? 'Verifying...' : 'Initialize Access'}
              </div>
            </button>
          </form>

          <div className="mt-10 flex justify-between items-center text-[10px] text-slate-600 font-mono">
            <span className="flex items-center gap-1">
              <div className="w-1 h-1 rounded-full bg-green-500" /> SECURITY ACTIVE
            </span>
            <span>V 2.0.4 - ENCRYPTED</span>
          </div>
        </div>
        
        <p className="mt-8 text-center text-slate-600 text-[10px] tracking-widest uppercase">
          Authorized Personnel Only Beyond This Point
        </p>
      </motion.div>
    </div>
  );
}
