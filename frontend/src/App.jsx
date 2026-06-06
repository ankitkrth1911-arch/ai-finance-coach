import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import PlaidLinkButton from './components/PlaidLinkButton';
import SpendingCharts from './components/SpendingCharts';
import BudgetGoalSetter from './components/BudgetGoalSetter';
import AICoachChat from './components/AICoachChat';
import BadHabitDetector from './components/BadHabitDetector';
import SavingsCalculator from './components/SavingsCalculator';
import WeeklyReportView from './components/WeeklyReportView';

import { 
  LayoutDashboard, 
  BarChart3, 
  Target, 
  Bot, 
  ShieldAlert, 
  PiggyBank, 
  FileText, 
  Link, 
  LogOut, 
  Sparkles, 
  Mail, 
  User, 
  Check, 
  RefreshCw 
} from 'lucide-react';

function AppContent() {
  const { user, token, loading, logout, updateWeeklyReportSetting } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1d] flex flex-col items-center justify-center gap-4">
        <RefreshCw className="w-10 h-10 text-brand-500 animate-spin" />
        <p className="text-slate-400 text-sm font-semibold tracking-wide">Syncing finance vault...</p>
      </div>
    );
  }

  if (!user || !token) {
    return <Auth />;
  }

  // Refresh helper for child components
  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4.5 h-4.5" /> },
    { id: 'charts', label: 'Cash Analysis', icon: <BarChart3 className="w-4.5 h-4.5" /> },
    { id: 'budgets', label: 'Budgets', icon: <Target className="w-4.5 h-4.5" /> },
    { id: 'coach', label: 'AI Coach Chat', icon: <Bot className="w-4.5 h-4.5" /> },
    { id: 'habits', label: 'Habit Auditor', icon: <ShieldAlert className="w-4.5 h-4.5" /> },
    { id: 'projections', label: 'Savings Projection', icon: <PiggyBank className="w-4.5 h-4.5" /> },
    { id: 'reports', label: 'Reports Hub', icon: <FileText className="w-4.5 h-4.5" /> },
    { id: 'connections', label: 'Bank Link', icon: <Link className="w-4.5 h-4.5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-slate-100 flex flex-col font-sans">
      {/* Decorative gradient blur rings */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="border-b border-slate-800 bg-[#0d1425]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-500/15 border border-brand-500/25 rounded-xl text-brand-400">
              <Bot className="w-5.5 h-5.5" />
            </div>
            <div>
              <span className="font-extrabold text-white text-lg tracking-tight flex items-center gap-1">
                Clarity <span className="bg-gradient-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent">AI</span>
                <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* User credentials */}
            <div className="hidden md:flex items-center gap-2 border-r border-slate-800 pr-4 text-xs font-semibold text-slate-400">
              <User className="w-4 h-4 text-slate-500" />
              <span>{user.full_name || user.email}</span>
            </div>

            {/* Email reports settings */}
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-400 select-none">
              <Mail className="w-4 h-4 text-brand-400" />
              <span className="hidden sm:inline">Weekly Summaries:</span>
              <input
                type="checkbox"
                checked={user.weekly_report_enabled}
                onChange={(e) => updateWeeklyReportSetting(e.target.checked)}
                className="w-4 h-4 accent-brand-500 rounded border-slate-800 cursor-pointer bg-slate-900"
              />
            </label>

            <button
              onClick={logout}
              className="p-2 border border-slate-800 hover:border-slate-700 bg-darkcard text-slate-400 hover:text-white rounded-xl text-sm transition-all active:scale-[0.95] flex items-center gap-1.5"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 relative z-10 flex flex-col lg:flex-row gap-8">
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-64 shrink-0">
          <nav className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible gap-1 pb-3 lg:pb-0 scroll-custom border-b lg:border-b-0 border-slate-800">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold whitespace-nowrap active:scale-[0.98] transition-all ${
                    isActive 
                      ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-500/10' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-850/45'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Dynamic Display Area */}
        <section className="flex-1 min-w-0">
          {activeTab === 'dashboard' && (
            <Dashboard key={`dashboard-${refreshTrigger}`} authToken={token} />
          )}
          {activeTab === 'charts' && (
            <SpendingCharts key={`charts-${refreshTrigger}`} authToken={token} />
          )}
          {activeTab === 'budgets' && (
            <BudgetGoalSetter key={`budgets-${refreshTrigger}`} authToken={token} />
          )}
          {activeTab === 'coach' && (
            <AICoachChat key={`coach-${refreshTrigger}`} authToken={token} />
          )}
          {activeTab === 'habits' && (
            <BadHabitDetector key={`habits-${refreshTrigger}`} authToken={token} />
          )}
          {activeTab === 'projections' && (
            <SavingsCalculator key={`projections-${refreshTrigger}`} authToken={token} />
          )}
          {activeTab === 'reports' && (
            <WeeklyReportView key={`reports-${refreshTrigger}`} authToken={token} />
          )}
          {activeTab === 'connections' && (
            <PlaidLinkButton authToken={token} onConnectionSuccess={triggerRefresh} />
          )}
        </section>
      </main>

      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        <p>© {new Date().getFullYear()} Clarity AI. SEC Sandbox Compliant Vault. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
