import React, { useState, useEffect } from 'react';
import { FileText, RefreshCw, Send, CheckSquare, Calendar, ChevronDown, ChevronUp, AlertCircle, TrendingUp, Sparkles } from 'lucide-react';
import { API_BASE_URL } from '../context/AuthContext';

export default function WeeklyReportView({ authToken }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/coach/reports`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data);
        if (data.length > 0) {
          setExpandedId(data[0].id); // Expand the latest report by default
        }
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/coach/reports/trigger`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        await fetchReports();
        alert('Weekly report generated successfully!');
      } else {
        const errData = await res.json();
        alert(`Failed to generate report: ${errData.detail || 'check account connection'}`);
      }
    } catch (err) {
      console.error('Error generating report:', err);
      alert('Error connecting to backend.');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [authToken]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-400" />
            Financial Health Reports
          </h2>
          <p className="text-sm text-slate-400 mt-1">Review weekly reviews, savings statistics, and coach advice</p>
        </div>

        <button
          onClick={handleGenerateReport}
          disabled={generating || loading}
          className="px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-600 text-white rounded-xl text-sm font-semibold active:scale-[0.98] transition-all flex items-center gap-2 shadow-md shadow-brand-500/10"
        >
          <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
          <span>{generating ? 'Compiling AI Report...' : 'Compile Latest Report'}</span>
        </button>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="border border-dashed border-slate-850 rounded-2xl p-12 text-center bg-darkcard/20">
          <div className="inline-flex items-center justify-center p-3 bg-brand-500/10 rounded-full text-brand-400 mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-white">No reports compiled yet</h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto mt-2">
            Reports are generated weekly on Sundays. You can trigger an immediate manual report using the button above.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const isExpanded = expandedId === report.id;
            const stats = report.content.statistics || {};
            const summary = report.content.summary || "";
            const tips = report.content.actionable_tips || [];
            const warnings = report.content.habit_warnings || [];

            return (
              <div 
                key={report.id} 
                className="glass-card rounded-2xl border border-slate-800 overflow-hidden transition-all duration-300"
              >
                {/* Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : report.id)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-darkcard/30 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2 bg-brand-500/10 rounded-lg text-brand-400 shrink-0">
                      <Calendar className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm sm:text-base">
                        Report: {report.start_date} to {report.end_date}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">Compiled on {new Date(report.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-4 text-xs font-semibold">
                      <span className="text-red-400">Spent: ${parseFloat(stats.total_spending || 0).toLocaleString()}</span>
                      <span className="text-emerald-400">Savings Rate: {parseFloat(stats.savings_rate || 0).toFixed(1)}%</span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </button>

                {/* Body Details */}
                {isExpanded && (
                  <div className="px-6 pb-6 pt-2 border-t border-slate-850/60 space-y-6">
                    {/* Metrics grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-[#0b101f] border border-slate-850 p-4 rounded-xl">
                        <span className="block text-[10px] text-slate-500 uppercase font-semibold">Outflow</span>
                        <span className="block text-base font-bold text-red-400 mt-1">${parseFloat(stats.total_spending || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="bg-[#0b101f] border border-slate-850 p-4 rounded-xl">
                        <span className="block text-[10px] text-slate-500 uppercase font-semibold">Inflow</span>
                        <span className="block text-base font-bold text-emerald-400 mt-1">${parseFloat(stats.total_income || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="bg-[#0b101f] border border-slate-850 p-4 rounded-xl">
                        <span className="block text-[10px] text-slate-500 uppercase font-semibold">Net Savings</span>
                        <span className="block text-base font-bold text-white mt-1">${Math.max(0, parseFloat(stats.total_income || 0) - parseFloat(stats.total_spending || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="bg-[#0b101f] border border-slate-850 p-4 rounded-xl">
                        <span className="block text-[10px] text-slate-500 uppercase font-semibold">Savings Rate</span>
                        <span className="block text-base font-bold text-brand-400 mt-1">{parseFloat(stats.savings_rate || 0).toFixed(1)}%</span>
                      </div>
                    </div>

                    {/* AI Coach Summary Text */}
                    <div className="bg-brand-950/20 border border-brand-900/30 rounded-xl p-5 relative overflow-hidden">
                      <div className="absolute top-3 right-3 text-brand-400">
                        <Sparkles className="w-5 h-5 animate-soft-pulse" />
                      </div>
                      <h5 className="font-bold text-white text-sm mb-2 flex items-center gap-1.5">
                        Coach Diagnosis
                      </h5>
                      <p className="text-slate-300 text-sm italic leading-relaxed">"{summary}"</p>
                    </div>

                    {/* Actionable items and Warnings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Tips */}
                      <div className="space-y-3">
                        <h5 className="font-bold text-white text-sm flex items-center gap-2">
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                          Recommended Next Steps
                        </h5>
                        <ul className="space-y-2.5">
                          {tips.map((tip, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 bg-slate-900/40 p-3 rounded-lg border border-slate-850 text-slate-300 text-xs leading-relaxed">
                              <span className="inline-flex items-center justify-center w-5 h-5 bg-emerald-500/10 text-emerald-400 rounded-full font-bold text-[10px] shrink-0 mt-0.5">{idx + 1}</span>
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Warnings */}
                      <div className="space-y-3">
                        <h5 className="font-bold text-white text-sm flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-400" />
                          Spending Warnings
                        </h5>
                        {warnings.length === 0 ? (
                          <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-4 text-center text-xs text-emerald-400 font-medium">
                            No habits flagged. Excellent balance this week!
                          </div>
                        ) : (
                          <ul className="space-y-2.5">
                            {warnings.map((warn, idx) => (
                              <li key={idx} className="flex items-start gap-2.5 bg-rose-950/10 border border-rose-900/20 p-3 rounded-lg text-rose-300 text-xs leading-relaxed">
                                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                <span>{warn}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
