import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { TrendingUp, PieChart as PieIcon, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../context/AuthContext';

// Harmonious custom HSL tailored colors for categories
const COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#f43f5e', // Rose
  '#14b8a6', // Teal
  '#eab308', // Yellow
  '#94a3b8'  // Slate
];

export default function SpendingCharts({ authToken }) {
  const [summaryData, setSummaryData] = useState({ breakdown: [], trends: [] });
  const [loading, setLoading] = useState(true);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/transactions/summary`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (err) {
      console.error('Error fetching spending summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [authToken]);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  const { breakdown, trends } = summaryData;
  const hasBreakdown = breakdown && breakdown.length > 0;
  const hasTrends = trends && trends.length > 0;

  // Custom tooltips matching theme
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#141c30] border border-slate-800 p-3 rounded-lg shadow-xl text-xs font-sans">
          <p className="font-semibold text-white mb-1.5">{payload[0].name}</p>
          {payload.map((item, idx) => (
            <p key={idx} style={{ color: item.color || '#fff' }} className="font-medium mt-1">
              {item.name}: ${item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Category Breakdown */}
      <div className="glass-card rounded-2xl p-6 border border-slate-800 flex flex-col justify-between">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-brand-500/10 rounded-lg text-brand-400">
            <PieIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Category Allocation</h3>
            <p className="text-xs text-slate-400">Where your cash goes</p>
          </div>
        </div>

        {!hasBreakdown ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-sm">
            No spending data available. Connect an account to populate metrics.
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="w-full sm:w-[50%] h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={breakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="category"
                  >
                    {breakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* List labels */}
            <div className="w-full sm:w-[45%] max-h-64 overflow-y-auto pr-2 space-y-2.5">
              {breakdown.map((item, index) => {
                const total = breakdown.reduce((sum, item) => sum + item.value, 0);
                const percent = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
                return (
                  <div key={item.category} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-slate-300 truncate font-medium max-w-[100px]">{item.category}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-semibold">${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      <span className="text-slate-500 ml-1.5 font-medium">{percent}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Spending Trend */}
      <div className="glass-card rounded-2xl p-6 border border-slate-800">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Monthly Cash Flow</h3>
            <p className="text-xs text-slate-400">Income vs. spending over time</p>
          </div>
        </div>

        {!hasTrends ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-sm">
            No history available. Setup plaid accounts first.
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={trends}
                margin={{ top: 10, right: 5, left: -25, bottom: 0 }}
              >
                <XAxis 
                  dataKey="month" 
                  stroke="#475569" 
                  fontSize={10}
                  tickLine={false} 
                />
                <YAxis 
                  stroke="#475569" 
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
                />
                <Bar name="Income" dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar name="Spending" dataKey="spending" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
