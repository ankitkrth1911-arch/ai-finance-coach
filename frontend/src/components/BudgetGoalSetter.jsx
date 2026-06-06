import React, { useState, useEffect } from 'react';
import { Target, Plus, Trash2, AlertTriangle, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../context/AuthContext';

const BUDGET_CATEGORIES = [
  "Dining Out",
  "Groceries",
  "Rent & Mortgage",
  "Utilities",
  "Subscriptions",
  "Entertainment",
  "Shopping",
  "Other"
];

export default function BudgetGoalSetter({ authToken }) {
  const currentMonthStr = new Date().toISOString().substring(0, 7); // Format: YYYY-MM
  const [month, setMonth] = useState(currentMonthStr);
  const [budgets, setBudgets] = useState([]);
  const [category, setCategory] = useState(BUDGET_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchBudgets = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/budgets?month=${month}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setBudgets(data);
      } else {
        const errData = await res.json();
        setError(errData.detail || 'Failed to fetch budgets');
      }
    } catch (err) {
      console.error('Error fetching budgets:', err);
      setError('Connection error fetching budgets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, [authToken, month]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/budgets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          category,
          amount: parseFloat(amount),
          month
        })
      });

      if (res.ok) {
        setAmount('');
        fetchBudgets();
      } else {
        const errData = await res.json();
        setError(errData.detail || 'Failed to update budget');
      }
    } catch (err) {
      console.error('Submit budget error:', err);
      setError('Connection error updating budget');
    }
  };

  const handleDelete = async (budgetId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/budgets/${budgetId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        fetchBudgets();
      }
    } catch (err) {
      console.error('Delete budget error:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-brand-400" />
            Budget Settings & Tracking
          </h2>
          <p className="text-sm text-slate-400 mt-1">Set category limits and track expenditures</p>
        </div>

        <div>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-[#141c30] border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-900/50 rounded-xl p-3 flex items-start gap-2 text-red-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Goal Creator Form */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800 h-fit lg:col-span-1">
          <h3 className="text-lg font-bold text-white mb-4">Set Category Goal</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#0d1527] border border-slate-800 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-brand-500"
              >
                {BUDGET_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Target Monthly Budget ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="500.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-[#0d1527] border border-slate-800 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-brand-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-medium py-3 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>Save Budget</span>
            </button>
          </form>
        </div>

        {/* Budgets Progress List */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
          ) : budgets.length === 0 ? (
            <div className="border border-slate-850 rounded-2xl p-8 text-center bg-darkcard/20 h-full flex flex-col justify-center">
              <p className="text-slate-400 text-sm">No active budget constraints created for {month}.</p>
              <p className="text-xs text-slate-500 mt-1">Use the planner form to designate maximum category spend goals.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {budgets.map((b) => {
                const limit = parseFloat(b.amount);
                const spent = parseFloat(b.current_spending);
                const percent = Math.min(100, Math.round((spent / limit) * 100));
                
                // Color formatting
                let statusColor = "bg-emerald-500";
                let statusText = "Safe";
                let icon = <CheckCircle className="w-4 h-4 text-emerald-400" />;
                
                if (spent >= limit) {
                  statusColor = "bg-red-500";
                  statusText = "Exceeded";
                  icon = <AlertCircle className="w-4 h-4 text-red-400" />;
                } else if (spent >= limit * 0.85) {
                  statusColor = "bg-amber-500";
                  statusText = "Warning";
                  icon = <AlertTriangle className="w-4 h-4 text-amber-400" />;
                }

                return (
                  <div key={b.id} className="glass-card rounded-xl p-5 border border-slate-800 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base">{b.category}</span>
                        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full text-[10px] font-medium text-slate-400">
                          {icon}
                          <span>{statusText}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-sm font-semibold text-white">${spent.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          <span className="text-xs text-slate-500 ml-1">/ ${limit.toLocaleString()}</span>
                        </div>
                        <button
                          onClick={() => handleDelete(b.id)}
                          className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"
                          title="Delete budget"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Progress track */}
                    <div className="w-full bg-slate-800/60 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${statusColor}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                      <span>{percent}% spent</span>
                      <span>${Math.max(0, limit - spent).toLocaleString(undefined, { minimumFractionDigits: 2 })} remaining</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
