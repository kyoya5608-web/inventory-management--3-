/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { Item, Warehouse, PurchaseOrder, SalesOrder, InventoryTransaction, Supplier } from '../types';
import { 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  ShoppingBag, 
  Building2, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw, 
  ClipboardList, 
  ArrowRightLeft,
  DollarSign,
  Activity,
  ChevronRight,
  Boxes,
  Scan,
  Camera,
  X,
  Search,
  Grid,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { Treemap as RechartsTreemap, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

// Custom SVG block cell for the Recharts Treemap component
const CustomTreemapNode = (props: any) => {
  const { x, y, width, height, index, name, value } = props;
  const colors = ['#6366F1', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#F59E0B'];
  const fill = colors[index % colors.length];

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill,
          stroke: '#fff',
          strokeWidth: 1.5,
          strokeOpacity: 0.9,
        }}
      />
      {width > 60 && height > 35 && (
        <text
          x={x + 8}
          y={y + 18}
          fill="#fff"
          fontSize="11px"
          fontWeight="bold"
          className="font-sans select-none"
        >
          {name}
        </text>
      )}
      {width > 70 && height > 50 && (
        <text
          x={x + 8}
          y={y + 34}
          fill="#ffffffd0"
          fontSize="10px"
          fontWeight="medium"
          className="font-mono select-none"
        >
          ₱{Math.round(value).toLocaleString()}
        </text>
      )}
    </g>
  );
};

// Custom interactive tooltip description popup on node hover
const CustomTreemapTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-slate-100 border border-slate-800 p-2.5 rounded-lg shadow-xl text-left font-mono text-xs">
        <p className="font-bold text-indigo-400 font-sans">{data.name}</p>
        <p className="mt-1">
          Capital Valuation: <span className="text-emerald-400 font-bold">₱{Math.round(data.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </p>
        <p className="text-[10px] text-slate-400">
          In-Stock Volume: {data.size.toLocaleString()} active units
        </p>
      </div>
    );
  }
  return null;
};

// Custom interactive tooltip description popup on bar chart hover
const CustomBarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-950 text-slate-100 border border-slate-800 p-3.5 rounded-xl shadow-2xl text-left font-sans text-xs space-y-1.5 min-w-[220px]">
        <p className="font-bold text-blue-400 text-[12px]">{data.name}</p>
        <p className="text-[10px] text-slate-450 font-mono tracking-wider">SKU: <span className="text-white font-bold">{data.sku}</span></p>
        <div className="border-t border-slate-800/80 pt-2 mt-1.5 space-y-1 font-mono text-[11px]">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Current Stock:</span> 
            <span className="text-blue-400 font-extrabold">{data.stock.toLocaleString()} units</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Reorder Threshold:</span> 
            <span className="text-slate-350 font-extrabold">{data.reorderPoint.toLocaleString()} units</span>
          </div>
          <div className="flex justify-between items-center border-t border-slate-800/60 pt-1.5 mt-1">
            <span className="text-slate-400">Absolute Gap:</span> 
            <span className="text-amber-400 font-black">{Math.abs(data.stock - data.reorderPoint).toLocaleString()} units</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Proximity Ratio:</span> 
            <span className={`font-black ${data.stock < data.reorderPoint ? 'text-rose-400 animate-pulse' : 'text-blue-300'}`}>
              {data.percentGap.toFixed(1)}% gap
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

interface DashboardProps {
  items: Item[];
  warehouses: Warehouse[];
  purchaseOrders: PurchaseOrder[];
  salesOrders: SalesOrder[];
  transactions: InventoryTransaction[];
  onNavigate: (tab: string, filter?: string) => void;
  suppliers?: Supplier[];
  onOpenScanner?: () => void;
}

export default function Dashboard({
  items,
  warehouses,
  purchaseOrders,
  salesOrders,
  transactions,
  onNavigate,
  suppliers = [],
  onOpenScanner
}: DashboardProps) {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('All');
  const [showForexDetails, setShowForexDetails] = useState(false);

  // Barcode / Scanner States
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scannedItem, setScannedItem] = useState<Item | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanQuery, setScanQuery] = useState('');
  const [scannerFeedback, setScannerFeedback] = useState('');
  const [scanHistory, setScanHistory] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('inv_scan_history');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Heatmap interactive state
  const [hoveredHeatmapItemId, setHoveredHeatmapItemId] = useState<string | null>(null);
  const [activeHeatmapItem, setActiveHeatmapItem] = useState<Item | null>(null);

  const startCamera = async () => {
    setCameraError(null);
    setScannedItem(null);
    setScannerFeedback('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => {
          console.warn("Video failed to auto-play:", err);
        });
      }
    } catch (err: any) {
      console.warn("Camera init failed:", err);
      setCameraError(
        err.name === 'NotAllowedError' 
          ? 'Access Blocked: Please enable camera/microphone frame permissions in your secure browser settings.' 
          : `Live camera stream is unavailable (${err.message || 'permission denied'}).`
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleBarcodeLookup = (code: string) => {
    const val = code.trim().toLowerCase();
    if (!val) return;
    
    // Find item with matching SKU or sub-properties
    const found = items.find(
      it => it.sku.toLowerCase() === val || 
            it.name.toLowerCase().includes(val) ||
            (it.applicableUnits || '').toLowerCase().includes(val)
    );

    if (found) {
      setScannedItem(found);
      setScannerFeedback(`Success: Located matching asset sku [${found.sku}]`);
      
      const totalStock = Object.values(found.stockByWarehouse || {}).reduce((s, q) => s + q, 0);
      const newEntry = {
        id: `scan-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        itemId: found.id,
        sku: found.sku,
        name: found.name,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        brand: found.brand,
        category: found.category,
        stockLevel: totalStock,
        reorderPoint: found.reorderPoint,
        unit: found.unit
      };

      setScanHistory(prev => {
        // Avoid duplicate consecutive entries for the same item to keep the log tidy
        if (prev.length > 0 && prev[0].itemId === found.id) {
          return prev;
        }
        const updated = [newEntry, ...prev].slice(0, 15);
        try {
          localStorage.setItem('inv_scan_history', JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });
    } else {
      setScannedItem(null);
      setScannerFeedback(`No records matching "${code}" in active catalogs.`);
    }
  };

  // Calculates total stock for an item in all or a specific warehouse
  const getItemStockForWarehouse = (item: Item, whId: string) => {
    if (whId === 'All') {
      return Object.values(item.stockByWarehouse || {}).reduce((s, q) => s + q, 0);
    }
    return item.stockByWarehouse?.[whId] || 0;
  };

  // Compute stats based on chosen warehouse
  const stats = useMemo(() => {
    let skuCount = 0;
    let totalStockUnits = 0;
    let totalAssetValuation = 0; // standard valuation (selling)
    let totalCostValuation = 0;   // expense valuation (cost - converted to PHP)
    const costValuationByCurrency: Record<string, { currency: string; rawCost: number; convertedPHP: number }> = {};
    let lowStockCount = 0;

    items.forEach(item => {
      if (item.status !== 'Active') return;
      skuCount++;
      const itemStock = getItemStockForWarehouse(item, selectedWarehouseId);
      totalStockUnits += itemStock;
      totalAssetValuation += itemStock * item.sellingPrice;
      
      // Multi-currency calculation
      const itemSupplier = suppliers?.find(sup => sup.id === item.supplierId);
      const exchangeRate = itemSupplier?.exchangeRate ?? 1.0;
      const currency = itemSupplier?.currency ?? 'PHP';
      
      const rawCostTotal = itemStock * item.purchasePrice;
      const convertedCostTotal = itemStock * item.purchasePrice * exchangeRate;
      
      totalCostValuation += convertedCostTotal;
      
      if (itemStock > 0) {
        if (!costValuationByCurrency[currency]) {
          costValuationByCurrency[currency] = { currency, rawCost: 0, convertedPHP: 0 };
        }
        costValuationByCurrency[currency].rawCost += rawCostTotal;
        costValuationByCurrency[currency].convertedPHP += convertedCostTotal;
      }

      // Low stock check
      if (itemStock < item.reorderPoint) {
        lowStockCount++;
      }
    });

    // Active PO count
    const activePOs = purchaseOrders.filter(po => 
      po.status !== 'Received' && po.status !== 'Cancelled' &&
      (selectedWarehouseId === 'All' || po.warehouseId === selectedWarehouseId)
    ).length;

    // Active SO count
    const activeSOs = salesOrders.filter(so => 
      so.status !== 'Received' && so.status !== 'Cancelled' &&
      (selectedWarehouseId === 'All' || so.warehouseId === selectedWarehouseId)
    ).length;

    return {
      skuCount,
      totalStockUnits,
      totalAssetValuation,
      totalCostValuation,
      costValuationByCurrency,
      lowStockCount,
      activePOs,
      activeSOs
    };
  }, [items, selectedWarehouseId, purchaseOrders, salesOrders, suppliers]);

  // Low stock alert list
  const lowStockItemsList = useMemo(() => {
    return items
      .filter(item => item.status === 'Active')
      .map(item => {
        const stock = getItemStockForWarehouse(item, selectedWarehouseId);
        return { item, stock };
      })
      .filter(entry => entry.stock < entry.item.reorderPoint)
      .sort((a,b) => a.stock - b.stock)
      .slice(0, 5);
  }, [items, selectedWarehouseId]);

  // Top 5 SKUs closest to their reorder point, showing both current stock level and the reorder limit
  const reorderClosenessList = useMemo(() => {
    return items
      .filter(item => item.status === 'Active' && item.reorderPoint > 0)
      .map(item => {
        const stock = getItemStockForWarehouse(item, selectedWarehouseId);
        const gap = Math.abs(stock - item.reorderPoint);
        const percentGap = (gap / item.reorderPoint) * 100;
        return {
          id: item.id,
          name: item.name,
          sku: item.sku,
          stock,
          reorderPoint: item.reorderPoint,
          gap,
          percentGap
        };
      })
      .sort((a, b) => a.percentGap - b.percentGap) // Sort by percent gap to get high-accuracy closeness
      .slice(0, 5);
  }, [items, selectedWarehouseId]);

  // Breakdown of stock by category
  const categoriesBreakdown = useMemo(() => {
    const counts: Record<string, { value: number; units: number }> = {};
    items.forEach(item => {
      if (item.status !== 'Active') return;
      const stock = getItemStockForWarehouse(item, selectedWarehouseId);
      if (!counts[item.category]) {
        counts[item.category] = { value: 0, units: 0 };
      }
      counts[item.category].value += stock * item.sellingPrice;
      counts[item.category].units += stock;
    });

    return Object.entries(counts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [items, selectedWarehouseId]);

  // Breakdown of stock by warehouses
  const warehouseBreakdown = useMemo(() => {
    return warehouses
      .filter(w => w.status === 'Active')
      .map(w => {
        let totalUnits = 0;
        let totalVal = 0;
        items.forEach(item => {
          const qty = item.stockByWarehouse?.[w.id] || 0;
          totalUnits += qty;
          totalVal += qty * item.sellingPrice;
        });
        return {
          id: w.id,
          name: w.name,
          code: w.code,
          units: totalUnits,
          value: totalVal
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [items, warehouses]);

  // Recent transactions stream
  const recentActivity = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [transactions]);

  // Low stock counts adjusted for incoming PO and outgoing SO commitments
  const adjustedLowStockCount = useMemo(() => {
    let count = 0;
    items.forEach(item => {
      if (item.status !== 'Active') return;
      const stock = getItemStockForWarehouse(item, selectedWarehouseId);
      
      const incoming = purchaseOrders
        .filter(po => (po.status === 'Issued' || po.status === 'In Transit') && (selectedWarehouseId === 'All' || po.warehouseId === selectedWarehouseId))
        .reduce((sum, po) => {
          const m = po.items?.find((it: any) => it.itemId === item.id);
          return sum + (m?.quantity || 0);
        }, 0);

      const outgoing = salesOrders
        .filter(so => (so.status === 'Confirmed' || so.status === 'On Going') && (selectedWarehouseId === 'All' || so.warehouseId === selectedWarehouseId))
        .reduce((sum, so) => {
          const m = so.items?.find((it: any) => it.itemId === item.id);
          return sum + (m?.quantity || 0);
        }, 0);

      const netStock = stock + incoming - outgoing;
      if (netStock < item.reorderPoint) {
        count++;
      }
    });
    return count;
  }, [items, selectedWarehouseId, purchaseOrders, salesOrders]);

  // Treemap data: Total cost valuation in PHP categorized by 'category'
  const costValuationBreakdownOfCategory = useMemo(() => {
    const valMap: Record<string, { name: string; value: number; size: number }> = {};
    
    items.forEach(item => {
      // We only consider active products
      if (item.status !== 'Active') return;
      
      const itemStock = getItemStockForWarehouse(item, selectedWarehouseId);
      if (itemStock <= 0) return;
      
      const itemSupplier = suppliers?.find(sup => sup.id === item.supplierId);
      const exchangeRate = itemSupplier?.exchangeRate ?? 1.0;
      const totalCostPHP = itemStock * (item.purchasePrice || 0) * exchangeRate;
      
      if (totalCostPHP > 0) {
        const cat = item.category || 'Spare Parts';
        if (!valMap[cat]) {
          valMap[cat] = { name: cat, value: 0, size: 0 };
        }
        valMap[cat].value += totalCostPHP;
        valMap[cat].size += itemStock;
      }
    });

    return Object.values(valMap)
      .sort((a, b) => b.value - a.value);
  }, [items, selectedWarehouseId, suppliers]);

  // Dynamic visual charts drawing calculations
  const categoryMaxVal = Math.max(...categoriesBreakdown.map(c => c.value), 1);
  const warehouseMaxVal = Math.max(...warehouseBreakdown.map(w => w.value), 1);

  return (
    <div className="space-y-6" id="dashboard-portal-view">
      {/* HEADER BAR AND WAREHOUSE CONTROLLER */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6 text-indigo-650" />
            Equiprime Inventory Portal
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Real-time multisite monitoring & logistics management dashboard
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="text-slate-600 text-xs font-semibold whitespace-nowrap flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            Logistics Site:
          </label>
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="w-full md:w-56 text-xs bg-white text-slate-800 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-505/50"
            id="warehouse-select-dashboard"
          >
            <option value="All">All Sites (Consolidated)</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* METRIC RIBBON */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" id="kpi-ribbon">
        {/* Metric 1 */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs hover:border-indigo-500/30 transition-all flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-slate-500 text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold font-mono">Consolidated Valuation</p>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-800 mt-2 break-words select-all" title={`₱${stats.totalAssetValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
                  ₱{stats.totalAssetValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-505 mt-1 break-words" title={`Cost Basis (PHP): ₱${stats.totalCostValuation.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}>
                  Cost Basis: <span className="font-semibold text-slate-700">₱{stats.totalCostValuation.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </p>
              </div>
              <div className="p-2.5 bg-indigo-500/10 text-indigo-650 rounded-lg flex-shrink-0 ml-2">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            {/* Supplier Currency Valuations - Floating Dropdown Mode */}
            {stats.costValuationByCurrency && Object.keys(stats.costValuationByCurrency).length > 0 && (
              <div className="relative mt-2.5 z-30">
                <button
                  type="button"
                  onClick={() => setShowForexDetails(!showForexDetails)}
                  className="text-[10px] text-indigo-650 hover:text-indigo-800 font-bold flex items-center gap-1 focus:outline-none transition-colors border border-indigo-100 bg-indigo-50/50 py-0.5 px-2 rounded-md hover:bg-indigo-50"
                  title="Click to toggle currency basis valuation breakdown"
                >
                  <span>Forex Breakdown</span>
                  <span className={`transform transition-transform text-[8px] duration-200 ${showForexDetails ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {showForexDetails && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowForexDetails(false)} />
                    <div className="absolute left-0 mt-1.5 w-56 bg-slate-900 border border-slate-800 text-slate-100 p-3 rounded-lg shadow-xl z-40 animate-in fade-in slide-in-from-top-1 duration-150">
                      <span className="text-[9px] font-bold text-indigo-400 block font-mono uppercase tracking-wider mb-2 pb-1 border-b border-slate-800">
                        Cost by Supplier Currency
                      </span>
                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto font-mono text-[10px]">
                        {Object.values(stats.costValuationByCurrency).map(({ currency, rawCost, convertedPHP }) => (
                          <div key={currency} className="flex justify-between items-start gap-1 py-0.5 leading-snug">
                            <span className="text-slate-400 font-medium">{currency}:</span>
                            <span className="text-white font-bold text-right">
                              {currency === 'PHP' ? '₱' : currency + ' '}{rawCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              {currency !== 'PHP' && (
                                <span className="text-[9px] text-indigo-300 font-normal block">
                                  (₱{convertedPHP.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs hover:border-emerald-500/30 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold font-mono">Logistics Physical Stock</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-2">
                {stats.totalStockUnits.toLocaleString()}
              </h3>
              <p className="text-[11px] text-emerald-600 flex items-center gap-1 mt-1">
                <span className="font-bold">{stats.skuCount}</span> active Catalog SKUs
              </p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <Package className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs hover:border-amber-500/30 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-550 text-[11px] uppercase tracking-wider font-semibold font-mono">Reorder Point Alerts</p>
              <h3 className={`text-2xl font-bold mt-2 ${stats.lowStockCount > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-750'}`}>
                {stats.lowStockCount}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 font-mono">
                SKUs falling below alert limits
              </p>
              <p className="text-[10px] text-rose-600 font-bold mt-1 font-mono">
                Adjusted for PO/SO: {adjustedLowStockCount} SKUs
              </p>
            </div>
            <div className={`p-2.5 rounded-lg ${stats.lowStockCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-550'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Metric 4: Low Stock Reorder Items (Interactive One-click Navigation Card) */}
        <div 
          onClick={() => onNavigate('items', 'Low Stock')}
          className="bg-amber-50/55 hover:bg-amber-100/40 border border-amber-200 hover:border-amber-450 p-5 rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
          title="Click to view all items currently below their reorder point in the catalog"
          id="reorder-point-interactive-card"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-amber-400/5 to-transparent rounded-bl-full pointer-events-none" />
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-amber-850 text-[11px] uppercase tracking-wider font-extrabold font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                Reorder Queue
              </p>
              <h3 className="text-2xl font-black text-amber-900 mt-2 flex items-baseline gap-1 font-mono">
                {stats.lowStockCount}
                <span className="text-[10px] text-amber-700 font-normal">SKUs</span>
              </h3>
              <p className="text-[10px] text-amber-800 font-bold mt-1 font-mono">
                Needs Immediate Restock
              </p>
              <div className="mt-2 text-[10.5px] font-black text-indigo-700 group-hover:underline flex items-center gap-0.5">
                <span>View Low Stock List ➔</span>
              </div>
            </div>
            <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-lg group-hover:scale-115 transition-transform">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Metric 5 */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs hover:border-sky-500/30 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold font-mono">Pending Commitments</p>
              <h3 className="text-2xl font-bold text-slate-850 mt-2">
                {stats.activePOs + stats.activeSOs}
              </h3>
              <p className="text-[11px] text-sky-600 flex items-center gap-2 mt-1 font-mono">
                <span>Inbound POs: {stats.activePOs}</span>
                <span className="text-slate-350">|</span>
                <span className="text-indigo-600">Outbound SOs: {stats.activeSOs}</span>
              </p>
            </div>
            <div className="p-2.5 bg-sky-100 text-sky-655 rounded-lg">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* CONSOLIDATED LOGISTICS STOCK HEALTH HEATMAP MATRIX */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-150 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 tracking-tight">
              <Grid className="w-5 h-5 text-indigo-650" />
              Consolidated Stock Health & Web Site Density Heatmap
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Faceted visualization of spatial warehouse utilization coordinates and individual SKU reserve depletion warning grids.
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono shrink-0 text-slate-600">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Well-Stocked</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-400" /> Near Reorder Level</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-rose-500" /> Critical Alert</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Warehouse capacity density grid */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <h4 className="text-xs font-bold font-mono uppercase text-indigo-700 tracking-wider">📍 Site Capacity Density Audits</h4>
              <p className="text-[10.5px] text-slate-500 mt-0.5">Physical volumetric footprint vs registered limits.</p>
            </div>

            <div className="space-y-3.5">
              {warehouses.map(wh => {
                // Calculate actual items stocked in this warehouse
                const occupiedStock = items.reduce((sum, item) => sum + (item.stockByWarehouse?.[wh.id] || 0), 0);
                const maxCap = wh.maxCapacity || 1000;
                const fillPercent = Math.min(100, Math.round((occupiedStock / maxCap) * 100));

                let densityColor = 'bg-emerald-500';
                let densityText = 'Optimal Room';
                let borderTheme = 'border-slate-200';
                if (fillPercent >= 85) {
                  densityColor = 'bg-rose-500';
                  densityText = 'Critical Footprint';
                  borderTheme = 'border-rose-300 animate-pulse bg-rose-50/10';
                } else if (fillPercent >= 55) {
                  densityColor = 'bg-amber-400';
                  densityText = 'Approaching Grid Cap';
                  borderTheme = 'border-amber-300 bg-amber-50/10';
                }

                return (
                  <div key={wh.id} className={`p-4 bg-slate-50/80 rounded-xl border ${borderTheme} space-y-3`}>
                    <div className="flex justify-between items-baseline">
                      <div>
                        <span className="text-xs font-bold text-slate-850 block truncate">{wh.name}</span>
                        <span className="text-[10px] text-slate-505 block mt-0.5 font-mono">CODE: {wh.code} • Status: {wh.status}</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded ${
                          fillPercent >= 85 ? 'bg-rose-100 text-rose-700' :
                          fillPercent >= 55 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {densityText}
                        </span>
                      </div>
                    </div>

                    {/* Progress tracking indicator bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-slate-500">
                        <span>Used: <b>{occupiedStock.toLocaleString()}</b> / {maxCap.toLocaleString()} {items[0]?.unit || 'pcs'}</span>
                        <span className="font-bold">{fillPercent}%</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden border border-slate-300">
                        <div 
                           className={`h-full rounded-full transition-all duration-500 ${densityColor}`} 
                          style={{ width: `${fillPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* DEFRAGMENTATION GRID MODULE Representing physical sectors */}
                    <div className="grid grid-cols-10 gap-1 pt-1">
                      {Array.from({ length: 10 }).map((_, idx) => {
                        const threshold = (idx + 1) * 10;
                        const isSustained = fillPercent >= threshold;
                        return (
                          <div 
                            key={idx} 
                            title={`Sector ${idx + 1}: ${isSustained ? 'Allocated' : 'Available'}`}
                            className={`h-2.5 rounded-xs transition-colors duration-200 ${
                              isSustained 
                                ? fillPercent >= 85 ? 'bg-rose-500' : fillPercent >= 55 ? 'bg-amber-400' : 'bg-emerald-500' 
                                : 'bg-slate-200 border border-slate-300'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: SKU Stock Health Level Contribution-style Grid */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex justify-between items-baseline">
              <div>
                <h4 className="text-xs font-bold font-mono uppercase text-indigo-700 tracking-wider">🎯 Catalog SKU Health Coordinates</h4>
                <p className="text-[10.5px] text-slate-500 mt-0.5">Click any block coordinates cell to review and inspect full SKU stock metrics.</p>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Viewing {items.length} Product SKUs</span>
            </div>

            {/* Continuous contributions graph representation */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <div className="flex flex-wrap gap-1.5 justify-start">
                {items.map((item) => {
                  const stock = getItemStockForWarehouse(item, selectedWarehouseId);
                  const isBelowReorder = stock < item.reorderPoint;
                  const isApproaching = stock < item.reorderPoint * 1.5 && stock >= item.reorderPoint;
                  
                  let blockBg = 'bg-emerald-500 hover:ring-2 hover:ring-emerald-300 text-white';
                  if (stock === 0) {
                    blockBg = 'bg-rose-200 border border-rose-300 hover:ring-2 hover:ring-rose-400 text-rose-800';
                  } else if (isBelowReorder) {
                    blockBg = 'bg-rose-500 hover:ring-2 hover:ring-rose-300 animate-pulse text-white';
                  } else if (isApproaching) {
                    blockBg = 'bg-amber-400 hover:ring-2 hover:ring-amber-200 text-slate-900';
                  }

                  const isActiveSelected = activeHeatmapItem?.id === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setHoveredHeatmapItemId(item.id)}
                      onClick={() => setActiveHeatmapItem(item)}
                      className={`w-6 h-6 rounded flex items-center justify-center font-mono text-[9px] font-bold transition-all cursor-pointer ${blockBg} ${
                        isActiveSelected ? 'ring-2 ring-slate-800 scale-110 z-10' : ''
                      }`}
                      title={`${item.sku}: ${item.name} (Qty: ${stock})`}
                    >
                      {item.sku.substring(Math.max(0, item.sku.length - 2))}
                    </button>
                  );
                })}
              </div>

              {/* DYNAMIC ITEM DETAIL RETRIEVES INTERACTIVE PANEL */}
              <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-3 min-h-[90px] flex flex-col justify-center">
                {(() => {
                  // Prioritize click state, fallback to hover, fallback to default hint
                  const activeId = activeHeatmapItem?.id || hoveredHeatmapItemId;
                  const currentItem = items.find(it => it.id === activeId);

                  if (!currentItem) {
                    return (
                      <div className="text-center text-slate-500 text-xs py-3 font-mono">
                        💡 Hover or select/click any SKU square coordinate cell above to load immediate structural telemetry analysis.
                      </div>
                    );
                  }

                  const itemStock = getItemStockForWarehouse(currentItem, selectedWarehouseId);
                  const healthStateText = itemStock === 0 ? 'CRITICAL DEPLETED (0 Qty)' :
                    itemStock < currentItem.reorderPoint ? 'FAIL: Below Reorder Point' :
                    itemStock < currentItem.reorderPoint * 1.5 ? 'WARNING: Low Threshold Warning' : 'HEALTHY: Well Stocked';

                  const healthTextColor = itemStock === 0 ? 'text-rose-600 font-bold' :
                    itemStock < currentItem.reorderPoint ? 'text-rose-500 font-bold animate-pulse' :
                    itemStock < currentItem.reorderPoint * 1.5 ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold';

                  return (
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-1 text-left">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 font-mono">
                            SKU File: {currentItem.sku} {activeHeatmapItem?.id === currentItem.id ? '📍 PINNED' : ''}
                          </span>
                          <h5 className="text-xs font-bold text-slate-850">{currentItem.name}</h5>
                          <span className="text-[9.5px] font-mono text-slate-500">Brand: {currentItem.brand || 'Generic'} • {currentItem.category}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-[10px] font-mono whitespace-nowrap block ${healthTextColor}`}>
                            {healthStateText}
                          </span>
                        </div>
                      </div>

                      {/* Storage breakdown details */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 uppercase font-mono text-[9.5px] text-slate-500 border-t border-slate-200 text-left">
                        <div>
                          <span>Consolidated: </span>
                          <strong className="text-slate-800 block">{itemStock} {currentItem.unit}</strong>
                        </div>
                        <div>
                          <span>Reorder Level: </span>
                          <strong className="text-slate-800 block">{currentItem.reorderPoint} {currentItem.unit}</strong>
                        </div>
                        <div>
                          <span>Purchase Price: </span>
                          <strong className="text-slate-800 block">₱{currentItem.purchasePrice.toFixed(2)}</strong>
                        </div>
                        <div>
                          <span>Selling Pricing: </span>
                          <strong className="text-slate-800 block">₱{currentItem.sellingPrice.toFixed(2)}</strong>
                        </div>
                      </div>

                      {/* Display breakdown per warehouse sites and an explicit lookup link */}
                      {activeHeatmapItem?.id === currentItem.id && (
                        <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-[9px] font-mono">
                          <div className="flex gap-2 text-slate-500 truncate max-w-sm">
                            {warehouses.map(w => (
                              <span key={w.id} className="bg-slate-100 border border-slate-200 text-slate-700 tracking-tight select-none px-1 py-0.5 rounded truncate">
                                📍 {w.code}: {currentItem.stockByWarehouse?.[w.id] || 0}
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={() => onNavigate('items')}
                            className="bg-indigo-600 hover:bg-indigo-700 text-[9.5px] text-white px-2.5 py-1 rounded-sm select-none font-bold whitespace-nowrap transition-colors"
                          >
                            Explore Timeline Logs →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

            </div>
          </div>
        </div>
      </div>
      {/* DETAILED STATS BENTO BANNERS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ALLOCATION BY CATEGORY (Chart Panel 1) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-650" />
              Asset Value by Category
            </h3>
            <p className="text-slate-505 text-[11px] mt-1">High value segments in the active warehouse selection</p>
            
            <div className="space-y-4 mt-6 text-left">
              {categoriesBreakdown.length === 0 ? (
                <p className="text-slate-500 text-xs italic text-center py-10">No stock allocated to any categories.</p>
              ) : (
                categoriesBreakdown.map((cat, idx) => {
                  const percent = (cat.value / categoryMaxVal) * 100;
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-700 font-medium">{cat.name}</span>
                        <span className="text-indigo-600 font-mono font-bold">₱{cat.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-650 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>{cat.units.toLocaleString()} active units</span>
                        <span>{((cat.value / Math.max(stats.totalAssetValuation, 1)) * 100).toFixed(0)}% share</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <button 
            onClick={() => onNavigate('items')}
            className="w-full text-center py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs mt-6 border border-slate-200 hover:border-slate-300 font-medium flex items-center justify-center gap-1 cursor-pointer transition-all"
          >
            Manage Product Catalog
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* DISTRIBUTION BY SITE (Chart Panel 2) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-650" />
              Warehouse Allocation Breakdown
            </h3>
            <p className="text-slate-505 text-[11px] mt-1">Physical stock load distribution across operating hubs</p>

            <div className="space-y-4 mt-6 text-left">
              {warehouseBreakdown.length === 0 ? (
                <p className="text-slate-500 text-xs italic text-center py-10">No active warehouses setup.</p>
              ) : (
                warehouseBreakdown.map((wh, idx) => {
                  const percent = (wh.value / warehouseMaxVal) * 100;
                  return (
                    <div key={idx} className="space-y-1.5" onClick={() => setSelectedWarehouseId(wh.id)}>
                      <div className="flex justify-between text-xs cursor-pointer group">
                        <span className="text-slate-700 group-hover:text-emerald-700 transition-colors font-medium">{wh.name} ({wh.code})</span>
                        <span className="text-emerald-600 font-mono font-bold">₱{wh.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>{wh.units.toLocaleString()} physical units</span>
                        <span>{((wh.value / Math.max(stats.totalAssetValuation, 1)) * 100).toFixed(0)}% workload</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <button 
            onClick={() => onNavigate('warehouses')}
            className="w-full text-center py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs mt-6 border border-slate-200 hover:border-slate-300 font-medium flex items-center justify-center gap-1 cursor-pointer transition-all"
          >
            Inspect Warehouse Settings
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* LOW STOCK CRITICAL ALERT LIST */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
              Critical Reorder Levels
            </h3>
            <p className="text-slate-500 text-[11px] mt-1">Immediate action recommended to prevent stocking gaps</p>

            <div className="space-y-3 mt-6 text-left">
              {lowStockItemsList.length === 0 ? (
                <div className="py-8 text-center space-y-1">
                  <div className="text-emerald-600 text-lg font-bold">✓ 100% Secure</div>
                  <p className="text-slate-500 text-xs text-center px-4">All SKU inventory counts reside safely above established reorder trigger levels.</p>
                </div>
              ) : (
                lowStockItemsList.map(({ item, stock }) => {
                  return (
                    <div key={item.id} className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg flex items-center justify-between gap-2 hover:bg-slate-100 transition-colors">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">{item.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                          <span className="bg-slate-200 text-slate-700 px-1 rounded font-bold">{item.sku}</span>
                          <span>Reorder Pt: {item.reorderPoint}</span>
                        </div>
                      </div>
                      <div className="text-right whitespace-nowrap min-w-[70px]">
                        <div className="text-xs font-bold text-amber-700 font-mono bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {stock} / {item.reorderPoint}
                        </div>
                        <span className="text-[9px] text-slate-500">Current Qty</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <button 
            onClick={() => onNavigate('purchase')}
            className="w-full text-center py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-xs mt-6 font-bold flex items-center justify-center gap-1 cursor-pointer transition-all shadow-xs"
          >
            Draft Material Inbound order
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* RECHARTS BAR CHART: TOP 5 SKUS CLOSEST TO REORDER POINT */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-left" id="reorder-proximity-widget">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              SKU Reorder Proximity Analytics
            </h3>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Live tracking of the top 5 catalog SKUs closest to reaching or dropping below their safe reorder limits
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-slate-105 text-slate-650 px-2.5 py-1 rounded-md font-bold font-mono border border-slate-200 uppercase">
              Selected Depot: {selectedWarehouseId === 'All' ? 'All Sites' : warehouses.find(w => w.id === selectedWarehouseId)?.name || 'Local'}
            </span>
          </div>
        </div>

        {reorderClosenessList.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs italic">
            No active material stocks with established reorder thresholds present in this warehouse selection.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
            {/* Recharts Bar Chart View */}
            <div className="lg:col-span-3 bg-slate-50 border border-slate-100 rounded-xl p-3 min-h-[300px] flex flex-col justify-between">
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={reorderClosenessList}
                    margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                    barGap={6}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis 
                      dataKey="sku" 
                      tick={{ fill: '#64748B', fontSize: 10 }}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#64748B', fontSize: 10 }}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '11px', fontWeight: 600 }}
                    />
                    <Bar 
                      name="Active In-Stock Level" 
                      dataKey="stock" 
                      fill="#2563EB" 
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={32}
                    />
                    <Bar 
                      name="Reorder Trigger Limit" 
                      dataKey="reorderPoint" 
                      fill="#94A3B8" 
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="text-[10px] text-center text-slate-400 italic">
                SKUs are aligned horizontally. Use touch or cursor hover for precise decimal allocations.
              </div>
            </div>

            {/* Explanatory ledger list side card */}
            <div className="space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider font-mono block mb-2">Threshold Proximity Ledger</span>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {reorderClosenessList.map((entry, idx) => {
                    const isBelow = entry.stock < entry.reorderPoint;
                    return (
                      <div key={idx} className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl hover:bg-slate-100/70 transition-all font-sans text-xs space-y-1.5 pointer-events-none">
                        <div className="flex items-center justify-between gap-2.5">
                          <span className="font-extrabold text-slate-800 text-[11px] truncate" title={entry.name}>{entry.name}</span>
                          <span className="text-[9.5px] font-bold font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">{entry.sku}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10.5px] text-slate-500 font-mono">
                          <span>Qty: <b className="text-slate-800 font-bold">{entry.stock}</b> / {entry.reorderPoint} Limit</span>
                          <span className={`font-extrabold text-[10px] px-1 py-0.5 rounded ${isBelow ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                            {isBelow ? '🔴 Low' : '🔵 OK'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-blue-55/50 border border-blue-100/60 p-3 rounded-lg text-[10.5px] text-slate-600 leading-normal">
                💡 <b>Strategic Blue & Silver Palette</b>: Current inventory balance (labeled in <b>Blue</b>) is tracked directly side-by-side with safety limits (in <b>Silver</b>). Keep blue bars well above silver blocks to bypass procurement delays.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CAPITAL COST VALUATION CATEGORY TREEMAP WIDGET */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-left" id="capital-treemap-widget">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-indigo-650" />
              Capital Cost Distribution Map (Treemap)
            </h3>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Proportional valuation breakdown comparing physical holdings cost basis in <b>PHP</b> across active product categories
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-bold font-mono border border-indigo-100 uppercase">
              Total Assets Cost basis: ₱{stats.totalCostValuation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {costValuationBreakdownOfCategory.length === 0 ? (
          <div className="py-14 text-center text-slate-400 text-xs italic">
            No active material stocks with valid cost basis present in the selected warehouse.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
            {/* Proportional visual treemap drawing */}
            <div className="lg:col-span-3 bg-slate-50 border border-slate-100 rounded-xl p-2.5 min-h-[280px] flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height={260}>
                <RechartsTreemap
                  data={costValuationBreakdownOfCategory}
                  dataKey="value"
                  stroke="#fff"
                  content={<CustomTreemapNode />}
                >
                  <Tooltip content={<CustomTreemapTooltip />} />
                </RechartsTreemap>
              </ResponsiveContainer>
            </div>

            {/* Explanatory ledger list next to Treemap */}
            <div className="space-y-2.5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider font-mono block mb-2.5">Capital Share Ledger</span>
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {costValuationBreakdownOfCategory.map((cat, idx) => {
                    const sharePercent = ((cat.value / (stats.totalCostValuation || 1)) * 100).toFixed(1);
                    const colors = ['#6366F1', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#F59E0B'];
                    const chipColor = colors[idx % colors.length];

                    return (
                      <div key={cat.name} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-mono hover:bg-slate-100 transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded shrink-0" style={{ backgroundColor: chipColor }} />
                          <span className="text-slate-700 truncate font-semibold font-sans">{cat.name}</span>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <div className="font-extrabold text-slate-800">₱{Math.round(cat.value).toLocaleString()}</div>
                          <div className="text-[9.5px] text-slate-500 font-bold">{sharePercent}% share • {cat.size.toLocaleString()} units</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-indigo-50/50 border border-indigo-100/60 p-3 rounded-lg text-[10.5px] text-slate-600 leading-normal">
                ℹ️ <b>Proportional Sizing Rules</b>: The physical block area scales dynamically according to total cost capital holdings. Larger grids signal higher capital commitment. Hover cells for stock counts.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CATEGORY CAPITAL TIE-UP HEATMAP MATRIX */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-left font-sans" id="category-capital-heatmap-widget">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-600 animate-pulse" />
              Category Capital Tie-up Heatmap Matrix
            </h3>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Visual risk heatmap outlining liquid cash commitment across inventory categorizations. Deep crimson/orange tiles signal high financial congestion.
            </p>
          </div>
          <div className="text-[10px] bg-slate-100 text-slate-500 font-mono px-2.5 py-1 rounded border border-slate-200">
            METRIC: TOTAL CAPITAL OUTLAY
          </div>
        </div>

        {costValuationBreakdownOfCategory.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs italic">
            No active material category stocks to evaluate.
          </div>
        ) : (() => {
          const maxVal = Math.max(...costValuationBreakdownOfCategory.map(c => c.value), 1);
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {costValuationBreakdownOfCategory.map((cat) => {
                  const percentOfMax = (cat.value / maxVal) * 100;
                  const shareOfTotal = ((cat.value / (stats.totalCostValuation || 1)) * 100).toFixed(1);

                  // Determine class color based on intensity of tied up cash
                  let bgClass = "bg-slate-50 border-slate-250 text-slate-800 hover:bg-slate-100";
                  let intensityLabel = "Minimal Commitment";
                  let levelColor = "bg-slate-400";

                  if (percentOfMax >= 75) {
                    bgClass = "bg-rose-50 hover:bg-rose-100/80 border-rose-205 text-rose-950";
                    intensityLabel = "CRITICAL TIE-UP";
                    levelColor = "bg-rose-600 animate-pulse";
                  } else if (percentOfMax >= 45) {
                    bgClass = "bg-amber-50 hover:bg-amber-100/80 border-amber-205 text-amber-950";
                    intensityLabel = "HIGH CONGESTION";
                    levelColor = "bg-amber-505";
                  } else if (percentOfMax >= 20) {
                    bgClass = "bg-indigo-50/70 hover:bg-indigo-100/70 border-indigo-150 text-indigo-950";
                    intensityLabel = "MODERATE COMMITTED";
                    levelColor = "bg-indigo-500";
                  } else if (percentOfMax >= 5) {
                    bgClass = "bg-emerald-50 hover:bg-emerald-100/70 border-emerald-150 text-emerald-950";
                    intensityLabel = "HEALTHY RANGE";
                    levelColor = "bg-emerald-500";
                  }

                  return (
                    <div 
                      key={cat.name} 
                      className={`border p-4 rounded-xl shadow-2xs transition-all relative overflow-hidden flex flex-col justify-between group ${bgClass}`}
                      title={`${cat.name}: ${shareOfTotal}% representation`}
                    >
                      {/* Top Label Row */}
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold tracking-wider font-mono uppercase text-slate-450 block">Category</span>
                          <h4 className="text-sm font-bold truncate pr-2 mt-0.5" title={cat.name}>{cat.name}</h4>
                        </div>
                        <span className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded font-mono shrink-0 uppercase tracking-wider flex items-center gap-1 bg-white border border-slate-200/50`}>
                          <span className={`w-1 h-1 rounded-full ${levelColor}`} />
                          {intensityLabel}
                        </span>
                      </div>

                      {/* Cash Metrics Info */}
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="text-slate-400 text-[10.5px]">Tied-Up Cash:</span>
                          <span className="font-extrabold text-[13px] font-mono text-slate-850">
                            ₱{Math.round(cat.value).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10.5px]">
                          <span className="text-slate-400">Total Units:</span>
                          <span className="font-semibold text-slate-700">{cat.size.toLocaleString()} units</span>
                        </div>
                        <div className="flex justify-between items-center text-[10.5px] border-t border-slate-200/50 pt-1 mt-1">
                          <span className="text-slate-400">Total Capital Share:</span>
                          <span className="font-bold text-indigo-700 bg-indigo-50 px-1 rounded font-mono text-[9px]">
                            {shareOfTotal}%
                          </span>
                        </div>
                      </div>

                      {/* Small visual heatmap fill-bar */}
                      <div className="w-full bg-slate-200/60 h-1 rounded-full mt-3 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            percentOfMax >= 75 ? 'bg-rose-600' : 
                            percentOfMax >= 45 ? 'bg-amber-500' : 
                            percentOfMax >= 20 ? 'bg-indigo-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${percentOfMax}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Heatmap Legend and strategic indicators */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 bg-slate-50 border border-slate-150 rounded-lg text-xs leading-relaxed">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-extrabold text-slate-500 text-[10px] uppercase font-mono tracking-widest block sm:inline">Heatmap Scale:</span>
                  <div className="flex items-center gap-1.5 font-mono text-[10px]">
                    <span className="w-2.5 h-2.5 rounded bg-rose-50 border border-rose-200" />
                    <span className="font-bold text-rose-850">Critical (≥75% max outlay)</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px]">
                    <span className="w-2.5 h-2.5 rounded bg-amber-50 border border-amber-205" />
                    <span className="font-bold text-amber-800">High (45%-74%)</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px]">
                    <span className="w-2.5 h-2.5 rounded bg-indigo-50 border border-indigo-150" />
                    <span className="font-bold text-indigo-650">Moderate (20%-44%)</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px]">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-50 border border-emerald-150" />
                    <span className="font-bold text-emerald-750">Healthy (&lt;20%)</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 italic">
                  *Heatmap intensity normalized dynamically against highest committing group.
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* QUICK QUICK ACTION MATRIX (BENTO TILES) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4" id="portal-quick-actions">
        <div 
          onClick={() => onNavigate('items')}
          className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col items-center justify-center text-center group cursor-pointer hover:border-indigo-400 hover:bg-slate-50 transition-all shadow-xs"
        >
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
            <Package className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-slate-800 mt-2.5 group-hover:text-indigo-650 transition-colors">SKU Catalog</span>
          <span className="text-[9px] text-slate-500 mt-0.5 font-mono">Stock levels & categories</span>
        </div>

        <div 
          onClick={() => onNavigate('purchase')}
          className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col items-center justify-center text-center group cursor-pointer hover:border-sky-400 hover:bg-slate-50 transition-all shadow-xs"
        >
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl group-hover:scale-110 transition-transform">
            <ClipboardList className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-slate-800 mt-2.5 group-hover:text-sky-655 transition-colors">Purchase Orders</span>
          <span className="text-[9px] text-slate-500 mt-0.5 font-mono">Material procurement POs</span>
        </div>

        <div 
          onClick={() => onNavigate('sales')}
          className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col items-center justify-center text-center group cursor-pointer hover:border-emerald-400 hover:bg-slate-50 transition-all shadow-xs"
        >
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-slate-800 mt-2.5 group-hover:text-emerald-355 transition-colors">Sales Dispatch</span>
          <span className="text-[9px] text-slate-500 mt-0.5 font-mono">Client SO fulfillment</span>
        </div>

        <div 
          onClick={() => onNavigate('fifo-lots')}
          className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col items-center justify-center text-center group cursor-pointer hover:border-pink-400 hover:bg-slate-50 transition-all shadow-xs"
        >
          <div className="p-3 bg-pink-50 text-pink-600 rounded-xl group-hover:scale-110 transition-transform">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-slate-800 mt-2.5 group-hover:text-pink-650 transition-colors">FIFO Batches</span>
          <span className="text-[9px] text-slate-500 mt-0.5 font-mono">Lot codes & QR scanner</span>
        </div>

        <div 
          onClick={() => onNavigate('tracking-hub')}
          className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col items-center justify-center text-center group cursor-pointer hover:border-purple-400 hover:bg-slate-50 transition-all shadow-xs"
        >
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-110 transition-transform">
            <RefreshCw className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-slate-800 mt-2.5 group-hover:text-purple-650 transition-colors">Tracking Hub</span>
          <span className="text-[9px] text-slate-500 mt-0.5 font-mono">GR & DR verification docs</span>
        </div>

        <div 
          onClick={() => onNavigate('reports')}
          className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col items-center justify-center text-center group cursor-pointer hover:border-amber-400 hover:bg-slate-50 transition-all shadow-xs"
        >
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
            <TrendingUp className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-slate-800 mt-2.5 group-hover:text-amber-650 transition-colors">KPI Reports</span>
          <span className="text-[9px] text-slate-500 mt-0.5 font-mono">Cross-site data analytics</span>
        </div>

        <div 
          onClick={onOpenScanner}
          className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col items-center justify-center text-center group cursor-pointer hover:border-indigo-400 hover:bg-slate-50 transition-all shadow-xs relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/5 rounded-bl-full pointer-events-none" />
          <div className="p-3 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 text-indigo-650 rounded-xl group-hover:scale-110 transition-transform relative">
            <Scan className="w-5 h-5 text-indigo-600" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white" />
          </div>
          <span className="text-xs font-semibold text-slate-800 mt-2.5 group-hover:text-indigo-650 transition-colors">Scan Barcode</span>
          <span className="text-[9px] text-slate-500 mt-0.5 font-mono">Mobile Scanner Sim</span>
        </div>
      </div>

      {/* RECENT ACTIVITY LOGS PANEL */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-5">
          <div className="text-left">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-650" />
              Real-time Inventory Transaction Sync Stream
            </h3>
            <p className="text-slate-500 text-[11px] mt-0.5">Live logistic state transitions, stocking adjustments and orders lifecycle</p>
          </div>
          <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 border border-indigo-200 rounded font-mono uppercase tracking-widest animate-pulse">● Live Sync</span>
        </div>

        <div id="activity-stream-table" className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-mono uppercase text-slate-505 tracking-wider">
                <th className="py-2.5 px-3">Date / Timestamp</th>
                <th className="py-2.5 px-3">Transaction ID / Reference</th>
                <th className="py-2.5 px-3">SKU - Product Name</th>
                <th className="py-2.5 px-3 font-mono">Type</th>
                <th className="py-2.5 px-3 text-right">Quantity Delta</th>
                <th className="py-2.5 px-3">Logged By</th>
                <th className="py-2.5 px-3">Site Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 italic">No inventory transactions logged yet.</td>
                </tr>
              ) : (
                recentActivity.map((txn, idx) => {
                  const correlatedItem = items.find(it => it.id === txn.itemId);
                  const correlatedWarehouse = warehouses.find(w => w.id === txn.warehouseId);
                  
                  let typeColor = 'text-slate-600 bg-slate-100';
                  let deltaSignStr = '+';
                  let deltaColor = 'text-emerald-700 font-bold';

                  if (txn.type === 'Stock Out' || txn.type === 'Adjustment Deduct') {
                    typeColor = 'text-rose-700 bg-rose-50 border border-rose-200';
                    deltaSignStr = '-';
                    deltaColor = 'text-rose-600 font-bold';
                  } else if (txn.type === 'Stock In' || txn.type === 'Adjustment Add' || txn.type === 'Stock Reversion') {
                    typeColor = 'text-emerald-700 bg-emerald-50 border border-emerald-200';
                    deltaSignStr = '+';
                    deltaColor = 'text-emerald-600 font-bold';
                  } else if (txn.type === 'Transfer Out') {
                    typeColor = 'text-amber-755 bg-amber-50 border border-amber-200';
                    deltaSignStr = '-';
                    deltaColor = 'text-amber-600 font-bold';
                  } else if (txn.type === 'Transfer In') {
                    typeColor = 'text-teal-700 bg-teal-50 border border-teal-200';
                    deltaSignStr = '+';
                    deltaColor = 'text-teal-600 font-bold';
                  }

                  return (
                    <tr key={txn.id || idx} className="hover:bg-slate-50/55 transition-colors">
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap font-mono">
                        {new Date(txn.date).toLocaleString(undefined, { 
                          year: 'numeric', month: 'short', day: '2-digit', 
                          hour: '2-digit', minute: '2-digit' 
                        })}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded text-slate-700 text-[10px] border border-slate-205">
                          {txn.reference || txn.id}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800 text-left">
                        {correlatedItem ? (
                          <div className="flex flex-col">
                            <span>{correlatedItem.name}</span>
                            <span className="text-[9px] text-slate-505 font-mono tracking-wider">{correlatedItem.sku}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Unknown SKU</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-left">
                        <span className={`px-2 py-0.5 text-[9px] rounded font-semibold whitespace-nowrap uppercase tracking-wider ${typeColor}`}>
                          {txn.type}
                        </span>
                      </td>
                      <td className={`py-3 px-3 text-right font-mono ${deltaColor}`}>
                        {deltaSignStr}{txn.quantity.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-left">
                        {txn.user || 'System Process'}
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-left">
                        {correlatedWarehouse ? correlatedWarehouse.name : 'Cross-Site'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
