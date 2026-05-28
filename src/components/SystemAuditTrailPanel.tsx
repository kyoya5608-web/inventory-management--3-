/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { PurchaseOrder, SalesOrder, InventoryTransaction, Item } from '../types';
import { 
  Search, 
  Database, 
  ShoppingCart, 
  Boxes, 
  TrendingUp, 
  Layers, 
  ChevronDown, 
  ExternalLink,
  SlidersHorizontal,
  FileCheck,
  History,
  Calendar,
  X,
  UserCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface SystemAuditTrailPanelProps {
  purchaseOrders: PurchaseOrder[];
  salesOrders: SalesOrder[];
  transactions: InventoryTransaction[];
  items: Item[];
  isSeparateWindow?: boolean;
}

interface AuditEvent {
  key: string;
  timestamp: string;
  id: string; // SO #, PO #, TX #
  module: 'Purchase Order' | 'Sales Order' | 'Catalog Item';
  activity: string;
  agent: string;
  details: string;
  badgeColor: string;
  meta?: any;
}

export default function SystemAuditTrailPanel({
  purchaseOrders = [],
  salesOrders = [],
  transactions = [],
  items = [],
  isSeparateWindow = false
}: SystemAuditTrailPanelProps) {
  // Navigation & Search Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState<'All' | 'Purchase Order' | 'Sales Order' | 'Catalog Item'>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visibleCount, setVisibleCount] = useState(30); // Lazy loading increments

  // Build a consolidated system audit log
  const consolidatedLogs: AuditEvent[] = useMemo(() => {
    const list: AuditEvent[] = [];

    // 1. Gather Catalog Items historical transactions
    transactions.forEach(tx => {
      const matchedItem = items.find(it => it.id === tx.itemId);
      const itemName = matchedItem ? matchedItem.name : tx.itemName || 'Unknown Component';
      const deltaText = tx.quantity > 0 ? `+${tx.quantity}` : `${tx.quantity}`;
      list.push({
        key: `tx-${tx.id}`,
        timestamp: tx.date || new Date().toISOString(),
        id: tx.referenceNumber || tx.id,
        module: 'Catalog Item',
        activity: `Stock ${tx.type}`,
        agent: 'Operational Planner',
        details: `${itemName} [SKU: ${tx.sku || 'N/A'}] - Quantity adjusted by ${deltaText}. Warehouse: ${tx.warehouseName || 'Node'}. Notes: ${tx.description || ''}`,
        badgeColor: 'bg-indigo-50 border-indigo-150 text-indigo-700',
        meta: { itemId: tx.itemId, type: tx.type }
      });
    });

    // 2. Gather Purchase Orders status history
    purchaseOrders.forEach(po => {
      if (po.statusHistory && po.statusHistory.length > 0) {
        po.statusHistory.forEach((hist, idx) => {
          list.push({
            key: `po-hist-${po.id}-${idx}`,
            timestamp: hist.date || po.orderDate,
            id: po.poNumber,
            module: 'Purchase Order',
            activity: `PO ${hist.status}`,
            agent: hist.user || 'Procurement Coordinator',
            details: `Purchase Contract with Vendor ${po.vendorName} updated. Status: ${hist.status}. Remarks: ${hist.note || po.notes || ''}`,
            badgeColor: 'bg-sky-50 border-sky-150 text-sky-700'
          });
        });
      } else {
        // Fallback placeholder event from orderDate
        list.push({
          key: `po-base-${po.id}`,
          timestamp: po.orderDate,
          id: po.poNumber,
          module: 'Purchase Order',
          activity: `PO Initialised`,
          agent: 'Asset Planner',
          details: `Opened procurement invoice for Vendor/Supplier ID: ${po.supplierId || po.vendorName}. Total subtotal: ₱${po.total.toLocaleString()}. Destination warehouse configured.`,
          badgeColor: 'bg-sky-50 border-sky-150 text-sky-700'
        });
      }
    });

    // 3. Gather Sales Orders status history
    salesOrders.forEach(so => {
      if (so.statusHistory && so.statusHistory.length > 0) {
        so.statusHistory.forEach((hist, idx) => {
          list.push({
            key: `so-hist-${so.id}-${idx}`,
            timestamp: hist.date || so.orderDate,
            id: so.soNumber,
            module: 'Sales Order',
            activity: `SO ${hist.status}`,
            agent: hist.user || 'Sales Specialist',
            details: `Sales Dispatch Order for ${so.customerName} transitioned state. Status: ${hist.status}. Notes: ${hist.note || so.notes || ''}. Heavy Serial linked: ${so.machineSerialNumber || 'None'}`,
            badgeColor: 'bg-emerald-50 border-emerald-150 text-emerald-700'
          });
        });
      } else {
        // Fallback placeholder event from orderDate
        list.push({
          key: `so-base-${so.id}`,
          timestamp: so.orderDate,
          id: so.soNumber,
          module: 'Sales Order',
          activity: `SO Ordered`,
          agent: 'Sales Lead',
          details: `Provisioned customer invoice for ${so.customerName}. Order billing focus: ${so.orderPurpose || 'Commercial'}. Gross volume total: ₱${so.total.toLocaleString()}`,
          badgeColor: 'bg-emerald-50 border-emerald-150 text-emerald-700'
        });
      }
    });

    // Sort chronologically (most recent first)
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [purchaseOrders, salesOrders, transactions, items]);

  // Search and Date Range filter matching
  const filteredEvents = useMemo(() => {
    return consolidatedLogs.filter(evt => {
      const matchModule = selectedModule === 'All' || evt.module === selectedModule;
      const matchSearch = searchTerm === '' ||
        (evt.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (evt.activity || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (evt.agent || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (evt.details || '').toLowerCase().includes(searchTerm.toLowerCase());

      // Date Range boundary check
      let matchDate = true;
      if (evt.timestamp) {
        const eventTime = new Date(evt.timestamp).getTime();
        if (startDate) {
          const start = new Date(startDate).setHours(0, 0, 0, 0);
          if (eventTime < start) matchDate = false;
        }
        if (endDate) {
          const end = new Date(endDate).setHours(23, 59, 59, 999);
          if (eventTime > end) matchDate = false;
        }
      }

      return matchModule && matchSearch && matchDate;
    });
  }, [consolidatedLogs, selectedModule, searchTerm, startDate, endDate]);

  // High-fidelity keyword highlighting helper
  const renderHighlightedText = (text: string, search: string) => {
    if (!search.trim()) return text;
    try {
      const regex = new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
      const parts = text.split(regex);
      return (
        <>
          {parts.map((part, i) => {
            const isMatch = part.toLowerCase() === search.toLowerCase();
            return isMatch ? (
              <mark key={i} className={`rounded-xs px-0.5 font-bold ${isSeparateWindow ? 'bg-amber-400 text-slate-950 font-extrabold' : 'bg-yellow-200 text-slate-950'}`}>
                {part}
              </mark>
            ) : (
              part
            );
          })}
        </>
      );
    } catch (e) {
      return text;
    }
  };

  // Lazy loading slice
  const pagedEvents = useMemo(() => {
    return filteredEvents.slice(0, visibleCount);
  }, [filteredEvents, visibleCount]);

  const loadMore = () => {
    setVisibleCount(prev => prev + 30);
  };

  const handleSeparateWindowOpen = () => {
    window.open('/?show_audit_window=true', '_blank', 'width=1100,height=750,resizable=yes');
  };

  return (
    <div className={`space-y-5 flex-1 flex flex-col ${isSeparateWindow ? 'p-6 bg-slate-900 min-h-screen text-slate-100' : ''}`}>
      {/* Audit Panel Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-100 pb-4 gap-4">
        <div>
          <h2 className={`text-md font-bold flex items-center gap-1.5 font-mono uppercase tracking-wider ${isSeparateWindow ? 'text-white' : 'text-slate-900'}`}>
            <History className="w-5 h-5 text-indigo-505" />
            System-Wide Compliance Audit Registry
          </h2>
          <p className={`text-xs ${isSeparateWindow ? 'text-slate-400' : 'text-gray-400'}`}>
            Real-time tracking of heavy machinery, equipment procurement logs, invoicing lifecycle, and raw warehouse adjustments.
          </p>
        </div>
        
        {!isSeparateWindow && (
          <button
            onClick={handleSeparateWindowOpen}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-black rounded-lg cursor-pointer transition-colors border border-slate-700 shadow-2xs"
            title="Pop out audit log to a separate browser window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open in Separate Window
          </button>
        )}
      </div>

      {/* KPI mini strips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`p-3 rounded-lg border ${isSeparateWindow ? 'bg-slate-800/60 border-slate-700/50' : 'bg-slate-50 border-slate-200/50'}`}>
          <span className="block text-[8.5px] uppercase font-bold text-gray-400 font-mono">Total System Logs</span>
          <span className={`text-sm font-black font-mono ${isSeparateWindow ? 'text-white' : 'text-slate-800'}`}>
            {consolidatedLogs.length} events
          </span>
        </div>
        <div className={`p-3 rounded-lg border ${isSeparateWindow ? 'bg-sky-950/20 border-sky-900/40' : 'bg-sky-50 border-sky-100'}`}>
          <span className="block text-[8.5px] uppercase font-bold text-sky-800 font-mono">Purchase Orders Logs</span>
          <span className={`text-sm font-black font-mono ${isSeparateWindow ? 'text-sky-305' : 'text-sky-700'}`}>
            {consolidatedLogs.filter(l => l.module === 'Purchase Order').length} events
          </span>
        </div>
        <div className={`p-3 rounded-lg border ${isSeparateWindow ? 'bg-emerald-950/20 border-emerald-900/40' : 'bg-emerald-50 border-emerald-100'}`}>
          <span className="block text-[8.5px] uppercase font-bold text-emerald-800 font-mono">Sales Orders Logs</span>
          <span className={`text-sm font-black font-mono ${isSeparateWindow ? 'text-emerald-305' : 'text-emerald-700'}`}>
            {consolidatedLogs.filter(l => l.module === 'Sales Order').length} events
          </span>
        </div>
        <div className={`p-3 rounded-lg border ${isSeparateWindow ? 'bg-indigo-950/20 border-indigo-900/40' : 'bg-indigo-50 border-indigo-100'}`}>
          <span className="block text-[8.5px] uppercase font-bold text-indigo-850 font-mono">Catalog / Adjustments</span>
          <span className={`text-sm font-black font-mono ${isSeparateWindow ? 'text-indigo-305' : 'text-indigo-700'}`}>
            {consolidatedLogs.filter(l => l.module === 'Catalog Item').length} events
          </span>
        </div>
      </div>

      {/* Interactive Command Center Filters */}
      <div className={`p-4 border rounded-xl space-y-3.5 shadow-xs ${isSeparateWindow ? 'bg-slate-800 border-slate-700/85' : 'bg-slate-50 border-slate-205'}`}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          {/* Search */}
          <div className="lg:col-span-5 relative">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider font-extrabold mb-1.5 font-mono">
              Keyword search & detail query
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setVisibleCount(30);
                }}
                placeholder="Search serials, PO/SO codes, items or operators..."
                className={`w-full text-xs pl-9 pr-3.5 py-1.5 focus:outline-hidden rounded-lg font-medium transition-colors ${
                  isSeparateWindow
                    ? 'bg-slate-900 border-slate-705 text-white placeholder-slate-500 focus:ring-1 focus:ring-slate-500'
                    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-indigo-500'
                }`}
              />
            </div>
          </div>

          {/* Module focus options */}
          <div className="lg:col-span-3">
            <label className="block text-[10px] text-slate-400 uppercase tracking-wider font-extrabold mb-1.5 font-mono">
              Module focus category
            </label>
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value as any);
                setVisibleCount(30);
              }}
              className={`w-full text-xs p-1.5 rounded-lg font-medium outline-hidden ${
                isSeparateWindow
                  ? 'bg-slate-900 border-slate-700 text-slate-150 focus:ring-1 focus:ring-slate-500'
                  : 'bg-white border-slate-200 text-slate-700 focus:ring-1 focus:ring-indigo-505'
              }`}
            >
              <option value="All">All Operations Logs</option>
              <option value="Purchase Order">Purchase Orders (POs)</option>
              <option value="Sales Order">Sales Orders (SOs)</option>
              <option value="Catalog Item">Catalog Items / Warehouse Stocks</option>
            </select>
          </div>

          {/* Date Pickers container */}
          <div className="lg:col-span-4 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider font-extrabold mb-1.5 font-mono">
                Since Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setVisibleCount(30);
                }}
                className={`w-full text-xs p-1 rounded-lg font-medium outline-hidden font-mono ${
                  isSeparateWindow
                    ? 'bg-slate-900 border-slate-705 text-slate-150 focus:ring-1 focus:ring-slate-500'
                    : 'bg-white border-slate-200 text-slate-700 focus:ring-1 focus:ring-indigo-505'
                }`}
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider font-extrabold mb-1.5 font-mono">
                Until Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setVisibleCount(30);
                }}
                className={`w-full text-xs p-1 rounded-lg font-medium outline-hidden font-mono ${
                  isSeparateWindow
                    ? 'bg-slate-900 border-slate-705 text-slate-150 focus:ring-1 focus:ring-slate-500'
                    : 'bg-white border-slate-200 text-slate-700 focus:ring-1 focus:ring-indigo-505'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Filter Badge indicator & matching records counts section */}
        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-dashed border-slate-300 text-[10.5px]">
          <div className="flex flex-wrap items-center gap-1.5 py-1">
            <span className="text-slate-400 font-mono text-[9px] uppercase font-bold">Filters:</span>
            {searchTerm && (
              <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-800 px-2 py-0.5 rounded-xs font-semibold text-[10px] font-mono">
                Search: "{searchTerm}"
              </span>
            )}
            {selectedModule !== 'All' && (
              <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-xs font-semibold text-[10px] font-mono">
                Module: {selectedModule}
              </span>
            )}
            {(startDate || endDate) && (
              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-805 px-2 py-0.5 rounded-xs font-semibold text-[10px] font-mono">
                Range: {startDate || 'Start'} to {endDate || 'Today'}
              </span>
            )}
            {!searchTerm && selectedModule === 'All' && !startDate && !endDate && (
              <span className="text-slate-400 italic text-[10px]">No active overrides</span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-slate-400 font-mono text-[10px]">
              Matching records: <span className="font-extrabold text-indigo-650">{filteredEvents.length}</span> / {consolidatedLogs.length}
            </span>
            {(startDate || endDate || searchTerm || selectedModule !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedModule('All');
                  setStartDate('');
                  setEndDate('');
                  setVisibleCount(30);
                }}
                className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-600 hover:text-rose-500 active:text-rose-700 transition-colors font-mono uppercase cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dense Auditing Ledger Table (Compact and High Scrollability) */}
      <div className={`border rounded-xl overflow-hidden shadow-xs ${isSeparateWindow ? 'bg-slate-950 border-slate-800' : 'bg-white border-gray-150'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[10.5px]">
            <thead>
              <tr className={`border-b font-extrabold uppercase tracking-wider text-[9.5px] ${isSeparateWindow ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-gray-55/65 border-gray-150 text-gray-500'}`}>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Referencing Doc ID</th>
                <th className="px-4 py-3">Operating Module</th>
                <th className="px-4 py-3">Transaction Delta / Status</th>
                <th className="px-4 py-3">Operator agent</th>
                <th className="px-4 py-3 min-w-[340px]">Audit Statement Detail</th>
              </tr>
            </thead>
            <tbody className={`divide-y text-[11px] ${isSeparateWindow ? 'divide-slate-800/80 text-slate-300' : 'divide-gray-100 text-gray-700'}`}>
              {pagedEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-1.5 italic font-mono">
                      <AlertCircle className="w-6 h-6 text-gray-300" />
                      <span>No historical audit trail matches current search constraints.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedEvents.map((evt) => (
                  <tr key={evt.key} className={`${isSeparateWindow ? 'hover:bg-slate-900/60' : 'hover:bg-slate-50/20'}`}>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(evt.timestamp).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className={`px-4 py-3 font-extrabold ${isSeparateWindow ? 'text-indigo-400' : 'text-indigo-700'}`}>
                      {evt.id}
                    </td>
                    <td className="px-4 py-3 capitalize">
                      <span className={`inline-block px-2 py-0.5 rounded-sm text-[9.5px] font-bold border border-current ${evt.badgeColor}`}>
                        {evt.module}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{evt.activity}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-sans">
                      {evt.agent}
                    </td>
                    <td className="px-4 py-3 font-sans font-medium leading-relaxed">
                      {renderHighlightedText(evt.details, searchTerm)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Lazy load incremental trigger bar */}
        {filteredEvents.length > visibleCount && (
          <div className={`p-3.5 border-t text-center ${isSeparateWindow ? 'border-slate-800 bg-slate-900/50' : 'border-gray-100 bg-gray-50/40'}`}>
            <button
              onClick={loadMore}
              className="px-5 py-2 bg-indigo-650 hover:bg-indigo-700 text-white text-[10.5px] font-black rounded-lg cursor-pointer transition-colors shadow-3xs hover:opacity-95"
            >
              Lazy Loads Trigger - View More Audit Rows ({filteredEvents.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
