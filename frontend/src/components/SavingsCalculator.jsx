import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { PiggyBank, RefreshCw, ArrowUpRight, DollarSign, Calendar } from 'lucide-react';
import { API_BASE_URL } from '../context/AuthContext';

export default function SavingsCalculator({ authToken }) {
  const [contribution, setContribution] = useState('200');
  const [returnRate, setReturnRate] = useState('7');
  const [years, setYears] = useState('15');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const calculateProjections = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/coach/projections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          monthly_contribution: parseFloat(contribution),
          annual_return_rate: parseFloat(returnRate) / 100,
          years: parseInt(years)
        })
      });
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error('Error fetching projections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateProjections();
  }, [authToken]);

  const handleSubmit = (e) => {
    e.preventDefault();
    calculateProjections();
  };

  const finalYear = data?.projection[data.projection.length - 1];

  return (
    <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
          <PiggyBank className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Savings Projection Planner</h3>
          <p className="text-xs text-slate-400">See your compounding interest grow over years</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Inputs */}
        <div className="bg-[#0b101f] border border-slate-850 p-5 rounded-xl space-y-4 h-fit">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Monthly Contribution ($)</label>
              <input
                type="number"
                value={contribution}
                onChange={(e) => setContribution(e.target.value)}
                className="w-full bg-[#0d1527] border border-slate-800 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Annual Interest Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={returnRate}
                onChange={(e) => setReturnRate(e.target.value)}
                className="w-full bg-[#0d1527] border border-slate-800 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Projection Horizon (Years)</label>
              <select
                value={years}
                onChange={(e) => setYears(e.target.value)}
                className="w-full bg-[#0d1527] border border-slate-800 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:border-brand-500"
              >
                {[5, 10, 15, 20, 30].map(y => (
                  <option key={y} value={y}>{y} Years</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-medium py-2.5 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>Calculate Projections</span>
            </button>
          </form>
        </div>

        {/* Projections graph & details */}
        <div className="lg:col-span-2 space-y-6">
          {data && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#0b101f] border border-slate-850 p-4 rounded-xl flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg shrink-0">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 uppercase font-semibold">Savings Rate</span>
                  <span className="block text-base font-bold text-white mt-0.5">{data.current_savings_rate}%</span>
                </div>
              </div>

              <div className="bg-[#0b101f] border border-slate-850 p-4 rounded-xl flex items-center gap-3">
                <div className="p-2.5 bg-brand-500/10 text-brand-400 rounded-lg shrink-0">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 uppercase font-semibold">Final Projection Balance</span>
                  <span className="block text-base font-bold text-white mt-0.5">${finalYear ? parseFloat(finalYear.balance).toLocaleString() : '0'}</span>
                </div>
              </div>

              <div className="bg-[#0b101f] border border-slate-850 p-4 rounded-xl flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-lg shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 uppercase font-semibold">Interest Accrued</span>
                  <span className="block text-base font-bold text-white mt-0.5">${finalYear ? parseFloat(finalYear.total_interest).toLocaleString() : '0'}</span>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
          ) : !data ? (
            <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
              Run calculation to construct investment projection chart.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.projection}
                  margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                >
                  <XAxis 
                    dataKey="year" 
                    stroke="#475569" 
                    fontSize={10}
                    tickFormatter={(v) => `Year ${v}`}
                  />
                  <YAxis 
                    stroke="#475569" 
                    fontSize={10}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#141c30', borderColor: '#1e293b' }} 
                    labelStyle={{ color: '#fff', fontSize: '12px' }}
                    itemStyle={{ fontSize: '11px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line name="Total Wealth" type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={2.5} dot={false} />
                  <Line name="Total Contributed" type="monotone" dataKey="total_contributed" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
