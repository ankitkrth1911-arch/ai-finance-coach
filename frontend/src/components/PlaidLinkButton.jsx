import React, { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Plus, Check, RefreshCw, Trash2, Shield, AlertTriangle } from 'lucide-react';
import { API_BASE_URL } from '../context/AuthContext';

export default function PlaidLinkButton({ authToken, onConnectionSuccess }) {
  const [linkToken, setLinkToken] = useState(null);
  const [connectedItems, setConnectedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Fetch connected Plaid items from backend
  const fetchItems = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/plaid/items`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setConnectedItems(data);
      }
    } catch (err) {
      console.error('Error fetching plaid connections:', err);
    }
  };

  // Generate Plaid Link token
  const generateLinkToken = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/plaid/link-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setLinkToken(data.link_token);
      }
    } catch (err) {
      console.error('Error generating link token:', err);
    }
  };

  useEffect(() => {
    fetchItems();
    generateLinkToken();
  }, [authToken]);

  // Exchange Plaid Public Token
  const handleOnSuccess = async (public_token, metadata) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/plaid/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          public_token,
          institution_id: metadata.institution?.institution_id || 'ins_sandbox',
          institution_name: metadata.institution?.name || 'Sandbox Bank'
        })
      });

      if (res.ok) {
        await fetchItems();
        if (onConnectionSuccess) {
          onConnectionSuccess();
        }
      }
    } catch (err) {
      console.error('Error exchanging token:', err);
    } finally {
      setLoading(false);
    }
  };

  // Disconnect item
  const handleDisconnect = async (itemId) => {
    if (!confirm('Are you sure you want to disconnect this bank account? This will delete all synced transactions.')) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/plaid/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        fetchItems();
        if (onConnectionSuccess) {
          onConnectionSuccess();
        }
      }
    } catch (err) {
      console.error('Error disconnecting item:', err);
    } finally {
      setLoading(false);
    }
  };

  // Manual transaction sync
  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/plaid/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const result = await res.json();
        alert(`Sync successful! Synced ${result.synced_items} account(s) and categorized ${result.new_transactions_added} new transaction(s).`);
        if (onConnectionSuccess) {
          onConnectionSuccess();
        }
      }
    } catch (err) {
      console.error('Manual sync failed:', err);
      alert('Failed to sync. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const config = {
    token: linkToken,
    onSuccess: handleOnSuccess,
  };

  const { open, ready } = usePlaidLink(config);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-400" />
            Bank Connections
          </h2>
          <p className="text-sm text-slate-400 mt-1">Connect and sync your sandbox financial accounts</p>
        </div>

        <div className="flex items-center gap-2">
          {connectedItems.length > 0 && (
            <button
              onClick={handleManualSync}
              disabled={syncing || loading}
              className="px-4 py-2 border border-slate-800 hover:border-slate-700 bg-darkcard text-slate-300 rounded-xl text-sm font-medium hover:text-white flex items-center gap-2 active:scale-[0.98] transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Transactions'}</span>
            </button>
          )}

          <button
            onClick={() => open()}
            disabled={!ready || loading}
            className="px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-600 text-white rounded-xl text-sm font-medium shadow-md shadow-brand-500/10 active:scale-[0.98] transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Connect a Bank</span>
          </button>
        </div>
      </div>

      {connectedItems.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-2xl p-8 text-center bg-darkcard/20">
          <div className="inline-flex items-center justify-center p-3 bg-brand-500/10 rounded-full text-brand-400 mb-3">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-white">No bank accounts linked yet</h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto mt-2">
            Connect your bank using Plaid Sandbox credentials to let Clarity AI analyze your income, spending, and financial health.
          </p>
          <button
            onClick={() => open()}
            disabled={!ready}
            className="mt-5 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Link Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {connectedItems.map((item) => (
            <div key={item.id} className="glass-card rounded-xl p-5 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-white text-base">{item.institution_name}</h4>
                  <p className="text-xs text-slate-400 mt-1">Item ID: {item.item_id.substring(0, 10)}...</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  item.status === 'active' 
                    ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' 
                    : item.status === 'syncing' 
                    ? 'bg-brand-950/40 text-brand-400 border border-brand-900/30 animate-pulse'
                    : 'bg-red-950/40 text-red-400 border border-red-900/30'
                }`}>
                  {item.status === 'active' && <Check className="w-3.5 h-3.5" />}
                  {item.status === 'syncing' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {item.status === 'error' && <AlertTriangle className="w-3.5 h-3.5" />}
                  <span className="capitalize">{item.status}</span>
                </span>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800/60 flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  {item.accounts?.length || 0} Account(s) Connected
                </div>
                <button
                  onClick={() => handleDisconnect(item.id)}
                  disabled={loading}
                  className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                  title="Disconnect account"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
