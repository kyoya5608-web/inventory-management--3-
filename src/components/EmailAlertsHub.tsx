/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Item } from '../types';
import { Mail, Search, Send, Trash2, ShieldAlert, Sparkles, AlertCircle, HelpCircle } from 'lucide-react';

interface EmailAlertLog {
  id: string;
  itemId: string;
  itemName: string;
  sku: string;
  previousStock: number;
  currentStock: number;
  reorderPoint: number;
  dateTriggered: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  serviceType: string;
}

interface EmailAlertsHubProps {
  emailAlertLogs: EmailAlertLog[];
  items: Item[];
  onTriggerMockAlert: (item: Item, customStockValue: number) => void;
  onClearLogs: () => void;
}

const EmailAlertsHub: React.FC<EmailAlertsHubProps> = ({
  emailAlertLogs,
  items,
  onTriggerMockAlert,
  onClearLogs,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || '');
  const [testStockVal, setTestStockVal] = useState(1);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);

  const filteredLogs = emailAlertLogs.filter(
    (log) =>
      log.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTriggerMock = (e: React.FormEvent) => {
    e.preventDefault();
    const targetedItem = items.find((it) => it.id === selectedItemId);
    if (!targetedItem) return;
    onTriggerMockAlert(targetedItem, testStockVal);
  };

  const selectedLog = emailAlertLogs.find((log) => log.id === activeLogId);

  return (
    <div id="email-alerts-hub" className="space-y-6">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-indigo-400" />
            <h2 className="text-sm font-mono uppercase tracking-wider font-extrabold text-white">Low Stock Email Alerts Portal</h2>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 max-w-2xl">
            Simulate and audit the automated notification subsystem. When stock levels dip below customized reorder levels, SMTP service logs are registered here.
          </p>
        </div>

        {emailAlertLogs.length > 0 && (
          <button
            onClick={onClearLogs}
            className="bg-slate-950 hover:bg-rose-955/20 border border-slate-800 hover:border-rose-900/40 text-slate-400 hover:text-rose-300 font-mono text-[11px] px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Notification History ({emailAlertLogs.length})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left simulation form */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-1.5 border-b border-slate-800 pb-3">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <h3 className="text-xs font-mono uppercase font-black text-white tracking-wider">Subsystem Simulator</h3>
          </div>

          <form onSubmit={handleTriggerMock} className="space-y-4 text-left">
            <div>
              <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">Select Catalog Sku</label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.sku} &middot; {it.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">Foil Stock level drop to</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={testStockVal}
                  onChange={(e) => setTestStockVal(parseInt(e.target.value) || 0)}
                  className="bg-slate-950 border border-slate-850 px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 w-24 font-mono select-all"
                  required
                />
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-550 text-white font-mono font-bold text-[10px] uppercase tracking-wider px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Send className="h-3.5 w-3.5" />
                  Fire Low Stock Trigger
                </button>
              </div>
              <p className="text-[9px] text-slate-500 font-mono mt-1.5">
                Forces immediate re-evaluation of thresholds. If drop is below reorder point, SMTP warning log registers instantly.
              </p>
            </div>
          </form>

          {/* Active stats bar */}
          <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-2">
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">Rule Threshold Rules</span>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="bg-slate-900 p-2 rounded">
                <p className="text-slate-550 text-[8px] uppercase">Service State</p>
                <p className="text-emerald-400 font-black mt-0.5">● RUNNING</p>
              </div>
              <div className="bg-slate-900 p-2 rounded">
                <p className="text-slate-550 text-[8px] uppercase">Recipient Desk</p>
                <p className="text-white truncate">procurement@equiprime</p>
              </div>
            </div>
          </div>
        </div>

        {/* Center log ledger */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-5 space-y-4 lg:col-span-2 flex flex-col min-h-[400px]">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-indigo-400" />
              <h3 className="text-xs font-mono uppercase font-black text-white tracking-wider">Subsystem Log History</h3>
            </div>
            
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search trigger logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 pl-8 pr-3 py-1 bg-no-repeat text-[11px] rounded-lg text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[350px] pr-1">
            {filteredLogs.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-center p-8 text-slate-500">
                <AlertCircle className="h-8 w-8 text-slate-700 mb-2" />
                <p className="text-xs font-mono uppercase tracking-wider">No Email SMTP Alerts Logged</p>
                <p className="text-[10px] mt-1 max-w-sm">Trigger stock changes or use the left simulation tool to generate system alerts.</p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isActive = log.id === activeLogId;
                return (
                  <div
                    key={log.id}
                    onClick={() => setActiveLogId(isActive ? null : log.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left ${
                      isActive 
                        ? 'bg-slate-950 border-indigo-500/50 shadow-lg' 
                        : 'bg-slate-950/45 border-slate-850 hover:bg-slate-950/80 hover:border-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0" />
                          <h4 className="text-[11px] font-bold text-white uppercase tracking-wide leading-tight truncate max-w-md">{log.subject}</h4>
                        </div>
                        <p className="text-[9px] font-mono text-slate-400 mt-1">
                          To: <span className="text-slate-350">{log.recipientEmail}</span> &middot; Code: <span className="text-indigo-400">{log.sku}</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-block bg-indigo-950 text-indigo-305 text-[8px] font-black uppercase font-mono px-2 py-0.5 rounded border border-indigo-900/60">
                          {log.status}
                        </span>
                        <p className="text-[9px] font-mono text-slate-500 mt-1">{log.dateTriggered}</p>
                      </div>
                    </div>

                    {/* Collapsible item telemetry details */}
                    {isActive && (
                      <div className="mt-4 pt-3.5 border-t border-slate-850 space-y-3 font-mono text-[10px] bg-slate-900/30 p-3 rounded-lg">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                          <div>
                            <p className="text-[8px] text-slate-550 uppercase">Catalog Item</p>
                            <p className="text-white font-sans mt-0.5 font-bold truncate">{log.itemName}</p>
                          </div>
                          <div>
                            <p className="text-[8px] text-slate-550 uppercase">Pre-alert Qty</p>
                            <p className="text-slate-300 mt-0.5">{log.previousStock} units</p>
                          </div>
                          <div>
                            <p className="text-[8px] text-slate-550 uppercase">Fell-to Qty</p>
                            <p className="text-rose-400 mt-0.5 font-black">{log.currentStock} units</p>
                          </div>
                          <div>
                            <p className="text-[8px] text-slate-550 uppercase">Alert Point</p>
                            <p className="text-indigo-300 mt-0.5">{log.reorderPoint} units</p>
                          </div>
                        </div>

                        <div className="mt-3">
                          <p className="text-[8px] text-slate-550 uppercase block mb-1">Formatted Output Body</p>
                          <pre className="text-[10px] text-slate-305 font-mono leading-relaxed bg-slate-950 p-3 border border-slate-850 rounded overflow-x-auto whitespace-pre-wrap text-left">
                            {log.body}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default EmailAlertsHub;
