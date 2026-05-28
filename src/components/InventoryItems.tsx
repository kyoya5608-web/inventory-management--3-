/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, FormEvent, useMemo, useEffect, useRef } from 'react';
import { AreaChart, Area } from 'recharts';
import { VisualQRCode, VisualBarcode } from './BarcodeQRGenerator';
import { Item, Warehouse, InventoryTransaction, PurchaseOrder, Supplier } from '../types';
import {   Search, 
  Plus, 
  SlidersHorizontal, 
  Layers, 
  AlertTriangle, 
  Building, 
  X, 
  ArrowLeftRight, 
  TrendingUp, 
  TrendingDown, 
  Edit3, 
  Trash2,
  Download,
  Package, 
  CheckCircle2, 
  Tag, 
  Hash, 
  DollarSign, 
  Wrench, 
  Clock, 
  Info,
  Bell,
  BellRing,
  Printer
} from 'lucide-react';

// Custom sub-component to animate stock quantity modifications (subtle green/red scale animation pulse)
function StockPulsingBadge({ 
  totalStock, 
  unit, 
  isOut, 
  isLow 
}: { 
  totalStock: number; 
  unit: string; 
  isOut: boolean; 
  isLow: boolean; 
}) {
  const prevStockRef = useRef<number | null>(null);
  const [pulse, setPulse] = useState<'green' | 'red' | null>(null);

  useEffect(() => {
    if (prevStockRef.current !== null && prevStockRef.current !== totalStock) {
      if (totalStock > prevStockRef.current) {
        setPulse('green');
      } else if (totalStock < prevStockRef.current) {
        setPulse('red');
      }

      const timer = setTimeout(() => {
        setPulse(null);
      }, 1500);

      return () => clearTimeout(timer);
    }
    prevStockRef.current = totalStock;
  }, [totalStock]);

  let pulseClasses = "";
  if (pulse === 'green') {
    pulseClasses = "ring-4 ring-emerald-500/40 animate-pulse bg-emerald-600 text-white border-emerald-700 scale-110";
  } else if (pulse === 'red') {
    pulseClasses = "ring-4 ring-rose-500/40 animate-pulse bg-rose-600 text-white border-rose-700 scale-110";
  } else {
    pulseClasses = isOut ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                   isLow ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                   'bg-emerald-50 text-emerald-600 border border-emerald-100';
  }

  return (
    <span className={`font-mono text-xs font-extrabold px-3 py-1 rounded-full transition-all duration-300 transform inline-flex items-center justify-center gap-1 whitespace-nowrap ${pulseClasses}`}>
      <span>{totalStock.toLocaleString()}</span>
      <span className="text-[10px] font-normal font-sans opacity-95">{unit}</span>
    </span>
  );
}

interface InventoryItemsProps {
  items: Item[];
  warehouses: Warehouse[];
  transactions: InventoryTransaction[];
  purchaseOrders: PurchaseOrder[];
  currentUser?: any;
  onAddItem: (item: Omit<Item, 'id'>) => void;
  onEditItem: (item: Item, extraTxns?: any) => void;
  onAdjustStock: (itemId: string, warehouseId: string, adjustmentType: 'add' | 'remove' | 'set', qty: number, reason: string) => void;
  onDeleteItem?: (itemId: string) => void;
  suppliers?: Supplier[];
  initialStockState?: string;
}

const STANDARD_CATEGORIES = [
  "Engine & Powertrain",
  "Hydraulic System",
  "Electrical System",
  "Undercarriage",
  "Attachments & Accessories",
  "Cabin & Operator Components",
  "Frame & Structural Parts",
  "Ground Engaging Tools",
  "Fuel & Emission Systems",
  "Suspension & Rubber Components",
  "Fasteners, Seals & Hardware",
  "General Maintenance",
  "Aircon System"
];

export default function InventoryItems({ 
  items = [], 
  warehouses = [], 
  transactions = [], 
  purchaseOrders = [], 
  currentUser,
  onAddItem,
  onEditItem,
  onAdjustStock,
  onDeleteItem,
  suppliers = [],
  initialStockState = 'All'
}: InventoryItemsProps) {
  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStockState, setSelectedStockState] = useState(initialStockState); // 'All', 'Low Stock', 'Out of Stock', 'In Stock'
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('All');

  useEffect(() => {
    setSelectedStockState(initialStockState);
  }, [initialStockState]);
  
  // Selected detail focus
  const [focusedItem, setFocusedItem] = useState<Item | null>(null);
  const [customReorderPoint, setCustomReorderPoint] = useState<number | null>(null);
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditFilterType, setAuditFilterType] = useState<'All' | 'Adjustments' | 'Orders' | 'Config'>('All');
  const [alertConfigItem, setAlertConfigItem] = useState<Item | null>(null);
  const [alertThresholdVal, setAlertThresholdVal] = useState<number>(0);
  const [saveFeedback, setSaveFeedback] = useState('');
  const [skuError, setSkuError] = useState('');

  const canSeePricing = currentUser?.permissions?.canSeePricing ?? true;
  const canEditItems = currentUser?.role === 'Admin' || (currentUser?.permissions?.canEditItems ?? false);
  const canAdjustStock = currentUser?.role === 'Admin' || (currentUser?.permissions?.canAdjustStock ?? false);
  
  // Modals status
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);

  // Sorting columns state
  const [sortBy, setSortBy] = useState<'sku' | 'name' | 'stock' | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Multi-select checkbox column state
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkEditCategory, setBulkEditCategory] = useState('');
  const [bulkEditBrand, setBulkEditBrand] = useState('');
  const [bulkEditReorderPoint, setBulkEditReorderPoint] = useState('');
  const [bulkEditStatus, setBulkEditStatus] = useState<'Active' | 'Inactive' | ''>('');
  const [bulkEditProgress, setBulkEditProgress] = useState<number>(-1); // -1 means idle, >=0 means active progress percentage
  const [bulkEditSuccessSummary, setBulkEditSuccessSummary] = useState<string | null>(null);

  // Unified action dropdown menu identifier
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Handle column header sorting trigger
  const handleSort = (field: 'sku' | 'name' | 'stock') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // State for in-table catalog deletion confirmation
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // States for printing SKU QR label stickers
  const [isPrintQRModalOpen, setIsPrintQRModalOpen] = useState(false);
  const [itemsToPrintQR, setItemsToPrintQR] = useState<Item[]>([]);

  // Initial manual stock allocation in Add Item form
  const [initialStockForm, setInitialStockForm] = useState<Record<string, number>>({});

  // Bulk CSV parser states
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [bulkImportFeedback, setBulkImportFeedback] = useState('');
  const [bulkWarehouseId, setBulkWarehouseId] = useState(warehouses[0]?.id || 'wh-a');

  // Form State: Add & Edit Item
  const [itemForm, setItemForm] = useState<{
    sku: string;
    name: string;
    description: string;
    unit: string;
    purchasePrice: number | string;
    sellingPrice: number | string;
    reorderPoint: number;
    category: string;
    brand: string;
    applicableUnits: string;
    alternatePartNumbers: string;
    status: 'Active' | 'Inactive';
    imageUrl: string;
    supplierId: string;
  }>({
    sku: '',
    name: '',
    description: '',
    unit: 'Pcs',
    purchasePrice: '',
    sellingPrice: '',
    reorderPoint: 5,
    category: 'Engine & Powertrain',
    brand: 'Generic',
    applicableUnits: '',
    alternatePartNumbers: '',
    status: 'Active',
    imageUrl: '',
    supplierId: ''
  });

  const [customCategory, setCustomCategory] = useState('');

  // Reset custom reorder point when selected focusedItem changes
  useEffect(() => {
    setCustomReorderPoint(null);
  }, [focusedItem]);

  // Form State: Adjust Stock
  const [adjustForm, setAdjustForm] = useState({
    warehouseId: warehouses[0]?.id || '',
    type: 'add' as 'add' | 'remove' | 'set',
    quantity: 10,
    reason: 'Focal cycle count validation'
  });

  // Calculate incoming stock from outstanding / Active POs
  const getItemIncomingQty = (itemId: string, whId: string = 'All') => {
    let incoming = 0;
    purchaseOrders.forEach(po => {
      // Typically 'Issued' means ordered but not fully received yet
      if (po.status === 'Issued' || po.status === 'Draft') {
        if (whId === 'All' || po.warehouseId === whId) {
          po.items.forEach((line) => {
            if (line.itemId === itemId) {
              const qtyOrdered = line.quantity;
              const qtyReceived = line.receivedQuantity || 0;
              const remaining = qtyOrdered - qtyReceived;
              if (remaining > 0) {
                incoming += remaining;
              }
            }
          });
        }
      }
    });
    return incoming;
  };

  // Helper for computing stock count for a single item (All warehouses or matching warehouse)
  const getItemTotalQty = (item: Item, whId: string = 'All') => {
    if (whId === 'All') {
      return Object.values(item.stockByWarehouse || {}).reduce((sum, qty) => sum + qty, 0);
    }
    return item.stockByWarehouse?.[whId] || 0;
  };

  // Export Currently Filtered Inventory list to a formatted CSV file
  const exportToCSV = () => {
    const headers = [
      'SKU',
      'Name',
      'Category',
      'Brand / Manufacturer',
      'Unit',
      'Purchase Price (PHP)',
      'Selling Price (PHP)',
      'Reorder Alert Limit',
      'Current Stock Balance',
      'Applicable Equipment Models',
      'Alternate Interchange Codes',
      'Status'
    ];

    const rows = filteredItems.map(item => {
      const stockBalance = getItemTotalQty(item, selectedWarehouseId);
      return [
        item.sku,
        item.name,
        item.category,
        item.brand || '',
        item.unit,
        item.purchasePrice,
        item.sellingPrice,
        item.reorderPoint,
        stockBalance,
        item.applicableUnits || '',
        item.alternatePartNumbers || '',
        item.status
      ];
    });

    // Excel CSV encoding with UTF-8 BOM
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(row => 
      row.map(val => {
        const escapedValue = String(val === null || val === undefined ? '' : val).replace(/"/g, '""');
        return `"${escapedValue}"`;
      }).join(',')
    )].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `Equiprime_Filtered_Inventory_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Global Keyboard shortcuts listener for the CatalogItems screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Support BOTH Ctrl+N and Ctrl+Alt+N to ensure it works cross-platform and environment-safe
      const isNewShortcut = (e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N');
      const isAltShortcut = e.altKey && (e.key === 'n' || e.key === 'N');
      
      if ((isNewShortcut || isAltShortcut) && canEditItems) {
        e.preventDefault();
        setItemForm({
          sku: 'SKU-' + Math.floor(Math.random() * 90000 + 10000),
          name: '',
          description: '',
          unit: 'Pcs',
          purchasePrice: 100,
          sellingPrice: 180,
          reorderPoint: 5,
          category: 'Engine & Powertrain',
          brand: 'Sumitomo',
          applicableUnits: '',
          alternatePartNumbers: '',
          status: 'Active',
          imageUrl: '',
          supplierId: ''
        });
        setInitialStockForm({});
        setSkuError('');
        setIsAddOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canEditItems, warehouses]);

  // Helper to construct the last 30 days of stock levels
  const getStockTrend30Days = (item: Item, selectedWhId: string) => {
    const currentStock = getItemTotalQty(item, selectedWhId);
    
    const result: { day: string; stock: number }[] = [];
    const today = new Date();
    
    // Filter transactions related to this item (and optionally, the selected warehouse)
    const itemTransactions = (transactions || []).filter(tx => 
      tx.itemId === item.id && 
      (selectedWhId === 'All' || tx.warehouseId === selectedWhId)
    );

    // Sort them decending by date
    const sortedTx = [...itemTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let tempStock = currentStock;
    
    // Build details from today working backward
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      result.unshift({
        day: dateStr,
        stock: tempStock
      });

      // Find any transactions that happened on this exact day and subtract them (going backward in time)
      const dayTxs = sortedTx.filter(tx => tx.date && tx.date.startsWith(dateStr));
      dayTxs.forEach(tx => {
        tempStock -= tx.quantity;
      });
      if (tempStock < 0) tempStock = 0;
    }
    
    return result;
  };

  // Categories list aggregation dynamically
  const categories = useMemo(() => {
    const list = items.map(it => it.category).filter(Boolean);
    return ['All', ...Array.from(new Set(list))];
  }, [items]);

  // Derived filtered item list
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.brand && item.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.alternatePartNumbers && item.alternatePartNumbers.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.applicableUnits && item.applicableUnits.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCategory = selectedCategory === 'All' || item.category === selectedCategory;
      
      const totalStock = getItemTotalQty(item, selectedWarehouseId);
      
      let matchStockState = true;
      if (selectedStockState === 'Low Stock') {
        matchStockState = totalStock < item.reorderPoint;
      } else if (selectedStockState === 'Out of Stock') {
        matchStockState = totalStock === 0;
      } else if (selectedStockState === 'In Stock') {
        matchStockState = totalStock > item.reorderPoint;
      }

      return matchSearch && matchCategory && matchStockState;
    });
  }, [items, searchTerm, selectedCategory, selectedStockState, selectedWarehouseId]);

  // Derived sorted item list
  const sortedItems = useMemo(() => {
    let sorted = [...filteredItems];
    if (sortBy) {
      sorted.sort((a, b) => {
        let valA: string | number = '';
        let valB: string | number = '';
        
        if (sortBy === 'sku') {
          valA = a.sku.toLowerCase();
          valB = b.sku.toLowerCase();
        } else if (sortBy === 'name') {
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
        } else if (sortBy === 'stock') {
          valA = getItemTotalQty(a, selectedWarehouseId);
          valB = getItemTotalQty(b, selectedWarehouseId);
        }
        
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
          return sortOrder === 'asc' 
            ? (valA as number) - (valB as number) 
            : (valB as number) - (valA as number);
        }
      });
    }
    return sorted;
  }, [filteredItems, sortBy, sortOrder, selectedWarehouseId]);

  // Handle Create Request
  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    setSkuError('');

    // Field Empty Checks
    if (!itemForm.sku || !itemForm.sku.trim()) {
      setSkuError("SKU code is required and cannot be empty.");
      return;
    }
    if (!itemForm.name || !itemForm.name.trim()) {
      setSkuError("Item Name is required and cannot be empty.");
      return;
    }
    // Optional pricing validation checks
    let buyPrice: number | undefined = undefined;
    if (itemForm.purchasePrice !== '' && itemForm.purchasePrice !== undefined && itemForm.purchasePrice !== null) {
      buyPrice = Number(itemForm.purchasePrice);
      if (isNaN(buyPrice)) {
        setSkuError("Purchase Price must be a valid number.");
        return;
      }
      if (buyPrice < 0) {
        setSkuError("Purchase Price cannot be negative.");
        return;
      }
    }

    let sellPrice: number | undefined = undefined;
    if (itemForm.sellingPrice !== '' && itemForm.sellingPrice !== undefined && itemForm.sellingPrice !== null) {
      sellPrice = Number(itemForm.sellingPrice);
      if (isNaN(sellPrice)) {
        setSkuError("Selling Price must be a valid number.");
        return;
      }
      if (sellPrice < 0) {
        setSkuError("Selling Price cannot be negative.");
        return;
      }
    }

    // SKU duplicate code validation check
    const skuExists = items.some(item => item.sku.trim().toLowerCase() === itemForm.sku.trim().toLowerCase());
    if (skuExists) {
      setSkuError("The SKU code provided already exists in the items array.");
      return;
    }
    setSkuError('');

    // Build fresh item structure
    // Since onAddItem takes Omit<Item, 'id'>, we pass values directly
    const defaultStock: Record<string, number> = {};
    warehouses.forEach(wh => {
      defaultStock[wh.id] = initialStockForm[wh.id] || 0;
    });

    const finalCategory = itemForm.category === 'Others' 
      ? (customCategory.trim() || 'Others') 
      : itemForm.category;

    onAddItem({
      sku: itemForm.sku,
      name: itemForm.name,
      description: itemForm.description,
      unit: itemForm.unit,
      purchasePrice: buyPrice,
      sellingPrice: sellPrice,
      reorderPoint: Number(itemForm.reorderPoint),
      category: finalCategory,
      brand: itemForm.brand || 'Generic',
      applicableUnits: itemForm.applicableUnits || undefined,
      alternatePartNumbers: itemForm.alternatePartNumbers || undefined,
      status: itemForm.status,
      imageUrl: itemForm.imageUrl || undefined,
      stockByWarehouse: defaultStock,
      supplierId: itemForm.supplierId || undefined
    });

    // Reset Form
    setItemForm({
      sku: '',
      name: '',
      description: '',
      unit: 'Pcs',
      purchasePrice: '',
      sellingPrice: '',
      reorderPoint: 5,
      category: 'Engine & Powertrain',
      brand: 'Generic',
      applicableUnits: '',
      alternatePartNumbers: '',
      status: 'Active',
      imageUrl: '',
      supplierId: ''
    });
    setCustomCategory('');
    setInitialStockForm({});
    setIsAddOpen(false);
  };

  // Handle Bulk CSV Data Import
  const handleBulkImport = (text: string) => {
    if (!text.trim()) {
      setBulkImportFeedback("⚠️ Empty CSV data provided. Please paste or choose a valid file.");
      return;
    }

    const lines = text.split('\n');
    let addedCount = 0;
    let duplicateCount = 0;
    let emptyCount = 0;

    lines.forEach((line, index) => {
      const cleanLine = line.trim();
      if (!cleanLine) {
        emptyCount++;
        return;
      }

      // Check for common headers and skip
      const lowerLine = cleanLine.toLowerCase();
      if (index === 0 && (lowerLine.includes('sku') || lowerLine.includes('name') || lowerLine.includes('item') || lowerLine.includes('part'))) {
        return;
      }

      // Basic comma splits
      const parts = cleanLine.split(',').map(p => p.trim());
      if (parts.length < 2) {
        return;
      }

      const sku = parts[0];
      const name = parts[1];
      if (!sku || !name) {
        return;
      }

      // Check SKU duplication
      const skuExists = items.some(item => item.sku.toLowerCase() === sku.toLowerCase());
      if (skuExists) {
        duplicateCount++;
        return;
      }

      // Extract details
      const category = parts[2] || 'Electrical System'; // default category
      const brand = parts[3] || 'Generic';
      const unit = parts[4] || 'Pcs';
      const purchasePrice = parseFloat(parts[5]) || 100;
      const sellingPrice = parseFloat(parts[6]) || 180;
      const reorderPoint = parseInt(parts[7]) || 5;
      const initialStockVal = parseInt(parts[8]) || 0;

      const customStock: Record<string, number> = {};
      warehouses.forEach(wh => {
        customStock[wh.id] = (wh.id === bulkWarehouseId) ? initialStockVal : 0;
      });

      onAddItem({
        sku,
        name,
        description: 'Bulk imported stock item',
        unit,
        purchasePrice,
        sellingPrice,
        reorderPoint,
        category,
        brand,
        status: 'Active',
        stockByWarehouse: customStock
      });

      addedCount++;
    });

    setBulkImportFeedback(`✅ Successfully imported and registered ${addedCount} items into the system! ${duplicateCount > 0 ? `(${duplicateCount} existing SKU duplicate lines skipped)` : ''}`);
    setCsvText('');
    setTimeout(() => {
      setBulkImportFeedback('');
    }, 6000);
  };

  // Open Edit Dialog prefilled
  const openEditDialog = (item: Item) => {
    setFocusedItem(item);
    const isStandard = STANDARD_CATEGORIES.includes(item.category);
    setItemForm({
      sku: item.sku,
      name: item.name,
      description: item.description,
      unit: item.unit,
      purchasePrice: item.purchasePrice === 0 ? '' : item.purchasePrice,
      sellingPrice: item.sellingPrice === 0 ? '' : item.sellingPrice,
      reorderPoint: item.reorderPoint,
      category: isStandard ? item.category : 'Others',
      brand: item.brand || 'Generic',
      applicableUnits: item.applicableUnits || '',
      alternatePartNumbers: item.alternatePartNumbers || '',
      status: item.status,
      imageUrl: item.imageUrl || '',
      supplierId: item.supplierId || ''
    });
    setCustomCategory(isStandard ? '' : item.category);
    setIsEditOpen(true);
  };

  // Handle Save Edit
  const handleSaveEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!focusedItem || !itemForm.name) return;

    const finalCategory = itemForm.category === 'Others' 
      ? (customCategory.trim() || 'Others') 
      : itemForm.category;

    onEditItem({
      ...focusedItem,
      sku: itemForm.sku,
      name: itemForm.name,
      description: itemForm.description,
      unit: itemForm.unit,
      purchasePrice: itemForm.purchasePrice === '' ? undefined : Number(itemForm.purchasePrice),
      sellingPrice: itemForm.sellingPrice === '' ? undefined : Number(itemForm.sellingPrice),
      reorderPoint: Number(itemForm.reorderPoint),
      category: finalCategory,
      brand: itemForm.brand || 'Generic',
      applicableUnits: itemForm.applicableUnits || undefined,
      alternatePartNumbers: itemForm.alternatePartNumbers || undefined,
      status: itemForm.status,
      imageUrl: itemForm.imageUrl || undefined,
      supplierId: itemForm.supplierId || undefined
    });

    setIsEditOpen(false);
    setFocusedItem(null);
  };

  // Open Adjust dialog
  const openAdjustDialog = (item: Item) => {
    setFocusedItem(item);
    setAdjustForm({
      warehouseId: warehouses[0]?.id || '',
      type: 'add',
      quantity: 5,
      reason: 'Manual Inventory Reconciliation'
    });
    setIsAdjustOpen(true);
  };

  // Handle execute adjustment
  const handleExecuteAdjustment = (e: FormEvent) => {
    e.preventDefault();
    if (!focusedItem) return;

    onAdjustStock(
      focusedItem.id,
      adjustForm.warehouseId,
      adjustForm.type,
      Number(adjustForm.quantity),
      adjustForm.reason
    );

    setIsAdjustOpen(false);
    setFocusedItem(null);
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER CONTROLS SHEET */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Spare Parts and Equipment Catalog</h1>
          <p className="text-xs text-slate-500 mt-0.5">Define master records, adjust stock balances, and track SKU reorder levels</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap relative">
          {selectedItemIds.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setIsBulkEditOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-600 font-extrabold text-white text-xs rounded-lg shadow-md hover:shadow-lg transition-all animate-bounce select-none cursor-pointer"
                title="Bulk edit properties of all currently ticked items"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Bulk Edit Selected ({selectedItemIds.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetItems = items.filter(it => selectedItemIds.includes(it.id));
                  setItemsToPrintQR(targetItems);
                  setIsPrintQRModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-755 text-white font-extrabold text-xs rounded-lg shadow-md hover:shadow-lg transition-all select-none cursor-pointer"
                title="Print standard SKU QR labels for checked items"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print QR Labels ({selectedItemIds.length})</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={exportToCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg shadow-md hover:shadow-lg transition-all select-none cursor-pointer"
            title="Download the currently filtered catalog items as a CSV spreadsheet"
            id="download-catalog-csv-btn"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV ({filteredItems.length})</span>
          </button>
          <div className="relative inline-block text-left">
            <button
              onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-lg shadow-md hover:shadow-lg transition-all select-none cursor-pointer"
            >
              <span>⚙️ Catalog Actions</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-3.5 h-3.5 transition-transform ${isActionsDropdownOpen ? 'rotate-180' : ''}`}>
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>

            {isActionsDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsActionsDropdownOpen(false)} 
                />
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 text-slate-705 divide-y divide-slate-100 animate-fadeIn">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        exportToCSV();
                        setIsActionsDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 font-semibold text-slate-700 flex items-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-slate-400" />
                      <span>Export Filtered CSV ({filteredItems.length})</span>
                    </button>
                  </div>

                  {canEditItems && (
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setIsBulkOpen(!isBulkOpen);
                          setIsActionsDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 font-semibold text-slate-700 flex items-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-slate-400" />
                        <span>Bulk CSV Upload</span>
                      </button>

                      <button
                        onClick={() => {
                          // Pre-fill / reset form parameters
                          setItemForm({
                            sku: 'SKU-' + Math.floor(Math.random() * 90000 + 10000),
                            name: '',
                            description: '',
                            unit: 'Pcs',
                            purchasePrice: 100,
                            sellingPrice: 180,
                            reorderPoint: 5,
                            category: 'Engine & Powertrain',
                            brand: 'Sumitomo',
                            applicableUnits: '',
                            alternatePartNumbers: '',
                            status: 'Active',
                            imageUrl: '',
                            supplierId: ''
                          });
                          setInitialStockForm({});
                          setSkuError('');
                          setIsAddOpen(true);
                          setIsActionsDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 font-semibold text-slate-700 flex items-center gap-2 cursor-pointer"
                        title="Register a new Brand SKU (Shortcut: Ctrl+N or Ctrl+Alt+N)"
                      >
                        <Plus className="w-4 h-4 text-slate-400" />
                        <span>Register Brand SKU</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* BULK CSV IMPORT PANEL */}
      {isBulkOpen && (
        <div className="bg-emerald-50/75 border border-emerald-250 rounded-xl p-5 shadow-xs space-y-4 animate-fadeIn">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-emerald-600 shrink-0" />
                Bulk Import Catalog Items & Initial Stock Registry
              </h3>
              <p className="text-xs text-emerald-800/80 mt-1 max-w-2xl">
                Paste raw comma-separated values (CSV) or write them manually using the syntax below. You can also specify which physical warehouse site will receive the initial stock balance instantly.
              </p>
            </div>
            <button
              onClick={() => setIsBulkOpen(false)}
              className="text-emerald-700 hover:text-emerald-950 text-xs font-bold font-mono px-2 py-1 bg-emerald-100/50 hover:bg-emerald-100 rounded-md transition-colors"
            >
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
            <div className="lg:col-span-8 space-y-2">
              <label className="block font-bold text-slate-700">
                CSV Syntax (Excel format) or Pasted Text:
              </label>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={5}
                placeholder="SKU, Name, Category, Brand, Unit, PurchasePrice, SellingPrice, ReorderLimit, InitialStock&#10;SKU-90221, Alternator Fan Belt, Electrical System, Sumitomo, Pcs, 45, 95, 10, 150"
                className="w-full p-3 font-mono text-[11px] leading-relaxed border border-slate-250 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-505 bg-white shadow-inner"
              />
              <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                <span>💡 <strong>Format:</strong> SKU, Name, Category, Brand, Unit, BuyPrice, SellPrice, MinReorder, InitialStock</span>
                <span>💡 <strong>Categories:</strong> Electrical System, Engine & Powertrain, Hydraulic Gears, Hydraulic Fittings, Filters & Fluids, Chassis Frame, Steering & Tires, Diagnostics Tools, Others</span>
              </div>
            </div>

            <div className="lg:col-span-4 bg-white/60 rounded-lg border border-emerald-200/60 p-3.5 flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <span className="block text-[10px] uppercase font-bold text-emerald-900 tracking-wider font-mono">Stock Deposition Target</span>
                <label className="block text-slate-600 font-medium">Receive Initial Stock At Warehouse:</label>
                <select
                  value={bulkWarehouseId}
                  onChange={(e) => setBulkWarehouseId(e.target.value)}
                  className="w-full text-xs bg-white text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold focus:outline-none"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>📍 {w.name} ({w.location})</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 italic">Lots, barcodes, and initial ledger transactions will be generated automatically for the chosen site.</p>
              </div>

              <div className="flex gap-2.5 pt-1">
                <input
                  type="file"
                  id="csv-file-selector"
                  accept=".csv, .txt, text/plain, text/csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const r = new FileReader();
                    r.onload = (evt) => {
                      const text2 = evt.target?.result as string;
                      if (text2) {
                        setCsvText(text2);
                      }
                    };
                    r.readAsText(file);
                  }}
                  className="hidden"
                />
                
                <button
                  type="button"
                  onClick={() => document.getElementById('csv-file-selector')?.click()}
                  className="flex-1 px-3 py-2 border border-slate-250 bg-white hover:bg-slate-50 active:bg-slate-100 font-semibold rounded-lg text-slate-705 transition-colors cursor-pointer text-center"
                >
                  📁 Select CSV File
                </button>

                <button
                  type="button"
                  onClick={() => handleBulkImport(csvText)}
                  className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  ⚡ Execute Import
                </button>
              </div>
            </div>
          </div>

          {bulkImportFeedback && (
            <div className="p-3 bg-white/95 border border-emerald-350 rounded-lg font-bold text-xs text-slate-800 animate-pulse">
              {bulkImportFeedback}
            </div>
          )}
        </div>
      )}

      {/* FILTER & OPTION CONTROLS GRID */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          
          {/* SEARCH BAR COMPACT */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by SKU, Name, Serials..."
              className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* CATEGORIES DROPDOWN */}
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 shrink-0 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat} Section</option>
              ))}
            </select>
          </div>

          {/* STOCK OUTLOOK SELECTOR */}
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4 shrink-0 text-slate-400" />
            <select
              value={selectedStockState}
              onChange={(e) => setSelectedStockState(e.target.value)}
              className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Stocks</option>
              <option value="Low Stock">⚠️ Low Thresholds</option>
              <option value="Out of Stock">🚫 Out of Stock (Zero)</option>
              <option value="In Stock">✅ Healthy levels (In Stock)</option>
            </select>
          </div>

          {/* SINGLE WAREHOUSE SCOPE SELECTOR */}
          <div className="flex items-center gap-1.5">
            <Building className="w-4 h-4 shrink-0 text-slate-400" />
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">Global (All Warehouses)</option>
              {warehouses.map(wh => (
                <option key={wh.id} value={wh.id}>📍 {wh.name}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* ITEMS INVENTORY RECORD TABLE SHEET */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table id="inventory-catalog-table" className="w-full text-left border-collapse table-auto text-xs">
            <thead>
              <tr className="bg-slate-55 border-b border-slate-200 font-semibold text-slate-500 text-[10px] uppercase tracking-wider font-mono select-none">
                <th className="px-4 py-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredItems.length > 0 && selectedItemIds.length === filteredItems.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedItemIds(filteredItems.map(it => it.id));
                      } else {
                        setSelectedItemIds([]);
                      }
                    }}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-505 cursor-pointer w-3.5 h-3.5"
                  />
                </th>
                <th className="px-4 py-3.5 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSort('sku')}
                      className="hover:text-indigo-600 flex items-center gap-1 font-mono hover:underline cursor-pointer focus:outline-none"
                    >
                      SKU {sortBy === 'sku' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                    </button>
                    <span className="text-slate-300 font-sans">|</span>
                    <button
                      type="button"
                      onClick={() => handleSort('name')}
                      className="hover:text-indigo-600 flex items-center gap-1 font-sans hover:underline cursor-pointer focus:outline-none"
                    >
                      Name {sortBy === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                    </button>
                  </div>
                </th>
                <th className="px-4 py-3.5">Category & Brand</th>
                <th className="px-4 py-3.5 text-right">Base Purchase Price</th>
                <th className="px-4 py-3.5 text-right">Selling Price</th>
                <th className="px-4 py-3.5 text-center">
                  <button
                    type="button"
                    onClick={() => handleSort('stock')}
                    className="inline-flex items-center justify-center gap-1 hover:text-indigo-600 hover:underline cursor-pointer focus:outline-none font-mono font-bold uppercase tracking-wider text-[10px]"
                  >
                    Available Stock {sortBy === 'stock' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                  </button>
                </th>
                <th className="px-4 py-3.5 text-center">30D Stock Trend</th>
                <th className="px-4 py-3.5 text-center">Pending Received</th>
                <th className="px-4 py-3.5">Stock Indicator Warnings</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-slate-400">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2.5" />
                    <span className="font-semibold block text-slate-500">No Catalog items matched current criteria.</span>
                    <span className="text-[11px] block text-slate-400 mt-0.5">Please expand search parameter scopes or clear filter selections</span>
                  </td>
                </tr>
              ) : (
                sortedItems.map(item => {
                  const totalStock = getItemTotalQty(item, selectedWarehouseId);
                  const isLow = totalStock <= item.reorderPoint && totalStock > 0;
                  const isOut = totalStock === 0;
                  const pendingQty = getItemIncomingQty(item.id, selectedWarehouseId);

                  const itemSupplier = suppliers.find(s => s.id === item.supplierId);
                  const costInBase = item.purchasePrice ? (item.purchasePrice * (itemSupplier?.exchangeRate || 1)) : 0;
                  const marginPercent = costInBase > 0 && item.sellingPrice
                    ? Math.round(((item.sellingPrice - costInBase) / costInBase) * 100) 
                    : 0;

                  const isBelowThreshold = totalStock <= item.reorderPoint;

                  return (
                    <tr 
                      key={item.id} 
                      onClick={() => setFocusedItem(item)}
                      className={`transition-all duration-150 ease-in-out cursor-pointer transform hover:scale-[1.006] hover:shadow-xs origin-center ${
                        focusedItem?.id === item.id 
                          ? 'bg-indigo-55/70 hover:bg-indigo-50/70 border-l-2 border-l-indigo-600' 
                          : isBelowThreshold
                            ? 'bg-amber-50/70 hover:bg-amber-100/50 border-l-2 border-l-amber-500'
                            : 'hover:bg-slate-50/75'
                      }`}
                    >
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedItemIds.includes(item.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItemIds(prev => [...prev, item.id]);
                            } else {
                              setSelectedItemIds(prev => prev.filter(id => id !== item.id));
                            }
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 flex items-center gap-2">
                          <span className="font-mono bg-slate-150 px-2.5 py-0.5 rounded text-[10px] uppercase border border-slate-200 tracking-wider">
                            {item.sku}
                          </span>
                          <span className="text-slate-800 line-clamp-1">{item.name}</span>
                        </div>
                        {item.description && (
                          <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 italic font-light pl-1">
                            “{item.description}”
                          </p>
                        )}
                        {(item.applicableUnits || item.alternatePartNumbers) && (
                          <div className="flex gap-1.5 mt-1 text-[9px] text-slate-450 items-center pl-1 font-mono">
                            {item.applicableUnits && <span className="bg-slate-100 px-1 py-0.2 rounded">⚙️ {item.applicableUnits}</span>}
                            {item.alternatePartNumbers && <span className="bg-slate-100 px-1 py-0.2 rounded">🏷️ {item.alternatePartNumbers}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded text-[10px] uppercase">
                          {item.category}
                        </span>
                        <span className="text-slate-500 font-medium block mt-1 pl-1 text-[11px] font-mono">
                          🏭 {item.brand || 'Generic'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono" onClick={(e) => e.stopPropagation()}>
                        {canSeePricing ? (
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-slate-800">
                              {itemSupplier ? (itemSupplier.currency === 'PHP' ? '₱' : itemSupplier.currency === 'JPY' ? '¥' : itemSupplier.currency === 'USD' ? '$' : itemSupplier.currency === 'EUR' ? '€' : '') : '₱'}
                              {item.purchasePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {itemSupplier && itemSupplier.currency !== 'PHP' && (
                              <span className="text-[9.5px] text-gray-400 font-medium font-sans">
                                ≈ ₱{costInBase.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PHP
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px] font-normal">🔒 Restricted</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canSeePricing ? (
                          <>
                            <span className="font-mono font-bold text-slate-900 block">₱{item.sellingPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            {marginPercent > 0 && (
                              <span className="text-[9px] text-emerald-600 font-semibold block mt-px font-mono">
                                +{marginPercent}% profit margin
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400 italic text-[11px] font-normal">🔒 Restricted</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StockPulsingBadge 
                          totalStock={totalStock} 
                          unit={item.unit} 
                          isOut={isOut} 
                          isLow={isLow} 
                        />
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-block h-8 w-24 bg-slate-50/50 border border-slate-100 rounded-md p-1">
                          <AreaChart width={90} height={22} data={getStockTrend30Days(item, selectedWarehouseId)}>
                            <defs>
                              <linearGradient id={`sparkline-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={isBelowThreshold ? '#f59e0b' : '#10b981'} stopOpacity={0.2}/>
                                <stop offset="95%" stopColor={isBelowThreshold ? '#f59e0b' : '#10b981'} stopOpacity={0.0}/>
                              </linearGradient>
                            </defs>
                            <Area
                              type="monotone"
                              dataKey="stock"
                              stroke={isBelowThreshold ? '#f59e0b' : '#10b981'}
                              strokeWidth={1.5}
                              fillOpacity={1}
                              fill={`url(#sparkline-${item.id})`}
                              dot={false}
                              isAnimationActive={false}
                            />
                          </AreaChart>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {pendingQty > 0 ? (
                          <span className="font-mono bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded font-bold inline-flex items-center gap-1 text-[10px]">
                            <Clock className="w-3 h-3 text-blue-500" />
                            +{pendingQty}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-light font-mono">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200/50 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shrink-0" /> Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-55/30 text-amber-800 border border-amber-205 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0" /> Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/50 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" /> Healthy
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                            className="inline-flex justify-center items-center gap-1 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-indigo-400 rounded-lg text-slate-700 hover:text-indigo-750 text-[10.5px] font-bold transition-all cursor-pointer shadow-3xs"
                          >
                            <span>⚙️ Actions</span>
                            <span className="text-[8px] opacity-70">▼</span>
                          </button>
                          
                          {activeMenuId === item.id && (
                            <>
                              <div 
                                className="fixed inset-0 z-30" 
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setDeletingItemId(null);
                                }}
                              />
                              <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-40 animate-in fade-in slide-in-from-top-2 duration-100 font-sans text-xs text-left">
                                {canEditItems && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAlertConfigItem(item);
                                      setAlertThresholdVal(item.reorderPoint);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full px-3 py-1.5 text-slate-750 hover:bg-amber-50 hover:text-amber-850 flex items-center gap-2 font-medium cursor-pointer"
                                  >
                                    <Bell className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    <span>Stock Alert</span>
                                  </button>
                                )}
                                
                                {canAdjustStock && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      openAdjustDialog(item);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full px-3 py-1.5 text-slate-750 hover:bg-slate-50 hover:text-indigo-650 flex items-center gap-2 font-medium cursor-pointer"
                                  >
                                    <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                    <span>Manual Adjust</span>
                                  </button>
                                )}
                                
                                {canEditItems && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      openEditDialog(item);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full px-3 py-1.5 text-slate-750 hover:bg-slate-50 hover:text-indigo-650 flex items-center gap-2 font-medium cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>Properties</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setItemsToPrintQR([item]);
                                    setIsPrintQRModalOpen(true);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-slate-750 hover:bg-slate-50 hover:text-indigo-650 flex items-center gap-2 font-medium cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                  <span>Print QR Label</span>
                                </button>
                                
                                {currentUser?.role === 'Admin' && (
                                  <div className="border-t border-slate-100 mt-1 pt-1">
                                    {deletingItemId === item.id ? (
                                      <div className="px-3 py-1.5 bg-rose-50 flex flex-col gap-1 rounded-b-xl">
                                        <span className="text-[9px] text-rose-800 font-bold font-mono">CONFIRM DELETION?</span>
                                        <div className="flex gap-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (onDeleteItem) onDeleteItem(item.id);
                                              setDeletingItemId(null);
                                              setActiveMenuId(null);
                                            }}
                                            className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9.5px] font-bold cursor-pointer transition-colors"
                                          >
                                            Yes
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setDeletingItemId(null)}
                                            className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-705 rounded text-[9.5px] font-bold cursor-pointer transition-colors"
                                          >
                                            No
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDeletingItemId(item.id);
                                        }}
                                        className="w-full px-3 py-1.5 text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                        <span>Delete SKU Item</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EXPANDED RECORD TRANSACTION LOG AUDITS / ITEM DETAILS MODAL */}
      {focusedItem && !alertConfigItem && !isEditOpen && !isAdjustOpen && (
        <div id="modal-container-details" className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full animate-in zoom-in-95 duration-150 p-6 space-y-4 text-white shadow-2xl relative">
            
            {/* Local success feedback toast */}
            {saveFeedback && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5 animate-bounce z-55">
                <CheckCircle2 className="w-4 h-4" />
                <span>{saveFeedback}</span>
              </div>
            )}

            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                    [{focusedItem.sku}] Item Details Analysis & Audits
                  </h3>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">
                    Physical stock records for: <b>{focusedItem.name}</b> • Category: <i>{focusedItem.category}</i>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFocusedItem(null)}
                className="p-1.5 cursor-pointer bg-slate-800 hover:bg-slate-700 rounded text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Allocation details per location */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {warehouses.map(wh => {
                const stock = focusedItem.stockByWarehouse?.[wh.id] || 0;
                const pending = getItemIncomingQty(focusedItem.id, wh.id);
                return (
                  <div key={wh.id} className="p-3.5 rounded-lg bg-slate-950 border border-slate-850 flex flex-col justify-between space-y-1.5">
                    <span className="text-[10.5px] font-semibold text-slate-400 font-mono block truncate">📍 {wh.name}</span>
                    <div className="flex justify-between items-baseline pt-1">
                      <span className="text-xl font-extrabold font-mono text-white">{stock} <span className="text-xs font-normal text-slate-500">{focusedItem.unit}</span></span>
                      {pending > 0 && <span className="text-[9.5px] font-mono text-indigo-400 font-bold bg-indigo-950/20 px-1.5 py-0.5 rounded">+{pending} Incoming</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dynamic reorder point alert threshold overriding */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 space-y-3 text-left">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase text-indigo-400 tracking-wider font-mono block">Dynamic Stock Alert Config</span>
                  <p className="text-[10px] text-slate-400">Specify an item-specific reorder threshold to override global automatic reorder levels.</p>
                </div>
                <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-amber-500/10 text-amber-400 border border-amber-500/15 shrink-0">
                  Item-level Override
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1 min-w-[120px] relative">
                  <input
                    type="number"
                    min={0}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                    placeholder="Threshold units..."
                    value={customReorderPoint !== null ? customReorderPoint : focusedItem.reorderPoint}
                    onChange={(e) => setCustomReorderPoint(Number(e.target.value))}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-500 font-bold uppercase">
                    Units
                  </span>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    const val = customReorderPoint !== null ? customReorderPoint : focusedItem.reorderPoint;
                    onEditItem({
                      ...focusedItem,
                      reorderPoint: val
                    });
                    setSaveFeedback(`Saved trigger: ${val} units!`);
                    setTimeout(() => setSaveFeedback(''), 3000);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-xs font-bold text-white rounded-lg transition-colors cursor-pointer text-center whitespace-nowrap"
                >
                  Save Custom Alert Threshold
                </button>
              </div>
            </div>

            {/* Sibling list of transactional entries */}
            <div className="space-y-3 mt-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider font-mono block">Historical Audit & Change-Logs ({transactions.filter(t => t.itemId === focusedItem.id).length})</span>
                
                {/* Clean inline search and filter controls */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={auditSearchTerm}
                    onChange={(e) => setAuditSearchTerm(e.target.value)}
                    placeholder="🔍 Search log keywords..."
                    className="bg-slate-950 text-slate-200 border border-slate-800 rounded-md px-2 py-1 text-[10.5px] font-mono focus:outline-none focus:border-indigo-500 w-36 sm:w-48 placeholder-slate-600"
                    id="input-audit-search"
                  />
                  {auditSearchTerm && (
                    <button
                      onClick={() => setAuditSearchTerm('')}
                      className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded px-1.5 py-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Filtering Segments Tabs */}
              <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-850">
                {(['All', 'Adjustments', 'Orders', 'Config'] as const).map((type) => {
                  const isActive = auditFilterType === type;
                  // Compute matching count
                  const rawCount = transactions.filter(t => t.itemId === focusedItem.id).filter(t => {
                    if (type === 'All') return true;
                    if (type === 'Adjustments') return t.type === 'Adjustment' && !(t.description || '').includes('[Bulk Edit');
                    if (type === 'Orders') return t.type === 'Purchase' || t.type === 'Sales' || t.type === 'Transfer Out' || t.type === 'Transfer In';
                    if (type === 'Config') return (t.description || '').includes('[Bulk Edit') || t.referenceNumber === 'BULK-EDIT';
                    return true;
                  }).length;

                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAuditFilterType(type)}
                      className={`px-2.5 py-1 text-[10px] font-bold font-mono rounded-md cursor-pointer transition-all flex items-center gap-1 ${
                        isActive 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'text-slate-400 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <span>{type}</span>
                      <span className={`px-1.5 py-0.2 text-[8px] rounded ${isActive ? 'bg-indigo-750 text-indigo-100' : 'bg-slate-900 text-slate-500'}`}>{rawCount}</span>
                    </button>
                  );
                })}
              </div>
              
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1.5">
                {(() => {
                  const filteredTxns = transactions
                    .filter(t => t.itemId === focusedItem.id)
                    .filter(t => {
                      // 1. Text Search query Matcher
                      const searchMatch = !auditSearchTerm 
                        ? true 
                        : (t.description || '').toLowerCase().includes(auditSearchTerm.toLowerCase()) || 
                          (t.referenceNumber || '').toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
                          (t.type || '').toLowerCase().includes(auditSearchTerm.toLowerCase());

                      if (!searchMatch) return false;

                      // 2. Tab Filter Matcher
                      if (auditFilterType === 'All') return true;
                      if (auditFilterType === 'Adjustments') {
                        return t.type === 'Adjustment' && !(t.description || '').includes('[Bulk Edit');
                      }
                      if (auditFilterType === 'Orders') {
                        return t.type === 'Purchase' || t.type === 'Sales' || t.type === 'Transfer Out' || t.type === 'Transfer In';
                      }
                      if (auditFilterType === 'Config') {
                        return (t.description || '').includes('[Bulk Edit') || t.referenceNumber === 'BULK-EDIT';
                      }
                      return true;
                    })
                    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                  if (filteredTxns.length === 0) {
                    return (
                      <p className="text-[11px] text-slate-400 font-mono py-8 text-center bg-slate-950/40 border border-slate-900 rounded-lg">
                        {auditSearchTerm 
                          ? `No log trails matched keyword: "${auditSearchTerm}" in this filter segment.`
                          : 'No audit records registered in this segment.'}
                      </p>
                    );
                  }

                  return filteredTxns.map(trans => {
                    const matchedWarehouse = warehouses.find(w => w.id === trans.warehouseId);
                    const isPositive = trans.quantity > 0;
                    const qtySigned = isPositive ? `+${trans.quantity}` : `${trans.quantity}`;
                    const isConfigChange = (trans.description || '').includes('[Bulk Edit') || trans.referenceNumber === 'BULK-EDIT';

                    return (
                      <div key={trans.id} className="p-2.5 bg-slate-950 border border-slate-850 rounded-lg flex items-start justify-between text-[11px] font-mono leading-relaxed gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                            isConfigChange 
                              ? 'bg-indigo-400' 
                              : isPositive 
                                ? 'bg-emerald-500' 
                                : trans.quantity < 0 
                                  ? 'bg-rose-500' 
                                  : 'bg-amber-400'
                          }`} />
                          <div className="min-w-0 flex-1">
                            <span className="text-slate-200 block font-medium break-words leading-normal">
                              {trans.description || trans.type}
                            </span>
                            <span className="text-[10px] text-slate-500 block mt-0.5">
                              Warehouse: {matchedWarehouse?.name || 'Central Office'} • Ref: {trans.referenceNumber || 'N/A'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          {isConfigChange ? (
                            <span className="px-1.5 py-0.2 font-bold text-[9px] rounded bg-indigo-950 text-indigo-400 border border-indigo-500/10 uppercase font-sans tracking-wide">Config</span>
                          ) : (
                            <span className={`font-extrabold text-xs block ${isPositive ? 'text-emerald-400' : trans.quantity < 0 ? 'text-rose-400' : 'text-slate-400'}`}>{qtySigned}</span>
                          )}
                          <span className="text-[9px] text-slate-500 block mt-0.5 whitespace-nowrap">{new Date(trans.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
            
            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setFocusedItem(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
              >
                Close Details
              </button>
            </div>

          </div>
        </div>
      )}

      {/* STOCK ALERT OVERRIDE MODAL */}
      {alertConfigItem && (
        <div id="modal-container-alert-override" className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full animate-in zoom-in-95 duration-150 p-6 space-y-4 shadow-xl text-slate-800">
            <div className="flex justify-between items-center border-b border-slate-150 pb-3">
              <div className="flex items-center gap-2">
                <BellRing className="w-5 h-5 text-amber-500 animate-bounce shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">Stock Alert Config</h3>
                  <p className="text-[10px] text-slate-500">Override reorder point for {alertConfigItem.sku}</p>
                </div>
              </div>
              <button 
                onClick={() => setAlertConfigItem(null)} 
                className="p-1 cursor-pointer hover:bg-slate-100 rounded text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-700">
              <p className="leading-relaxed">
                Set an item-specific reorder threshold for <strong>{alertConfigItem.name}</strong>. When total stock drops below this level, an amber warnings flag triggers.
              </p>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 space-y-1.5 font-mono">
                <div className="flex justify-between text-[11px]">
                  <span>Product Code:</span>
                  <span className="font-bold text-slate-900">{alertConfigItem.sku}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Category:</span>
                  <span className="font-semibold text-slate-800">{alertConfigItem.category}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Current Reorder:</span>
                  <span className="font-bold text-amber-600">{alertConfigItem.reorderPoint} {alertConfigItem.unit}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Custom Alert Threshold (Units) *</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min={0}
                    value={alertThresholdVal}
                    onChange={(e) => setAlertThresholdVal(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-slate-950 font-mono font-bold text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none focus:bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold font-mono text-[10px]">
                    {alertConfigItem.unit}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAlertConfigItem(null)}
                className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 cursor-pointer select-none text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onEditItem({
                    ...alertConfigItem,
                    reorderPoint: alertThresholdVal
                  });
                  setAlertConfigItem(null);
                }}
                className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-extrabold text-white cursor-pointer select-none text-xs shadow-xs"
              >
                Save Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL WINDOWS CONTROLLERS */}

      {/* ADD ITEM SKU MODAL */}
      {isAddOpen && (
        <div id="modal-container-add" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full animate-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">Register Catalog Item SKU</h3>
                  <p className="text-[10px] text-slate-500">Insert permanent stock details to catalog</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsAddOpen(false)} className="p-1 cursor-pointer hover:bg-slate-100 rounded text-slate-500"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                <div className="space-y-1">
                  <label className="text-[10px] font-[700] uppercase text-slate-500 tracking-wider font-mono">Stock Keeping Unit SKU *</label>
                  <input
                    type="text"
                    required
                    value={itemForm.sku}
                    onChange={(e) => {
                      const typedSku = e.target.value;
                      setItemForm({ ...itemForm, sku: typedSku });
                      if (typedSku.trim()) {
                        const exists = items.some(
                          (item) => item.sku.trim().toLowerCase() === typedSku.trim().toLowerCase()
                        );
                        if (exists) {
                          setSkuError('The typed SKU already exists in the items catalog.');
                        } else {
                          setSkuError('');
                        }
                      } else {
                        setSkuError('');
                      }
                    }}
                    className={`w-full px-3 py-1.5 border rounded-lg text-slate-800 font-mono text-xs focus:ring-1 focus:outline-none transition-colors duration-150 ${
                      skuError 
                        ? 'border-rose-500 bg-rose-50/20 text-rose-900 focus:ring-rose-500 focus:bg-white' 
                        : 'border-slate-200 bg-slate-50 focus:ring-indigo-500 focus:bg-white'
                    }`}
                    data-helper="🔢 SKU HELPER: Unique key identifier. Use uppercase prefix like PT- (Parts) or SP- (Spare Parts)."
                  />
                  <p className="text-[9px] text-slate-400 font-normal mt-0.5">Primary identifier. Format: PREFIX-NUMBER.</p>
                  {skuError && (
                    <p className="text-[10px] text-rose-600 font-[800] mt-1 leading-snug animate-fadeIn">
                      ⚠️ {skuError}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Category Taxonomy *</label>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    data-helper="🛠️ CATEGORY HELPER: Classifies the item under a primary subsystem block for analytics filtering."
                  >
                    <option value="Engine & Powertrain">Engine & Powertrain</option>
                    <option value="Hydraulic System">Hydraulic System</option>
                    <option value="Electrical System">Electrical System</option>
                    <option value="Undercarriage">Undercarriage</option>
                    <option value="Attachments & Accessories">Attachments & Accessories</option>
                    <option value="Cabin & Operator Components">Cabin & Operator Components</option>
                    <option value="Frame & Structural Parts">Frame & Structural Parts</option>
                    <option value="Ground Engaging Tools">Ground Engaging Tools</option>
                    <option value="Fuel & Emission Systems">Fuel & Emission Systems</option>
                    <option value="Suspension & Rubber Components">Suspension & Rubber Components</option>
                    <option value="Fasteners, Seals & Hardware">Fasteners, Seals & Hardware</option>
                    <option value="General Maintenance">General Maintenance</option>
                    <option value="Aircon System">Aircon System</option>
                    <option value="Others">Others</option>
                  </select>
                  <p className="text-[9px] text-slate-400 font-normal mt-0.5">Assigns proper storage shelves & warehouse zoning.</p>

                  {itemForm.category === 'Others' && (
                    <div className="mt-2 space-y-1 animate-in slide-in-from-top-1 duration-150">
                      <label className="text-[10px] font-bold uppercase text-indigo-900 font-mono">Custom Category Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Enter custom category manually..."
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-indigo-250 rounded-md focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-850"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1 text-slate-700">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Skilled Commercial Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Caterpillar Oil Filter D8"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none focus:bg-white"
                  data-helper="📝 NAME HELPER: Clear commercial manufacturer title of the part or mechanical assembly."
                />
                <p className="text-[9px] text-slate-400 font-normal mt-0.5">Used in Purchase Orders and Customer Invoices.</p>
              </div>

              <div className="space-y-1 text-slate-700">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Technical Specifications / Description</label>
                <textarea
                  placeholder="Insert dimensions, manufacturer model number allocations, compatibility warnings"
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none focus:bg-white resize-none"
                  data-helper="📖 DESCRIPTION HELPER: Technical properties, dimensions, weight capacity, and sub-assembly diagrams."
                />
                <p className="text-[9px] text-slate-400 font-normal mt-0.5">Enter key fitting dimensions, warnings, or detailed certifications.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Brand *</label>
                  <input
                    type="text"
                    required
                    value={itemForm.brand}
                    onChange={(e) => setItemForm({ ...itemForm, brand: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    data-helper="🏷️ BRAND HELPER: Original Equipment Manufacturer (OEM) or qualified aftermarket manufacturer label."
                  />
                  <p className="text-[9px] text-slate-400 font-normal mt-0.5">e.g. Komatsu, Cat, Rexroth.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Count Unit *</label>
                  <select
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:outline-none"
                    data-helper="📦 UNIT HELPER: Standard metric or discrete counting container for stocktaking valuations."
                  >
                    <option value="Pcs">Pieces (Pcs)</option>
                    <option value="Units">Complete Units</option>
                    <option value="Sets">Integrated Sets</option>
                    <option value="Liters">Liters (Ltr)</option>
                    <option value="Kgs">Kilograms (Kg)</option>
                  </select>
                  <p className="text-[9px] text-slate-400 font-normal mt-0.5">Unit of measurement.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Reorder Level *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={itemForm.reorderPoint}
                    onChange={(e) => setItemForm({ ...itemForm, reorderPoint: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none focus:bg-white"
                    data-helper="⚠️ REORDER HELPER: Minimum margin quantity threshold. Dropping beneath this triggers dashboard warnings."
                  />
                  <p className="text-[9px] text-slate-400 font-normal mt-0.5">Stock warning threshold level.</p>
                </div>
              </div>

              {/* Preferred Supplier linked selector */}
              <div className="space-y-1 text-slate-700">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono col-span-full">Preferred Supplier & Currency Integration</label>
                <select
                  value={itemForm.supplierId}
                  onChange={(e) => setItemForm({ ...itemForm, supplierId: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none focus:bg-white"
                  data-helper="🏭 SUPPLIER HELPER: Sets default link for purchase orders, tracking vendor's standard country currency."
                >
                  <option value="">-- No Supplier Linked (Base Currency PHP) --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>🏭 {s.name} ({s.currency})</option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-400 font-normal mt-0.5">Links item to pre-configured partners for automated replenishment.</p>
              </div>

              {canSeePricing && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">
                      Purchase Price ({suppliers.find(s => s.id === itemForm.supplierId)?.currency || 'PHP'})
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00 (Optional)"
                      value={itemForm.purchasePrice}
                      onChange={(e) => setItemForm({ ...itemForm, purchasePrice: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none focus:bg-white font-mono"
                      data-helper="💵 PURCHASE HELPER: Cost paid to vendor. Captured in supplier's native country currency."
                    />
                    <p className="text-[9px] text-slate-400 font-normal mt-0.5">Supplier buy rate. Optional.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Standard Selling Price (PHP)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="PHP (Optional)"
                      value={itemForm.sellingPrice}
                      onChange={(e) => setItemForm({ ...itemForm, sellingPrice: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none focus:bg-white font-mono"
                      data-helper="🛒 SELLING HELPER: Customer retail list price in local Philippine Peso (PHP), exclusive of custom VAT levels."
                    />
                    <p className="text-[9px] text-slate-400 font-normal mt-0.5">Local retail listing rate (PHP). Optional.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Applicable Models / Units</label>
                  <input
                    type="text"
                    placeholder="e.g. PC200-8, D8R"
                    value={itemForm.applicableUnits}
                    onChange={(e) => setItemForm({ ...itemForm, applicableUnits: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none focus:bg-white"
                    data-helper="⚙️ MODELS HELPER: Machinery models (e.g. Komatsu excavators, Cat dozers) compatible with this item."
                  />
                  <p className="text-[9px] text-slate-400 font-normal mt-0.5">Compatible heavy equipment lines.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Alt Part Numbers / Codes</label>
                  <input
                    type="text"
                    placeholder="e.g. 154-19-12110"
                    value={itemForm.alternatePartNumbers}
                    onChange={(e) => setItemForm({ ...itemForm, alternatePartNumbers: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none focus:bg-white"
                    data-helper="🔄 ALT CODES HELPER: Interchangeable part numbers, OEM codes, or legacy numbers matching this SKU."
                  />
                  <p className="text-[9px] text-slate-400 font-normal mt-0.5">Cross-reference numbers. Optional.</p>
                </div>
              </div>

              {/* Optional Initial Stock Upload / Insertion block */}
              <div className="border border-slate-200/60 bg-slate-50/50 p-3 rounded-xl space-y-2">
                <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider font-mono">
                  Initial Physical Stock Allocation (Optional)
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                  You can specify starting stocks for each warehouse below. This will register starting balances, lots, and ledger records automatically.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 mt-1.5 font-mono">
                  {warehouses.map(wh => (
                    <div key={wh.id} className="bg-white p-2 border border-slate-150 rounded-lg flex items-center justify-between gap-1">
                      <span className="font-semibold text-slate-800 text-[10px] truncate">📍 {wh.name}</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={initialStockForm[wh.id] || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setInitialStockForm({ ...initialStockForm, [wh.id]: val });
                        }}
                        className="w-16 px-1.5 py-0.5 border border-slate-200 rounded text-right font-mono text-xs focus:bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-550"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 cursor-pointer select-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-extrabold text-white cursor-pointer select-none"
                >
                  Confirm & Write
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ITEM SKU PROPERTIES MODAL */}
      {isEditOpen && focusedItem && (
        <div id="modal-container-edit" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full animate-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">Edit Catalog Properties</h3>
                  <p className="text-[10px] text-slate-500">Update item identity variables: <b>{focusedItem.sku}</b></p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsEditOpen(false);
                  setFocusedItem(null);
                }} 
                className="p-1 cursor-pointer hover:bg-slate-100 rounded text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Stock Keeping Unit SKU *</label>
                  <input
                    type="text"
                    required
                    value={itemForm.sku}
                    onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-100/60 rounded-lg text-slate-500 font-mono text-xs focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Category Taxonomy *</label>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 font-semibold focus:ring-1 focus:ring-indigo-505 focus:outline-none"
                  >
                    <option value="Engine & Powertrain">Engine & Powertrain</option>
                    <option value="Hydraulic System">Hydraulic System</option>
                    <option value="Electrical System">Electrical System</option>
                    <option value="Undercarriage">Undercarriage</option>
                    <option value="Attachments & Accessories">Attachments & Accessories</option>
                    <option value="Cabin & Operator Components">Cabin & Operator Components</option>
                    <option value="Frame & Structural Parts">Frame & Structural Parts</option>
                    <option value="Ground Engaging Tools">Ground Engaging Tools</option>
                    <option value="Fuel & Emission Systems">Fuel & Emission Systems</option>
                    <option value="Suspension & Rubber Components">Suspension & Rubber Components</option>
                    <option value="Fasteners, Seals & Hardware">Fasteners, Seals & Hardware</option>
                    <option value="General Maintenance">General Maintenance</option>
                    <option value="Aircon System">Aircon System</option>
                    <option value="Others">Others</option>
                  </select>

                  {itemForm.category === 'Others' && (
                    <div className="mt-2 space-y-1 animate-in slide-in-from-top-1 duration-150">
                      <label className="text-[10px] font-bold uppercase text-indigo-900 font-mono">Custom Category Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Enter custom category manually..."
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-indigo-250 rounded-md focus:outline-hidden focus:ring-1 focus:ring-indigo-505 font-semibold text-slate-850"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1 text-slate-700">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Skilled Commercial Name *</label>
                <input
                  type="text"
                  required
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-850 font-medium focus:ring-1 focus:ring-indigo-505 focus:outline-none focus:bg-white"
                />
              </div>

              <div className="space-y-1 text-slate-700">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Technical Specifications / Description</label>
                <textarea
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none focus:bg-white resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Brand *</label>
                  <input
                    type="text"
                    required
                    value={itemForm.brand}
                    onChange={(e) => setItemForm({ ...itemForm, brand: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Count Unit *</label>
                  <select
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:outline-none"
                  >
                    <option value="Pcs">Pieces (Pcs)</option>
                    <option value="Units">Complete Units</option>
                    <option value="Sets">Integrated Sets</option>
                    <option value="Liters">Liters (Ltr)</option>
                    <option value="Kgs font-bold">Kilograms (Kg)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Reorder Point Threshold *</label>
                  <input
                    type="number"
                    required
                    value={itemForm.reorderPoint}
                    onChange={(e) => setItemForm({ ...itemForm, reorderPoint: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none"
                  />
                </div>
              </div>

              {/* Preferred Supplier linked selector */}
              <div className="space-y-1 text-slate-700 col-span-full">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono col-span-full">Preferred Supplier & Currency Integration</label>
                <select
                  value={itemForm.supplierId}
                  onChange={(e) => setItemForm({ ...itemForm, supplierId: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none focus:bg-white"
                >
                  <option value="">-- No Supplier Linked (Base Currency PHP) --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>🏭 {s.name} ({s.currency})</option>
                  ))}
                </select>
              </div>

               {canSeePricing && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700 col-span-full">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">
                      Purchase Price ({suppliers.find(s => s.id === itemForm.supplierId)?.currency || 'PHP'})
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00 (Optional)"
                      value={itemForm.purchasePrice}
                      onChange={(e) => setItemForm({ ...itemForm, purchasePrice: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Standard Selling Price (PHP)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="PHP (Optional)"
                      value={itemForm.sellingPrice}
                      onChange={(e) => setItemForm({ ...itemForm, sellingPrice: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Alternate Models Allocation</label>
                  <input
                    type="text"
                    value={itemForm.applicableUnits}
                    onChange={(e) => setItemForm({ ...itemForm, applicableUnits: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Alt Part Numbers</label>
                  <input
                    type="text"
                    value={itemForm.alternatePartNumbers}
                    onChange={(e) => setItemForm({ ...itemForm, alternatePartNumbers: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditOpen(false);
                    setFocusedItem(null);
                  }}
                  className="flex-1 py-1.8 bg-slate-100 hover:bg-slate-200 text-slate-650 font-bold rounded-lg transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.8 bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold rounded-lg transition-all cursor-pointer text-center"
                >
                  Save Modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK EDIT SUBMISSION MODAL */}
      {isBulkEditOpen && selectedItemIds.length > 0 && (
        <div id="modal-container-bulk-edit" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full animate-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 text-slate-900">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide">Bulk Edit {selectedItemIds.length} Items</h3>
                  <p className="text-[10px] text-slate-500">Provide new properties below. Leave blank to retain existing values.</p>
                </div>
              </div>
              <button 
                type="button"
                disabled={bulkEditProgress >= 0 && !bulkEditSuccessSummary}
                onClick={() => {
                  setIsBulkEditOpen(false);
                  setBulkEditCategory('');
                  setBulkEditBrand('');
                  setBulkEditReorderPoint('');
                  setBulkEditStatus('');
                  setBulkEditProgress(-1);
                  setBulkEditSuccessSummary(null);
                }} 
                className="p-1 cursor-pointer hover:bg-slate-100 rounded text-slate-500 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {bulkEditProgress >= 0 ? (
              <div className="space-y-5 py-4 text-center">
                {bulkEditSuccessSummary ? (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="mx-auto w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-900 text-sm">Execution Succeeded!</h4>
                      <p className="text-[11px] text-slate-600 leading-relaxed px-2 bg-slate-50 border border-slate-100 rounded-lg p-3 font-medium text-left">
                        {bulkEditSuccessSummary}
                      </p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setIsBulkEditOpen(false);
                        setBulkEditCategory('');
                        setBulkEditBrand('');
                        setBulkEditReorderPoint('');
                        setBulkEditStatus('');
                        setBulkEditProgress(-1);
                        setBulkEditSuccessSummary(null);
                      }}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow cursor-pointer transition-colors"
                    >
                      Dismiss & Return to Catalog ➔
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 py-2">
                    <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto animate-duration-700" />
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider font-mono">Applying Bulk Operations...</h4>
                      <p className="text-[10px] text-slate-500 font-medium">Overwriting selected row values ({bulkEditProgress}% completed)</p>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-100 ease-out"
                        style={{ width: `${bulkEditProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Category Group</label>
                  <select
                    value={bulkEditCategory}
                    onChange={(e) => setBulkEditCategory(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-505 focus:outline-none"
                    data-helper="🛠️ BULK HELPER: Change category of all selected items. Leave unselected to bypass modification."
                  >
                    <option value="">-- No Change (Skip) --</option>
                    {categories.filter(c => c !== 'All').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="NEW_CATEGORY">+ Create Custom Category</option>
                  </select>
                </div>

                {bulkEditCategory === 'NEW_CATEGORY' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono font-medium">New Category Name</label>
                    <input
                      type="text"
                      placeholder="Enter custom category"
                      onChange={(e) => setBulkEditCategory(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-slate-800"
                      data-helper="🛠️ BULK HELPER: Key-in a new custom department tag to group these parts."
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Brand / Maker Manufacturer</label>
                  <input
                    type="text"
                    placeholder="Leave blank to skip"
                    value={bulkEditBrand}
                    onChange={(e) => setBulkEditBrand(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-slate-805"
                    data-helper="🛠️ BULK HELPER: Apply brand variable to selected elements. Blank retains previous data."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Reorder Buffer Point</label>
                  <input
                    type="number"
                    placeholder="Leave blank to skip"
                    value={bulkEditReorderPoint}
                    onChange={(e) => setBulkEditReorderPoint(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-slate-805 font-mono"
                    data-helper="🛠️ BULK HELPER: Update reorder threshold values for alerts. Blank retains previous levels."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Active Lifecycle Status</label>
                  <select
                    value={bulkEditStatus}
                    onChange={(e) => setBulkEditStatus(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-505 focus:outline-none"
                    data-helper="🛠️ BULK HELPER: Change toggled state to Active or Inactive. Blank retains current lifecycle states."
                  >
                    <option value="">-- No Change (Skip) --</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="bg-amber-50 rounded-lg p-3 text-[10.5px] text-amber-800 font-medium">
                  ⚠️ Executing this will update all selected {selectedItemIds.length} items simultaneously.
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkEditOpen(false);
                      setBulkEditCategory('');
                      setBulkEditBrand('');
                      setBulkEditReorderPoint('');
                      setBulkEditStatus('');
                    }}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkEditProgress(0);
                      setBulkEditSuccessSummary(null);
                      let currentPercent = 0;
                      const interval = setInterval(() => {
                        currentPercent += 10;
                        if (currentPercent > 100) {
                          clearInterval(interval);
                          
                          // Actually apply updates
                          selectedItemIds.forEach(id => {
                            const existing = items.find(it => it.id === id);
                            if (existing) {
                              const updated: Item = { ...existing };
                              const changes: string[] = [];

                              if (bulkEditCategory && bulkEditCategory !== 'NEW_CATEGORY') {
                                changes.push(`Category: "${existing.category}" ➔ "${bulkEditCategory}"`);
                                updated.category = bulkEditCategory;
                              }
                              if (bulkEditBrand !== '') {
                                changes.push(`Brand: "${existing.brand || 'None'}" ➔ "${bulkEditBrand}"`);
                                updated.brand = bulkEditBrand;
                              }
                              if (bulkEditReorderPoint !== '') {
                                changes.push(`Reorder Point: ${existing.reorderPoint} ➔ ${bulkEditReorderPoint}`);
                                updated.reorderPoint = Number(bulkEditReorderPoint);
                              }
                              if (bulkEditStatus) {
                                changes.push(`Status: "${existing.status}" ➔ "${bulkEditStatus}"`);
                                updated.status = bulkEditStatus as any;
                              }

                              if (changes.length > 0) {
                                // Create separate transaction log audit trail block detailing previous vs updated values
                                const changeLogDescription = `[Bulk Edit Audit Log] Modified properties: ${changes.join(' | ')}`;
                                const auditTxn = {
                                  id: `txn-bulk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                                  itemId: existing.id,
                                  itemName: existing.name,
                                  sku: existing.sku,
                                  quantity: 0, // configuration updates keep stock level delta at 0
                                  type: 'Adjustment' as const,
                                  referenceNumber: 'BULK-EDIT',
                                  warehouseId: Object.keys(existing.stockByWarehouse || {})[0] || 'wh-a',
                                  warehouseName: 'Central Office',
                                  date: new Date().toISOString(),
                                  description: changeLogDescription
                                };
                                onEditItem(updated, auditTxn);
                              } else {
                                onEditItem(updated);
                              }
                            }
                          });

                          // Generate nice description summary
                          const details: string[] = [];
                          if (bulkEditCategory && bulkEditCategory !== 'NEW_CATEGORY') details.push(`Category ➔ ${bulkEditCategory}`);
                          if (bulkEditBrand !== '') details.push(`Brand ➔ ${bulkEditBrand}`);
                          if (bulkEditReorderPoint !== '') details.push(`Reorder Threshold ➔ ${bulkEditReorderPoint} units`);
                          if (bulkEditStatus) details.push(`Lifecycle State ➔ ${bulkEditStatus}`);

                          const summaryMsg = `Successfully updated and wrote configuration changes for all ${selectedItemIds.length} designated SKU records in memory! Modifiers applied: ${details.join(', ') || 'None (No manual fields populated)'}.`;
                          setBulkEditSuccessSummary(summaryMsg);
                        } else {
                          setBulkEditProgress(currentPercent);
                        }
                      }, 100);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-750 text-white font-bold rounded-lg shadow cursor-pointer"
                  >
                    Apply Bulk Updates
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DIRECT STOCK ADJUSTMENT DIALOG */}
      {isAdjustOpen && focusedItem && (
        <div id="modal-container-adjust" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full animate-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">Manual Balance Adjustment</h3>
                  <p className="text-[10.5px] text-slate-500">Record an instant balance correction audit</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsAdjustOpen(false);
                  setFocusedItem(null);
                }} 
                className="p-1 cursor-pointer hover:bg-slate-100 text-slate-500 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-indigo-50 text-indigo-805 rounded-lg flex items-start gap-2.5 text-[11px] leading-relaxed">
              <Info className="w-4 h-4 mt-0.5 shrink-0 text-indigo-600" />
              <div>
                <span>Target item SKU: <b>{focusedItem.sku}</b> • {focusedItem.name}</span>
                <span className="block text-[10px] text-indigo-700 mt-1">
                  Adjustments will trigger instant physical audit trails logging the actor and reason codes.
                </span>
              </div>
            </div>

            <form onSubmit={handleExecuteAdjustment} className="space-y-4 text-xs font-sans">
              <div className="space-y-1 text-slate-700">
                <label className="text-[10px] font-bold uppercase text-slate-550 tracking-wider font-mono">Location Warehouse *</label>
                <select
                  value={adjustForm.warehouseId}
                  onChange={(e) => setAdjustForm({ ...adjustForm, warehouseId: e.target.value })}
                  className="w-full px-3 py-1.8 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 font-semibold focus:ring-1 focus:ring-indigo-505 focus:outline-none"
                >
                  {warehouses.map(wh => (
                    <option key={wh.id} value={wh.id}>📍 {wh.name} ({focusedItem.stockByWarehouse?.[wh.id] || 0} Pcs active)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-550 tracking-wider font-mono">Correction Method *</label>
                  <select
                    value={adjustForm.type}
                    onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value as 'add' | 'remove' | 'set' })}
                    className="w-full px-3 py-1.8 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 font-bold focus:ring-1 focus:ring-indigo-510 focus:outline-none"
                  >
                    <option value="add">➕ Increment (+) count</option>
                    <option value="remove">➖ Decrement (-) count</option>
                    <option value="set">✏️ Overwrite / Set (=) count</option>
                  </select>
                </div>

                <div className="space-y-1 text-slate-700">
                  <label className="text-[10px] font-bold uppercase text-slate-550 tracking-wider font-mono">Quantity Count *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={adjustForm.quantity}
                    onChange={(e) => setAdjustForm({ ...adjustForm, quantity: Math.max(1, Number(e.target.value)) })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 font-mono text-xs focus:ring-1 focus:ring-indigo-510 focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1 text-slate-700">
                <label className="text-[10px] font-bold uppercase text-slate-550 tracking-wider font-mono">Reason for Correction / Justification *</label>
                <input
                  type="text"
                  required
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  placeholder="e.g. Broken packaging write-off, manual check audit"
                  className="w-full px-3 py-1.8 border border-slate-200 bg-slate-50 rounded-lg text-slate-850 font-medium focus:ring-1 focus:ring-indigo-515 focus:outline-none focus:bg-white"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdjustOpen(false);
                    setFocusedItem(null);
                  }}
                  className="flex-1 py-1.8 bg-slate-100 hover:bg-slate-200 font-bold text-slate-650 rounded-lg transition-colors cursor-pointer text-center select-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.8 bg-indigo-600 hover:bg-indigo-755 text-white font-extrabold rounded-lg transition-all cursor-pointer text-center select-none"
                >
                  Write Balance Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE QR CODE LABELS MODAL PANEL */}
      {isPrintQRModalOpen && itemsToPrintQR.length > 0 && (
        <div id="modal-container-print-labels" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-left border border-slate-100">
            {/* Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-sans leading-none">Printable SKU QR Labels Hub</h3>
                  <p className="text-[10.5px] text-slate-500 font-mono mt-0.5">Sticker Size: 2.25" x 1.25" • Generated {itemsToPrintQR.length} label sheets</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPrintQRModalOpen(false);
                  setItemsToPrintQR([]);
                }}
                className="p-1 px-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-900 rounded-lg transition-all cursor-pointer text-xs font-bold font-mono"
              >
                Close (Esc)
              </button>
            </div>

            {/* Print Settings Banner */}
            <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100/60 leading-relaxed text-xs text-indigo-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
              <div>
                🖨️ <b>Print Tip</b>: Standard label rolls (2.25" x 1.25") align perfectly. For normal A4 paper, choose the "Save as PDF" option or print straight to label sticker sheets.
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="shrink-0 inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-[11px] px-3.5 py-1.5 rounded-lg transition-all select-none shadow hover:shadow-md cursor-pointer uppercase tracking-wider"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Trigger Print Process</span>
              </button>
            </div>

            {/* Injected Print Stylesheet ONLY active during browser printing */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                /* Hide everything in the document */
                body * {
                  visibility: hidden !important;
                  background: none !important;
                }
                /* Exposing only print sticker zone */
                #printable-labels-area, #printable-labels-area * {
                  visibility: visible !important;
                }
                #printable-labels-area {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  background: white !important;
                  color: black !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  box-shadow: none !important;
                }
                /* Break page on every label for standard rolls or grid wrap */
                .print-sticker-card {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  border: 1px solid #000 !important;
                  margin-bottom: 5px !important;
                }
              }
            `}} />

            {/* Main scrollable layout cards */}
            <div className="p-6 overflow-y-auto bg-slate-100 flex-1 space-y-6">
              <div 
                id="printable-labels-area" 
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
              >
                {itemsToPrintQR.map((item) => (
                  <div 
                    key={item.sku}
                    className="print-sticker-card bg-white border-2 border-slate-300 rounded-xl p-4 flex gap-4 items-center shadow-xs md:max-w-xs relative bg-no-repeat overflow-hidden"
                  >
                    {/* Visual Stamp Line */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-slate-900" />
                    
                    {/* Barcode block code left side aligned to replace QR per guidelines */}
                    <div className="w-24 h-16 bg-slate-50 border border-slate-205 rounded p-1.5 shrink-0 flex items-center justify-center">
                      <div className="w-20 h-12 text-slate-950">
                        <VisualBarcode value={item.sku} height={35} />
                      </div>
                    </div>

                    {/* Metadata text label right side aligned */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between h-20 text-left">
                      <div>
                        <span className="font-mono text-xs font-black bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-900 tracking-wider">
                          {item.sku}
                        </span>
                        <h4 className="font-bold text-slate-900 mt-1 line-clamp-1 leading-snug text-xs">
                          {item.name}
                        </h4>
                        <p className="text-[9.5px] text-slate-450 line-clamp-1 font-mono font-medium">
                          Brand: {item.brand || 'Generic'} • {item.category}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between text-[8px] font-mono text-slate-400 mt-1">
                        <span className="truncate max-w-[100px]">{item.applicableUnits || 'Genuine OEM Part'}</span>
                        <span className="font-bold text-slate-900 shrink-0 font-sans">PHP-{item.unit}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0 text-[11px] text-slate-500">
              <span className="font-mono">Total Stickers Configured: <b>{itemsToPrintQR.length}</b></span>
              <button
                type="button"
                onClick={() => {
                  setIsPrintQRModalOpen(false);
                  setItemsToPrintQR([]);
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-250 font-bold text-slate-700 rounded-lg cursor-pointer transition-all"
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
