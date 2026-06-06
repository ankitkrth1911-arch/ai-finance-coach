import React, { useState, useEffect } from 'react';
import { DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw, Wallet, Calendar, AlertCircle, Edit2, Check, X } from 'lucide-react';
import { API_BASE_URL } from '../context/AuthContext';

const ALLOWED_CATEGORIES = [
  "Dining Out",
  "Groceries",
  "Rent & Mortgage",
  "Utilities",
  "Subscriptions",
  "Income",
  "Transfer",
  "Entertainment",
  "Shopping",
  "Other"
];

// Helper to color category tags
const getCategoryBadgeStyle = (cat) => {
  switch (cat) {
    case 'Income':
      return 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30';
    case 'Rent & Mortgage':
      return 'bg-violet-950/40 text-violet-400 border border-violet-900/30';
    case 'Dining Out':
      return 'bg-amber-950/40 text-amber-400 border border-amber-900/30';
    case 'Groceries':
      return 'bg-teal-950/40 text-teal-400 border border-teal-900/30';
    case 'Utilities':
      return 'bg-sky-950/40 text-sky-400 border border-sky-900/30';
    case 'Subscriptions':
      return 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/30';
    case 'Transfer':
      return 'bg-slate-900/60 text-slate-400 border border-slate-800';
    case 'Entertainment':
      return 'bg-pink-950/40 text-pink-400 border border-pink-900/30';
    case 'Shopping':
      return 'bg-rose-950/40 text-rose-400 border border-rose-900/30';
    default:
      return 'bg-slate-950/40 text-slate-300 border border-slate-800/40';
  }
};

export default function Dashboard({ authToken }) {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTxId, setEditingTxId] = useState(null);
  const [newCategory, setNewCategory] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch connected Plaid items/accounts
      const accRes = await fetch(`${API_BASE_URL}/plaid/items`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      let fetchedAccounts = [];
      if (accRes.ok) {
        const items = await accRes.json();
        items.forEach(item => {
          fetchedAccounts = fetchedAccounts.concat(item.accounts || []);
        });
        setAccounts(fetchedAccounts);
      }

      // 2. Fetch recent transactions
      const txRes = await fetch(`${API_BASE_URL}/transactions?limit=30`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData);
      }
    } catch (err) {
      console.error('Error fetching dashboard statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [authToken]);

  // Recategorize transaction manually
  const handleRecategorize = async (txId) => {
    if (!newCategory) return;
    try {
      const res = await fetch(`${API_BASE_URL}/transactions/${txId}/category?category=${encodeURIComponent(newCategory)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        setEditingTxId(null);
        setNewCategory('');
        fetchData(); // Reload transactions
      }
    } catch (err) {
      console.error('Failed to update transaction category:', err);
    }
  };

  // Compute stats counters
  const totalAssets = accounts
    .filter(a => a.type === 'depository')
    .reduce((sum, a) => sum + parseFloat(a.balance_current), 0);

  const totalLiabilities = accounts
    .filter(a => a.type === 'credit')
    .reduce((sum, a) => sum + parseFloat(a.balance_current), 0);

  const netWorth = totalAssets - totalLiabilities;

  const recentExpenses = transactions
    .filter(t => t.ai_category !== 'Income' && t.ai_category !== 'Transfer')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const recentIncome = transactions
    .filter(t => t.ai_category === 'Income')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Worth */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Net Worth</span>
            <div className="p-2 bg-brand-500/10 text-brand-400 rounded-lg">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-white tracking-tight">
              ${netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Cash assets minus liabilities</p>
          </div>
        </div>

        {/* Assets */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Cash Assets</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-white tracking-tight">
              ${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Total balances in savings & checking</p>
          </div>
        </div>

        {/* Liabilities */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Credit Debt</span>
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-white tracking-tight">
              ${totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Total credit card liability</p>
          </div>
        </div>

        {/* Cash Flow */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Recent Expenses</span>
            <div className="p-2 bg-brand-500/10 text-brand-400 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-white tracking-tight">
              ${recentExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Sum of last 30 outflows</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connected Accounts List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Connected Accounts</h3>
            <button 
              onClick={fetchData} 
              disabled={loading}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="h-32 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-brand-500 animate-spin" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="border border-slate-850 rounded-xl p-6 text-center text-xs text-slate-500 bg-darkcard/20">
              No accounts linked. Use the Bank connections tab to sync.
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map(acc => (
                <div key={acc.id} className="bg-[#0b101f] border border-slate-850 rounded-xl p-4 flex items-center justify-between hover:border-slate-800 transition-all">
                  <div>
                    <span className="block font-semibold text-white text-xs sm:text-sm truncate max-w-[150px]">{acc.name}</span>
                    <span className="block text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{acc.subtype || acc.type} {acc.mask ? `•••• ${acc.mask}` : ''}</span>
                  </div>
                  <div className="text-right">
                    <span className="block font-bold text-white text-sm sm:text-base">${parseFloat(acc.balance_current).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">Available: ${acc.balance_available ? parseFloat(acc.balance_available).toLocaleString() : 'N/A'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transactions Ledger */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-base font-bold text-white">Recent Transactions</h3>
          
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="border border-slate-850 rounded-xl p-12 text-center text-xs text-slate-500 bg-darkcard/20">
              No transactions imported.
            </div>
          ) : (
            <div className="bg-[#0b101f] border border-slate-850 rounded-xl overflow-hidden shadow-xl max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-850 bg-darkcard/40 text-slate-400 font-semibold">
                    <th className="py-3 px-4">Transaction / Date</th>
                    <th className="py-3 px-4">AI Category</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60">
                  {transactions.map((tx) => {
                    const isIncome = tx.ai_category === 'Income';
                    return (
                      <tr key={tx.id} className="hover:bg-slate-900/35 transition-colors group">
                        <td className="py-3.5 px-4 max-w-[200px]">
                          <span 
                            className="block font-bold text-white truncate" 
                            title={tx.ai_justification || tx.name}
                          >
                            {tx.merchant_name || tx.name}
                          </span>
                          <span className="block text-[10px] text-slate-500 mt-0.5 font-medium flex items-center gap-1">
                            <Calendar className="w-3 h-3 shrink-0" />
                            {tx.date} | Account: {tx.account_name || 'Sandbox'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {editingTxId === tx.id ? (
                            <div className="flex items-center gap-1.5">
                              <select
                                value={newCategory || tx.ai_category}
                                onChange={(e) => setNewCategory(e.target.value)}
                                className="bg-[#0d1527] border border-slate-700 rounded-lg py-1 px-2 text-white text-xs focus:outline-none"
                              >
                                {ALLOWED_CATEGORIES.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleRecategorize(tx.id)}
                                className="p-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-500/30 transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingTxId(null)}
                                className="p-1 bg-slate-800 text-slate-400 border border-slate-700 rounded hover:bg-slate-700 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${getCategoryBadgeStyle(tx.ai_category)}`}>
                                {tx.ai_category}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingTxId(tx.id);
                                  setNewCategory(tx.ai_category);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-white rounded hover:bg-slate-800 transition-all"
                                title="Edit category manually"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          <span className="block text-[10px] text-slate-500 mt-1 max-w-[180px] truncate leading-normal italic" title={tx.ai_justification}>
                            {tx.ai_justification || "No explanation provided."}
                          </span>
                        </td>
                        <td className={`py-3.5 px-4 text-right font-bold text-sm ${isIncome ? 'text-emerald-400' : 'text-slate-200'}`}>
                          {isIncome ? '+' : '-'}${parseFloat(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
