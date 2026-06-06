import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, RefreshCw, Sparkles, HelpCircle } from 'lucide-react';
import { API_BASE_URL } from '../context/AuthContext';

const SUGGESTIONS = [
  "How is my savings rate doing?",
  "Analyze my bad habits this week",
  "Why am I spending so much on food?",
  "How can I hit my budget goals?"
];

export default function AICoachChat({ authToken }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/coach/chat/history`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error('Error fetching chat history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [authToken]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (messageText) => {
    const textToSend = messageText || input;
    if (!textToSend.trim()) return;

    if (!messageText) {
      setInput('');
    }
    setLoading(true);

    // Append user message instantly for responsive feel
    const tempUserMsg = {
      id: Date.now(),
      role: 'user',
      content: textToSend,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`${API_BASE_URL}/coach/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ message: textToSend })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(data.history);
      } else {
        throw new Error('Failed to get coach response');
      }
    } catch (err) {
      console.error('Error posting message:', err);
      // Append error message from system
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'I had trouble formulating a response. Please check your network connection or verify that the OpenAI API key is configured correctly.',
        created_at: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl border border-slate-800 h-[600px] flex flex-col overflow-hidden relative">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-darkcard/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="p-2.5 bg-brand-500/10 border border-brand-500/20 rounded-xl text-brand-400">
              <Bot className="w-5 h-5" />
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-darkcard" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-1.5">
              AI Financial Coach
              <Sparkles className="w-3.5 h-3.5 text-brand-400 animate-pulse" />
            </h3>
            <p className="text-xs text-slate-400">Personalized spending & saving advisors</p>
          </div>
        </div>

        <button
          onClick={fetchHistory}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Reload conversation logs"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {historyLoading ? (
          <div className="h-full flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="p-4 bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl mb-4">
              <Bot className="w-10 h-10 mx-auto opacity-75" />
            </div>
            <h4 className="text-white font-bold text-base">Meet your Financial Coach</h4>
            <p className="text-slate-400 text-sm max-w-sm mt-1 mb-6">
              Ask about transaction analysis, how to improve your savings, or how to stick to your budget.
            </p>
            <div className="w-full max-w-md grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="p-3 bg-[#0d1527] border border-slate-800/80 hover:border-brand-500/40 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition-colors flex items-start gap-1.5"
                >
                  <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-brand-400" />
                  <span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isCoach = msg.role === 'assistant';
              return (
                <div key={msg.id} className={`flex items-start gap-3.5 ${isCoach ? '' : 'flex-row-reverse'}`}>
                  <div className={`p-2 rounded-xl border shrink-0 ${
                    isCoach 
                      ? 'bg-brand-500/10 border-brand-500/20 text-brand-400' 
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}>
                    {isCoach ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>

                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-md leading-relaxed ${
                    isCoach 
                      ? 'bg-[#141c30] border border-slate-800 text-slate-200 rounded-tl-none' 
                      : 'bg-brand-600 text-white rounded-tr-none'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              );
            })}
            
            {loading && (
              <div className="flex items-start gap-3.5">
                <div className="p-2 bg-brand-500/10 border border-brand-500/20 text-brand-400 rounded-xl shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-[#141c30] border border-slate-800 text-slate-400 rounded-2xl rounded-tl-none px-4 py-3 text-sm shadow-md flex items-center gap-1.5 animate-pulse">
                  <span>Coach is analyzing</span>
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce delay-0" />
                    <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce delay-150" />
                    <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce delay-300" />
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Form */}
      <div className="p-4 border-t border-slate-800 bg-darkcard/30">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            disabled={loading}
            placeholder="Ask your coach something..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-[#0d1527] border border-slate-800 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-brand-500 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl active:scale-[0.95] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center shadow-lg"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
