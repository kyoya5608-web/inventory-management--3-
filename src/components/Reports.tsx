/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { Item, Warehouse, PurchaseOrder, SalesOrder, InventoryTransaction, Supplier, StockLot } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  PiggyBank, 
  PackageCheck, 
  BarChart3, 
  PieChart as LucidePieChart, 
  LineChart as LucideLineChart,
  DollarSign,
  Boxes,
  MapPin,
  ClipboardList,
  AlertTriangle,
  History,
  Briefcase,
  Layers,
  Percent,
  Truck,
  Building,
  FileSpreadsheet,
  CheckCircle2,
  LogOut,
  Hourglass
} from 'lucide-react';
import { initAuth, googleSignIn, logoutUser, exportReportToGoogleSheets } from '../workspace';
import SystemAuditTrailPanel from './SystemAuditTrailPanel';

function SafeResponsiveContainer({ children, height, width = "100%", ...props }: any) {
  const [hasCalculated, setHasCalculated] = useState(false);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setHasCalculated(true);
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  if (!hasCalculated) {
    return <div style={{ height, width: "100%" }} />;
  }

  return (
    <ResponsiveContainer width={width} height={height} {...props}>
      {children}
    </ResponsiveContainer>
  );
}

interface ReportsProps {
  items: Item[];
  warehouses: Warehouse[];
  purchaseOrders: PurchaseOrder[];
  salesOrders: SalesOrder[];
  transactions: InventoryTransaction[];
  suppliers?: Supplier[];
  lots?: StockLot[];
}

export default function Reports({
  items = [],
  warehouses = [],
  purchaseOrders = [],
  salesOrders = [],
  transactions = [],
  suppliers = [],
  lots = []
}: ReportsProps) {
  const [activeReportTab, setActiveReportTab] = useState<'financials' | 'inventory' | 'warehouses' | 'logs' | 'ph-compliance' | 'weekly-pdf' | 'procurement-forecast' | 'collections-timeline' | 'supplier-analytics' | 'inventory-aging'>('financials');
  const [reportFrequency, setReportFrequency] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [supplierPeriod, setSupplierPeriod] = useState<'30' | '60' | '90' | '180' | '365'>('365');

  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');

  // Procurement Forecast States
  const [lookbackDays, setLookbackDays] = useState<number>(60);
  const [forecastPeriod, setForecastPeriod] = useState<number>(90);
  const [demandMultiplier, setDemandMultiplier] = useState<number>(1.0);
  const [forecastSearch, setForecastSearch] = useState<string>('');
  const [forecastCategory, setForecastCategory] = useState<string>('ALL');
  const [forecastBrand, setForecastBrand] = useState<string>('ALL');

  // FSM Classification States
  const [procurementSubTab, setProcurementSubTab] = useState<'forecast' | 'fsm-movement' | 'demand-forecast'>('forecast');
  const [fsmPeriodDays, setFsmPeriodDays] = useState<number>(90);
  const [fsmMovementFilter, setFsmMovementFilter] = useState<'ALL' | 'FAST' | 'SLOW' | 'NON_MOVING' | 'NON-MOVING'>('ALL');
  const [fastMovingThreshold, setFastMovingThreshold] = useState<number>(5);

  // Sales Collection Report Filter States
  const [collectionSearch, setCollectionSearch] = useState<string>('');
  const [collectionStatus, setCollectionStatus] = useState<string>('ALL'); // ALL, Paid, Unpaid
  const [collectionTaxType, setCollectionTaxType] = useState<string>('ALL'); // ALL, VAT, Non-VAT/None

  // Inventory Aging Report States
  const [agingWarehouseFilter, setAgingWarehouseFilter] = useState<string>('ALL');
  const [agingCategoryFilter, setAgingCategoryFilter] = useState<string>('ALL');
  const [agingBrandFilter, setAgingBrandFilter] = useState<string>('ALL');
  const [agingIntervalFilter, setAgingIntervalFilter] = useState<'ALL' | 'fresh' | 'active' | 'stagnant' | 'dead'>('ALL');
  const [agingSearch, setAgingSearch] = useState<string>('');

  // Google Sheets Workspace Auth State Managers
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        setIsAuthLoading(false);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        setIsAuthLoading(false);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    setExportError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setExportError(err.message || 'Failed to authenticate Google Account.');
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await logoutUser();
      setGoogleUser(null);
      setGoogleToken(null);
      setExportedUrl(null);
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  const handleExportToSheets = async () => {
    if (!googleToken) return;
    setIsExporting(true);
    setExportError(null);
    setExportedUrl(null);

    try {
      const sheetUrl = await exportReportToGoogleSheets({
        selectedYear,
        selectedMonth,
        totalSales,
        totalPurchases,
        potentialMargin,
        avgLeadTime,
        taxSummary,
        categorySalesSummary,
        clustersData,
        salesOrders: filteredSalesOrders,
        purchaseOrders: filteredPurchaseOrders,
        transactions: filteredTransactions,
        warehouses,
        items,
        suppliers
      });
      setExportedUrl(sheetUrl);
    } catch (err: any) {
      console.error('Google Sheets Export error:', err);
      setExportError(err.message || 'Failed to export dynamic report to Google Sheets.');
    } finally {
      setIsExporting(false);
    }
  };

  // Export filtered forecast records to standard CSV
  const exportForecastToCSV = (filteredForecasts: any[]) => {
    const headers = [
      'SKU',
      'Name',
      'Category',
      'Brand',
      'Current Stock',
      'Consumption Rate (Daily)',
      'Projected Consumed Qty',
      'Predicted Reorder Date',
      'Recommended Reorder Qty',
      'Estimated Outlay (PHP)'
    ];

    const rows = filteredForecasts.map(f => [
      `"${f.item.sku}"`,
      `"${f.item.name.replace(/"/g, '""')}"`,
      `"${f.item.category}"`,
      `"${(f.item.brand || 'Generic').replace(/"/g, '""')}"`,
      f.currentStock,
      f.finalDailyRate.toFixed(4),
      Math.round(f.projectedConsumption),
      `"${f.runOutDateStr}"`,
      f.recommendedReorderQty,
      f.estimatedSourcingCost
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `central_procurement_forecast_${forecastPeriod}d_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dynamically extract available years from datasets
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    
    // Seed standard years so it's never empty
    years.add('2025');
    years.add('2026');
    years.add('2027');

    purchaseOrders.forEach(po => {
      const dateStr = po.orderDate || po.deliveryDate;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          years.add(String(d.getFullYear()));
        }
      }
    });

    salesOrders.forEach(so => {
      const dateStr = so.orderDate || so.shipmentDate;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          years.add(String(d.getFullYear()));
        }
      }
    });

    transactions.forEach(t => {
      const dateStr = t.date;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          years.add(String(d.getFullYear()));
        }
      }
    });

    return Array.from(years).sort();
  }, [purchaseOrders, salesOrders, transactions]);

  // Filter base datasets based on Year and Month selections
  const filteredPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter(po => {
      const date = new Date(po.orderDate || po.deliveryDate);
      if (isNaN(date.getTime())) return true;
      const yearMatch = selectedYear === 'ALL' || String(date.getFullYear()) === selectedYear;
      const monthMatch = selectedMonth === 'ALL' || String(date.getMonth()) === selectedMonth;
      return yearMatch && monthMatch;
    });
  }, [purchaseOrders, selectedYear, selectedMonth]);

  const filteredSalesOrders = useMemo(() => {
    return salesOrders.filter(so => {
      const date = new Date(so.orderDate || so.shipmentDate);
      if (isNaN(date.getTime())) return true;
      const yearMatch = selectedYear === 'ALL' || String(date.getFullYear()) === selectedYear;
      const monthMatch = selectedMonth === 'ALL' || String(date.getMonth()) === selectedMonth;
      return yearMatch && monthMatch;
    });
  }, [salesOrders, selectedYear, selectedMonth]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const date = new Date(t.date);
      if (isNaN(date.getTime())) return true;
      const yearMatch = selectedYear === 'ALL' || String(date.getFullYear()) === selectedYear;
      const monthMatch = selectedMonth === 'ALL' || String(date.getMonth()) === selectedMonth;
      return yearMatch && monthMatch;
    });
  }, [transactions, selectedYear, selectedMonth]);

  // Procurement Forecast based on last 90 days Consumption rates
  const procurementForecast = useMemo(() => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    return items.map(item => {
      // Outbound transactions for this item in the last 90 days
      const outboundTxns = transactions.filter(t => 
        t.itemId === item.id && 
        new Date(t.date) >= ninetyDaysAgo &&
        ['Stock Out', 'Adjustment Deduct', 'Transfer Out'].includes(t.type)
      );

      const totalOutbound = outboundTxns.reduce((sum, t) => sum + Math.abs(t.quantity), 0);
      const avgDailyConsumption = totalOutbound > 0 ? (totalOutbound / 90) : 0;

      // Current aggregate stock on hand
      const currentOnHand = Object.values(item.stockByWarehouse || {}).reduce((s: number, q: any) => s + ((q as number) || 0), 0);
      const reorderLevel = item.reorderPoint || 0;

      let daysToReorder = Infinity;
      let predictedDateStr = 'Safe / Stable';
      let status: 'CRITICAL' | 'ATTENTION' | 'STABLE' = 'STABLE';

      if (currentOnHand <= reorderLevel) {
        daysToReorder = 0;
        predictedDateStr = 'IMMEDIATE - Sourcing Needed!';
        status = 'CRITICAL';
      } else if (avgDailyConsumption > 0) {
        const remainingBuffer = currentOnHand - reorderLevel;
        daysToReorder = Math.ceil(remainingBuffer / avgDailyConsumption);
        
        if (daysToReorder <= 7) {
          status = 'CRITICAL';
        } else if (daysToReorder <= 30) {
          status = 'ATTENTION';
        }

        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysToReorder);
        predictedDateStr = targetDate.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: '2-digit'
        });
      } else {
        predictedDateStr = 'No Active Outbound (Inactive)';
      }

      return {
        ...item,
        currentOnHand,
        totalOutbound,
        avgDailyConsumption,
        daysToReorder,
        predictedDateStr,
        status
      };
    }).sort((a, b) => a.daysToReorder - b.daysToReorder);
  }, [items, transactions]);

  // Year-only filtered sets for chronological charts (trend lines)
  const filteredPurchaseOrdersYearOnly = useMemo(() => {
    return purchaseOrders.filter(po => {
      const date = new Date(po.orderDate || po.deliveryDate);
      if (isNaN(date.getTime())) return true;
      return selectedYear === 'ALL' || String(date.getFullYear()) === selectedYear;
    });
  }, [purchaseOrders, selectedYear]);

  const filteredSalesOrdersYearOnly = useMemo(() => {
    return salesOrders.filter(so => {
      const date = new Date(so.orderDate || so.shipmentDate);
      if (isNaN(date.getTime())) return true;
      return selectedYear === 'ALL' || String(date.getFullYear()) === selectedYear;
    });
  }, [salesOrders, selectedYear]);

  // --- BRAND PERFORMANCE, SUPPLIER METRICS & LEAD TIMES ---

  // Calculate Avg lead time
  const avgLeadTime = useMemo(() => {
    const receivedPOs = filteredPurchaseOrders.filter(po => po.status === 'Received');
    if (receivedPOs.length === 0) return 0;
    
    let totalDays = 0;
    let counted = 0;
    
    receivedPOs.forEach(po => {
      if (po.leadTimeDays && po.leadTimeDays > 0) {
        totalDays += po.leadTimeDays;
        counted++;
      } else {
        const start = new Date(po.orderDate).getTime();
        const endStr = po.actualDeliveryDate || po.goodsReceipt?.receivedDate || po.deliveryDate;
        if (endStr && start) {
          const end = new Date(endStr).getTime();
          const pDiff = (end - start) / (1000 * 60 * 60 * 24);
          if (pDiff >= 0) {
            totalDays += pDiff;
            counted++;
          }
        }
      }
    });
    
    return counted > 0 ? totalDays / counted : 0;
  }, [filteredPurchaseOrders]);

  // Monthly procurement spending trends by Supplier (uses year-only filter for smooth line trends)
  const monthlySupplierProcurementData = useMemo(() => {
    const supplierNames: string[] = Array.from(new Set<string>(filteredPurchaseOrdersYearOnly.map(po => {
      const matchedSupplier = suppliers.find(s => s.id === po.supplierId || s.name === po.vendorName);
      return String(matchedSupplier ? matchedSupplier.name : po.vendorName);
    })));

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthMap: Record<string, Record<string, number>> = {};

    monthNames.forEach(m => {
      monthMap[m] = {};
      supplierNames.forEach(sName => {
        monthMap[m][sName] = 0;
      });
    });

    filteredPurchaseOrdersYearOnly.forEach(po => {
      if (po.status === 'Cancelled') return;
      const matchedSupplier = suppliers.find(s => s.id === po.supplierId || s.name === po.vendorName);
      const sName = matchedSupplier ? matchedSupplier.name : po.vendorName;
      
      const date = new Date(po.orderDate);
      if (!isNaN(date.getTime())) {
        const mName = monthNames[date.getMonth()];
        const rate = matchedSupplier?.exchangeRate || po.exchangeRate || 1.0;
        const currency = matchedSupplier?.currency || po.currency || 'USD';
        
        po.items.forEach(line => {
          const itemObj = items.find(it => it.id === line.itemId);
          let amountInPHP = line.quantity * (line.unitCost || itemObj?.purchasePrice || 0) * rate;
          monthMap[mName][sName] = (monthMap[mName][sName] || 0) + amountInPHP;
        });
      }
    });

    return monthNames.map(m => ({
      month: m,
      ...monthMap[m]
    }));
  }, [filteredPurchaseOrdersYearOnly, suppliers, items]);

  const uniqueSupplierSpentNames = useMemo(() => {
    return Array.from(new Set(filteredPurchaseOrdersYearOnly.map(po => {
      const matchedSupplier = suppliers.find(s => s.id === po.supplierId || s.name === po.vendorName);
      return matchedSupplier ? matchedSupplier.name : po.vendorName;
    })));
  }, [filteredPurchaseOrdersYearOnly, suppliers]);

  // Brand sales data breakdown of parts vs services
  const brandSalesData = useMemo(() => {
    const validSOs = filteredSalesOrders.filter(so => so.status !== 'Cancelled');
    const brandMap: Record<string, { brand: string; partsSales: number; servicesSales: number; totalSales: number }> = {};

    validSOs.forEach(so => {
      so.items.forEach(line => {
        const itemObj = items.find(it => it.id === line.itemId);
        const brandName = (itemObj?.brand || 'Generic').trim();
        
        const classification = (line.category === 'Parts' || line.category === 'Services') 
          ? line.category 
          : (itemObj?.category?.toLowerCase().includes('service') || itemObj?.category?.toLowerCase().includes('labor') || itemObj?.category?.toLowerCase().includes('work')) 
            ? 'Services' 
            : 'Parts';

        const lineAmount = (line.quantity * line.unitPrice);

        if (!brandMap[brandName]) {
          brandMap[brandName] = { brand: brandName, partsSales: 0, servicesSales: 0, totalSales: 0 };
        }

        if (classification === 'Services') {
          brandMap[brandName].servicesSales += lineAmount;
        } else {
          brandMap[brandName].partsSales += lineAmount;
        }
        brandMap[brandName].totalSales += lineAmount;
      });
    });

    return Object.values(brandMap).sort((a, b) => b.totalSales - a.totalSales);
  }, [filteredSalesOrders, items]);

  // --- PH REGIONAL CLUSTERS, CATEGORY BREAKDOWN, & TAX AUDITS ---

  // 1. Sales per Cluster breakdown (parts and service classification)
  const clustersData = useMemo(() => {
    const validSOs = filteredSalesOrders.filter(so => so.status !== 'Cancelled');
    const clusterSummary: Record<string, { name: string; totalSales: number; partsSales: number; servicesSales: number; vatExSales: number; vatIncSales: number; count: number }> = {};
    
    // Core default clusters to seed in the list for a clean layout
    const defaultClusters = ['Head Office', 'Davao Hub', 'Cebu Logistics', 'North Luzon Cluster', 'Other / Walk-In'];
    defaultClusters.forEach(name => {
      clusterSummary[name] = { name, totalSales: 0, partsSales: 0, servicesSales: 0, vatExSales: 0, vatIncSales: 0, count: 0 };
    });

    validSOs.forEach(so => {
      const rawCluster = so.salesCluster || 'Other / Walk-In';
      let clusterName = rawCluster;
      if (rawCluster.toLowerCase().includes('davao')) clusterName = 'Davao Hub';
      else if (rawCluster.toLowerCase().includes('cebu')) clusterName = 'Cebu Logistics';
      else if (rawCluster.toLowerCase().includes('luzon')) clusterName = 'North Luzon Cluster';
      else if (rawCluster.toLowerCase().includes('head') || rawCluster.toLowerCase().includes('manila') || rawCluster.toLowerCase().includes('office')) clusterName = 'Head Office';
      else if (!clusterSummary[rawCluster]) {
        clusterSummary[rawCluster] = { name: rawCluster, totalSales: 0, partsSales: 0, servicesSales: 0, vatExSales: 0, vatIncSales: 0, count: 0 };
      }

      const cluster = clusterSummary[clusterName] || clusterSummary['Other / Walk-In'] || clusterSummary[rawCluster];
      cluster.count += 1;
      cluster.vatIncSales += so.total || 0;
      cluster.vatExSales += so.subtotal || 0;
      cluster.totalSales += so.total || 0;

      // Classify line items into parts & services
      so.items.forEach(line => {
        const itemObj = items.find(it => it.id === line.itemId);
        const classification = (line.category === 'Parts' || line.category === 'Services') 
          ? line.category 
          : (itemObj?.category?.toLowerCase().includes('service') || itemObj?.category?.toLowerCase().includes('labor') || itemObj?.category?.toLowerCase().includes('work')) 
            ? 'Services' 
            : 'Parts';

        const lineAmount = (line.quantity * line.unitPrice);
        if (classification === 'Services') {
          cluster.servicesSales += lineAmount;
        } else {
          cluster.partsSales += lineAmount;
        }
      });
    });

    return Object.values(clusterSummary).filter(c => c.count > 0 || defaultClusters.includes(c.name));
  }, [filteredSalesOrders, items]);

  // 2. VAT Exclusive vs VAT Inclusive Sales (sales vat ex & sales w/ vat)
  const taxSummary = useMemo(() => {
    const validSOs = filteredSalesOrders.filter(so => so.status !== 'Cancelled');
    let totalVatExclusive = 0;
    let totalVatInclusive = 0;
    let totalTaxCollected = 0;
    let vatSalesCount = 0;
    let exemptSalesCount = 0;

    validSOs.forEach(so => {
      totalVatExclusive += so.subtotal || 0;
      totalVatInclusive += so.total || 0;
      totalTaxCollected += so.tax || 0;
      if (so.taxType === 'VAT' || (so.tax && so.tax > 0)) {
        vatSalesCount++;
      } else {
        exemptSalesCount++;
      }
    });

    return {
      totalVatExclusive,
      totalVatInclusive,
      totalTaxCollected,
      vatSalesCount,
      exemptSalesCount
    };
  }, [filteredSalesOrders]);

  // 3. Sales per Item Category
  const categorySalesSummary = useMemo(() => {
    const validSOs = filteredSalesOrders.filter(so => so.status !== 'Cancelled');
    const catSales: Record<string, { category: string; amount: number; qty: number }> = {};

    validSOs.forEach(so => {
      so.items.forEach(line => {
        const itemObj = items.find(it => it.id === line.itemId);
        const cat = itemObj?.category || line.category || 'General';
        if (!catSales[cat]) {
          catSales[cat] = { category: cat, amount: 0, qty: 0 };
        }
        catSales[cat].amount += (line.quantity * line.unitPrice);
        catSales[cat].qty += line.quantity;
      });
    });

    return Object.values(catSales).sort((a, b) => b.amount - a.amount);
  }, [filteredSalesOrders, items]);

  // 4. Purchase Amount per Supplier per Category
  const purchaseSupplierCategorySummary = useMemo(() => {
    const summary: Record<string, { supplierName: string; totalSpent: number; categories: Record<string, number> }> = {};

    filteredPurchaseOrders.forEach(po => {
      let supName = po.vendorName || po.supplierId || 'General Supplier';
      let key = po.supplierId || supName;

      // Match partner Supplier for accurate currency exchange rate conversion to PHP
      const matchedSupplier = suppliers.find(s => s.id === po.supplierId || s.name === po.vendorName);
      if (matchedSupplier) {
        supName = matchedSupplier.name;
        key = matchedSupplier.id;
      }

      const rate = matchedSupplier?.exchangeRate || po.exchangeRate || 1.0;

      if (!summary[key]) {
        summary[key] = { supplierName: supName, totalSpent: 0, categories: {} };
      }

      po.items.forEach(line => {
        const itemObj = items.find(it => it.id === line.itemId);
        const cat = itemObj?.category || 'General';
        
        let amountInPHP = line.quantity * (line.unitCost || itemObj?.purchasePrice || 0) * rate;

        if (!summary[key].categories[cat]) {
          summary[key].categories[cat] = 0;
        }
        summary[key].categories[cat] += amountInPHP;
        summary[key].totalSpent += amountInPHP;
      });
    });

    return Object.values(summary).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [filteredPurchaseOrders, items, suppliers]);

  // 5. BIR-Aligned Sales Collection Audit Data
  const collectionsSummary = useMemo(() => {
    const activeOrders = salesOrders.filter(so => so.status !== 'Draft' && so.status !== 'Cancelled');
    
    const filteredByTime = activeOrders.filter(so => {
      if (!so.orderDate) return true;
      const parts = so.orderDate.split('-');
      if (parts.length < 2) return true;
      const yr = parts[0];
      const mo = parts[1];
      
      const matchYear = selectedYear === 'ALL' || yr === selectedYear;
      
      let matchMonth = true;
      if (selectedMonth !== 'ALL') {
        const monthIndexStr = String(selectedMonth).padStart(2, '0');
        matchMonth = mo === monthIndexStr;
      }
      
      return matchYear && matchMonth;
    });

    const finalFiltered = filteredByTime.filter(so => {
      const matchSearch = collectionSearch === '' || 
        so.soNumber.toLowerCase().includes(collectionSearch.toLowerCase()) || 
        so.customerName.toLowerCase().includes(collectionSearch.toLowerCase()) ||
        (so.invoiceNumber && so.invoiceNumber.toLowerCase().includes(collectionSearch.toLowerCase()));
        
      const matchStatus = collectionStatus === 'ALL' || 
        (collectionStatus === 'Paid' && so.isPaid) ||
        (collectionStatus === 'Unpaid' && !so.isPaid);

      const matchTax = collectionTaxType === 'ALL' ||
        (collectionTaxType === 'VAT' && so.taxType === 'VAT') ||
        (collectionTaxType === 'Non-VAT' && so.taxType !== 'VAT');

      return matchSearch && matchStatus && matchTax;
    });

    let totalBilled = 0;
    let totalCollected = 0;
    let totalEwt = 0;
    let totalAr = 0;

    finalFiltered.forEach(so => {
      if (so.isInvoiced || so.invoiceNumber || (so as any).invoiceCreated) {
        totalBilled += so.total;
      }
      if (so.isPaid) {
        totalCollected += (so.amountPaid ?? so.total);
        totalEwt += (so.ewtAmount ?? 0);
      } else {
        totalAr += so.total;
      }
    });

    return {
      orders: finalFiltered,
      totalBilled,
      totalCollected,
      totalEwt,
      totalAr
    };
  }, [salesOrders, selectedMonth, selectedYear, collectionSearch, collectionStatus, collectionTaxType]);

  // Dual-Timeline Collection Comparison (Expected SO Month/Year vs. Actual Collection Month/Year)
  const collectionsTimelineComparison = useMemo(() => {
    // 1. Group by Sales Order Month/Year (Accrual expectation)
    const salesOrderTimeline: Record<string, { totalBilled: number; totalCollected: number; count: number }> = {};
    // 2. Group by Actual Collection Month/Year (Actual receipts)
    const actualCollectionTimeline: Record<string, { totalCollected: number; count: number }> = {};

    salesOrders.forEach(so => {
      if (so.status === 'Cancelled') return;

      // Group Expectations by Sales Order Date (SO Month & Year)
      if (so.orderDate) {
        const parts = so.orderDate.split('-'); // "YYYY-MM-DD" -> ["YYYY", "MM", "DD"]
        if (parts.length >= 2) {
          const key = `${parts[0]}-${parts[1]}`;
          if (!salesOrderTimeline[key]) {
            salesOrderTimeline[key] = { totalBilled: 0, totalCollected: 0, count: 0 };
          }
          salesOrderTimeline[key].totalBilled += so.total;
          salesOrderTimeline[key].count += 1;
          if (so.isPaid) {
            salesOrderTimeline[key].totalCollected += (so.amountPaid ?? so.total);
          }
        }
      }

      // Group Actual Receipts by Actual Payment Date (Collection Month & Year)
      if (so.isPaid) {
        let paymentKey = '';
        if (so.paymentDate) {
          const parts = so.paymentDate.split('-');
          if (parts.length >= 2) {
            paymentKey = `${parts[0]}-${parts[1]}`;
          }
        } else if (so.orderDate) {
          // Fallback to order date if marked paid but payment date is missing
          const parts = so.orderDate.split('-');
          if (parts.length >= 2) {
            paymentKey = `${parts[0]}-${parts[1]}`;
          }
        }

        if (paymentKey) {
          if (!actualCollectionTimeline[paymentKey]) {
            actualCollectionTimeline[paymentKey] = { totalCollected: 0, count: 0 };
          }
          actualCollectionTimeline[paymentKey].totalCollected += (so.amountPaid ?? so.total);
          actualCollectionTimeline[paymentKey].count += 1;
        }
      }
    });

    // Merge periods together chronologically
    const allPeriods = Array.from(new Set([
      ...Object.keys(salesOrderTimeline),
      ...Object.keys(actualCollectionTimeline)
    ])).sort();

    const chartData = allPeriods.map(period => {
      const soData = salesOrderTimeline[period] || { totalBilled: 0, totalCollected: 0, count: 0 };
      const actualData = actualCollectionTimeline[period] || { totalCollected: 0, count: 0 };
      return {
        period, // e.g. "2026-05"
        expectedBilled: soData.totalBilled,
        expectedCollected: soData.totalCollected,
        actualCollected: actualData.totalCollected,
        soCount: soData.count,
        collectionCount: actualData.count
      };
    });

    return {
      chartData,
      salesOrderTimeline,
      actualCollectionTimeline
    };
  }, [salesOrders]);

  // --- FINANCIAL CALCULATIONS ---
  // Total Inventory Value at Cost and Price
  const { totalValueAtCost, totalValueAtRetail, potentialMargin, costValuationByCurrency } = useMemo(() => {
    let costSum = 0;
    let retailSum = 0;
    const currencySplits: Record<string, { currency: string; rawCost: number; convertedPHP: number }> = {};

    items.forEach(item => {
      const qoh = Object.values(item.stockByWarehouse || {}).reduce((sum, qty) => sum + qty, 0);
      
      const supplier = suppliers?.find(sup => sup.id === item.supplierId);
      const exRate = supplier?.exchangeRate ?? 1.0;
      const currency = supplier?.currency ?? 'PHP';
      
      const itemCostInPHP = item.purchasePrice * exRate;
      const totalItemCostPHP = qoh * itemCostInPHP;
      const totalItemCostRaw = qoh * item.purchasePrice;

      costSum += totalItemCostPHP;
      retailSum += qoh * item.sellingPrice;

      if (qoh > 0) {
        if (!currencySplits[currency]) {
          currencySplits[currency] = { currency, rawCost: 0, convertedPHP: 0 };
        }
        currencySplits[currency].rawCost += totalItemCostRaw;
        currencySplits[currency].convertedPHP += totalItemCostPHP;
      }
    });

    const margin = retailSum > 0 ? ((retailSum - costSum) / retailSum) * 100 : 0;
    return {
      totalValueAtCost: costSum,
      totalValueAtRetail: retailSum,
      potentialMargin: margin,
      costValuationByCurrency: currencySplits
    };
  }, [items, suppliers]);

  // Total Purchase commitment (sum of active POs)
  const totalPurchases = useMemo(() => {
    return filteredPurchaseOrders.reduce((sum, po) => sum + (po.total || 0), 0);
  }, [filteredPurchaseOrders]);

  // Total Sales commitments (sum of sales orders)
  const totalSales = useMemo(() => {
    return filteredSalesOrders.reduce((sum, so) => sum + (so.total || 0), 0);
  }, [filteredSalesOrders]);

  // --- RECHARTS DATA PREPARATIONS ---

  // 1. Stock Valuation per Category (Pie Chart)
  const categoryData = useMemo(() => {
    const map: Record<string, { name: string; value: number }> = {};
    items.forEach(item => {
      const qoh = Object.values(item.stockByWarehouse || {}).reduce((sum, qty) => sum + qty, 0);
      const supplier = suppliers?.find(sup => sup.id === item.supplierId);
      const exRate = supplier?.exchangeRate ?? 1.0;
      const val = qoh * item.purchasePrice * exRate;
      if (val <= 0) return;
      if (!map[item.category]) {
        map[item.category] = { name: item.category, value: 0 };
      }
      map[item.category].value += Math.round(val);
    });
    return Object.values(map);
  }, [items, suppliers]);

  // 2. Warehouse Stock Allocation (Bar Chart)
  const warehouseStockData = useMemo(() => {
    return warehouses.map(wh => {
      let totalQty = 0;
      let totalVal = 0;
      items.forEach(item => {
        const qty = item.stockByWarehouse?.[wh.id] || 0;
        totalQty += qty;
        const supplier = suppliers?.find(sup => sup.id === item.supplierId);
        const exRate = supplier?.exchangeRate ?? 1.0;
        totalVal += qty * item.purchasePrice * exRate;
      });
      return {
        name: wh.code || wh.name.substring(0, 8),
        fullName: wh.name,
        quantity: totalQty,
        valuation: Math.round(totalVal)
      };
    });
  }, [warehouses, items, suppliers]);

  // 3. Purchase vs Sales Orders Trend (Configurable Weekly, Monthly, or Yearly)
  const timelineData = useMemo(() => {
    if (reportFrequency === 'weekly') {
      const dataMap: Record<string, { label: string; Purchases: number; Sales: number }> = {};
      
      // Seed the last 12 weeks to ensure continuous chart flow
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - (i * 7));
        const janFirst = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil((((d.getTime() - janFirst.getTime()) / 86400000) + janFirst.getDay() + 1) / 7);
        const label = `Wk ${weekNum} (${d.getFullYear()})`;
        dataMap[label] = { label, Purchases: 0, Sales: 0 };
      }

      // Populate purchase orders
      filteredPurchaseOrdersYearOnly.forEach(po => {
        const d = new Date(po.orderDate || po.deliveryDate || Date.now());
        const janFirst = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil((((d.getTime() - janFirst.getTime()) / 86400000) + janFirst.getDay() + 1) / 7);
        const label = `Wk ${weekNum} (${d.getFullYear()})`;
        const poVal = po.total || 0;
        
        if (!dataMap[label]) {
          dataMap[label] = { label, Purchases: 0, Sales: 0 };
        }
        dataMap[label].Purchases += Math.round(poVal);
      });

      // Populate sales orders
      filteredSalesOrdersYearOnly.forEach(so => {
        const d = new Date(so.orderDate || so.shipmentDate || Date.now());
        const janFirst = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil((((d.getTime() - janFirst.getTime()) / 86400000) + janFirst.getDay() + 1) / 7);
        const label = `Wk ${weekNum} (${d.getFullYear()})`;
        const soVal = so.total || 0;
        
        if (!dataMap[label]) {
          dataMap[label] = { label, Purchases: 0, Sales: 0 };
        }
        dataMap[label].Sales += Math.round(soVal);
      });

      // Sort chronological
      return Object.values(dataMap);

    } else if (reportFrequency === 'yearly') {
      const dataMap: Record<string, { label: string; Purchases: number; Sales: number }> = {
        '2025': { label: '2025', Purchases: 0, Sales: 0 },
        '2026': { label: '2026', Purchases: 0, Sales: 0 },
        '2027': { label: '2027', Purchases: 0, Sales: 0 },
      };

      filteredPurchaseOrdersYearOnly.forEach(po => {
        const date = new Date(po.orderDate || po.deliveryDate || Date.now());
        const yr = String(date.getFullYear());
        if (!dataMap[yr]) {
          dataMap[yr] = { label: yr, Purchases: 0, Sales: 0 };
        }
        dataMap[yr].Purchases += Math.round(po.total || 0);
      });

      filteredSalesOrdersYearOnly.forEach(so => {
        const date = new Date(so.orderDate || so.shipmentDate || Date.now());
        const yr = String(date.getFullYear());
        if (!dataMap[yr]) {
          dataMap[yr] = { label: yr, Purchases: 0, Sales: 0 };
        }
        dataMap[yr].Sales += Math.round(so.total || 0);
      });

      return Object.values(dataMap).sort((a,b) => a.label.localeCompare(b.label));

    } else {
      // Monthly
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dataMap: Record<string, { label: string; Purchases: number; Sales: number }> = {};
      
      months.forEach((m) => {
        dataMap[m] = { label: m, Purchases: 0, Sales: 0 };
      });

      filteredPurchaseOrdersYearOnly.forEach(po => {
        const date = new Date(po.orderDate || po.deliveryDate || Date.now());
        const mName = months[date.getMonth()];
        if (dataMap[mName]) {
          dataMap[mName].Purchases += Math.round(po.total || 0);
        }
      });

      filteredSalesOrdersYearOnly.forEach(so => {
        const date = new Date(so.orderDate || so.shipmentDate || Date.now());
        const mName = months[date.getMonth()];
        if (dataMap[mName]) {
          dataMap[mName].Sales += Math.round(so.total || 0);
        }
      });

      return Object.values(dataMap);
    }
  }, [filteredPurchaseOrdersYearOnly, filteredSalesOrdersYearOnly, reportFrequency]);

  // 4. Low Stock alert items
  const lowStockItems = useMemo(() => {
    return items.filter(item => {
      const totalQty = Object.values(item.stockByWarehouse).reduce((sum, q) => sum + q, 0);
      return totalQty <= item.reorderPoint;
    });
  }, [items]);

  // 5. 30-day Sparkline trends for Purchases & Sales (Chronological 30 days up to current local system time)
  const sparklineData = useMemo(() => {
    const days: { dateStr: string; purchaseSpend: number; salesRevenue: number }[] = [];
    const now = new Date();
    
    // Generate previous 30 calendar days
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        dateStr,
        purchaseSpend: 0,
        salesRevenue: 0
      });
    }

    // Accumulate actual sourcing purchase orders (excluding Cancelled/Draft)
    purchaseOrders.forEach(po => {
      if (po.status === 'Cancelled' || po.status === 'Draft' || !po.orderDate) return;
      const poDate = po.orderDate.split('T')[0];
      const match = days.find(day => day.dateStr === poDate);
      if (match) {
        match.purchaseSpend += po.total || 0;
      }
    });

    // Accumulate actual sales orders (excluding Cancelled/Draft)
    salesOrders.forEach(so => {
      if (so.status === 'Cancelled' || so.status === 'Draft' || !so.orderDate) return;
      const soDate = so.orderDate.split('T')[0];
      const match = days.find(day => day.dateStr === soDate);
      if (match) {
        match.salesRevenue += so.total || 0;
      }
    });

    return days;
  }, [purchaseOrders, salesOrders]);

  // Color Palette Constants
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6'];

  return (
    <div className="space-y-6">
      {/* Page Header and Filtering Dashboard Control Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 border border-gray-150 p-4 rounded-xl">
        <div>
          <h1 className="text-xl font-bold text-gray-905 tracking-tight flex items-center gap-1.5">
            <BarChart3 className="w-5 h-5 text-indigo-650" />
            Business Intelligence Reports
          </h1>
          <p className="text-xs text-gray-500">Corporate analytics, financial statements, and warehouse allocation audits</p>
        </div>
        
        {/* Dynamic Sourcing Date Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono mb-1">Fiscal Year</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg font-bold text-gray-750 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-3xs"
            >
              <option value="ALL">📅 All Years</option>
              {availableYears.map(yr => (
                <option key={yr} value={yr}>Year {yr}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono mb-1">Sourcing Month</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg font-bold text-gray-750 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-3xs"
            >
              <option value="ALL">🗓️ All Months</option>
              <option value="0">January</option>
              <option value="1">February</option>
              <option value="2">March</option>
              <option value="3">April</option>
              <option value="4">May</option>
              <option value="5">June</option>
              <option value="6">July</option>
              <option value="7">August</option>
              <option value="8">September</option>
              <option value="9">October</option>
              <option value="10">November</option>
              <option value="11">December</option>
            </select>
          </div>

          {(selectedYear !== 'ALL' || selectedMonth !== 'ALL') && (
            <button
              onClick={() => {
                setSelectedYear('ALL');
                setSelectedMonth('ALL');
              }}
              className="mt-4 px-2.5 py-1.5 text-[9px] font-extrablack font-mono text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 rounded-lg transition-all cursor-pointer shadow-3xs"
              title="Reset Filters"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Google Sheets Live Integration Control Center */}
      <div className="bg-white border border-gray-150 rounded-xl p-4 shadow-3xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 flex-shrink-0" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                Google Sheets Integration
                {googleUser && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 bg-emerald-50 rounded-md border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Connected
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-455 max-w-2xl mt-0.5">
                Sync live inventory valuation ledger audits, Sales Orders records, Purchase Orders logistics datasets, and compliance statements directly to real Google Sheets spreadsheets in your Google Drive.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isAuthLoading ? (
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono">
                <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
                Reconciling Google Auth...
              </div>
            ) : !googleUser ? (
              <button
                onClick={handleGoogleLogin}
                className="text-xs font-bold border border-gray-200 hover:bg-gray-50 shadow-3xs rounded-lg transition-all cursor-pointer flex items-center justify-center bg-white px-3 py-2 text-gray-700"
                style={{ height: '38px' }}
              >
                <div className="flex items-center gap-2">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 flex-shrink-0">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                  <span className="font-semibold">Sign in with Google</span>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-bold text-gray-800">{googleUser.displayName || 'Authorized Account'}</span>
                  <span className="text-[10px] text-gray-400 font-mono">{googleUser.email}</span>
                </div>
                
                {googleUser.photoURL && (
                  <img 
                    src={googleUser.photoURL} 
                    alt="Profile" 
                    className="w-8 h-8 rounded-full border border-gray-200"
                    referrerPolicy="no-referrer"
                  />
                )}

                <button
                  onClick={handleExportToSheets}
                  disabled={isExporting}
                  className="px-3.5 py-1.5 text-xs font-bold font-mono text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  {isExporting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Export Report
                    </>
                  )}
                </button>

                <button
                  onClick={handleGoogleLogout}
                  className="p-2 text-gray-400 hover:text-gray-650 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                  title="Sign Out Google Session"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action outcome banners/logs alerts */}
        {(exportedUrl || exportError) && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            {exportedUrl && (
              <div className="bg-emerald-25 border border-emerald-100 text-emerald-800 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div>
                    <span className="font-bold block">🟢 Live Sheets Sync Completed!</span>
                    <span className="text-[10px] text-emerald-700 font-mono">
                      Created a multi-tab workbook with active year/month filters. Anyone with edit permissions in drive can view.
                    </span>
                  </div>
                </div>
                <a
                  href={exportedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-500 rounded-md shadow-3xs cursor-pointer transition-colors flex items-center gap-1 justify-center self-start sm:self-center"
                >
                  Open Google Sheet
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                    <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M13 2.5a.75.75 0 01.75-.75h4.5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0V4.56L10.78 11.3a.75.75 0 11-1.06-1.06l6.74-6.74H13.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>
            )}

            {exportError && (
              <div className="bg-rose-25 border border-rose-100 text-rose-800 p-3 rounded-lg flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-1">Google Workspace Sync Failed</span>
                  <p className="text-[10px] text-rose-700 leading-normal whitespace-pre-wrap">{exportError}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* KPI Highlight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-xs flex items-start gap-4">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg flex-shrink-0 mt-0.5">
            <Building className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-400 font-medium font-mono">Stock Valuation (Cost)</p>
            <h3 className="text-md font-bold text-gray-900 leading-tight">₱{totalValueAtCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
            <span className="text-[10px] text-indigo-600 font-mono font-bold block mb-1.5 animate-pulse">₱{totalValueAtRetail.toLocaleString(undefined, {maximumFractionDigits: 0})} Retail</span>
            
            {/* Supplier Currency Splits */}
            {costValuationByCurrency && Object.keys(costValuationByCurrency).length > 0 && (
              <div className="mt-2 pt-2 border-t border-dashed border-gray-150 space-y-1">
                <span className="text-[8px] font-bold text-gray-405 block font-mono uppercase tracking-wider">By Supplier Currency</span>
                {Object.values(costValuationByCurrency).map(({ currency, rawCost, convertedPHP }) => (
                  <div key={currency} className="flex justify-between items-start text-[10px] font-mono py-0.5 border-b border-gray-50 last:border-0">
                    <span className="text-gray-500 font-medium">{currency}:</span>
                    <span className="text-gray-800 font-bold text-right">
                      {currency === 'PHP' ? '₱' : currency + ' '}{rawCost.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      {currency !== 'PHP' && (
                        <span className="text-[8px] text-gray-450 font-normal block mt-0.5">
                          (₱{convertedPHP.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-xs flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg flex-shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <p className="text-xs text-gray-400 font-medium font-mono">Total Sales Ledger</p>
            </div>
            <div className="mt-2 pl-0.5">
              <h3 className="text-md font-bold text-gray-900 leading-none">₱{totalSales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
              <span className="text-[10px] text-emerald-600 font-mono font-semibold mt-1.5 block">{filteredSalesOrders.length} Orders Booked</span>
            </div>
          </div>
          
          <div className="w-full mt-3 pt-2 border-t border-gray-100">
            <div className="h-10 w-full">
              <SafeResponsiveContainer width="100%" height={40}>
                <AreaChart data={sparklineData}>
                  <Area type="monotone" dataKey="salesRevenue" stroke="#10b981" strokeWidth={1.2} fill="#a7f3d0" fillOpacity={0.2} dot={false} isAnimationActive={false} />
                </AreaChart>
              </SafeResponsiveContainer>
            </div>
            <div className="text-[8px] text-right text-gray-400 font-mono leading-none mt-1">30d Sales Trend</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-xs flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-lg flex-shrink-0">
                <TrendingDown className="w-4 h-4" />
              </div>
              <p className="text-xs text-gray-400 font-medium font-mono">Total Procurement Expenses</p>
            </div>
            <div className="mt-2 pl-0.5">
              <h3 className="text-md font-bold text-gray-900 leading-none">₱{totalPurchases.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
              <span className="text-[10px] text-rose-600 font-mono font-semibold mt-1.5 block">{filteredPurchaseOrders.length} Supply Requests</span>
            </div>
          </div>
          
          <div className="w-full mt-3 pt-2 border-t border-gray-100">
            <div className="h-10 w-full">
              <SafeResponsiveContainer width="100%" height={40}>
                <AreaChart data={sparklineData}>
                  <Area type="monotone" dataKey="purchaseSpend" stroke="#ef4444" strokeWidth={1.2} fill="#fecaca" fillOpacity={0.2} dot={false} isAnimationActive={false} />
                </AreaChart>
              </SafeResponsiveContainer>
            </div>
            <div className="text-[8px] text-right text-gray-400 font-mono leading-none mt-1">30d Procurement Trend</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-xs flex items-center gap-4">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <PiggyBank className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium font-mono">Simulated Gross Profit</p>
            <h3 className="text-md font-bold text-gray-900">₱{Math.max(0, totalSales - (totalValueAtCost * (filteredSalesOrders.length / (salesOrders.length || 1)))).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
            <span className="text-[10px] text-amber-600 font-mono font-semibold">{potentialMargin.toFixed(1)}% Avg Assets Markup</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-xs flex items-center gap-4">
          <div className="p-2.5 bg-indigo-50 text-indigo-640 rounded-lg">
            <Truck className="w-5 h-5 text-indigo-600 animate-pulse" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium font-mono">Avg Fulfillment Lead Time</p>
            <h3 className="text-md font-semibold text-gray-900">{avgLeadTime === 0 ? 'N/A' : `${avgLeadTime.toFixed(1)} Days`}</h3>
            <span className="text-[10px] text-indigo-600 font-mono font-bold">From {filteredPurchaseOrders.filter(p => p.status === 'Received').length} Delivered POs</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap border-b border-gray-200 gap-1 bg-white p-1 rounded-t-xl border border-b-0 border-gray-150">
        <button
          onClick={() => setActiveReportTab('financials')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeReportTab === 'financials' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-gray-800'}`}
        >
          <DollarSign className="w-4 h-4" />
          Financial Statements & Trends
        </button>
        <button
          onClick={() => setActiveReportTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeReportTab === 'inventory' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-gray-800'}`}
        >
          <Boxes className="w-4 h-4" />
          Inventory Valuation & Catalog
        </button>
        <button
          onClick={() => setActiveReportTab('warehouses')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeReportTab === 'warehouses' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-gray-800'}`}
        >
          <MapPin className="w-4 h-4" />
          Facility Allocation
        </button>
        <button
          onClick={() => setActiveReportTab('ph-compliance')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeReportTab === 'ph-compliance' ? 'bg-indigo-50 text-indigo-700 font-extrabold shadow-2xs border border-indigo-150' : 'text-gray-500 hover:text-gray-800'}`}
        >
          <Building className="w-4 h-4" />
          🇵🇭 PH Compliance & Sourcing
        </button>
        <button
          onClick={() => setActiveReportTab('collections-timeline')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeReportTab === 'collections-timeline' ? 'bg-indigo-50 text-indigo-700 font-extrabold shadow-2xs border border-indigo-150' : 'text-gray-500 hover:text-gray-800'}`}
        >
          <PiggyBank className="w-4 h-4 text-emerald-600" />
          Collections Timeline Matrix
        </button>
        <button
          onClick={() => setActiveReportTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeReportTab === 'logs' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-gray-800'}`}
        >
          <History className="w-4 h-4" />
          Audit Ledger Activity
        </button>
        <button
          onClick={() => setActiveReportTab('weekly-pdf')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeReportTab === 'weekly-pdf' ? 'bg-rose-50 text-rose-700 font-extrabold shadow-2xs border border-rose-150' : 'text-gray-505 hover:text-gray-800'}`}
        >
          <ClipboardList className="w-4 h-4 text-rose-600" />
          Weekly PDF Alerts
        </button>
        <button
          onClick={() => setActiveReportTab('procurement-forecast')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeReportTab === 'procurement-forecast' ? 'bg-amber-50 text-amber-700 font-extrabold shadow-2xs border border-amber-150' : 'text-gray-500 hover:text-gray-800'}`}
        >
          <TrendingUp className="w-4 h-4 text-amber-500 animate-pulse" />
          Procurement Forecast
        </button>
        <button
          onClick={() => setActiveReportTab('supplier-analytics')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeReportTab === 'supplier-analytics' ? 'bg-indigo-50 text-indigo-700 font-extrabold shadow-2xs border border-indigo-150' : 'text-gray-500 hover:text-gray-800'}`}
          id="supplier-analytics-nav-btn"
        >
          <Truck className="w-4 h-4 text-indigo-500" />
          Supplier Analytics
        </button>
        <button
          onClick={() => setActiveReportTab('inventory-aging')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeReportTab === 'inventory-aging' ? 'bg-indigo-50 text-indigo-700 font-extrabold shadow-2xs border border-indigo-150' : 'text-gray-500 hover:text-gray-800'}`}
          id="inventory-aging-nav-btn"
        >
          <Hourglass className="w-4 h-4 text-emerald-600" />
          Inventory Aging Report
        </button>
      </div>

      {/* Tab Panels */}
      <div className="bg-white p-5 rounded-b-xl border border-gray-150 mt-[-1px] shadow-xs">
        
        {/* PANEL 1: FINANCIALS */}
        {activeReportTab === 'financials' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-3 gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Capital Flow Analysis</h3>
                <p className="text-xs text-gray-400">Comparing historical sales deliveries vs sourcing expenditures over the calendar timeline</p>
              </div>
              
              {/* Report Frequency options: weekly, monthly, or yearly */}
              <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-lg border border-slate-200 shadow-2xs self-start sm:self-auto shrink-0">
                <button
                  onClick={() => setReportFrequency('weekly')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    reportFrequency === 'weekly'
                      ? 'bg-white text-indigo-700 shadow-3xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setReportFrequency('monthly')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    reportFrequency === 'monthly'
                      ? 'bg-white text-indigo-700 shadow-3xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setReportFrequency('yearly')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    reportFrequency === 'yearly'
                      ? 'bg-white text-indigo-700 shadow-3xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Yearly
                </button>
              </div>
            </div>

            {/* Recharts Area Timeline */}
            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 h-[300px] min-w-0">
              <SafeResponsiveContainer height={260}>
                <AreaChart
                  data={timelineData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#6b7280' }} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip wrapperStyle={{ outline: 'none' }} contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }} />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="Purchases" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorPurchases)" name="Supply Orders Expense" />
                  <Area type="monotone" dataKey="Sales" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" name="Client Sales Revenue" />
                </AreaChart>
              </SafeResponsiveContainer>
            </div>

            {/* NEW ADDED SECTIONS: Monthly Procurement Spend by Supplier & Sales Report Per Brand */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Supplier Monthly Procurement Spending Trends */}
              <div className="bg-white p-5 rounded-xl border border-gray-150 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Monthly Procurement Trend by Supplier
                  </h4>
                  <p className="text-[11px] text-gray-400">Chronological procurement spend (converted to PHP) tracking per supplier brand</p>
                </div>
                <div className="h-[260px] bg-gray-50/50 p-2 rounded-lg border border-gray-100 min-w-0">
                  <SafeResponsiveContainer height={240}>
                    <LineChart data={monthlySupplierProcurementData} margin={{ top: 10, right: 10, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} />
                      <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '6px' }} />
                      <Legend wrapperStyle={{ fontSize: '9px' }} />
                      {uniqueSupplierSpentNames.map((sName, index) => {
                        const colors = ['#6366f1', '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
                        const color = colors[index % colors.length];
                        return (
                          <Line
                            key={sName}
                            type="monotone"
                            dataKey={sName}
                            stroke={color}
                            strokeWidth={2.5}
                            activeDot={{ r: 5 }}
                            name={sName}
                            connectNulls
                          />
                        );
                      })}
                    </LineChart>
                  </SafeResponsiveContainer>
                </div>
              </div>

              {/* Brand Parts vs Service Sales Bar Chart */}
              <div className="bg-white p-5 rounded-xl border border-gray-150 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-indigo-500" />
                    Sales Distribution per Brand (Parts/Service)
                  </h4>
                  <p className="text-[11px] text-gray-400">Breakdown of gross sales revenue of parts vs services across product brands</p>
                </div>
                <div className="h-[260px] bg-gray-50/50 p-2 rounded-lg border border-gray-100 min-w-0">
                  <SafeResponsiveContainer height={240}>
                    <BarChart data={brandSalesData} margin={{ top: 10, right: 5, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="brand" tick={{ fontSize: 9, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} />
                      <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '6px' }} />
                      <Legend wrapperStyle={{ fontSize: '9px' }} />
                      <Bar dataKey="partsSales" stackId="brandStack" fill="#6366f1" name="Parts Sales" />
                      <Bar dataKey="servicesSales" stackId="brandStack" fill="#14b8a6" name="Services Billed" />
                    </BarChart>
                  </SafeResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Brand Leaderboard Table Cards */}
            <div className="bg-white p-4.5 rounded-xl border border-gray-150 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider font-mono">Billed Product Brand Performance Grid</h4>
                <span className="text-[10px] bg-slate-100 text-slate-705 px-2 py-0.5 rounded font-bold font-mono">Total {brandSalesData.length} Brands tracked</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {brandSalesData.map((b, idx) => (
                  <div key={b.brand} className="bg-slate-50/50 border border-slate-100 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                      <span className="font-bold text-gray-800 text-xs truncate max-w-[120px]">{b.brand || 'Generic'}</span>
                      <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded">Rank #{idx + 1}</span>
                    </div>
                    <div className="space-y-1 text-[10px] font-mono">
                      <div className="flex items-center justify-between text-gray-500">
                        <span>Parts Sales:</span>
                        <span className="font-bold text-gray-700">₱{b.partsSales.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-gray-500">
                        <span>Services:</span>
                        <span className="font-bold text-gray-700">₱{b.servicesSales.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-indigo-700 font-sans border-t border-dashed border-gray-200 pt-1 mt-1 font-bold">
                        <span>Grand Total:</span>
                        <span>₱{b.totalSales.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {brandSalesData.length === 0 && (
                  <div className="col-span-full py-6 text-center text-xs text-slate-400">No sales record exists to construct brand leaderboard.</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-gray-150 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                  <ClipboardList className="w-4 h-4 text-gray-400" />
                  Latest Procurement Logs
                </div>
                <div className="divide-y divide-gray-50 text-[11px] max-h-[180px] overflow-y-auto">
                  {filteredPurchaseOrders.length === 0 ? (
                    <div className="p-3 text-center text-gray-400">No active purchase orders recorded</div>
                  ) : (
                    filteredPurchaseOrders.slice(-5).map(po => {
                      const total = po.total || 0;
                      return (
                        <div key={po.id} className="py-2.5 flex items-center justify-between">
                          <div className="space-y-0.5 text-left">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-900">{po.poNumber}</span>
                              <span className="text-[10px] text-gray-400 font-mono">({po.orderDate})</span>
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono">Status: {po.status}</div>
                          </div>
                          <span className="font-mono font-bold text-rose-600">${total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="border border-gray-150 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                  <PackageCheck className="w-4 h-4 text-gray-400" />
                  Latest Sales Logs
                </div>
                <div className="divide-y divide-gray-50 text-[11px] max-h-[180px] overflow-y-auto">
                  {filteredSalesOrders.length === 0 ? (
                    <div className="p-3 text-center text-gray-400">No sales orders recorded</div>
                  ) : (
                    filteredSalesOrders.slice(-5).map(so => {
                      const total = so.total || 0;
                      return (
                        <div key={so.id} className="py-2.5 flex items-center justify-between">
                          <div className="space-y-0.5 text-left">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-900">{so.soNumber}</span>
                              <span className="text-[10px] text-gray-400 font-mono">({so.orderDate})</span>
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono">Shipment: {so.status}</div>
                          </div>
                          <span className="font-mono font-bold text-emerald-600">₱{total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PANEL 2: INVENTORY VALUATION */}
        {activeReportTab === 'inventory' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Capital Distribution per Category</h3>
                <p className="text-xs text-gray-400">Divergence of static cash inventory values segmented across your category structures</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Category Pie Chart */}
              <div className="md:col-span-5 h-[240px] flex items-center justify-center">
                {categoryData.length === 0 ? (
                  <div className="text-center text-gray-400 text-xs font-mono">No values to compute categories on</div>
                ) : (
                  <div className="w-full h-full relative min-w-0">
                    <SafeResponsiveContainer height={220}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`₱${Number(value).toLocaleString()}`, 'Valuation']} />
                      </PieChart>
                    </SafeResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider font-mono">Total Capital</span>
                      <span className="text-sm font-extrabold text-gray-800">₱{Math.round(totalValueAtCost).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Legends list */}
              <div className="md:col-span-7 space-y-3.5">
                <h4 className="text-xs font-bold text-gray-800 font-mono">Valuation Split Details (Cost)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categoryData.map((data, index) => {
                    const percent = totalValueAtCost > 0 ? (data.value / totalValueAtCost) * 100 : 0;
                    return (
                      <div key={data.name} className="flex items-center justify-between p-2 rounded-lg border border-gray-100 hover:shadow-xs transition-shadow">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                          <span className="text-xs font-semibold text-gray-700">{data.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-gray-950 font-mono">₱{data.value.toLocaleString()}</span>
                          <span className="block text-[9px] text-gray-400">{percent.toFixed(1)}% split</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Low stock alerts panel */}
            <div className="border border-rose-100 rounded-xl p-4 bg-rose-50/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  Inventory Surveillance Alert: Stock depletion at risk
                </div>
                <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded font-mono">
                  {lowStockItems.length} Products Low
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[10px] text-gray-600">
                  <thead>
                    <tr className="border-b border-rose-100 text-rose-800 opacity-80 font-bold uppercase">
                      <th className="py-2">SKU</th>
                      <th className="py-2">Item Name</th>
                      <th className="py-2 text-right">Reorder Level</th>
                      <th className="py-2 text-right">Total On Hand</th>
                      <th className="py-2 text-right">Procurement Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-50/50">
                    {lowStockItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-emerald-600 font-bold">
                          🎉 Perfect Inventory Levels! All items sit safely above reorder points.
                        </td>
                      </tr>
                    ) : (
                      lowStockItems.map(item => {
                        const sumQty = Object.values(item.stockByWarehouse || {}).reduce((s: number, q: any) => s + ((q as number) || 0), 0);
                        return (
                          <tr key={item.id} className="hover:bg-rose-50/10">
                            <td className="py-2.5 font-bold text-gray-900">{item.sku}</td>
                            <td className="py-2.5 font-sans font-medium text-gray-800">{item.name}</td>
                            <td className="py-2.5 text-right">{item.reorderPoint}</td>
                            <td className="py-2.5 text-right font-bold text-rose-600">{sumQty}</td>
                            <td className="py-2.5 text-right font-bold">₱{item.purchasePrice.toFixed(2)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PROCUREMENT FORECAST (90-DAY OUTBOUND CONSUMPTION INDICATOR) */}
            <div className="border border-indigo-200 border-dashed rounded-xl p-5 bg-indigo-50/15 space-y-4 text-left">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-650 animate-bounce" />
                    Procurement Demand & Reorder Forecast Indicator
                  </h4>
                  <p className="text-xs text-gray-400">Estimated required reorder dates derived from average daily material outflows (last 90 days)</p>
                </div>
                <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono text-[9px] font-extrabold px-2 py-0.5 rounded tracking-wide uppercase shadow-3xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping"></span>
                  90-day demand run-rate
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-450 font-mono text-[9px] uppercase tracking-wider">
                      <th className="py-2 pr-2">SKU</th>
                      <th className="py-2 pr-2">Product Description</th>
                      <th className="py-2 pr-2 text-right font-semibold">On Hand</th>
                      <th className="py-2 pr-2 text-right">Reorder Level</th>
                      <th className="py-2 pr-2 text-right">90d Outflows</th>
                      <th className="py-2 pr-2 text-right text-indigo-700">Daily Demand Rate</th>
                      <th className="py-2 pr-2 text-center text-amber-700 font-bold">Required Reorder Date</th>
                      <th className="py-2 pr-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {procurementForecast.map(item => {
                      let statusBadge = (
                        <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 rounded">
                          Stable
                        </span>
                      );
                      let dateColor = "text-slate-800 font-semibold";

                      if (item.status === 'CRITICAL') {
                        statusBadge = (
                          <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-700 bg-red-100 rounded animate-pulse">
                            CRITICAL
                          </span>
                        );
                        dateColor = "text-red-700 font-extrabold";
                      } else if (item.status === 'ATTENTION') {
                        statusBadge = (
                          <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 rounded">
                            Warning
                          </span>
                        );
                        dateColor = "text-amber-700 font-bold";
                      }

                      return (
                        <tr key={item.id} className="hover:bg-indigo-50/20">
                          <td className="py-2.5 font-bold text-gray-900 font-mono pr-2">{item.sku}</td>
                          <td className="py-2.5 font-sans font-medium text-gray-800 pr-2">{item.name}</td>
                          <td className="py-2.5 text-right font-mono text-gray-700 pr-2">{item.currentOnHand}</td>
                          <td className="py-2.5 text-right font-mono text-gray-500 pr-2">{item.reorderPoint || 0}</td>
                          <td className="py-2.5 text-right font-mono text-gray-700 pr-2">{item.totalOutbound}</td>
                          <td className="py-2.5 text-right font-mono text-indigo-650 font-extrabold pr-2">
                            {item.avgDailyConsumption.toFixed(2)} / d
                          </td>
                          <td className={`py-2.5 text-center font-mono ${dateColor} pr-2`}>
                            {item.predictedDateStr}
                          </td>
                          <td className="py-2.5 text-right">{statusBadge}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PANEL 3: WAREHOUSE FACILITY ALLOCATION */}
        {activeReportTab === 'warehouses' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Capital Volume on Location Placement</h3>
                <p className="text-xs text-gray-400">Total volume allocations and dollar valuations on location node</p>
              </div>
            </div>

            {/* Warehouse Allocation Recharts Bar */}
            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 h-[280px] min-w-0">
              <SafeResponsiveContainer height={245}>
                <BarChart
                  data={warehouseStockData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} />
                  <YAxis yAxisId="left" orientation="left" stroke="#6366f1" tick={{ fontSize: 10 }} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#10b981" tick={{ fontSize: 10 }} axisLine={false} />
                  <Tooltip formatter={(value: any) => [`₱${Number(value).toLocaleString()}`]} contentStyle={{ fontSize: '11px', fontWeight: 'bold', borderRadius: '8px' }} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Bar yAxisId="left" dataKey="quantity" fill="#6366f1" radius={[4, 4, 0, 0]} name="On Hand Stock Qty" />
                  <Bar yAxisId="right" dataKey="valuation" fill="#10b981" radius={[4, 4, 0, 0]} name="Valuation at Cost (₱ - PHP)" />
                </BarChart>
              </SafeResponsiveContainer>
            </div>

            {/* Details breakdown of warehouses */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {warehouseStockData.map(data => (
                <div key={data.name} className="bg-white p-4 rounded-xl border border-gray-150 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 truncate">{data.fullName}</span>
                    <span className="text-[9px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded uppercase">{data.name}</span>
                  </div>
                  <div className="flex justify-between text-xs pt-1.5 border-t border-gray-105">
                    <span className="text-gray-400 font-medium">Physical Stock:</span>
                    <span className="font-mono font-bold text-gray-900">{data.quantity.toLocaleString()} units</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 font-medium">Storage Valuation:</span>
                    <span className="font-mono font-bold text-emerald-600">₱{data.valuation.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PANEL 4: TRANSACTION LEDGER ACTIVITIES (Unifies active audit pathways) */}
        {activeReportTab === 'logs' && (
          <div className="animate-in fade-in duration-200">
            <SystemAuditTrailPanel
              purchaseOrders={purchaseOrders}
              salesOrders={salesOrders}
              transactions={transactions}
              items={items}
              isSeparateWindow={false}
            />
          </div>
        )}

        {/* PANEL 5: PH COMPLIANCE & SOURCING */}
        {activeReportTab === 'ph-compliance' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Compliance Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4 gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-indigo-650" />
                  PH Revenue & Import Sourcing Compliance Audit
                </h3>
                <p className="text-xs text-gray-400">BIR-aligned cluster distribution, parts vs services breakdown, VAT audits, and overseas supplier category spend in PHP</p>
              </div>
              <span className="self-start sm:self-auto text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-150 font-mono font-bold px-2.5 py-1 rounded inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                PH CUSTOMS & BIR ALIGNED
              </span>
            </div>

            {/* Sub-grid 1: VAT Breakdown & Item Category Sales */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* VAT Audit Breakdown */}
              <div className="lg:col-span-5 border border-indigo-100/80 rounded-xl p-5 bg-indigo-50/10 space-y-4">
                <h4 className="text-xs font-bold text-indigo-950 font-mono flex items-center gap-1.5 uppercase tracking-wider">
                  <Percent className="w-4 h-4 text-indigo-600" />
                  12% VAT Audit Breakdown
                </h4>
                <div className="space-y-3">
                  <div className="p-3 bg-white rounded-lg border border-gray-100 flex justify-between items-center shadow-2xs">
                    <span className="text-xs text-gray-400 font-medium">VAT-Exempt Sales (Net Value)</span>
                    <span className="text-xs font-mono font-bold text-gray-900">₱{taxSummary.totalVatExclusive.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-gray-100 flex justify-between items-center shadow-2xs">
                    <span className="text-xs text-gray-400 font-medium">VAT-Inclusive Sales (Gross)</span>
                    <span className="text-xs font-mono font-bold text-gray-905">₱{taxSummary.totalVatInclusive.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="p-3 bg-indigo-50/30 rounded-lg border border-indigo-100/50 flex justify-between items-center">
                    <span className="text-xs text-indigo-950 font-bold">12% VAT Output Tax Collected</span>
                    <span className="text-xs font-mono font-extrabold text-indigo-700">₱{taxSummary.totalTaxCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Micro statistics */}
                <div className="grid grid-cols-2 gap-3 text-center pt-2">
                  <div className="p-2 border border-gray-100 bg-white rounded-lg">
                    <span className="block text-[9px] text-gray-400 uppercase font-mono font-semibold">VAT Transactions</span>
                    <span className="text-sm font-black text-gray-800">{taxSummary.vatSalesCount}</span>
                  </div>
                  <div className="p-2 border border-gray-100 bg-white rounded-lg">
                    <span className="block text-[9px] text-gray-400 uppercase font-mono font-semibold">Exempt / Zero-rated</span>
                    <span className="text-sm font-black text-gray-800">{taxSummary.exemptSalesCount}</span>
                  </div>
                </div>
              </div>

              {/* Item Category Sales */}
              <div className="lg:col-span-7 border border-gray-150 rounded-xl p-5 space-y-4 bg-white">
                <h4 className="text-xs font-bold text-gray-850 font-mono flex items-center gap-1.5 uppercase tracking-wider">
                  <Layers className="w-4 h-4 text-indigo-650" />
                  Category Sales Ledger Summary
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-sans text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider text-[10px] font-mono">
                        <th className="pb-2">Category Classification</th>
                        <th className="pb-2 text-right">Qty Dispatched</th>
                        <th className="pb-2 text-right">Invoice Value (PHP)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {categorySalesSummary.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-gray-400">No category-based client deliveries identified</td>
                        </tr>
                      ) : (
                        categorySalesSummary.map(cat => (
                          <tr key={cat.category} className="hover:bg-gray-50/30">
                            <td className="py-3 font-semibold text-gray-900">{cat.category}</td>
                            <td className="py-3 text-right font-mono text-gray-505">{cat.qty.toLocaleString()} units</td>
                            <td className="py-3 text-right font-mono font-bold text-indigo-950">₱{cat.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Section 2: Regional Cluster Audits (Parts vs Service Breakdown) */}
            <div className="border border-gray-150 rounded-xl p-5 bg-white space-y-4">
              <h4 className="text-xs font-bold text-gray-850 font-mono flex items-center gap-1.5 uppercase tracking-wider">
                <Building className="w-4 h-4 text-purple-650" />
                Regional Cluster Sales performance & Lines Classification
              </h4>
              <p className="text-[11px] text-gray-400 mt-[-8px]">
                Regional logistics cluster categorization including explicit separation of parts assets vs service/labor contracts.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-sans text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-405 font-bold uppercase text-[10px] font-mono">
                      <th className="pb-3">Reporting Cluster Region</th>
                      <th className="pb-3 text-right">Parts Sales (PHP)</th>
                      <th className="pb-3 text-right">Service/Labor (PHP)</th>
                      <th className="pb-3 text-right">VAT-Exclusive Sales</th>
                      <th className="pb-3 text-right">Grand Total (Inc. VAT)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-55">
                    {clustersData.map((cluster) => (
                      <tr key={cluster.name} className="hover:bg-gray-50/20">
                        <td className="py-3.5 font-bold text-gray-950 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                          {cluster.name}
                        </td>
                        <td className="py-3.5 text-right font-mono text-teal-700">
                          ₱{cluster.partsSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 text-right font-mono text-indigo-600">
                          ₱{cluster.servicesSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 text-right font-mono text-gray-500">
                          ₱{cluster.vatExSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 text-right font-mono font-extrabold text-indigo-950 text-sm">
                          ₱{cluster.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 3: Sourcing Sourcing Expenditures (Supplier per category in PHP) */}
            <div className="border border-gray-150 rounded-xl p-5 bg-white space-y-4">
              <h4 className="text-xs font-bold text-gray-850 font-mono flex items-center gap-1.5 uppercase tracking-wider">
                <Truck className="w-4 h-4 text-emerald-650" />
                Purchase Expenditures: Supplier per Item Category (converted to PHP)
              </h4>
              <p className="text-[11px] text-gray-400 mt-[-8px]">
                Audit matrix translating international currency supply costs (e.g. Caterpillar/Komatsu in USD) into Philippine Peso (PHP) at partner partner exchange rates.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-sans text-xs">
                  <thead>
                    <tr className="border-b border-gray-150 text-gray-400 font-bold uppercase text-[10px] font-mono">
                      <th className="pb-3">Sourcing Vendor / Supplier</th>
                      <th className="pb-3">Internal Category Allocation</th>
                      <th className="pb-3 text-right">Expenses (PHP Equivalent)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {purchaseSupplierCategorySummary.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-gray-400">No active overseas procurement data recorded</td>
                      </tr>
                    ) : (
                      purchaseSupplierCategorySummary.map((sup, sIdx) => {
                        const categories = Object.entries(sup.categories);
                        if (categories.length === 0) {
                          return (
                            <tr key={sup.supplierName} className="hover:bg-gray-50/10">
                              <td className="py-3.5 font-bold text-gray-900">{sup.supplierName}</td>
                              <td className="py-3.5 text-gray-400 font-mono italic">None Registered</td>
                              <td className="py-3.5 text-right font-mono font-bold text-emerald-600">₱0.00</td>
                            </tr>
                          );
                        }
                        return categories.map(([catName, expenseAmount], cIdx) => (
                           <tr key={`${sup.supplierName}-${catName}`} className="hover:bg-gray-50/10">
                            {cIdx === 0 ? (
                              <td className="py-3 font-bold text-gray-950" rowSpan={categories.length}>
                                <div className="flex items-center gap-1">
                                  <span className="px-1 text-[9px] font-black font-sans bg-emerald-50 text-emerald-700 border border-emerald-150 rounded mr-1">VENDOR</span>
                                  {sup.supplierName}
                                </div>
                              </td>
                            ) : null}
                            <td className="py-3 font-mono font-medium text-gray-700">{catName}</td>
                            <td className="py-3 text-right font-mono font-bold text-emerald-700">
                              ₱{Number(expenseAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ));
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 4: BIR Sales Invoicing & Cash Collections Ledger */}
            <div id="bir-collections-ledger" className="border border-indigo-150 rounded-xl p-5 bg-white space-y-5 shadow-3xs text-left">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-3">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-gray-850 font-mono flex items-center gap-1.5 uppercase tracking-wider">
                    <PiggyBank className="w-4 h-4 text-indigo-650" />
                    BIR Form 2307 & Cash Collections Account Ledger
                  </h4>
                  <p className="text-[11px] text-gray-400">
                    Real-time auditing of collection receipts, corporate Expanded Withholding Tax (EWT) deductions, and outstanding trade receivables.
                  </p>
                </div>
                
                {/* Export CSV trigger with standard download */}
                <button
                  type="button"
                  onClick={() => {
                    const headers = ["SO Number", "Customer Name", "Order Date", "Invoice No", "Invoice Date", "Tax Type", "Tax Rate (%)", "Tax Amount", "Withheld EWT (%)", "EWT Amount", "Gross Total", "Net Amount Collected", "Payment Method", "Payment Date", "Payment Remarks"];
                    const rows = collectionsSummary.orders.map(so => {
                      return [
                        so.soNumber,
                        `"${so.customerName.replace(/"/g, '""')}"`,
                        so.orderDate || '',
                        so.invoiceNumber || '—',
                        so.invoiceDate || '—',
                        so.taxType || 'None',
                        so.taxType === 'VAT' ? '12' : (so.customTaxRate || '0'),
                        so.tax || '0',
                        so.hasEwt ? (so.ewtRate || '0') : '0',
                        so.ewtAmount || '0',
                        so.total,
                        so.amountPaid || (so.isPaid ? so.total : 0),
                        so.paymentMethod || '—',
                        so.paymentDate || '—',
                        `"${(so.paymentRemarks || '').replace(/"/g, '""')}"`
                      ];
                    });
                    
                    const csvContent = "data:text/csv;charset=utf-8," 
                      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `Sales_Collection_Report_${selectedYear}_${selectedMonth}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="self-start md:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-black rounded-lg cursor-pointer transition-colors shadow-3xs hover:opacity-90"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Export Collections CSV
                </button>
              </div>

              {/* Collections KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl space-y-1">
                  <span className="block text-[8.5px] uppercase font-bold text-gray-400 font-mono">Billed Gross (Sales Total)</span>
                  <span className="text-sm font-black text-slate-850 font-mono">₱{collectionsSummary.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  <span className="block text-[9px] text-slate-400">Total invoiced sales</span>
                </div>
                <div className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-xl space-y-1">
                  <span className="block text-[8.5px] uppercase font-bold text-emerald-800 font-mono">Cash Collected (Net received)</span>
                  <span className="text-sm font-black text-emerald-700 font-mono">₱{collectionsSummary.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  <span className="block text-[9px] text-emerald-600">Total bank credits cleared</span>
                </div>
                <div className="p-3 bg-amber-50/40 border border-amber-100 rounded-xl space-y-1">
                  <span className="block text-[8.5px] uppercase font-bold text-amber-800 font-mono">withholding tax credits (2307)</span>
                  <span className="text-sm font-black text-amber-700 font-mono">₱{collectionsSummary.totalEwt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  <span className="block text-[9px] text-amber-600">Total deferred tax receipts</span>
                </div>
                <div className="p-3 bg-rose-50/40 border border-rose-100 rounded-xl space-y-1">
                  <span className="block text-[8.5px] uppercase font-bold text-rose-800 font-mono">Trade Accounts Receivables (AR)</span>
                  <span className="text-sm font-black text-rose-700 font-mono">₱{collectionsSummary.totalAr.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  <span className="block text-[9px] text-rose-600">Outstanding client balances</span>
                </div>
              </div>

              {/* Collections Interactive Filters */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <div className="md:col-span-5 relative">
                  <label className="block text-[9px] text-slate-400 uppercase tracking-wider font-bold mb-1 font-mono">Search Collections ledger</label>
                  <input
                    type="text"
                    value={collectionSearch}
                    onChange={(e) => setCollectionSearch(e.target.value)}
                    placeholder="Search SO #, client name, or invoice doc..."
                    className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-sans text-slate-800"
                  />
                </div>
                
                <div className="md:col-span-3">
                  <label className="block text-[9px] text-slate-400 uppercase tracking-wider font-bold mb-1 font-mono">Collection Filter</label>
                  <select
                    value={collectionStatus}
                    onChange={(e) => setCollectionStatus(e.target.value)}
                    className="w-full text-xs p-1.5 bg-white border border-slate-200 rounded-lg text-slate-800"
                  >
                    <option value="ALL">All Payments</option>
                    <option value="Paid">✓ Paid Collections</option>
                    <option value="Unpaid">✗ Unpaid / Outstanding</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[9px] text-slate-400 uppercase tracking-wider font-bold mb-1 font-mono">BIR Tax Configuration</label>
                  <select
                    value={collectionTaxType}
                    onChange={(e) => setCollectionTaxType(e.target.value)}
                    className="w-full text-xs p-1.5 bg-white border border-slate-200 rounded-lg text-slate-800"
                  >
                    <option value="ALL">All Tax items</option>
                    <option value="VAT">12% VAT Applied</option>
                    <option value="Non-VAT">Non-VAT / Tax Exempt</option>
                  </select>
                </div>

                <div className="md:col-span-1 pt-4 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setCollectionSearch('');
                      setCollectionStatus('ALL');
                      setCollectionTaxType('ALL');
                    }}
                    className="w-full py-1.5 px-2 bg-slate-200 hover:bg-slate-300 rounded text-[10px] text-slate-800 font-black cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Collection ledger table */}
              <div className="overflow-x-auto border border-gray-150 rounded-xl bg-white">
                <table className="w-full text-left font-sans text-xs">
                  <thead>
                    <tr className="border-b border-gray-150 text-gray-400 font-extrabold uppercase text-[9.5px] font-mono bg-slate-50/50">
                      <th className="p-3">Sales Order & Client</th>
                      <th className="p-3">Invoice details</th>
                      <th className="p-3 text-center">Tax Type</th>
                      <th className="p-3 text-right">Invoice Value</th>
                      <th className="p-3 text-right">withheld EWT</th>
                      <th className="p-3 text-right">Cash Received</th>
                      <th className="p-3">Timeline & Clearing Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {collectionsSummary.orders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-gray-400 italic">No Sales collections matching selection found</td>
                      </tr>
                    ) : (
                      collectionsSummary.orders.map((so) => (
                        <tr key={so.id} className="hover:bg-slate-50/40 text-[11.5px]">
                          <td className="p-3">
                            <span className="font-bold text-indigo-900 block">{so.soNumber}</span>
                            <span className="text-gray-500 font-medium block text-[10.5px]">{so.customerName}</span>
                          </td>
                          <td className="p-3 font-mono">
                            {so.invoiceNumber ? (
                              <div className="space-y-px">
                                <span className="font-mono text-[10.5px] bg-indigo-50 text-indigo-900 px-1.5 py-0.2 rounded font-semibold border border-indigo-100">{so.invoiceNumber}</span>
                                {so.invoiceDate && <span className="block text-[9.5px] text-gray-450 mt-0.5 font-sans">Inv: {so.invoiceDate}</span>}
                              </div>
                            ) : (
                              <span className="text-[10px] text-amber-600 font-bold bg-amber-50 rounded border border-amber-100 px-1.5 py-0.2">✗ Pending Invoice</span>
                            )}
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-slate-600">
                            {so.taxType === 'VAT' ? '12% VAT' : (so.taxType || 'None/Zero')}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-800">
                            ₱{so.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-right">
                            {so.hasEwt ? (
                              <div className="space-y-px text-right font-mono">
                                <span className="text-amber-700 font-bold block">₱{(so.ewtAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                <span className="text-[9px] bg-amber-100/60 text-amber-800 px-1 rounded font-extrabold">{so.ewtRate}% EWT</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 font-mono">—</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {so.isPaid ? (
                              <div className="space-y-px text-right font-mono">
                                <span className="text-emerald-700 font-black block">₱{(so.amountPaid ?? so.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                <span className="text-[9.5px] text-slate-405">Received ✓</span>
                              </div>
                            ) : (
                              <span className="text-rose-600 font-bold font-mono">₱0.00</span>
                            )}
                          </td>
                          <td className="p-3 font-sans">
                            {so.isPaid ? (
                              <div className="space-y-1">
                                <span className="text-[10px] inline-flex items-center gap-1 font-bold bg-emerald-50 text-emerald-800 border border-emerald-100 px-1.5 py-0.2 rounded">
                                  🏦 {so.paymentMethod || 'Bank Transfer'}
                                </span>
                                {so.paymentDate && <span className="block text-[10px] text-gray-450 font-mono">Cleared: {so.paymentDate}</span>}
                                {so.paymentRemarks && <p className="text-[9.5px] font-sans text-gray-400 italic mt-0.5 font-medium">“{so.paymentRemarks}”</p>}
                              </div>
                            ) : (
                              <span className="text-rose-500 font-bold text-[10.5px] flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                                Outstanding Receivable
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PANEL: DUAL-TIMELINE COLLECTIONS COMPARISON */}
        {activeReportTab === 'collections-timeline' && (
          <div className="space-y-6 animate-in fade-in duration-250">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4 gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                  <PiggyBank className="w-4.5 h-4.5 text-indigo-650" />
                  Sales Accrual vs. Cash Collections Dual Ledger
                </h3>
                <p className="text-xs text-gray-400">Comparing expected collections by Sales Order sales month vs. actual cash cleared by collection payment records</p>
              </div>
              <span className="text-[10px] bg-indigo-50 text-indigo-800 border border-indigo-150 font-mono font-black px-2.5 py-1 rounded inline-flex items-center gap-1 uppercase">
                Dual Timeline Auditing active
              </span>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
                <span className="block text-[9px] uppercase font-bold text-gray-400 font-mono">Cumulative Sales Billed (Accrual basis)</span>
                <span className="text-lg font-black text-slate-850 font-mono">
                  ₱{collectionsTimelineComparison.chartData.reduce((sum, item) => sum + item.expectedBilled, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="block text-[10px] text-gray-400">Total revenue recorded on sales contracts date</span>
              </div>
              <div className="p-4 bg-emerald-50/30 border border-emerald-150 rounded-xl space-y-1">
                <span className="block text-[9px] uppercase font-bold text-emerald-850 font-mono">Cumulative Cash Collected (Cash basis)</span>
                <span className="text-lg font-black text-emerald-700 font-mono">
                  ₱{collectionsTimelineComparison.chartData.reduce((sum, item) => sum + item.actualCollected, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="block text-[10px] text-emerald-600">Total cleared bank credits and cash receipts</span>
              </div>
              <div className="p-4 bg-rose-50/30 border border-rose-150 rounded-xl space-y-1">
                <span className="block text-[9px] uppercase font-bold text-rose-850 font-mono">Uncollected Accounts Receivable Gap</span>
                <span className="text-lg font-black text-rose-700 font-mono">
                  ₱{Math.max(0, collectionsTimelineComparison.chartData.reduce((sum, item) => sum + (item.expectedBilled - item.actualCollected), 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="block text-[10px] text-rose-600">Uncollected backlog remaining</span>
              </div>
            </div>

            {/* Recharts Chart Section */}
            <div className="border border-gray-150 rounded-xl p-5 bg-white space-y-3">
              <h4 className="text-xs font-bold text-slate-800 font-mono uppercase tracking-wider">
                Monthly Accrual Sales vs. Actual Payments Collected
              </h4>
              <div className="h-72">
                <SafeResponsiveContainer height="100%">
                  <BarChart data={collectionsTimelineComparison.chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={11} 
                      tickLine={false} 
                      tickFormatter={(val) => `₱${(val / 1000).toLocaleString()}k`} 
                    />
                    <Tooltip 
                      formatter={(value: any) => [`₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`]}
                      contentStyle={{ background: '#f8fafc', borderColor: '#e2e8f0', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar name="Accrued/Expected (SO Month)" dataKey="expectedBilled" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar name="Actual Cash Collections (Cleared Month)" dataKey="actualCollected" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </SafeResponsiveContainer>
              </div>
            </div>

            {/* Comparative Breakdown Table */}
            <div className="border border-gray-150 rounded-xl bg-white overflow-hidden shadow-2xs">
              <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
                <h4 className="text-xs font-black text-slate-800 font-mono uppercase tracking-wider">
                  Timeline Reconciliation Audit Grid
                </h4>
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  {collectionsTimelineComparison.chartData.length} active periods loaded
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-sans text-xs">
                  <thead>
                    <tr className="bg-gray-55/65 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider font-mono text-[10px]">
                      <th className="px-5 py-3">Calendar Period</th>
                      <th className="px-5 py-3 text-right">Accrued SO total (A)</th>
                      <th className="px-5 py-3 text-center">SO volume</th>
                      <th className="px-5 py-3 text-right">Actual payments (B)</th>
                      <th className="px-5 py-3 text-center">Receipts volume</th>
                      <th className="px-5 py-3 text-right">Outstanding deficit (A - B)</th>
                      <th className="px-5 py-3">Audit assessment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-mono text-[11px] text-gray-700">
                    {collectionsTimelineComparison.chartData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-400 italic">
                          No active sales order records found to display timeline audits.
                        </td>
                      </tr>
                    ) : (
                      collectionsTimelineComparison.chartData.map((row) => {
                        const netDeficit = row.expectedBilled - row.actualCollected;
                        const statusPct = row.expectedBilled > 0 ? (row.actualCollected / row.expectedBilled) * 100 : 100;
                        return (
                          <tr key={row.period} className="hover:bg-slate-50/40">
                            <td className="px-5 py-3.5 font-bold text-gray-900 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                              {row.period}
                            </td>
                            <td className="px-5 py-3.5 text-right font-medium text-slate-700">
                              ₱{row.expectedBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-5 py-3.5 text-center text-gray-400">
                              {row.soCount} SOs
                            </td>
                            <td className="px-5 py-3.5 text-right font-bold text-emerald-700">
                              ₱{row.actualCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-5 py-3.5 text-center text-gray-500">
                              {row.collectionCount} Payments
                            </td>
                            <td className={`px-5 py-3.5 text-right font-bold ${netDeficit > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                              ₱{Math.max(0, netDeficit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-5 py-3.5 font-sans">
                              {netDeficit <= 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded font-bold font-mono">
                                  ✓ Cleared / Balanced
                                </span>
                              ) : statusPct >= 75 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-sky-50 text-sky-800 border border-sky-100 px-2 py-0.5 rounded font-bold font-mono">
                                  ⚡ Strong Collection ({Math.round(statusPct)}%)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-800 border border-amber-100 px-2 py-0.5 rounded font-bold font-mono">
                                  🗂️ Collectible Deficit ({Math.round(statusPct)}%)
                                </span>
                              )}
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
        )}

        {/* PANEL 6: WEEKLY ALERTS & SPEND PDF SUMMARY */}
        {activeReportTab === 'weekly-pdf' && (() => {
          // Compute summary variables inside closure
          const lowStockThreshold = 10;
          const lowStockItems = items.filter(item => {
            const totalQty = Object.values(item.stockByWarehouse || {}).map((v: any) => Number(v) || 0).reduce((a, b) => a + b, 0);
            return totalQty <= (item.reorderPoint || lowStockThreshold);
          });

          let totalSpentPHP = 0;
          const poDetails = purchaseOrders.slice(0, 8).map(po => {
            const poSupplier = suppliers.find(s => s.name === po.vendorName || s.id === po.supplierId);
            const conversionRate = poSupplier?.exchangeRate || po.exchangeRate || 1.0;
            const totalPHP = po.total * conversionRate;
            totalSpentPHP += totalPHP;
            return {
              ...po,
              totalPHP
            };
          });

          // PDF compiler function
          const handleDownloadPDF = () => {
            const doc = new jsPDF({
              orientation: 'portrait',
              unit: 'mm',
              format: 'a4'
            });

            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // Slate 800 background banner
            doc.setFillColor(30, 41, 59);
            doc.rect(0, 0, pageWidth, 42, 'F');
            
            // Indigo divider accent
            doc.setFillColor(79, 70, 229);
            doc.rect(0, 42, pageWidth, 2.5, 'F');

            // Titles
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.text("EQUIPRIME LOGISTICS HUB", 14, 16);
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(191, 196, 210);
            doc.text("WEEKLY COMPREHENSIVE INTELLIGENCE REPORT", 14, 23);
            doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 30);

            // Confidentials right aligned
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "bold");
            doc.text("Status: CONFIDENTIAL", pageWidth - 14, 16, { align: 'right' });
            doc.setFont("helvetica", "normal");
            doc.setTextColor(191, 196, 210);
            doc.text("Type: LOW-STOCK & SOURCING SPEND", pageWidth - 14, 23, { align: 'right' });
            doc.text("Class: Standardized Sourcing Extract", pageWidth - 14, 30, { align: 'right' });

            let yPos = 55;

            // SECTION 1: LOW STOCK
            doc.setFillColor(244, 63, 94); // rose-500 indicator
            doc.rect(14, yPos, 4, 6, 'F');
            
            doc.setTextColor(30, 41, 59);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text("1. DEPROVISIONED / LOW-STOCK SAFETY WARNINGS", 22, yPos + 4.5);

            yPos += 12;

            // Table Header block
            doc.setFillColor(241, 245, 249);
            doc.rect(14, yPos, pageWidth - 28, 8, 'F');
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            doc.text("SKU CODE", 16, yPos + 5.5);
            doc.text("PRODUCT DETAILS & MODEL", 42, yPos + 5.5);
            doc.text("ON-HAND", 115, yPos + 5.5);
            doc.text("TARGET LEVEL", 145, yPos + 5.5);
            doc.text("URGENCY STATUS", 172, yPos + 5.5);

            yPos += 8;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);

            if (lowStockItems.length === 0) {
              doc.text("No active safety threshold violations recorded. Supply levels are structurally solid.", 16, yPos + 5.5);
              yPos += 12;
            } else {
              lowStockItems.forEach(item => {
                const totalQty = Object.values(item.stockByWarehouse || {}).map((v: any) => Number(v) || 0).reduce((a, b) => a + b, 0);
                doc.setDrawColor(241, 245, 249);
                doc.line(14, yPos, pageWidth - 14, yPos);

                doc.text(item.sku, 16, yPos + 5.5);
                const descText = `${item.name} (${item.brand})`;
                doc.text(descText.length > 42 ? descText.substring(0, 42) + '...' : descText, 42, yPos + 5.5);
                
                doc.text(`${totalQty} ${item.unit}`, 115, yPos + 5.5);
                doc.text(`${item.reorderPoint} ${item.unit}`, 145, yPos + 5.5);

                doc.setFont("helvetica", "bold");
                if (totalQty === 0) {
                  doc.setTextColor(239, 68, 68);
                  doc.text("OUT-OF-STOCK", 172, yPos + 5.5);
                } else {
                  doc.setTextColor(245, 158, 11);
                  doc.text("LOW ON-HAND", 172, yPos + 5.5);
                }
                doc.setFont("helvetica", "normal");
                doc.setTextColor(30, 41, 59);
                yPos += 8;
              });
            }

            yPos += 10;

            // SECTION 2: SOURCING EXPEDITURES
            doc.setFillColor(79, 70, 229); // Indigo for money
            doc.rect(14, yPos, 4, 6, 'F');
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text("2. WEEKLY SOURCING EXPENDITURES & PROCUREMENT", 22, yPos + 4.5);

            yPos += 12;

            // Table Header block
            doc.setFillColor(241, 245, 249);
            doc.rect(14, yPos, pageWidth - 28, 8, 'F');
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            doc.text("PO REF", 16, yPos + 5.5);
            doc.text("ORDER DATE", 42, yPos + 5.5);
            doc.text("SUPPLIER VENDOR", 72, yPos + 5.5);
            doc.text("SITE", 125, yPos + 5.5);
            doc.text("LEDGER STATE", 152, yPos + 5.5);
            doc.text("SUBTOTAL (PHP)", 172, yPos + 5.5);

            yPos += 8;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);

            if (poDetails.length === 0) {
              doc.text("No active procurement contracts registered in systems databases.", 16, yPos + 5.5);
              yPos += 12;
            } else {
              poDetails.forEach(po => {
                doc.setDrawColor(241, 245, 249);
                doc.line(14, yPos, pageWidth - 14, yPos);

                doc.text(po.poNumber, 16, yPos + 5.5);
                doc.text(po.orderDate || 'N/A', 42, yPos + 5.5);
                
                const sName = po.vendorName || 'N/A';
                doc.text(sName.length > 25 ? sName.substring(0, 25) + '...' : sName, 72, yPos + 5.5);
                
                const destWh = warehouses.find(w => w.id === po.warehouseId);
                doc.text(destWh ? destWh.code : 'Default', 125, yPos + 5.5);
                doc.text(po.status, 152, yPos + 5.5);

                doc.setFont("helvetica", "bold");
                doc.text(`₱${po.totalPHP.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 172, yPos + 5.5);
                doc.setFont("helvetica", "normal");
                yPos += 8;
              });
            }

            yPos += 8;

            // Totals Sum block
            doc.setFillColor(248, 250, 252);
            doc.rect(14, yPos, pageWidth - 28, 16, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.rect(14, yPos, pageWidth - 28, 16, 'S');

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139);
            doc.text("AGGREGATE SOURCING EXPENSES SUM IN BASE PHP CONVERSION:", 18, yPos + 10.5);
            
            doc.setFontSize(11);
            doc.setTextColor(79, 70, 229);
            doc.text(`₱${totalSpentPHP.toLocaleString('en-US', { minimumFractionDigits: 2 })} PHP`, pageWidth - 18, yPos + 10.5, { align: 'right' });

            // Page end footer
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text("Equiprime Logistics Sourcing Desk - SECURE LEDGER BATCH EXTRACT", 14, pageHeight - 12);
            doc.text("Aligned with BIR Revenue Sourcing Protocols and ISO-2026 Audit Codes.", 14, pageHeight - 8);
            doc.text("Page 1 of 1", pageWidth - 14, pageHeight - 10, { align: 'right' });

            doc.save(`Weekly_Sourcing_Report_${new Date().toISOString().split('T')[0]}.pdf`);
          };

          return (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Header Title bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4 gap-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-901 flex items-center gap-1.5">
                    <ClipboardList className="w-4 h-4 text-rose-500" />
                    Automated Weekly PDF Intelligence Compiler
                  </h3>
                  <p className="text-xs text-gray-400">Instantly package threshold alerts and raw vendor spending converted to BIR-compliant base currency PHP</p>
                </div>
                <button
                  onClick={handleDownloadPDF}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-transform cursor-pointer shadow-sm hover:scale-[1.02] flex items-center gap-2"
                >
                  📥 Download Standard PDF Report
                </button>
              </div>

              {/* Grid Statistics summaries */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-amber-50/50 border border-amber-100/70 rounded-xl space-y-1">
                  <span className="block text-[10px] text-amber-500 uppercase font-mono font-bold">Safety Threshold Breaches</span>
                  <strong className="text-lg text-amber-900 block font-mono">{lowStockItems.length} SKUs Violation</strong>
                  <span className="text-[10px] text-amber-600 font-medium block">Urgent procurement list automatically drafted below.</span>
                </div>

                <div className="p-4 bg-indigo-50/40 border border-indigo-100/60 rounded-xl space-y-1">
                  <span className="block text-[10px] text-indigo-500 uppercase font-mono font-bold">Aggregate Sourcing Cost (Base)</span>
                  <strong className="text-lg text-indigo-950 block font-mono">₱{totalSpentPHP.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                  <span className="text-[10px] text-indigo-600 font-medium block">Formulated across active procurement purchase order contracts in database.</span>
                </div>

                <div className="p-4 bg-emerald-50/40 border border-emerald-100/60 rounded-xl space-y-1">
                  <span className="block text-[10px] text-emerald-500 uppercase font-mono font-bold">Ledger Export Status</span>
                  <strong className="text-lg text-emerald-950 block">Audit-Compliant</strong>
                  <span className="text-[10px] text-emerald-600 font-medium block">Configured for instant download, local storage archiving, or print dispatch.</span>
                </div>
              </div>

              {/* Full Interactive PDF Mock Preview Container */}
              <div className="border border-gray-250 bg-slate-100 p-6 md:p-12 rounded-xl flex justify-center shadow-inner">
                {/* Paper sheet representation */}
                <div className="bg-white max-w-2xl w-full p-8 shadow-xl rounded-md border border-gray-250 text-slate-800 font-sans space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-800" />
                  
                  {/* Mock Paper Header */}
                  <div className="flex justify-between items-start border-b border-gray-200 pb-4">
                    <div>
                      <h4 className="text-base font-black uppercase text-slate-900 tracking-tight">Equiprime Logistics Hub</h4>
                      <p className="text-[10px] text-slate-450 uppercase tracking-widest font-mono">Weekly Sourcing & Satiation Intelligence Summary</p>
                      <p className="text-[10px] text-indigo-600 mt-1 font-mono font-bold">Extract Timeline: Week Ending {new Date().toLocaleDateString()}</p>
                    </div>
                    <div className="text-right text-[9px] font-mono text-slate-500">
                      <span className="block font-bold">ID: EQP-WLR-0994</span>
                      <span className="block">Status: SECURE ARCHIVE</span>
                      <span className="block">Location: Manila Hub, PH</span>
                    </div>
                  </div>

                  {/* Mock Section 1: Low stock alerts */}
                  <div className="space-y-3">
                    <h5 className="text-[11px] font-bold uppercase text-rose-600 font-mono tracking-wider flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded bg-rose-500" />
                      1. Deprovisioned / Low-Stock Safety Warnings
                    </h5>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-[10.5px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150 font-bold font-mono text-[9px] text-slate-450">
                            <th className="p-2">SKU Code</th>
                            <th className="p-2">Product Name & Category</th>
                            <th className="p-2 text-center">Safety Level</th>
                            <th className="p-2 text-center">Current Stock</th>
                            <th className="p-2 text-right">Ledger Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {lowStockItems.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-4 text-center italic text-slate-400">Stable inventory balance levels. No threshold overdraws tracked.</td>
                            </tr>
                          ) : (
                            lowStockItems.slice(0, 4).map(item => {
                              const totalQty = Object.values(item.stockByWarehouse || {}).map((v: any) => Number(v) || 0).reduce((a, b) => a + b, 0);
                              return (
                                <tr key={item.id} className="text-slate-700">
                                  <td className="p-2 font-bold">{item.sku}</td>
                                  <td className="p-2 font-sans">{item.name} <span className="text-[9.5px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-mono font-semibold">{item.category}</span></td>
                                  <td className="p-2 text-center text-rose-600 font-black">{item.reorderPoint}</td>
                                  <td className="p-2 text-center text-amber-600 font-black">{totalQty}</td>
                                  <td className="p-2 text-right text-rose-650 font-bold uppercase text-[9px]">{totalQty === 0 ? '⛔ OUT OF STOCK' : '⚠️ LOW ON-HAND'}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mock Section 2: Procurement Costs breakdown */}
                  <div className="space-y-3">
                    <h5 className="text-[11px] font-bold uppercase text-indigo-600 font-mono tracking-wider flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded bg-indigo-500" />
                      2. Sourcing Expenditures & Capital Allocations
                    </h5>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-[10.5px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150 font-bold font-mono text-[9px] text-slate-450">
                            <th className="p-2">PO Ref Reference</th>
                            <th className="p-2">Supplier Vendor</th>
                            <th className="p-2">Site</th>
                            <th className="p-2">Stage</th>
                            <th className="p-2 text-right">Amount (PHP Eq)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {poDetails.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-4 text-center italic text-slate-400">No active overseas procurement bills drafted.</td>
                            </tr>
                          ) : (
                            poDetails.slice(0, 4).map(po => (
                              <tr key={po.id} className="text-slate-700">
                                <td className="p-2 font-bold">{po.poNumber}</td>
                                <td className="p-2 font-sans">{po.vendorName}</td>
                                <td className="p-2">{warehouses.find(w => w.id === po.warehouseId)?.code || 'MANILA'}</td>
                                <td className="p-2 font-semibold text-emerald-650 text-[9.5px] uppercase">{po.status}</td>
                                <td className="p-2 text-right font-black text-slate-900">₱{po.totalPHP.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Total summary Box */}
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200/80 flex items-center justify-between font-mono">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Weekly Total Procurement spending conversion (Base currency PHP):</span>
                    <strong className="text-base text-indigo-700 font-black">
                      ₱{totalSpentPHP.toLocaleString('en-US', { minimumFractionDigits: 2 })} PHP
                    </strong>
                  </div>

                  {/* Footer declaration */}
                  <div className="pt-4 border-t border-dashed border-slate-200 text-center text-[9px] text-slate-400 italic space-y-1 font-mono">
                    <p>Secured with military-grade SHA ledger hashing codes. Authorized distribution channels only.</p>
                    <p>© 2026 Equiprime Logistics Sourcing. Standards enforcement document.</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {activeReportTab === 'procurement-forecast' && (() => {
          // Dynamic collections for filter selections
          const categoriesList = ['ALL', ...Array.from(new Set(items.map(item => item.category)))];
          const brandsList = ['ALL', ...Array.from(new Set(items.map(item => item.brand || 'Others').filter(Boolean)))];

          // Compute today reference
          const nowMs = new Date('2026-05-28').getTime();

          // Calculate all forecasts
          const rawForecasts = items.map(item => {
            const currentStock = Object.values(item.stockByWarehouse || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
            
            // Filter depletions
            const relevantTx = transactions.filter(tx => {
              if (tx.itemId !== item.id || tx.quantity >= 0) return false;
              const txTime = new Date(tx.date).getTime();
              const diffDays = (nowMs - txTime) / (1000 * 60 * 60 * 24);
              return diffDays <= lookbackDays;
            });

            const totalDepleted = relevantTx.reduce((sum, tx) => sum + Math.abs(tx.quantity), 0);
            const actualDailyRate = totalDepleted / lookbackDays;
            
            // Fallback baseline consumption rate
            const fallbackDailyRate = (item.reorderPoint / 30) || 0.15;
            const finalDailyRate = (actualDailyRate > 0 ? actualDailyRate : fallbackDailyRate) * demandMultiplier;

            const projectedConsumption = finalDailyRate * forecastPeriod;
            const daysRemaining = finalDailyRate > 0 ? (currentStock / finalDailyRate) : Infinity;

            let runOutDateStr = 'Adequate Runway';
            if (daysRemaining !== Infinity && finalDailyRate > 0) {
              const runOutMs = nowMs + (daysRemaining * 24 * 60 * 60 * 1000);
              runOutDateStr = new Date(runOutMs).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            }

            // Suggested Reorder Qty and costs
            let recommendedReorderQty = 0;
            if (currentStock <= item.reorderPoint || daysRemaining <= forecastPeriod) {
              recommendedReorderQty = Math.max(0, Math.ceil(projectedConsumption - currentStock + item.reorderPoint));
            }
            const estimatedSourcingCost = recommendedReorderQty * item.purchasePrice;

            return {
              item,
              currentStock,
              totalDepleted,
              actualDailyRate,
              finalDailyRate,
              projectedConsumption,
              daysRemaining,
              runOutDateStr,
              recommendedReorderQty,
              estimatedSourcingCost
            };
          });

          // Apply filters
          const filteredForecasts = rawForecasts.filter(f => {
            const matchesSearch = f.item.name.toLowerCase().includes(forecastSearch.toLowerCase()) || 
                                f.item.sku.toLowerCase().includes(forecastSearch.toLowerCase()) ||
                                (f.item.brand && f.item.brand.toLowerCase().includes(forecastSearch.toLowerCase()));
            const matchesCategory = forecastCategory === 'ALL' || f.item.category === forecastCategory;
            const matchesBrand = forecastBrand === 'ALL' || (f.item.brand || 'Others') === forecastBrand;

            return matchesSearch && matchesCategory && matchesBrand;
          });

          // Aggregate computations for stats
          const totalForecastDepletion = filteredForecasts.reduce((sum, f) => sum + f.projectedConsumption, 0);
          const totalProcurementBudget = filteredForecasts.reduce((sum, f) => sum + f.estimatedSourcingCost, 0);
          const criticalDeficitCount = filteredForecasts.filter(f => f.daysRemaining <= 15).length;
          const warningCount = filteredForecasts.filter(f => f.daysRemaining > 15 && f.daysRemaining <= forecastPeriod).length;

          // Chart preparation - top 8 depletions sorted
          const chartData = [...filteredForecasts]
            .sort((a, b) => b.projectedConsumption - a.projectedConsumption)
            .slice(0, 8)
            .map(f => ({
              name: f.item.sku,
              fullName: f.item.name,
              "OnHand Stock": f.currentStock,
              "Projected Demand": Math.round(f.projectedConsumption),
              "Recommended order": f.recommendedReorderQty
            }));

          // Compute Line Chart Trend Data for top 10 SKUs (90-day depletion timeline tracking)
          const top10TrendsForecasts = [...filteredForecasts]
            .sort((a, b) => b.projectedConsumption - a.projectedConsumption)
            .slice(0, 10);

          const depletionLineIntervals = [0, 15, 30, 45, 60, 75, 90];
          const depletionTrendsChartData = depletionLineIntervals.map(dayOffset => {
            const dataPoint: any = { timelineLabel: `Day ${dayOffset}` };
            top10TrendsForecasts.forEach(f => {
              // Projected stock remaining after dayOffset days at finalDailyRate depletion
              const projectedStockAtDay = Math.max(0, f.currentStock - Math.round(f.finalDailyRate * dayOffset));
              dataPoint[f.item.sku] = projectedStockAtDay;
            });
            return dataPoint;
          });

          // Calculate FSM metrics
          const fsmList = items.map(item => {
            const currentStock = Object.values(item.stockByWarehouse || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
            
            // Filter depletions in chosen FSM period
            const relevantTx = transactions.filter(tx => {
              if (tx.itemId !== item.id || tx.quantity >= 0) return false;
              const txTime = new Date(tx.date).getTime();
              const diffDays = (nowMs - txTime) / (1000 * 60 * 60 * 24);
              return diffDays <= fsmPeriodDays;
            });

            const cumulativeDepleted = relevantTx.reduce((sum, tx) => sum + Math.abs(tx.quantity), 0);
            const dailyRate = cumulativeDepleted / fsmPeriodDays;

            let classification: 'FAST' | 'SLOW' | 'NON-MOVING' = 'NON-MOVING';
            if (cumulativeDepleted >= fastMovingThreshold) {
              classification = 'FAST';
            } else if (cumulativeDepleted > 0) {
              classification = 'SLOW';
            }

            return {
              item,
              currentStock,
              cumulativeDepleted,
              dailyRate,
              classification
            };
          });

          // Filter FSM List
          const filteredFsm = fsmList.filter(f => {
            const matchesSearch = f.item.name.toLowerCase().includes(forecastSearch.toLowerCase()) || 
                                f.item.sku.toLowerCase().includes(forecastSearch.toLowerCase()) ||
                                (f.item.brand && f.item.brand.toLowerCase().includes(forecastSearch.toLowerCase()));
            const matchesCategory = forecastCategory === 'ALL' || f.item.category === forecastCategory;
            const matchesBrand = forecastBrand === 'ALL' || (f.item.brand || 'Others') === forecastBrand;
            const matchesClassification = fsmMovementFilter === 'ALL' || f.classification === fsmMovementFilter;

            return matchesSearch && matchesCategory && matchesBrand && matchesClassification;
          });

          // Counts for FSM overall matching brand/category
          const baseFsmList = fsmList.filter(f => {
            const matchesCategory = forecastCategory === 'ALL' || f.item.category === forecastCategory;
            const matchesBrand = forecastBrand === 'ALL' || (f.item.brand || 'Others') === forecastBrand;
            return matchesCategory && matchesBrand;
          });

          const totalBaseCount = baseFsmList.length || 1;
          const fastCount = baseFsmList.filter(f => f.classification === 'FAST').length;
          const slowCount = baseFsmList.filter(f => f.classification === 'SLOW').length;
          const nonMovingCount = baseFsmList.filter(f => f.classification === 'NON-MOVING').length;

          const fastPct = Math.round((fastCount / totalBaseCount) * 100);
          const slowPct = Math.round((slowCount / totalBaseCount) * 100);
          const nonPct = Math.max(0, 100 - fastPct - slowPct);

          const fsmChartData = [
            { name: 'Fast Moving', value: fastCount, fill: '#6366f1' },
            { name: 'Slow Moving', value: slowCount, fill: '#f59e0b' },
            { name: 'Non-Moving', value: nonMovingCount, fill: '#94a3b8' }
          ];

          return (
            <div className="space-y-6">
              {/* Header section with description */}
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-100 pb-4 gap-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                    Fulfillment Forecasting & Movement Speeds Engine
                  </h3>
                  <p className="text-xs text-slate-505 mt-1">
                    Configure lookback and forward prediction ranges, or review FSM (Fast, Slow, Non-moving) item depletions across custom activity cycles.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 px-2 bg-amber-50 text-[10px] uppercase font-bold text-amber-800 tracking-wider font-mono rounded-md border border-amber-200">
                    💡 Reference Date: May 28, 2026
                  </span>
                </div>
              </div>

              {/* Sub-tab Selection Bar */}
              <div className="flex border-b border-slate-200 gap-1">
                <button
                  type="button"
                  onClick={() => setProcurementSubTab('forecast')}
                  className={`py-2 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer select-none ${
                    procurementSubTab === 'forecast'
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Predictive Forecast Simulator ({forecastPeriod} Days)
                </button>
                <button
                  type="button"
                  onClick={() => setProcurementSubTab('fsm-movement')}
                  className={`py-2 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer select-none ${
                    procurementSubTab === 'fsm-movement'
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Boxes className="w-3.5 h-3.5 text-amber-500" />
                  FSM Movement Classification Report ({fsmPeriodDays} Days)
                </button>
                <button
                  type="button"
                  onClick={() => setProcurementSubTab('demand-forecast')}
                  className={`py-2 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer select-none ${
                    procurementSubTab === 'demand-forecast'
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <LucideLineChart className="w-3.5 h-3.5 text-emerald-550 text-emerald-600" />
                  Demand Forecast Chart (Top 5 Items)
                </button>
              </div>

              {/* Filtering Controls Shared Layout Area */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3s space-y-3.5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Search SKU/Manufacturer Code:</label>
                    <input
                      type="text"
                      value={forecastSearch}
                      onChange={(e) => setForecastSearch(e.target.value)}
                      placeholder="Type search terms here..."
                      data-helper="🔍 SEARCH HELPER: Quickly slice through entire forecast ledger by item name or unique part SKU numbers."
                      className="w-full text-xs font-medium border border-slate-200 bg-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-650 font-bold mb-1 font-sans text-slate-705">SKU Master Category:</label>
                    <select
                      value={forecastCategory}
                      onChange={(e) => setForecastCategory(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {categoriesList.map(itemCat => (
                        <option key={itemCat} value={itemCat}>📁 {itemCat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-650 font-bold mb-1 font-sans text-slate-705">Brand Name / Supplier:</label>
                    <select
                      value={forecastBrand}
                      onChange={(e) => setForecastBrand(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {brandsList.map(brName => (
                        <option key={brName} value={brName}>🏷️ {brName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        setForecastSearch('');
                        setForecastCategory('ALL');
                        setForecastBrand('ALL');
                        setLookbackDays(60);
                        setForecastPeriod(90);
                        setFsmPeriodDays(90);
                        setFsmMovementFilter('ALL');
                        setFastMovingThreshold(5);
                        setDemandMultiplier(1.0);
                      }}
                      className="w-full bg-slate-150 hover:bg-slate-200 text-slate-700 font-bold py-2 px-3 rounded-lg shadow-2xs border border-slate-200 transition-colors text-xs cursor-pointer select-none text-center"
                    >
                      🔄 Reset All Engine Parameters
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs border-t border-slate-100 pt-3.5">
                  <div className="md:col-span-2 flex flex-col gap-1.5">
                    <label className="block text-slate-600 font-bold">Quick Forecast Period Toggle:</label>
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                      {[30, 60, 90].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setForecastPeriod(days)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                            forecastPeriod === days
                              ? 'bg-indigo-650 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-205'
                          }`}
                        >
                          🔮 {days} Days Forecast
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="md:col-span-2 flex items-end justify-end font-sans">
                    <button
                      type="button"
                      onClick={() => exportForecastToCSV(filteredForecasts)}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all select-none cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Download CSV Forecast ({filteredForecasts.length})</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tab 1: FORECAST PANEL */}
              {procurementSubTab === 'forecast' && (
                <div className="space-y-6">
                  {/* Aggregated Bento Grid Stats cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Shortage Risk Level (CRITICAL)</span>
                        <span className="p-1 px-1.5 bg-red-50 text-red-700 text-[10px] font-bold rounded font-mono">≤15 Days Runway</span>
                      </div>
                      <h3 className="text-lg font-black text-slate-900 mt-1.5">{criticalDeficitCount} SKUs</h3>
                      <p className="text-[10.5px] text-slate-400 mt-1">Imminent stock de-allocation danger.</p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Preemptive Warning Rows</span>
                        <span className="p-1 px-1.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded font-mono">16D to {forecastPeriod}D Runway</span>
                      </div>
                      <h3 className="text-lg font-black text-slate-900 mt-1.5">{warningCount} SKUs</h3>
                      <p className="text-[10.5px] text-slate-400 mt-1">Tripped inside forecast timeframe.</p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Projected Total Demand</span>
                        <span className="p-1 px-1.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded font-mono">{forecastPeriod}D Units Sum</span>
                      </div>
                      <h3 className="text-lg font-black text-slate-900 mt-1.5">{Math.round(totalForecastDepletion).toLocaleString()} Units</h3>
                      <p className="text-[10.5px] text-slate-400 mt-1">Aggregated units consumption volume.</p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-2xs ring-1 ring-amber-400/25">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider font-mono font-black">Capital Outlay Estimate</span>
                        <span className="p-1 px-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded font-mono">Purchase Cost Est</span>
                      </div>
                      <h3 className="text-lg font-black text-indigo-700 mt-1.5">₱{totalProcurementBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
                      <p className="text-[10.5px] text-slate-500 mt-1">Needed procurement capital funding.</p>
                    </div>
                  </div>

                  {/* Adjusters and Control variables (Demand slider + Lookback selector + Forecast Period selector) */}
                  <div className="bg-[#fcfdfa] p-4 border border-slate-200/80 rounded-xl grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                    <div className="md:col-span-4 space-y-1.5 col-span-1">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Percent className="w-3.5 h-3.5 text-amber-500" />
                          Global Demand Modifier Rate:
                        </label>
                        <span className="px-2 py-0.5 bg-amber-600 text-white font-mono text-[11px] font-bold rounded-md">
                          {demandMultiplier.toFixed(1)}x ({Math.round(demandMultiplier * 100)}%)
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.5"
                        step="0.1"
                        value={demandMultiplier}
                        onChange={(e) => setDemandMultiplier(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                      />
                      <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                        <span>📉 50% (Lower demand)</span>
                        <span>Baseline (100%)</span>
                        <span>📈 250% (Peak Season Spike)</span>
                      </div>
                    </div>

                    <div className="md:col-span-4 space-y-1.5">
                      <label className="text-xs font-bold text-slate-705 block text-slate-700">
                        Historical Activity Lookback Phase:
                      </label>
                      <select
                        value={lookbackDays}
                        onChange={(e) => setLookbackDays(parseInt(e.target.value))}
                        className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg p-2 focus:outline-none"
                      >
                        <option value={30}>📅 Last 30 Days (High sensitivity to recent sales)</option>
                        <option value={60}>📅 Last 60 Days (Balanced timeline evaluation)</option>
                        <option value={90}>📅 Last 90 Days (Sourcing trend baseline)</option>
                        <option value={180}>📅 Last 180 Days (Includes medium cyclicality)</option>
                        <option value={365}>📅 Last 365 Days (Complete annual cycle lookback)</option>
                      </select>
                    </div>

                    <div className="md:col-span-4 space-y-1.5">
                      <label className="text-xs font-bold text-slate-705 block text-slate-700">
                        Procurement Forecast Target Range:
                      </label>
                      <select
                        value={forecastPeriod}
                        onChange={(e) => setForecastPeriod(parseInt(e.target.value))}
                        className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value={30}>🔮 30 Days Forecast (Immediate Short-Term Supply)</option>
                        <option value={60}>🔮 60 Days Forecast (Operational Stock Prep)</option>
                        <option value={90}>🔮 90 Days Forecast (Standard Business Quarter)</option>
                        <option value={180}>🔮 6 Months Forecast (Mid-Term Capital Commitment)</option>
                        <option value={365}>🔮 1 Year Forecast (Annual Long-Sourcing Cycle)</option>
                      </select>
                    </div>
                  </div>

                  {/* Dual Chart Overview Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Dynamic demand Visualizer Chart */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono flex items-center gap-1.5">
                              <BarChart3 className="w-4 h-4 text-indigo-600" />
                              Visualizing Demand: Top 8 Consumption Rows
                            </h4>
                            <p className="text-[11px] text-slate-400">Comparing available stock vs projected {forecastPeriod}-day depletion and preemptive reorder suggestions</p>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-3 font-mono mt-2">
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-slate-400 rounded-sm" /> On Hand</span>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-500 rounded-sm" /> Projected Demand</span>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm" /> Recommended Order</span>
                        </div>
                      </div>

                      {chartData.length === 0 ? (
                        <div className="h-[240px] flex items-center justify-center border border-dashed border-slate-200 rounded-lg italic text-slate-400 text-xs mt-3">
                          No active filtered records for data visualization.
                        </div>
                      ) : (
                        <div className="h-[260px] bg-slate-50/10 p-2 rounded-lg border border-slate-100/50 mt-3">
                          <SafeResponsiveContainer height={240}>
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} />
                              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                              <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                              <Legend wrapperStyle={{ fontSize: '9px' }} />
                              <Bar dataKey="OnHand Stock" fill="#94a3b8" radius={[4, 4, 0, 0]} name="On Hand Stock" />
                              <Bar dataKey="Projected Demand" fill="#f59e0b" radius={[4, 4, 0, 0]} name={`Projected ${forecastPeriod}D Consumption`} />
                              <Bar dataKey="Recommended order" fill="#6366f1" radius={[4, 4, 0, 0]} name="Preemptive Suggestions" />
                            </BarChart>
                          </SafeResponsiveContainer>
                        </div>
                      )}
                    </div>

                    {/* Line Chart: 90-Day Stock Depletion Trends for Top 10 SKUs */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono flex items-center gap-1.5">
                              <LucideLineChart className="w-4 h-4 text-emerald-600" />
                              90-Day Stock Depletion Curve (Top 10 High-Demand SKUs)
                            </h4>
                            <p className="text-[11px] text-slate-400">Chronological trend simulation tracking projected stock decay over a 90-day depletion timeline.</p>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-3 font-mono mt-2">
                          <span className="text-[9px] text-slate-400">X-Axis tracks simulated days out into future</span>
                        </div>
                      </div>

                      {top10TrendsForecasts.length === 0 ? (
                        <div className="h-[240px] flex items-center justify-center border border-dashed border-slate-200 rounded-lg italic text-slate-400 text-xs mt-3">
                          No active filtered records for line trend simulation.
                        </div>
                      ) : (
                        <div className="h-[260px] bg-slate-50/10 p-2 rounded-lg border border-slate-100/50 mt-3">
                          <SafeResponsiveContainer height={240}>
                            <LineChart data={depletionTrendsChartData} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="timelineLabel" tick={{ fontSize: 9, fill: '#64748b' }} />
                              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} label={{ value: 'Projected Stock Units', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 8, fill: '#94a3b8', fontWeight: 'bold' } }} />
                              <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                              <Legend wrapperStyle={{ fontSize: '9px' }} />
                              {top10TrendsForecasts.map((f, index) => {
                                const colors = ['#6366f1', '#10b981', '#ef4444', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4'];
                                return (
                                  <Line
                                    key={f.item.sku}
                                    type="monotone"
                                    dataKey={f.item.sku}
                                    stroke={colors[index % colors.length]}
                                    strokeWidth={2}
                                    dot={{ r: 3 }}
                                    activeDot={{ r: 5 }}
                                    name={`${f.item.sku}`}
                                  />
                                );
                              })}
                            </LineChart>
                          </SafeResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Main detailed projection list */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3s">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-600 uppercase font-mono tracking-wider">
                        Calculated forecasts matching filters ({filteredForecasts.length} entries)
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Target window parameters: {forecastPeriod} Days projection
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100/50 text-slate-600 font-mono font-bold text-[10px] uppercase border-b border-slate-200">
                            <th className="p-3">SKU Identifier</th>
                            <th className="p-3">Product Name & Category</th>
                            <th className="p-3 text-center">On Hand</th>
                            <th className="p-3 text-right">Daily Depletion</th>
                            <th className="p-3 text-right">Projected {forecastPeriod}D Demand</th>
                            <th className="p-3 text-center">Stock Runway</th>
                            <th className="p-3">Expected Depletion Date</th>
                            <th className="p-3 text-center">Preemptive Order Bundle</th>
                            <th className="p-3 text-right">Est Outlay</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {filteredForecasts.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                                No active forecasts matching the chosen configurations. Try resetting filters.
                              </td>
                            </tr>
                          ) : (
                            filteredForecasts.map(f => {
                              const isCriticalDeficit = f.daysRemaining <= 15;
                              const isWarningDeficit = f.daysRemaining > 15 && f.daysRemaining <= forecastPeriod;
                              
                              let runwayColor = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                              let runwayLabel = `${Math.ceil(f.daysRemaining)} Days`;
                              if (f.daysRemaining === Infinity) {
                                runwayColor = 'bg-slate-100 text-slate-500 border border-slate-200';
                                runwayLabel = 'Infinite Runway';
                              } else if (isCriticalDeficit) {
                                runwayColor = 'bg-red-50 text-red-700 border border-red-200 animate-pulse';
                              } else if (isWarningDeficit) {
                                runwayColor = 'bg-amber-50 text-amber-700 border border-amber-200';
                              }

                              return (
                                <tr key={f.item.id} className="hover:bg-slate-50/40 transition-colors font-medium">
                                  <td className="p-3 font-mono font-bold text-slate-900">{f.item.sku}</td>
                                  <td className="p-3">
                                    <div className="font-bold text-slate-950">{f.item.name}</div>
                                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5 font-semibold">
                                      <span>📂 {f.item.category}</span>
                                      <span>•</span>
                                      <span>🏷️ {f.item.brand || 'No Brand'}</span>
                                    </div>
                                  </td>
                                  <td className="p-3 text-center font-mono font-bold text-slate-800">
                                    {f.currentStock} <span className="text-[10px] text-slate-400 font-normal">{f.item.unit}</span>
                                  </td>
                                  <td className="p-3 text-right font-mono text-slate-605">
                                    {f.finalDailyRate.toFixed(2)}/day
                                  </td>
                                  <td className="p-3 text-right font-mono font-bold text-slate-800">
                                    {Math.ceil(f.projectedConsumption)} Pcs
                                  </td>
                                  <td className="p-3">
                                    <div className="flex justify-center">
                                      <span className={`inline-block py-0.5 px-2 rounded-lg text-[10px] font-bold font-mono ${runwayColor}`}>
                                        {runwayLabel}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="p-3 font-semibold text-slate-600 font-mono text-[11px]">
                                    {isCriticalDeficit ? (
                                      <span className="text-red-650 flex items-center gap-1 font-bold text-red-600">
                                        🚨 Out before {f.runOutDateStr}
                                      </span>
                                    ) : isWarningDeficit ? (
                                      <span className="text-amber-650 flex items-center gap-1 text-amber-600">
                                        ⚠️ {f.runOutDateStr}
                                      </span>
                                    ) : f.daysRemaining === Infinity ? (
                                      <span className="text-slate-400 font-normal">Never (Stock Secured)</span>
                                    ) : (
                                      <span className="text-emerald-600 font-semibold">{f.runOutDateStr}</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-center">
                                    {f.recommendedReorderQty > 0 ? (
                                      <div className="flex items-center justify-center gap-1">
                                        <span className="p-1 px-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[10.5px] font-black rounded-lg">
                                          📥 Order +{f.recommendedReorderQty}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] font-semibold text-emerald-600 uppercase font-mono bg-emerald-50/60 p-1 px-2 rounded">✅ SECURE</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-right font-mono font-bold text-slate-900">
                                    {f.estimatedSourcingCost > 0 ? (
                                      <span className="text-indigo-650 font-black text-indigo-705">₱{f.estimatedSourcingCost.toLocaleString()}</span>
                                    ) : (
                                      <span className="text-slate-405 font-normal">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 text-center text-[11px] text-slate-500 italic font-mono flex flex-wrap justify-between gap-2">
                      <span>Forecast calculated utilizing raw historical deallocations + baseline reorder calculations.</span>
                      <span>Enforces minimum safety quantities for critical SKUs automatically.</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: FSM MOVEMENT CLASSIFICATION REPORT */}
              {procurementSubTab === 'fsm-movement' && (
                <div className="space-y-6 flex-col">
                  {/* Aggregated Bento Grid Stats cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">⚡ Fast Moving Items</span>
                        <span className="p-1 px-1.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded font-mono">≥ {fastMovingThreshold} units</span>
                      </div>
                      <h3 className="text-lg font-black text-indigo-700 mt-1.5">{fastCount} SKUs</h3>
                      <p className="text-[10.5px] text-slate-400 mt-1">Represents {fastPct}% of catalog selection.</p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">🐢 Slow Moving Items</span>
                        <span className="p-1 px-1.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded font-mono">&gt;0 &amp; &lt; {fastMovingThreshold} units</span>
                      </div>
                      <h3 className="text-lg font-black text-amber-600 mt-1.5">{slowCount} SKUs</h3>
                      <p className="text-[10.5px] text-slate-400 mt-1">Represents {slowPct}% of catalog selection.</p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">❄️ Non-Moving Items</span>
                        <span className="p-1 px-1.5 bg-slate-100 text-slate-650 text-[10px] font-bold rounded font-mono">0 units sold</span>
                      </div>
                      <h3 className="text-lg font-black text-slate-700 mt-1.5">{nonMovingCount} SKUs</h3>
                      <p className="text-[10.5px] text-slate-400 mt-1">Represents {nonPct}% of catalog selection.</p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-indigo-205 shadow-2xs ring-1 ring-indigo-400/10">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider font-mono font-bold">FSM Segment Count</span>
                        <span className="p-1 px-1.5 bg-slate-100 text-slate-705 text-[10px] font-bold rounded font-mono">Total SKUs</span>
                      </div>
                      <h3 className="text-lg font-black text-slate-900 mt-1.5">{totalBaseCount} Items</h3>
                      <p className="text-[10.5px] text-slate-400 mt-1">Total indexed items in current catalog.</p>
                    </div>
                  </div>

                  {/* FSM Controllers: Timeframe Selector & Threshold Limit Adjustment */}
                  <div className="bg-[#fcfdfa] p-4 border border-slate-200/80 rounded-xl grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                    <div className="md:col-span-4 space-y-1.5">
                      <label className="text-xs font-bold text-slate-705 block text-slate-700">
                        FSM Historical Analysis Cycle:
                      </label>
                      <select
                        value={fsmPeriodDays}
                        onChange={(e) => setFsmPeriodDays(parseInt(e.target.value))}
                        className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value={30}>📅 Last 30 Days Report (Immediate Rotation)</option>
                        <option value={60}>📅 Last 60 Days Report (Bi-Monthly velocity Check)</option>
                        <option value={90}>📅 Last 90 Days Report (Quarterly Inventory Audit)</option>
                        <option value={180}>📅 Last 180 Days (6 Months Medium-Horizon)</option>
                        <option value={365}>📅 Last 365 Days (1 Year Velocity Index)</option>
                      </select>
                    </div>

                    <div className="md:col-span-5 space-y-1.5">
                      <div className="flex justify-between items-center font-sans">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Percent className="w-3.5 h-3.5 text-indigo-650 text-indigo-600" />
                          Fast-Moving Segment Threshold (Units):
                        </label>
                        <span className="px-2 py-0.5 bg-indigo-650 bg-indigo-600 text-white font-mono text-[11px] font-bold rounded-md">
                          ≥ {fastMovingThreshold} units
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="30"
                        step="1"
                        value={fastMovingThreshold}
                        onChange={(e) => setFastMovingThreshold(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                      <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                        <span>🚀 1 Unit (Sensitive)</span>
                        <span>15 Units</span>
                        <span>📦 30 Units (High Volume Only)</span>
                      </div>
                    </div>

                    <div className="md:col-span-3 bg-white/60 p-3 rounded-lg border border-dashed border-slate-200 text-[11px] text-slate-400 space-y-1 font-sans">
                      <span className="font-bold block text-[10px] uppercase font-mono text-slate-700">📊 FSM PARAMETERS:</span>
                      <p className="leading-tight text-[10.5px]">
                        • <strong>Fast:</strong> sold ≥ {fastMovingThreshold} units.<br />
                        • <strong>Slow:</strong> sold &gt; 0 and &lt; {fastMovingThreshold} units.<br />
                        • <strong>Non-Moving:</strong> 0 units sold in period.
                      </p>
                    </div>
                  </div>

                  {/* FSM Distribution Chart Block */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-col">
                    <div className="bg-white border border-slate-200 rounded-xl p-5 lg:col-span-2 space-y-3">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono flex items-center gap-1.5">
                          <BarChart3 className="w-4 h-4 text-indigo-650" />
                          Catalog Segment Movement Velocity Chart
                        </h4>
                        <p className="text-[11px] text-slate-400">Comparing quantity count of units distributed within the {fsmPeriodDays} days analyzed limit</p>
                      </div>

                      <div className="h-[200px] bg-slate-50/10 p-2 rounded-lg border border-slate-100/50">
                        <SafeResponsiveContainer height={180}>
                          <BarChart data={fsmChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} />
                            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                            <Tooltip contentStyle={{ fontSize: '10px' }} />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                              {fsmChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </SafeResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-5 lg:col-span-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono flex items-center gap-1.5">
                          Percentage Share Split %
                        </h4>
                        <p className="text-[11px] text-slate-400">FSM allocation overview metrics</p>
                      </div>

                      <div className="space-y-4 py-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />
                              Fast Moving ({fastCount})
                            </span>
                            <span>{fastPct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${fastPct}%` }} />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
                              Slow Moving ({slowCount})
                            </span>
                            <span>{slowPct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${slowPct}%` }} />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 bg-slate-400 rounded-full" />
                              Non-Moving ({nonMovingCount})
                            </span>
                            <span>{nonPct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-slate-400 h-full rounded-full" style={{ width: `${nonPct}%` }} />
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] text-center text-slate-410 text-slate-400 font-mono leading-tight bg-slate-50 p-2 rounded-lg border border-slate-100">
                        Total {items.length} variants tracked inside the regional system database.
                      </div>
                    </div>
                  </div>

                  {/* FSM Classification Filtering Toggle Bar */}
                  <div className="flex items-center gap-2 flex-wrap text-xs bg-slate-50 border border-slate-200/60 p-2 rounded-xl">
                    <span className="font-bold text-slate-505 uppercase font-mono text-[10px] px-2 text-slate-500">Filter Movement Segment:</span>
                    <button
                      onClick={() => setFsmMovementFilter('ALL')}
                      className={`px-3 py-1 font-bold rounded-lg cursor-pointer text-xs select-none transition-all ${
                        fsmMovementFilter === 'ALL'
                          ? 'bg-slate-900 border border-slate-900 text-white'
                          : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700'
                      }`}
                    >
                      🌟 Show All Segment Items ({fsmList.length})
                    </button>
                    <button
                      onClick={() => setFsmMovementFilter('FAST')}
                      className={`px-3 py-1 font-bold rounded-lg cursor-pointer text-xs select-none transition-all flex items-center gap-1 ${
                        fsmMovementFilter === 'FAST'
                          ? 'bg-indigo-600 border border-indigo-600 text-white shadow-2xs'
                          : 'bg-white hover:bg-indigo-50 border border-slate-200 text-indigo-700'
                      }`}
                    >
                      ⚡ Fast Moving Rows ({fastCount})
                    </button>
                    <button
                      onClick={() => setFsmMovementFilter('SLOW')}
                      className={`px-3 py-1 font-bold rounded-lg cursor-pointer text-xs select-none transition-all flex items-center gap-1 ${
                        fsmMovementFilter === 'SLOW'
                          ? 'bg-amber-500 border border-amber-500 text-white shadow-2xs'
                          : 'bg-white hover:bg-amber-50 border border-slate-200 text-amber-600'
                      }`}
                    >
                      🐢 Slow Moving Rows ({slowCount})
                    </button>
                    <button
                      onClick={() => setFsmMovementFilter('NON-MOVING')}
                      className={`px-3 py-1 font-bold rounded-lg cursor-pointer text-xs select-none transition-all flex items-center gap-1 ${
                        fsmMovementFilter === 'NON-MOVING'
                          ? 'bg-slate-500 border border-slate-500 text-white shadow-2xs'
                          : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-600'
                      }`}
                    >
                      ❄️ Non-Moving Stagnant ({nonMovingCount})
                    </button>
                  </div>

                  {/* Master Table Area for FSM */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3s">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-600 uppercase font-mono tracking-wider">
                        Classified velocity catalog dataset ({filteredFsm.length} records matched)
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Calculated based on {fsmPeriodDays} Days activity window
                      </span>
                    </div>

                    <div className="overflow-x-auto font-sans">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100/50 text-slate-600 font-mono font-bold text-[10px] uppercase border-b border-slate-200 font-mono">
                            <th className="p-3">SKU Identifier</th>
                            <th className="p-3">Product Name & Category</th>
                            <th className="p-3 text-center font-mono">On Hand Stock</th>
                            <th className="p-3 text-right">Units Depleted ({fsmPeriodDays}d)</th>
                            <th className="p-3 text-right">Avg Daily Flow</th>
                            <th className="p-3 text-center">Velocity Classification Badge</th>
                            <th className="p-3 text-right">Purchase Cost</th>
                            <th className="p-3 text-right font-mono">Value on Hand</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium font-sans">
                          {filteredFsm.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="p-10 text-center text-slate-400 italic">
                                No classified items found in current selection criteria. Adjust your search.
                              </td>
                            </tr>
                          ) : (
                            filteredFsm.map(f => {
                              let badgeClass = 'bg-slate-50 text-slate-500 border border-slate-200';
                              let badgeLabel = 'Non-Moving';
                              if (f.classification === 'FAST') {
                                badgeClass = 'bg-indigo-50 text-indigo-700 border border-indigo-200';
                                badgeLabel = '⚡ Fast-Moving';
                              } else if (f.classification === 'SLOW') {
                                badgeClass = 'bg-amber-50 text-amber-750 border border-amber-200';
                                badgeLabel = '🐢 Slow-Moving';
                              }

                              const valOnHand = f.currentStock * f.item.purchasePrice;

                              return (
                                <tr key={f.item.id} className="hover:bg-slate-50/40 transition-colors font-medium text-slate-700">
                                  <td className="p-3 font-mono font-bold text-slate-900">{f.item.sku}</td>
                                  <td className="p-3">
                                    <div className="font-bold text-slate-900">{f.item.name}</div>
                                    <div className="text-[10px] text-slate-450 mt-0.5 flex items-center gap-1.5 font-semibold text-slate-400">
                                      <span>📂 {f.item.category}</span>
                                      <span>•</span>
                                      <span>🏷️ {f.item.brand || 'No Brand'}</span>
                                    </div>
                                  </td>
                                  <td className="p-3 text-center font-mono font-bold text-slate-800 animate-none">
                                    {f.currentStock} <span className="text-[10px] text-slate-400 font-normal">{f.item.unit}</span>
                                  </td>
                                  <td className="p-3 text-right font-mono font-black text-slate-800">
                                    {f.cumulativeDepleted.toLocaleString()} units
                                  </td>
                                  <td className="p-3 text-right font-mono text-slate-500">
                                    {f.dailyRate.toFixed(3)}/day
                                  </td>
                                  <td className="p-3">
                                    <div className="flex justify-center">
                                      <span className={`inline-block py-0.5 px-2 rounded-lg text-[10px] font-bold uppercase font-mono ${badgeClass}`}>
                                        {badgeLabel}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="p-3 text-right font-mono text-slate-500 text-slate-600">
                                    ₱{f.item.purchasePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="p-3 text-right font-mono font-bold text-slate-900 animate-none">
                                    ₱{valOnHand.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 text-center text-[11px] text-slate-500 italic font-mono flex flex-wrap justify-between gap-2">
                      <span>FSM evaluation compares actual sales and de-allocations registering in the target period.</span>
                      <span>Enables inventory managers to isolate dead stock and accelerate high-rebound investments.</span>
                    </div>
                  </div>
                </div>
              )}

              {procurementSubTab === 'demand-forecast' && (() => {
                const nowMs = new Date('2026-05-28').getTime();

                // Find top 5 high-demand items based on total depletions (lookback window deallocations)
                const itemsWithDepletions = items.map(item => {
                  const relevantTx = transactions.filter(tx => {
                    if (tx.itemId !== item.id || tx.quantity >= 0) return false;
                    const txTime = new Date(tx.date).getTime();
                    const diffDays = (nowMs - txTime) / (1000 * 60 * 60 * 24);
                    return diffDays <= lookbackDays;
                  });

                  const totalDepleted = relevantTx.reduce((sum, tx) => sum + Math.abs(tx.quantity), 0);
                  const actualDailyRate = totalDepleted / lookbackDays;
                  const fallbackDailyRate = (item.reorderPoint / 30) || 0.15;
                  const finalDailyRate = (actualDailyRate > 0 ? actualDailyRate : fallbackDailyRate) * demandMultiplier;

                  // Historical PO quantity ordered
                  const itemPOs = purchaseOrders.filter(po => po.status !== 'Cancelled');
                  const totalPOQty = itemPOs.reduce((sum, po) => {
                    const poItem = po.items.find(pi => pi.itemId === item.id);
                    return sum + (poItem ? poItem.quantity : 0);
                  }, 0);

                  const currentStock = Object.values(item.stockByWarehouse || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);

                  return {
                    item,
                    totalDepleted,
                    finalDailyRate,
                    totalPOQty,
                    currentStock,
                  };
                });

                // Get top 5 sorted by depletions (high-demand)
                const top5DemandItems = [...itemsWithDepletions]
                  .sort((a, b) => b.totalDepleted - a.totalDepleted)
                  .slice(0, 5);

                // Build 90-day future depletion timeline data points (0 to 90 days)
                const timelineIntervals = [0, 15, 30, 45, 60, 75, 90];
                const lineChartTimelineData = timelineIntervals.map(dayOffset => {
                  const dataPoint: any = { timelineLabel: `Day ${dayOffset}` };
                  top5DemandItems.forEach(f => {
                    const projectedStock = Math.max(0, f.currentStock - Math.round(f.finalDailyRate * dayOffset));
                    dataPoint[f.item.sku] = projectedStock;
                  });
                  return dataPoint;
                });

                // Build comparison data points for each item (Bar / Composed Chart)
                const comparisonChartData = top5DemandItems.map(f => ({
                  name: f.item.sku,
                  fullName: f.item.name,
                  "Current Stock": f.currentStock,
                  "Projected 90D Depletion": Math.round(f.finalDailyRate * 90),
                  "Historical PO Qty": f.totalPOQty,
                }));

                const lineColors = ['#10B981', '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6'];

                return (
                  <div className="space-y-6 animate-fadeIn text-slate-800">
                    {/* Overview & Quick Metrics Block */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      {top5DemandItems.map((f, index) => (
                        <div key={f.item.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs relative overflow-hidden flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-1.5 justify-between font-sans">
                              <span className="text-[10px] font-extrabold uppercase font-mono text-slate-400">#{index + 1} High Demand</span>
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lineColors[index] }} />
                            </div>
                            <h4 className="text-xs font-black text-slate-800 font-mono mt-1.5 truncate">{f.item.sku}</h4>
                            <p className="text-[11px] font-semibold text-slate-600 line-clamp-1 mt-0.5">{f.item.name}</p>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-1 border-t border-slate-100 mt-3 pt-2 text-center text-[10px] font-mono">
                            <div className="space-y-0.5">
                              <span className="text-slate-400 block text-[9px]">Stock</span>
                              <span className="font-bold text-slate-800">{f.currentStock}</span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-slate-400 block text-[9px] text-amber-500">90D Dep</span>
                              <span className="font-bold text-amber-600">-{Math.round(f.finalDailyRate * 90)}</span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-slate-400 block text-[9px] text-indigo-500">PO Qty</span>
                              <span className="font-bold text-indigo-600">+{f.totalPOQty}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Charts Panel Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      
                      {/* Left: 90-Day Depletion Trend Line Chart */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-3xs flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-black uppercase text-slate-800 tracking-wide flex items-center gap-2 font-mono">
                            <LucideLineChart className="w-4 h-4 text-emerald-600" />
                            90-Day Depletion Stock Levels Projection
                          </h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">Shows forecasted decay in on-hand quantities based on {lookbackDays}-day consumption multiplier ({demandMultiplier}x).</p>
                        </div>

                        {top5DemandItems.length === 0 ? (
                          <div className="h-[280px] flex items-center justify-center border border-dashed border-slate-200 rounded-lg italic text-slate-400 text-xs mt-4">
                            No high demand items found to estimate projections.
                          </div>
                        ) : (
                          <div className="h-[290px] bg-slate-50/20 p-2 rounded-lg border border-slate-100 mt-4">
                            <SafeResponsiveContainer height={270}>
                              <LineChart data={lineChartTimelineData} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis dataKey="timelineLabel" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }} />
                                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                                <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px', backgroundColor: '#0f172a', color: '#f8fafc' }} />
                                <Legend wrapperStyle={{ fontSize: '9px' }} />
                                {top5DemandItems.map((f, idx) => (
                                  <Line
                                    key={f.item.id}
                                    type="monotone"
                                    dataKey={f.item.sku}
                                    stroke={lineColors[idx]}
                                    strokeWidth={3}
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 6 }}
                                    name={`${f.item.sku}`}
                                  />
                                ))}
                              </LineChart>
                            </SafeResponsiveContainer>
                          </div>
                        )}
                      </div>

                      {/* Right: Depletion vs Historical PO Comparison Bar/Line Chart */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-3xs flex flex-col justify-between font-sans">
                        <div>
                          <h4 className="text-xs font-black uppercase text-slate-800 tracking-wide flex items-center gap-2 font-mono">
                            <BarChart3 className="w-4 h-4 text-indigo-650" />
                            90D Projected Depletion vs. Historical PO Balance
                          </h4>
                          <p className="text-[10px] text-slate-505 mt-0.5 text-slate-500">Compares forecasted 90-day depletion quantity against total historical purchase ordered quantities.</p>
                        </div>

                        {top5DemandItems.length === 0 ? (
                          <div className="h-[280px] flex items-center justify-center border border-dashed border-slate-200 rounded-lg italic text-slate-400 text-xs mt-4">
                            No comparison statistics available.
                          </div>
                        ) : (
                          <div className="h-[290px] bg-slate-50/20 p-2 rounded-lg border border-slate-100 mt-4">
                            <SafeResponsiveContainer height={270}>
                              <BarChart data={comparisonChartData} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }} />
                                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                                <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                                <Legend wrapperStyle={{ fontSize: '9px' }} />
                                <Bar dataKey="Historical PO Qty" fill="#6366F1" radius={[4, 4, 0, 0]} name="Historical PO Quantity" />
                                <Bar dataKey="Projected 90D Depletion" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Projected 90D Depletion" />
                                <Bar dataKey="Current Stock" fill="#94A3B8" radius={[4, 4, 0, 0]} name="Current Stock Level" />
                              </BarChart>
                            </SafeResponsiveContainer>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Dynamic Actionable Guidance / Insights */}
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 space-y-2 font-sans">
                      <h4 className="text-xs font-black text-indigo-900 uppercase font-mono flex items-center gap-2">
                        💡 Intelligent Forecasting Insights & Action Plans
                      </h4>
                      <p className="text-[11px] leading-relaxed text-indigo-950 text-indigo-900">
                        Comparing future demand lines against historic procurement habits displays key operational balance points. 
                        If an item's <strong>Projected 90D Depletion</strong> significantly exceeds its <strong>Historical PO level</strong>, we advise immediately raising current safety stock limits or establishing longer-term supplier commitments to prevent severe stock depletion and service line delays.
                      </p>
                    </div>

                    {/* Detailed Comparative Information Ledger Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3s font-sans">
                      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-600 uppercase font-mono tracking-wider">
                          Ledger Balance Sheet (Top 5 high-demand SKUs)
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Simulated at multiplier: {demandMultiplier.toFixed(1)}x
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100/50 text-slate-600 font-mono font-bold text-[10px] uppercase border-b border-slate-200">
                              <th className="p-3">SKU Code</th>
                              <th className="p-3">Item Name</th>
                              <th className="p-3">Category</th>
                              <th className="p-3 text-right">On-Hand Stock</th>
                              <th className="p-3 text-right">Daily Consumption Rate</th>
                              <th className="p-3 text-right">Forecasted 90D Depletion</th>
                              <th className="p-3 text-right">Completed PO Quantity</th>
                              <th className="p-3 text-center">Safety Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium font-sans">
                            {top5DemandItems.map(f => {
                              const projectedDepletion = Math.round(f.finalDailyRate * 90);
                              const balanceRatio = f.totalPOQty > 0 ? (projectedDepletion / f.totalPOQty) : 0;
                              let statusLabel = "Balanced Flow";
                              let statusTagColor = "bg-emerald-50 text-emerald-700 border-emerald-100";

                              if (projectedDepletion > f.currentStock) {
                                statusLabel = "Shortage Danger";
                                statusTagColor = "bg-rose-50 text-rose-700 border-rose-100";
                              } else if (balanceRatio > 1.3) {
                                statusLabel = "Procure Deficit";
                                statusTagColor = "bg-amber-50 text-amber-700 border-amber-100";
                              }

                              return (
                                <tr key={f.item.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-3 font-mono font-bold text-slate-800">{f.item.sku}</td>
                                  <td className="p-3 font-semibold text-slate-800">{f.item.name}</td>
                                  <td className="p-3 text-slate-500 font-mono text-[10px]">{f.item.category}</td>
                                  <td className="p-3 text-right font-mono text-slate-800">{f.currentStock} units</td>
                                  <td className="p-3 text-right font-mono text-slate-500">{f.finalDailyRate.toFixed(2)}/day</td>
                                  <td className="p-3 text-right font-mono text-amber-600 font-extrabold">{projectedDepletion} units</td>
                                  <td className="p-3 text-right font-mono text-indigo-600 font-extrabold">+{f.totalPOQty} units</td>
                                  <td className="p-3 text-center">
                                    <span className={`inline-block px-2.5 py-1 rounded text-[10px] uppercase font-bold font-mono border ${statusTagColor}`}>
                                      {statusLabel}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {activeReportTab === 'supplier-analytics' && (() => {
          // Average Sourcing Fulfillment Speed and Total Spend per Supplier based on selected timeline using PO logs
          const nowRef = new Date();
          let periodDays = 365;
          if (supplierPeriod === '30') periodDays = 30;
          else if (supplierPeriod === '60') periodDays = 60;
          else if (supplierPeriod === '90') periodDays = 90;
          else if (supplierPeriod === '180') periodDays = 180;
          else if (supplierPeriod === '365') periodDays = 365;

          const periodAgo = new Date(nowRef.getTime() - periodDays * 24 * 60 * 60 * 1000);

          // Group by supplier/vendor name
          const supplierStatsMap: Record<string, {
            vendorName: string;
            totalSpend: number;
            totalCompletedSpend: number;
            totalPOs: number;
            completedPOs: number;
            totalFulfillmentDays: number;
            fulfillmentCount: number;
          }> = {};

          purchaseOrders.forEach(po => {
            if (!po.orderDate) return;
            const poDate = new Date(po.orderDate);
            // filter for selected period
            if (poDate < periodAgo || poDate > nowRef) return;

            const name = po.vendorName || "Unknown Vendor";
            if (!supplierStatsMap[name]) {
              supplierStatsMap[name] = {
                vendorName: name,
                totalSpend: 0,
                totalCompletedSpend: 0,
                totalPOs: 0,
                completedPOs: 0,
                totalFulfillmentDays: 0,
                fulfillmentCount: 0
              };
            }

            const statsObj = supplierStatsMap[name];
            statsObj.totalPOs += 1;
            
            // Spend calculation (sum po.total, which is already in base currency PHP)
            statsObj.totalSpend += po.total || 0;

            if (po.status === 'Received') {
              statsObj.completedPOs += 1;
              statsObj.totalCompletedSpend += po.total || 0;
              
              let speedDays = po.leadTimeDays;
              if (po.actualDeliveryDate && po.orderDate) {
                const start = new Date(po.orderDate).getTime();
                const end = new Date(po.actualDeliveryDate).getTime();
                if (end > start) {
                  speedDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
                }
              }

              if (speedDays !== undefined && speedDays >= 0) {
                statsObj.totalFulfillmentDays += speedDays;
                statsObj.fulfillmentCount += 1;
              }
            }
          });

          const supplierData = Object.values(supplierStatsMap).map(supplier => {
            const avgSpeed = supplier.fulfillmentCount > 0 
              ? parseFloat((supplier.totalFulfillmentDays / supplier.fulfillmentCount).toFixed(1)) 
              : 0;

            return {
              name: supplier.vendorName,
              spend: Math.round(supplier.totalSpend),
              completedSpend: Math.round(supplier.totalCompletedSpend),
              avgSpeed,
              totalPOs: supplier.totalPOs,
              completedPOs: supplier.completedPOs,
              fulfillmentCount: supplier.fulfillmentCount
            };
          }).sort((a, b) => b.spend - a.spend); // Sort by spend descending

          // High-level statistics
          const overallSpend = supplierData.reduce((sum, s) => sum + s.spend, 0);
          const activeSuppliersCount = supplierData.length;
          
          let sumFulfillment = 0;
          let countFulfillment = 0;
          supplierData.forEach(s => {
            if (s.fulfillmentCount > 0) {
              sumFulfillment += s.avgSpeed * s.fulfillmentCount;
              countFulfillment += s.fulfillmentCount;
            }
          });
          const overallAvgFulfillment = countFulfillment > 0 
            ? (sumFulfillment / countFulfillment).toFixed(1) 
            : 'N/A';

          const topSupplier = supplierData.length > 0 ? supplierData[0] : null;

          // For the Procurement Performance chart, rank by completedSpend descending
          const completedSpendData = [...supplierData]
            .filter(s => s.completedSpend > 0)
            .sort((a, b) => b.completedSpend - a.completedSpend);

          return (
            <div className="space-y-6 animate-fadeIn text-left" id="supplier-analytics-widget">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-3 gap-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-indigo-600" />
                    Supplier Performance & Sourcing Analytics
                  </h3>
                  <p className="text-xs text-slate-450 mt-0.5">
                    Comprehensive ledger of procurement fulfillment timelines and spend matrices across your selected timeline scope
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold font-mono text-slate-400">Analysis Period:</span>
                  <select
                    value={supplierPeriod}
                    onChange={(e) => setSupplierPeriod(e.target.value as any)}
                    className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-extrabold text-slate-750 py-1.5 px-3 rounded-lg focus:ring-1 focus:ring-indigo-500 shadow-3xs cursor-pointer focus:outline-none transition-colors"
                  >
                    <option value="30">Last 30 Days</option>
                    <option value="60">Last 60 Days</option>
                    <option value="90">Last 90 Days</option>
                    <option value="180">Last 6 Months</option>
                    <option value="365">Yearly (12 Months)</option>
                  </select>
                </div>
              </div>

              {/* KPI Header Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-150 rounded-xl p-4 shadow-3xs flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block">Aggregate Sourcing Spend</span>
                    <span className="text-lg font-black text-slate-800 tracking-tight block mt-1">
                      ₱{overallSpend.toLocaleString()}
                    </span>
                    <span className="text-[9.5px] text-slate-450 block font-mono mt-0.5">
                      {supplierPeriod === '30' ? 'Across last 30 days' : supplierPeriod === '60' ? 'Across last 60 days' : supplierPeriod === '90' ? 'Across last 90 days' : supplierPeriod === '180' ? 'Across last 6 months' : 'Across last 12 months'}
                    </span>
                  </div>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white border border-gray-150 rounded-xl p-4 shadow-3xs flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block">Active Vendors Sourced</span>
                    <span className="text-lg font-black text-slate-800 tracking-tight block mt-1">
                      {activeSuppliersCount}
                    </span>
                    <span className="text-[9.5px] text-slate-450 block font-mono mt-0.5">Integrated supplier nodes</span>
                  </div>
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Building className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white border border-gray-150 rounded-xl p-4 shadow-3xs flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block">Avg Fulfillment Turnaround</span>
                    <span className="text-lg font-black text-slate-800 tracking-tight block mt-1">
                      {overallAvgFulfillment} {overallAvgFulfillment !== 'N/A' && 'Days'}
                    </span>
                    <span className="text-[9.5px] text-slate-450 block font-mono mt-0.5">Sourcing to warehouse check-in</span>
                  </div>
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <History className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white border border-gray-150 rounded-xl p-4 shadow-3xs flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block">Top Strategic Partner</span>
                    <span className="text-xs font-bold text-indigo-650 tracking-tight block mt-1.5 truncate max-w-[150px]" title={topSupplier?.name || 'None'}>
                      {topSupplier ? topSupplier.name : 'N/A'}
                    </span>
                    <span className="text-[9.5px] text-slate-450 block font-mono mt-0.5">
                      Spend: {topSupplier ? `₱${topSupplier.spend.toLocaleString()}` : '₱0'}
                    </span>
                  </div>
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {supplierData.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-slate-250 rounded-xl bg-slate-50/50 text-slate-400 text-xs italic">
                  No active purchase order history elements registered within the selected timeline scope.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                  
                  {/* Spend and Speed dual-axis visualizer */}
                  <div className="lg:col-span-3 bg-slate-50 border border-slate-150 p-4 rounded-xl space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">Supplier Spend Matrix & Lead times</h4>
                      <p className="text-[10.5px] text-slate-450 mt-0.5">Left-Y: Sourcing Expenditures (Bars, PHP) | Right-Y: Avg Days to Deliver (Line, Days)</p>
                    </div>
                    
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={supplierData}
                          margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis 
                            dataKey="name" 
                            tick={{ fill: '#475569', fontSize: 9.5 }}
                            axisLine={{ stroke: '#CBD5E1' }}
                            tickLine={false}
                          />
                          <YAxis 
                            yAxisId="left"
                            tick={{ fill: '#312E81', fontSize: 9.5 }}
                            axisLine={{ stroke: '#CBD5E1' }}
                            tickLine={false}
                            tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                          />
                          <YAxis 
                            yAxisId="right"
                            orientation="right"
                            tick={{ fill: '#B45309', fontSize: 9.5 }}
                            axisLine={{ stroke: '#CBD5E1' }}
                            tickLine={false}
                            tickFormatter={(v) => `${v}d`}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', border: '1px solid #1E293B', color: '#F8FAFC', fontSize: '11px', textAlign: 'left' }}
                            formatter={(value: any, name: any) => {
                              if (name === "Spend (PHP)") return [`₱${value.toLocaleString()}`, name];
                              return [`${value} Days`, "Lead Speed"];
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 600 }} />
                          <Bar 
                            yAxisId="left"
                            name="Spend (PHP)" 
                            dataKey="spend" 
                            fill="#6366F1" 
                            radius={[3, 3, 0, 0]} 
                            maxBarSize={35}
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            name="Fulfillment Speed (Days)"
                            dataKey="avgSpeed"
                            stroke="#D97706"
                            strokeWidth={2.5}
                            dot={{ fill: '#D97706', r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* High Quality Ledger Table */}
                  <div className="lg:col-span-2 space-y-3">
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider font-mono block">Performance Audit Ledger</span>
                    <div className="bg-white border border-slate-150 rounded-xl overflow-hidden shadow-2xs max-h-[320px] overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150 text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                            <th className="p-3 font-bold">Supplier Info</th>
                            <th className="p-3 font-bold text-right">Fulfillment</th>
                            <th className="p-3 font-bold text-right">Spend</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {supplierData.map((supplier) => (
                            <tr key={supplier.name} className="hover:bg-slate-50 transition-colors font-sans border-none">
                              <td className="p-3 leading-snug">
                                <span className="font-bold text-slate-800 block truncate max-w-[130px]" title={supplier.name}>
                                  {supplier.name}
                                </span>
                                <span className="text-[9px] text-slate-450 font-mono">
                                  Orders: {supplier.completedPOs} / {supplier.totalPOs} recv
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <span className={`inline-flex items-center gap-1 font-mono font-bold text-[11px] px-1.5 py-0.5 rounded-md ${
                                  supplier.avgSpeed === 0 
                                    ? 'bg-slate-50 text-slate-500' 
                                    : supplier.avgSpeed <= 5 
                                      ? 'bg-emerald-50 text-emerald-700' 
                                      : supplier.avgSpeed <= 12 
                                        ? 'bg-blue-50 text-blue-700' 
                                        : 'bg-rose-50 text-rose-700'
                                }`}>
                                  {supplier.avgSpeed === 0 ? 'N/A' : `${supplier.avgSpeed} days`}
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono font-extrabold text-indigo-700 bg-none border-none">
                                ₱{supplier.spend.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg text-[10.5px] text-amber-905 leading-normal">
                      💡 <b>Strategic Lead-Speed Correlation</b>: Higher priority is assigned to partners in the green category. Preferred suppliers process orders faster to optimize working capital cycles.
                    </div>
                  </div>

                </div>

                {/* Procurement Performance horizontal bar chart ranking */}
                <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      Procurement Performance (Active Supplier Ranks)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ranks suppliers based on the total PHP value of completed (Received) purchase orders within the selected period: <span className="font-semibold text-slate-700">{supplierPeriod === '30' ? 'last 30 days' : supplierPeriod === '60' ? 'last 60 days' : supplierPeriod === '90' ? 'last 90 days' : supplierPeriod === '180' ? 'last 6 months' : 'last 12 months'}</span>
                    </p>
                  </div>

                  {completedSpendData.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-sm italic bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                      No active completed (Received) purchase orders found within this selected period.
                    </div>
                  ) : (
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={completedSpendData}
                          margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                          <XAxis 
                            type="number"
                            tickFormatter={(v) => `₱${v.toLocaleString()}`}
                            tick={{ fill: '#64748B', fontSize: 9.5 }}
                            axisLine={{ stroke: '#E2E8F0' }}
                            tickLine={false}
                          />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={140}
                            tick={{ fill: '#334155', fontSize: 10, fontWeight: 700 }}
                            axisLine={{ stroke: '#E2E8F0' }}
                            tickLine={false}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', border: '1px solid #1E293B', color: '#F8FAFC', fontSize: '11px', textAlign: 'left' }}
                            formatter={(value: any) => [`₱${value.toLocaleString()}`, "Total Completed PO Value"]}
                          />
                          <Bar 
                            dataKey="completedSpend" 
                            name="Completed PO Value (PHP)"
                            fill="#10B981" 
                            radius={[0, 4, 4, 0]}
                            maxBarSize={22}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </>
            )}

            </div>
          );
        })()}

        {activeReportTab === 'inventory-aging' && (() => {
          // Calculate dynamic referenceDate safely
          const referenceDate = (() => {
            const envDate = new Date("2026-05-28T08:04:11Z");
            const systemDate = new Date();
            const baseDate = systemDate > envDate ? systemDate : envDate;
            let maxLotTime = baseDate.getTime();
            lots.forEach(l => {
              if (l.dateReceived) {
                const t = new Date(l.dateReceived).getTime();
                if (t > maxLotTime) maxLotTime = t;
              }
            });
            return new Date(maxLotTime);
          })();

          // 1. Process all stock lots and system stock levels to find age
          const allAgingStock = items.flatMap(item => {
            const supplier = suppliers?.find(sup => sup.id === item.supplierId);
            const exRate = supplier?.exchangeRate ?? 1.0;
            const unitCostPHP = (item.purchasePrice || 0) * exRate;

            return warehouses.map(wh => {
              const systemQty = item.stockByWarehouse?.[wh.id] || 0;
              if (systemQty <= 0) return [];

              // Find lots in this warehouse
              const itemLots = lots.filter(
                l => l.itemId === item.id && l.warehouseId === wh.id && l.quantityRemaining > 0
              );

              const mappedLots = itemLots.map(lot => {
                const ageDays = Math.max(0, Math.floor(
                  (referenceDate.getTime() - new Date(lot.dateReceived).getTime()) / (1000 * 60 * 60 * 24)
                ));
                return {
                  item,
                  sku: item.sku,
                  name: item.name,
                  category: item.category,
                  brand: item.brand || 'Generic',
                  warehouseId: wh.id,
                  warehouseName: wh.name,
                  quantity: lot.quantityRemaining,
                  unitCostPHP,
                  totalValuePHP: lot.quantityRemaining * unitCostPHP,
                  ageDays,
                  lotNumber: lot.lotNumber,
                  dateReceived: lot.dateReceived
                };
              });

              const representedQty = itemLots.reduce((sum, l) => sum + l.quantityRemaining, 0);
              if (systemQty > representedQty) {
                const extraQty = systemQty - representedQty;
                // find earliest tx if possible as fallback
                const itemTx = transactions.filter(t => t.itemId === item.id);
                let fallbackAge = 45;
                let fallbackDate = new Date(referenceDate.getTime() - 45 * 24 * 3600 * 1000).toISOString();
                if (itemTx.length > 0) {
                  const earliestTime = Math.min(...itemTx.map(t => new Date(t.date).getTime()));
                  const calculatedAge = Math.floor(
                    (referenceDate.getTime() - earliestTime) / (1000 * 60 * 60 * 24)
                  );
                  if (calculatedAge > 0) {
                    fallbackAge = calculatedAge;
                    fallbackDate = new Date(earliestTime).toISOString();
                  }
                }
                mappedLots.push({
                  item,
                  sku: item.sku,
                  name: item.name,
                  category: item.category,
                  brand: item.brand || 'Generic',
                  warehouseId: wh.id,
                  warehouseName: wh.name,
                  quantity: extraQty,
                  unitCostPHP,
                  totalValuePHP: extraQty * unitCostPHP,
                  ageDays: fallbackAge,
                  lotNumber: 'SYSTEM-ESTIMATED',
                  dateReceived: fallbackDate
                });
              }

              return mappedLots;
            }).flat();
          });

          // 2. Apply Filters (Warehouse, Category, Brand, Search, Interval)
          const filteredAging = allAgingStock.filter(row => {
            const matchesWarehouse = agingWarehouseFilter === 'ALL' || row.warehouseId === agingWarehouseFilter;
            const matchesCategory = agingCategoryFilter === 'ALL' || row.category === agingCategoryFilter;
            const matchesBrand = agingBrandFilter === 'ALL' || row.brand.toLowerCase() === agingBrandFilter.toLowerCase();
            
            // Interval classification
            let interval: 'fresh' | 'active' | 'stagnant' | 'dead' = 'fresh';
            if (row.ageDays < 30) {
              interval = 'fresh';
            } else if (row.ageDays < 90) {
              interval = 'active';
            } else if (row.ageDays < 180) {
              interval = 'stagnant';
            } else {
              interval = 'dead';
            }
            const matchesInterval = agingIntervalFilter === 'ALL' || interval === agingIntervalFilter;

            const matchesSearch = !agingSearch.trim() || 
              row.sku.toLowerCase().includes(agingSearch.toLowerCase()) ||
              row.name.toLowerCase().includes(agingSearch.toLowerCase()) ||
              row.lotNumber?.toLowerCase().includes(agingSearch.toLowerCase());

            return matchesWarehouse && matchesCategory && matchesBrand && matchesInterval && matchesSearch;
          });

          // 3. Compute KPI Aggregations over current filtered structure
          let totalQty = 0;
          let totalValPHP = 0;
          let weightedAgeSum = 0;

          let freshQty = 0; let freshVal = 0;
          let activeQty = 0; let activeVal = 0;
          let stagnantQty = 0; let stagnantVal = 0;
          let deadQty = 0; let deadVal = 0;

          filteredAging.forEach(row => {
            totalQty += row.quantity;
            totalValPHP += row.totalValuePHP;
            weightedAgeSum += row.ageDays * row.quantity;

            if (row.ageDays < 30) {
              freshQty += row.quantity;
              freshVal += row.totalValuePHP;
            } else if (row.ageDays < 90) {
              activeQty += row.quantity;
              activeVal += row.totalValuePHP;
            } else if (row.ageDays < 180) {
              stagnantQty += row.quantity;
              stagnantVal += row.totalValuePHP;
            } else {
              deadQty += row.quantity;
              deadVal += row.totalValuePHP;
            }
          });

          const averageAge = totalQty > 0 ? Math.round(weightedAgeSum / totalQty) : 0;
          const deadStockRatio = totalValPHP > 0 ? (deadVal / totalValPHP) * 100 : 0;
          const stagnantStockRatio = totalValPHP > 0 ? ((stagnantVal + deadVal) / totalValPHP) * 100 : 0;

          // Holding burden calculated roughly at 2% holding cost per month of carrying
          const monthlyCarryingCostEstimate = (stagnantVal + deadVal) * 0.02;

          // Chart preparation data
          const intervalBarChartData = [
            { name: 'Fresh (<30d)', quantity: freshQty, value: Math.round(freshVal), fill: '#10B981' },
            { name: 'Active (30-90d)', quantity: activeQty, value: Math.round(activeVal), fill: '#3B82F6' },
            { name: 'Stagnant (90-180d)', quantity: stagnantQty, value: Math.round(stagnantVal), fill: '#F59E0B' },
            { name: 'Dead Stock (180d+)', quantity: deadQty, value: Math.round(deadVal), fill: '#EF4444' }
          ];

          // Dynamic category ranking for dead & stagnant items to pinpoint trouble areas
          const categoryTroubleMap: Record<string, number> = {};
          filteredAging.forEach(row => {
            if (row.ageDays >= 90) {
              categoryTroubleMap[row.category] = (categoryTroubleMap[row.category] || 0) + row.totalValuePHP;
            }
          });
          const categoryTroubleChartData = Object.entries(categoryTroubleMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

          // Get unique brands and categories for filter options
          const categoriesList = Array.from(new Set(items.map(i => i.category))).filter(Boolean);
          const brandsList = Array.from(new Set(items.map(i => i.brand))).filter(Boolean);

          return (
            <div className="space-y-6 animate-fadeIn">
              {/* Header section with description */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-100 pb-4 gap-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                    <Hourglass className="w-5 h-5 text-indigo-600 animate-pulse" />
                    Inventory Aging & Dead Stock Analytics
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Analyzes current stock holdings by duration in physical warehouses to identify sluggish capital rotation and stagnant assets.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-amber-50 border border-amber-200 text-[10px] text-amber-800 font-bold px-3 py-1.5 rounded-lg font-mono">
                    REF REFERENCE DATE: {referenceDate.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}
                  </div>
                </div>
              </div>

              {/* Dynamic Search & Dropdown Filters Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {/* Search */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Search Stock</label>
                  <input
                    type="text"
                    placeholder="Search by SKU, Name..."
                    value={agingSearch}
                    onChange={(e) => setAgingSearch(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-lg py-1.5 px-3 focus:outline-none"
                  />
                </div>

                {/* Warehouse Filter */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider font-mono">Warehouse Location</label>
                  <select
                    value={agingWarehouseFilter}
                    onChange={(e) => setAgingWarehouseFilter(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 hover:border-slate-300 rounded-lg py-1.5 px-2.5 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Vaults / Warehouses</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>

                {/* Category Filter */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider font-mono">Item Taxonomy Category</label>
                  <select
                    value={agingCategoryFilter}
                    onChange={(e) => setAgingCategoryFilter(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 hover:border-slate-300 rounded-lg py-1.5 px-2.5 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Categories</option>
                    {categoriesList.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Brand Filter */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider font-mono">Supplier / Brand</label>
                  <select
                    value={agingBrandFilter}
                    onChange={(e) => setAgingBrandFilter(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 hover:border-slate-300 rounded-lg py-1.5 px-2.5 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Brands</option>
                    {brandsList.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                {/* Age Interval filter */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider font-mono">Age Range / Stagnancy</label>
                  <select
                    value={agingIntervalFilter}
                    onChange={(e) => setAgingIntervalFilter(e.target.value as any)}
                    className="w-full text-xs bg-white border border-slate-200 hover:border-slate-300 rounded-lg py-1.5 px-2.5 focus:outline-none cursor-pointer font-bold text-indigo-950"
                  >
                    <option value="ALL">All Lifespans</option>
                    <option value="fresh">Fresh (&lt; 30 days)</option>
                    <option value="active">Active (30 - 90 days)</option>
                    <option value="stagnant">Stagnant (90 - 180 days)</option>
                    <option value="dead">Dead Stock (180+ days)</option>
                  </select>
                </div>
              </div>

              {/* KPI metrics cards display */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Metric 1 */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs hover:shadow-2xs transition-all relative overflow-hidden">
                  <span className="text-[10px] font-extrabold uppercase font-mono text-slate-400 block tracking-wider">Total Capital On-Hand</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-xl font-black text-slate-800 font-mono">₱{totalValPHP.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    <span className="text-[10px] font-bold text-slate-500 font-mono">({totalQty.toLocaleString()} units)</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    Across current filtered inventory subset
                  </div>
                  <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-50 text-slate-400">
                    <Boxes className="w-4 h-4" />
                  </div>
                </div>

                {/* Metric 2 */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs hover:shadow-2xs transition-all relative overflow-hidden">
                  <span className="text-[10px] font-extrabold uppercase font-mono text-slate-400 block tracking-wider">Average Stock Age</span>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className={`text-xl font-black font-mono ${averageAge > 90 ? 'text-amber-600' : 'text-slate-800'}`}>
                      {averageAge} Days
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    Weighted average duration in shelves
                  </div>
                  <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-amber-50 text-amber-505">
                    <Hourglass className="w-4 h-4 text-amber-500" />
                  </div>
                </div>

                {/* Metric 3 */}
                <div className={`bg-white border rounded-xl p-4 shadow-3xs hover:shadow-2xs transition-all relative overflow-hidden ${deadStockRatio > 15 ? 'border-rose-100 bg-rose-50/10' : 'border-slate-200'}`}>
                  <span className="text-[10px] font-extrabold uppercase font-mono text-rose-500 block tracking-wider">Dead Stock Index (%)</span>
                  <div className="flex items-baseline gap-2 mt-2 font-mono">
                    <span className="text-xl font-black text-rose-600">
                      {deadStockRatio.toFixed(1)}%
                    </span>
                    <span className="text-[11px] text-rose-500 font-semibold">
                      (₱{deadVal.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    Proportion of holding &gt; 180 days age
                  </div>
                  <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-rose-50 text-rose-500">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>

                {/* Metric 4 */}
                <div className={`bg-white border rounded-xl p-4 shadow-3xs hover:shadow-2xs transition-all relative overflow-hidden ${stagnantStockRatio > 35 ? 'border-amber-100 bg-amber-50/5' : 'border-slate-200'}`}>
                  <span className="text-[10px] font-extrabold uppercase font-mono text-amber-500 block tracking-wider">Carrying burden cost</span>
                  <div className="flex items-baseline gap-1 mt-2 font-mono">
                    <span className="text-xl font-black text-amber-600">
                      ₱{monthlyCarryingCostEstimate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">/mo</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono leading-normal">
                    Est. 2% monthly carrying drain of stagnant stock (₱{(stagnantVal + deadVal).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                  </div>
                  <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-amber-50 text-amber-500">
                    <PiggyBank className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Graphic charts analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart 1: Bracket distribution */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-3xs space-y-4">
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wide">Shelved Capital Breakdown by Age Bracket</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">PHP valuation locked within specific warehouse storage windows</p>
                  </div>
                  <div className="h-[260px] w-full">
                    {totalValPHP === 0 ? (
                      <div className="flex items-center justify-center h-full text-slate-400 text-xs italic bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                        No qualified stock found for current filter combination
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={intervalBarChartData}
                          margin={{ top: 10, right: 10, left: 15, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                          <XAxis 
                            dataKey="name" 
                            tick={{ fill: '#475569', fontSize: 10, fontWeight: 600 }}
                            axisLine={{ stroke: '#E2E8F0' }}
                          />
                          <YAxis 
                            tickFormatter={(v) => `₱${(v / 1000).toLocaleString()}k`}
                            tick={{ fill: '#64748B', fontSize: 9 }}
                            axisLine={{ stroke: '#E2E8F0' }}
                          />
                          <Tooltip 
                            formatter={(value: any) => [`₱${value.toLocaleString()}`, 'Tied Capital (PHP)']}
                            contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#F8FAFC', fontSize: '11px' }}
                          />
                          <Bar 
                            dataKey="value" 
                            radius={[6, 6, 0, 0]}
                            maxBarSize={45}
                          >
                            {intervalBarChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Chart 2: Category trouble zones */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-3xs space-y-4">
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wide">Top Stagnant Categories (&gt;90 Days)</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Top stock groups causing holding cost overheads</p>
                  </div>
                  <div className="h-[260px] w-full">
                    {categoryTroubleChartData.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-slate-400 text-xs italic bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                        ✅ Awesome! No stagnant stock (&gt;90 days) detected under this filter.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={categoryTroubleChartData}
                          margin={{ top: 10, right: 10, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                          <XAxis 
                            type="number"
                            tickFormatter={(v) => `₱${v.toLocaleString()}`}
                            tick={{ fill: '#64748B', fontSize: 9 }}
                            axisLine={{ stroke: '#E2E8F0' }}
                          />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={110}
                            tick={{ fill: '#334155', fontSize: 9.5, fontWeight: 700 }}
                            axisLine={{ stroke: '#E2E8F0' }}
                          />
                          <Tooltip 
                            formatter={(value: any) => [`₱${value.toLocaleString()}`, 'Stagnant Capital (PHP)']}
                            contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#F8FAFC', fontSize: '11px' }}
                          />
                          <Bar 
                            dataKey="value" 
                            fill="#F59E0B" 
                            radius={[0, 4, 4, 0]}
                            maxBarSize={18}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              {/* Stagnant & Dead Stock Ledger Table Section */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-3xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wide">Aging Ledger Breakdown</h4>
                    <p className="text-[10px] text-slate-400">Detailed item logs categorized by warehouse duration with actionable suggestions</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const headers = ["SKU", "Item Name", "Category", "Warehouse", "Lot Number", "Date Received", "Age (Days)", "Qty On Hand", "Value (PHP)", "Action Recommendation"];
                        const rows = filteredAging.map(r => {
                          const ageText = `${r.ageDays} Days`;
                          let recommendation = "OK";
                          if (r.ageDays >= 180) {
                            recommendation = "Liquidate / Return / High Discount";
                          } else if (r.ageDays >= 90) {
                            recommendation = "Promotional Bundling / Halt Ordering";
                          } else if (r.ageDays >= 30) {
                            recommendation = "Monitor Movement Rate";
                          }
                          return [r.sku, r.name, r.category, r.warehouseName, r.lotNumber || 'N/A', new Date(r.dateReceived).toLocaleDateString(), ageText, r.quantity.toString(), r.totalValuePHP.toFixed(2), recommendation];
                        });
                        const csvContent = "data:text/csv;charset=utf-8," 
                          + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `Equiprime_Inventory_Aging_Report_${new Date().toISOString().slice(0,10)}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-205 text-[10px] font-bold text-slate-700 py-1.5 px-3 rounded-lg shadow-3xs transition-all cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      Export Spreadsheet (.csv)
                    </button>
                  </div>
                </div>

                {/* Actual Data Table layout */}
                <div className="overflow-x-auto font-sans">
                  {filteredAging.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs italic bg-white pb-14">
                      No stock records matched current selections or search queries.
                    </div>
                  ) : (
                    <table className="w-full text-[11px] text-slate-650 border-collapse">
                      <thead>
                        <tr className="bg-slate-100/70 text-slate-500 text-left font-mono border-b border-slate-150 uppercase tracking-wider text-[9.5px]">
                          <th className="py-2.5 px-3">SKU / Item</th>
                          <th className="py-2.5 px-3">Warehouse Slot</th>
                          <th className="py-2.5 px-3 border-none">Receipt Lot ID</th>
                          <th className="py-2.5 px-3">Date Received</th>
                          <th className="py-2.5 px-3 text-center">Shelf Duration</th>
                          <th className="py-2.5 px-3 text-right">In-Stock</th>
                          <th className="py-2.5 px-3 text-right">Tied Capital</th>
                          <th className="py-2.5 px-3">Critical Rating</th>
                          <th className="py-2.5 px-3">Action Recommendation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredAging.sort((a, b) => b.ageDays - a.ageDays).slice(0, 100).map((row, idx) => {
                          const isDead = row.ageDays >= 180;
                          const isStagnant = row.ageDays >= 90 && row.ageDays < 180;
                          const isActive = row.ageDays >= 30 && row.ageDays < 90;

                          // Dynamic rating tag style classification
                          let ratingTag = (
                            <span className="inline-flex items-center gap-1 font-bold text-[9.5px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-mono">
                              ● FRESH
                            </span>
                          );
                          let actionRec = <span className="text-slate-400 italic">No action needed; healthy rotation.</span>;

                          if (isDead) {
                            ratingTag = (
                              <span className="inline-flex items-center gap-1 font-bold text-[9.5px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100 font-mono animate-pulse">
                                ⚠️ DEAD STOCK
                              </span>
                            );
                            actionRec = (
                              <span className="font-bold text-rose-705">
                                Liquidate immediately, return to supplier, or offer 50%+ discount burden.
                              </span>
                            );
                          } else if (isStagnant) {
                            ratingTag = (
                              <span className="inline-flex items-center gap-1 font-bold text-[9.5px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-750 border border-amber-100 font-mono">
                                ⚠ STAGNANT
                              </span>
                            );
                            actionRec = (
                              <span className="font-semibold text-amber-705">
                                Halt reorders, create promotional parts bundles, or adjust min-stock.
                              </span>
                            );
                          } else if (isActive) {
                            ratingTag = (
                              <span className="inline-flex items-center gap-1 font-bold text-[9.5px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-mono">
                                ○ SLOW MOVING
                              </span>
                            );
                            actionRec = (
                              <span className="text-slate-600">
                                Keep on watch list; review monthly turn-rate index.
                              </span>
                            );
                          }

                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-800 font-mono text-[10px]">{row.sku}</div>
                                <div className="text-slate-700 font-semibold line-clamp-1" title={row.name}>{row.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono italic">{row.category}</div>
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-700">{row.warehouseName}</td>
                              <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">
                                {row.lotNumber === 'SYSTEM-ESTIMATED' ? (
                                  <span className="text-slate-400 italic font-normal text-[9.5px]">Est. Pre-Lot</span>
                                ) : (
                                  row.lotNumber
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[9.5px] text-slate-400">
                                {new Date(row.dateReceived).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`font-black font-mono text-xs px-2 py-0.5 rounded ${isDead ? 'bg-rose-100 text-rose-800' : isStagnant ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                                  {row.ageDays} Days
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-800 font-mono">
                                {row.quantity.toLocaleString()} pcs
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-slate-900 font-mono text-xs">
                                ₱{row.totalValuePHP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">{ratingTag}</td>
                              <td className="py-2.5 px-3 text-[10px] leading-tight text-slate-600">{actionRec}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
                {filteredAging.length > 100 && (
                  <div className="p-3 bg-slate-50 border-t border-slate-100 text-center text-slate-400 text-[10px]">
                    ... Showing top 100 aging entries only. Use filters above or click export to download all {filteredAging.length} entries.
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
