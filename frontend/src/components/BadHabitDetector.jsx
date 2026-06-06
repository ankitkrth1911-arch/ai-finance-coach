import React, { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, Sparkles, CheckCircle2, ChevronRight } from 'lucide-react';
import { API_BASE_URL } from '../context/AuthContext';

export default function BadHabitDetector({ authToken }) {
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(false);

  const scanHabits = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/coach/habits`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setHabits(data.habits || []);
      }
    } catch (err) {
      console.error('Error auditing habits:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    scanHabits();
  }, [authToken]);

  return (
    <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
              Bad Habit Auditor
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            </h3>
            <p className="text-xs text-slate-400">Automated spending and leakage scanner</p>
          </div>
        </div>

        <button
          onClick={scanHabits}
          disabled={loading}
          className="px-4 py-2 border border-slate-800 bg-[#0d1527] text-slate-300 hover:text-white rounded-xl text-xs font-semibold hover:border-slate-700 active:scale-[0.98] transition-all flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Auditing logs...' : 'Scan Transactions'}</span>
        </button>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      ) : habits.length === 0 ? (
        <div className="border border-dashed border-slate-850 rounded-xl p-8 text-center bg-darkcard/20">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <h4 className="text-white font-semibold">No negative spending habits found!</h4>
          <p className="text-slate-500 text-xs mt-1">
            Clarity AI has audited your recent transactions and found no major concerns. Maintain your current saving velocity!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {habits.map((h, idx) => {
            const isPraise = h.title.includes("Healthy") || h.title.includes("Praise") || h.title.includes("No major");
            const iconBg = isPraise ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400";
            
            return (
              <div 
                key={idx} 
                className="bg-[#0b101f] border border-slate-850 rounded-xl p-5 hover:border-slate-800 transition-all flex flex-col gap-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isPraise ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                    <h4 className="font-bold text-white text-base">{h.title}</h4>
                  </div>
                  
                  {!isPraise && (
                    <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest bg-rose-950/40 border border-rose-900/50 px-2 py-0.5 rounded-full">
                      Leakage Flagged
                    </span>
                  )}
                </div>

                <p className="text-slate-300 text-sm">{h.description}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 pt-3 border-t border-slate-900 text-xs">
                  <div>
                    <span className="block text-slate-500 uppercase tracking-wider font-semibold">Risk & Impact</span>
                    <span className="block text-slate-300 mt-1">{h.impact}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 uppercase tracking-wider font-semibold">Remediation Step</span>
                    <span className="block text-emerald-400 font-medium mt-1">{h.remediation}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
