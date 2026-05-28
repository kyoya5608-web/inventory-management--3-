/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent, useEffect, ChangeEvent, useRef } from 'react';
import { SalesOrder, Item, Warehouse, SOItem, Customer, StockLot, ExplicitDeliveryReceipt } from '../types';
import { Search, Plus, Eye, Truck, CheckCircle, Ban, X, Trash2, ShieldCheck, FileText, AlertCircle, Edit2, ShieldAlert, Paperclip, MapPin, Tag, Wrench, ClipboardCheck, Printer, Upload, Download, Activity } from 'lucide-react';
import { AttachmentRecord } from '../types';
import { VisualQRCode, VisualBarcode } from './BarcodeQRGenerator';

interface SalesOrdersProps {
  salesOrders: SalesOrder[];
  items: Item[];
  warehouses: Warehouse[];
  customers: Customer[];
  onCreateSO: (so: Omit<SalesOrder, 'id' | 'subtotal' | 'tax' | 'total'> & { subtotal: number, tax: number, total: number }) => void;
  onUpdateSOStatus: (soId: string, status: SalesOrder['status']) => void;
  onEditSO: (so: SalesOrder, isRemarkOnly?: boolean) => void;
  canEdit: boolean;
  lots: StockLot[];
  machineLogs?: import('../types').MachineLog[];
  currentUser?: import('../types').UserRecord;
  users?: import('../types').UserRecord[];
  canSeePricing?: boolean;
  onShipSOBatch?: (
    soId: string,
    receiptNumber: string,
    dispatchedBy: string,
    dispatchDate: string,
    notes: string,
    shippedAmounts: Record<string, number>
  ) => void;
  explicitDeliveryReceipts?: any[];
  onDeleteSO?: (soId: string) => void;
  onBatchUpdateSOStatus?: (soIds: string[], status: 'Confirmed' | 'Shipped') => void;
  onDeleteDeliveryReceipt?: (drId: string) => void;
  onUpdateMachineLogs?: (logs: import('../types').MachineLog[]) => void;
}

export default function SalesOrders({
  salesOrders,
  items,
  warehouses,
  customers,
  onCreateSO,
  onUpdateSOStatus,
  onEditSO,
  canEdit,
  lots,
  machineLogs = [],
  currentUser,
  users = [],
  canSeePricing = true,
  onShipSOBatch,
  explicitDeliveryReceipts = [],
  onDeleteSO,
  onBatchUpdateSOStatus,
  onDeleteDeliveryReceipt,
  onUpdateMachineLogs,
}: SalesOrdersProps) {
  // UI states
  const [selectedSOIds, setSelectedSOIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedCustomer, setSelectedCustomer] = useState('All');
  const [focusedSO, setFocusedSO] = useState<SalesOrder | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [revisingSO, setRevisingSO] = useState<SalesOrder | null>(null);
  const [viewingMachineSerial, setViewingMachineSerial] = useState<string | null>(null);
  const [isPrintLabelModalOpen, setIsPrintLabelModalOpen] = useState(false);

  // Heavy machinery custom inspection explorer interactive edits
  const [fleetModelText, setFleetModelText] = useState('');
  const [fleetLocation, setFleetLocation] = useState('');
  const [fleetStatus, setFleetStatus] = useState<string>('Operational');
  const [fleetClassification, setFleetClassification] = useState<'Core Product' | 'Service Campaign'>('Core Product');
  const [fleetJournalDesc, setFleetJournalDesc] = useState('');
  const [fleetJournalNotes, setFleetJournalNotes] = useState('');
  const [fleetFormMsg, setFleetFormMsg] = useState<string | null>(null);

  // Invoicing & Expanded Withholding Tax (EWT) billing form states
  const [isEditingBilling, setIsEditingBilling] = useState(false);
  const [billingInvoiceNumber, setBillingInvoiceNumber] = useState('');
  const [billingInvoiceDate, setBillingInvoiceDate] = useState('');
  const [billingInvoiceRemarks, setBillingInvoiceRemarks] = useState('');
  const [billingIsPaid, setBillingIsPaid] = useState(false);
  const [billingAmountPaid, setBillingAmountPaid] = useState(0);
  const [billingHasEwt, setBillingHasEwt] = useState(false);
  const [billingEwtRate, setBillingEwtRate] = useState(1); // 1% default
  const [billingEwtAmount, setBillingEwtAmount] = useState(0);
  const [billingPaymentDate, setBillingPaymentDate] = useState('');
  const [billingPaymentRemarks, setBillingPaymentRemarks] = useState('');
  const [billingPaymentMethod, setBillingPaymentMethod] = useState('Bank Transfer');

  // Synchronize billing fields upon opening a sales order
  useEffect(() => {
    if (focusedSO) {
      setBillingInvoiceNumber(focusedSO.invoiceNumber || '');
      setBillingInvoiceDate(focusedSO.invoiceDate || '');
      setBillingInvoiceRemarks(focusedSO.invoiceRemarks || '');
      setBillingIsPaid(focusedSO.isPaid || false);
      setBillingAmountPaid(focusedSO.amountPaid || 0);
      setBillingHasEwt(focusedSO.hasEwt || false);
      setBillingEwtRate(focusedSO.ewtRate || 1);
      setBillingEwtAmount(focusedSO.ewtAmount || 0);
      setBillingPaymentDate(focusedSO.paymentDate || '');
      setBillingPaymentRemarks(focusedSO.paymentRemarks || '');
      setBillingPaymentMethod(focusedSO.paymentMethod || 'Bank Transfer');
    }
  }, [focusedSO]);

  // Synchronize focusedSO with updated props when salesOrders changes
  useEffect(() => {
    if (focusedSO) {
      const currentSO = salesOrders.find(s => s.id === focusedSO.id);
      if (currentSO && JSON.stringify(currentSO) !== JSON.stringify(focusedSO)) {
        setFocusedSO(currentSO);
      }
    }
  }, [salesOrders, focusedSO]);

  const handleQuickRegisterMachine = (serialNumber: string) => {
    if (!onUpdateMachineLogs || !machineLogs || !focusedSO) return;
    
    // Check if item in Sales Order matches any specific SKU to auto-fill model
    const firstItem = focusedSO.items[0];
    const firstItemName = firstItem ? (items.find(it => it.id === firstItem.itemId)?.name || 'Heavy Construction Equipment') : 'Heavy Construction Equipment';
    
    const newMachine: import('../types').MachineLog = {
      id: `ML-${Date.now().toString().slice(-6)}`,
      serialNumber: serialNumber,
      model: firstItemName,
      status: 'Operational',
      machineLocation: 'Delivered - Client Site',
      deliveryDate: new Date().toISOString().split('T')[0],
      warrantyStart: new Date().toISOString().split('T')[0],
      warrantyEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 12 months out
      customerId: focusedSO.customerId || '',
      customerName: focusedSO.customerName || 'Standard Client',
      salesOrderId: focusedSO.id,
      soNumber: focusedSO.soNumber,
      classification: 'Core Product',
      notes: `Linked automatically from Sales Order: ${focusedSO.soNumber} upon physical serial record mapping.`,
      warrantyStatus: 'warranty/primecare',
      warrantyPeriod: '12 Months',
      unitWarranty: 'Active',
      unitPrimecare: 'Active',
      currentSmr: 0,
      updateDate: new Date().toISOString().split('T')[0]
    };
    
    onUpdateMachineLogs([...machineLogs, newMachine]);
    alert(`Success! Heavy machinery unit with serial number ${serialNumber} has been successfully registered in the fleet database.`);
  };

  // Synchronize fleet explorer form helper fields when active serial toggles
  useEffect(() => {
    if (viewingMachineSerial) {
      const activeMachine = machineLogs.find(m => m.serialNumber === viewingMachineSerial);
      if (activeMachine) {
        setFleetModelText(activeMachine.model);
        setFleetLocation(activeMachine.machineLocation || '');
        setFleetStatus(activeMachine.status);
        setFleetClassification(activeMachine.classification || 'Core Product');
      } else {
        setFleetModelText('');
        setFleetLocation('');
        setFleetStatus('Operational');
        setFleetClassification('Core Product');
      }
      setFleetJournalDesc('');
      setFleetJournalNotes('');
      setFleetFormMsg(null);
    }
  }, [viewingMachineSerial, machineLogs]);

  const [soLogRemarks, setSoLogRemarks] = useState<Record<number, string>>({});

  const handleAppendSoLogRemark = (logIdx: number, text: string) => {
    if (!focusedSO || !text.trim() || !onEditSO) return;
    
    const fallbackHistory = focusedSO.statusHistory && focusedSO.statusHistory.length > 0
      ? [...focusedSO.statusHistory]
      : [
          { status: 'Draft' as const, date: focusedSO.orderDate || new Date().toISOString().split('T')[0], note: 'Sales Order drafted by sales team.', user: 'Operations' }
        ];
      
    if (logIdx >= 0 && logIdx < fallbackHistory.length) {
      const entry = { ...fallbackHistory[logIdx] };
      entry.note = `${entry.note} (${text.trim()})`;
      fallbackHistory[logIdx] = entry;
      
      const updatedSO: SalesOrder = {
        ...focusedSO,
        statusHistory: fallbackHistory
      };
      
      onEditSO(updatedSO, true);
      setFocusedSO(updatedSO);
    }
  };

  const handleAutoCalculateEwt = (hasEwt: boolean, rateVal: number) => {
    if (!focusedSO) return;
    if (hasEwt) {
      const netOfTax = focusedSO.taxType === 'VAT' ? focusedSO.subtotal : focusedSO.total;
      const ewt = Number((netOfTax * (rateVal / 100)).toFixed(2));
      const payAmt = Number((focusedSO.total - ewt).toFixed(2));
      setBillingEwtAmount(ewt);
      setBillingAmountPaid(payAmt);
    } else {
      setBillingEwtAmount(0);
      setBillingAmountPaid(focusedSO.total);
    }
  };

  // Global Keyboard shortcut listener for power users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Support BOTH Ctrl+N and Ctrl+Alt+N to ensure it works cross-platform and environment-safe
      const isNewShortcut = (e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N');
      const isAltShortcut = e.altKey && (e.key === 'n' || e.key === 'N');
      
      if ((isNewShortcut || isAltShortcut) && canEdit) {
        e.preventDefault();
        handleOpenDrafting();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canEdit, customers, warehouses, items]);

  const handleExportAuditSO = () => {
    if (!focusedSO) return;
    const historyList = focusedSO.statusHistory && focusedSO.statusHistory.length > 0
      ? focusedSO.statusHistory
      : [
          { status: 'Draft', date: focusedSO.orderDate || new Date().toISOString().split('T')[0], note: 'Sales Order drafted by sales team.', user: 'Operations' }
        ];

    // CSV format: Columns are SO details and the history records
    const headers = ['Sales Order Number', 'Customer', 'Date/Time Stamp', 'Transaction Status', 'Log / Transition Note', 'Operator'];
    const rows = historyList.map(h => [
      focusedSO.soNumber,
      focusedSO.customerName,
      h.date || '',
      h.status,
      h.note || '',
      h.user || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SO_AuditLog_${focusedSO.soNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Form states for Create/Edit SO
  const [soNumber, setSoNumber] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [shipmentDate, setShipmentDate] = useState('');
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
  const [deliveryOption, setDeliveryOption] = useState('Standard Cargo');
  const [forwarderName, setForwarderName] = useState('');
  const [isDeliveryReceiptOpen, setIsDeliveryReceiptOpen] = useState(false);
  const [isCreateReceiptOpen, setIsCreateReceiptOpen] = useState(false);
  const [isPickListOpen, setIsPickListOpen] = useState(false);
  const [selectedDRForView, setSelectedDRForView] = useState<ExplicitDeliveryReceipt | null>(null);
  const [receiptForm, setReceiptForm] = useState<{
    receiptNumber: string;
    dispatchedBy: string;
    dispatchDate: string;
    notes: string;
    serialNumbers: Record<string, string>;
    shippedAmounts: Record<string, number>;
  }>({
    receiptNumber: '',
    dispatchedBy: '',
    dispatchDate: '',
    notes: '',
    serialNumbers: {},
    shippedAmounts: {}
  });

  const handleOpenCreateReceipt = (so: SalesOrder) => {
    const today = new Date().toISOString().split('T')[0];
    const drPrefix = `DR-${so.soNumber.replace('SO-', '')}-${Date.now().toString().slice(-4)}`;
    
    // Default form quantities to 0
    const initialShippedAmounts: Record<string, number> = {};
    const initialSerials: Record<string, string> = {};
    
    so.items.forEach(it => {
      const balance = Math.max(0, it.quantity - (it.shippedQuantity || 0));
      initialShippedAmounts[it.itemId] = 0; // Standard Zoho starts at 0 for user input choice
      initialSerials[it.itemId] = '';
    });

    setReceiptForm({
      receiptNumber: drPrefix,
      dispatchedBy: 'Logistics Supervisor',
      dispatchDate: today,
      notes: 'Shipment dispatched in compliance with sales layout criteria and transit security.',
      serialNumbers: initialSerials,
      shippedAmounts: initialShippedAmounts
    });
    setFocusedSO(so);
    setIsCreateReceiptOpen(true);
  };

  const [notes, setNotes] = useState('');
  
  // Custom states for Machine Serial and Order Purpose (Sales/Warranty)
  const [orderPurpose, setOrderPurpose] = useState<'Sales' | 'Warranty'>('Sales');
  const [machineSerialNumber, setMachineSerialNumber] = useState('');
  
  // Custom tax, discount, region, classification, and attachments
  const [taxType, setTaxType] = useState<'VAT' | 'Non-VAT' | 'Custom' | 'None'>('None');
  const [customTaxRate, setCustomTaxRate] = useState<number>(12);
  const [discountType, setDiscountType] = useState<'Percentage' | 'Fixed' | 'None'>('None');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [region, setRegion] = useState<string>('Head Office');
  const [description, setDescription] = useState<string>('');
  const [salesCategory, setSalesCategory] = useState<'Parts' | 'Services' | 'Both'>('Parts');
  const [serviceCategory, setServiceCategory] = useState<string>('');
  const [customServiceCategory, setCustomServiceCategory] = useState<string>('');
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);

  // File system upload handlers
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    const newRecords: AttachmentRecord[] = filesArray.map((f: File) => ({
      id: `att-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: f.name,
      size: f.size,
      type: f.type,
      url: '#',
      uploadedAt: new Date().toISOString()
    }));
    setAttachments(prev => [...prev, ...newRecords]);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };
  
  // Custom items currently drafted inside SO
  const [draftedItems, setDraftedItems] = useState<(SOItem & { _searchQuery?: string })[]>([
    { itemId: items[0]?.id || '', quantity: 2, unitPrice: items[0]?.sellingPrice || 0, category: 'Parts' }
  ]);

  // Sync focused SO with fresh sales orders list in case of status update
  useEffect(() => {
    if (focusedSO) {
      const match = salesOrders.find(s => s.id === focusedSO.id);
      if (match) {
        setFocusedSO(match);
      }
    }
  }, [salesOrders, focusedSO]);

  // Filtering list
  const filteredSOs = salesOrders.filter(so => {
    const matchedCustomer = customers.find(c => c.id === so.customerId);
    const clientName = matchedCustomer ? matchedCustomer.name : so.customerName;
    const matchSearch = so.soNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = selectedStatus === 'All' || so.status === selectedStatus;
    const matchCustomer = selectedCustomer === 'All' || so.customerId === selectedCustomer;
    return matchSearch && matchStatus && matchCustomer;
  });

  // Helper: check stock in chosen warehouse
  const checkStockLevel = (itemId: string, targetWhId: string) => {
    const product = items.find(p => p.id === itemId);
    if (!product) return 0;
    return product.stockByWarehouse[targetWhId] || 0;
  };

  const getOldestLotInfo = (itemId: string, currentWarehouseId: string) => {
    const activeLots = (lots || []).filter(
      l => l.itemId === itemId && l.warehouseId === currentWarehouseId && l.quantityRemaining > 0
    );
    if (activeLots.length === 0) return null;
    const sorted = [...activeLots].sort((a, b) => new Date(a.dateReceived).getTime() - new Date(b.dateReceived).getTime());
    return sorted[0];
  };

  const getFifoViolation = (itemId: string, currentWarehouseId: string, selectedLotId?: string) => {
    if (!selectedLotId) return { violated: false };
    const oldest = getOldestLotInfo(itemId, currentWarehouseId);
    if (!oldest) return { violated: false };
    if (oldest.id !== selectedLotId) {
      const selected = (lots || []).find(l => l.id === selectedLotId);
      return { violated: true, oldest, selected };
    }
    return { violated: false };
  };

  // Helper validation: any line exceeding available stock?
  const hasInadequateStock = () => {
    return draftedItems.some(row => {
      const stock = checkStockLevel(row.itemId, warehouseId);
      return row.quantity > stock;
    });
  };

  // Calculate Draft Summary
  const calculateDraftTotals = () => {
    const subtotal = draftedItems.reduce((acc, row) => acc + (row.quantity * row.unitPrice), 0);
    
    let discountAmount = 0;
    if (discountType === 'Percentage') {
      discountAmount = subtotal * (discountValue / 100);
    } else if (discountType === 'Fixed') {
      discountAmount = discountValue;
    }
    const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);

    let taxRate = 0.12;
    if (taxType === 'Non-VAT' || taxType === 'None') {
      taxRate = 0;
    } else if (taxType === 'Custom') {
      taxRate = customTaxRate / 100;
    }

    const tax = subtotalAfterDiscount * taxRate;
    const total = subtotalAfterDiscount + tax;

    return { subtotal, discountAmount, subtotalAfterDiscount, tax, total };
  };

  const totals = calculateDraftTotals();

  // Handlers for DraftingItems
  const handleAddItemToDraft = () => {
    const defaultProduct = items[0];
    if (!defaultProduct) return;
    setDraftedItems([
      ...draftedItems,
      { itemId: defaultProduct.id, quantity: 1, unitPrice: defaultProduct.sellingPrice, category: 'Parts' }
    ]);
  };

  const handleUpdateDraftRow = (index: number, fields: Partial<SOItem & { _searchQuery?: string }>) => {
    setDraftedItems(draftedItems.map((row, idx) => {
      if (idx !== index) return row;
      const updatedRow = { ...row, ...fields };
      // Auto-populate unit price when switching itemId
      if (fields.itemId) {
        updatedRow.lotId = undefined; // reset lot select
        const found = items.find(p => p.id === fields.itemId);
        if (found) {
          updatedRow.unitPrice = found.sellingPrice;
        }
      }
      return updatedRow;
    }));
  };

  const handleRemoveDraftRow = (index: number) => {
    if (draftedItems.length === 1) return; // Must have at least one slot
    setDraftedItems(draftedItems.filter((_, idx) => idx !== index));
  };

  const handleOpenDrafting = () => {
    setRevisingSO(null);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setSoNumber(`SO-${new Date().getFullYear()}-${randomSuffix}`);
    setReferenceNo('');
    setCustomerId(customers[0]?.id || '');
    setShipmentDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // 3 days from now
    setWarehouseId(warehouses[0]?.id || '');
    setDeliveryOption('Standard Cargo');
    setForwarderName('');
    setNotes('');
    setDescription('');
    setTaxType('VAT');
    setCustomTaxRate(12);
    setDiscountType('None');
    setDiscountValue(0);
    setRegion('Head Office');
    setSalesCategory('Parts');
    setServiceCategory('');
    setCustomServiceCategory('');
    setAttachments([]);
    setOrderPurpose('Sales');
    setMachineSerialNumber('');
    setDraftedItems([
      { itemId: items[0]?.id || '', quantity: 2, unitPrice: items[0]?.sellingPrice || 0 }
    ]);
    setIsFormOpen(true);
  };

  const handleOpenEditDraft = (so: SalesOrder) => {
    if (so.status !== 'Draft') {
      alert("Only 'Draft' status Sales Orders can be edited to prevent inventory discrepancy.");
      return;
    }
    setRevisingSO(so);
    setSoNumber(so.soNumber);
    setReferenceNo(so.referenceNo || '');
    setCustomerId(so.customerId || '');
    setShipmentDate(so.shipmentDate);
    setWarehouseId(so.warehouseId);
    if (so.deliveryOption?.startsWith("Others (Forwarder: ")) {
      setDeliveryOption('Others');
      const startIdx = "Others (Forwarder: ".length;
      const endIdx = so.deliveryOption.lastIndexOf(")");
      setForwarderName(so.deliveryOption.substring(startIdx, endIdx !== -1 ? endIdx : undefined));
    } else if (so.deliveryOption === 'Others') {
      setDeliveryOption('Others');
      setForwarderName('');
    } else {
      setDeliveryOption(so.deliveryOption || 'Standard Cargo');
      setForwarderName('');
    }
    setNotes(so.notes);
    setDescription(so.description || '');
    setTaxType(so.taxType || 'None');
    setCustomTaxRate(so.customTaxRate || 12);
    setDiscountType(so.discountType || 'None');
    setDiscountValue(so.discountValue || 0);
    setRegion(so.salesCluster || so.region || 'Head Office');
    setSalesCategory(so.salesCategory || 'Parts');
    
    const predefined = ['Overhauling', 'Onsite Services', 'Preventive Maintenance', 'Inspection and Troubleshooting', 'Diagnostics'];
    if (so.serviceCategory) {
      if (predefined.includes(so.serviceCategory)) {
        setServiceCategory(so.serviceCategory);
        setCustomServiceCategory('');
      } else {
        setServiceCategory('other');
        setCustomServiceCategory(so.serviceCategory);
      }
    } else {
      setServiceCategory('');
      setCustomServiceCategory('');
    }

    setAttachments(so.attachments || []);
    setOrderPurpose(so.orderPurpose || 'Sales');
    setMachineSerialNumber(so.machineSerialNumber || '');
    setDraftedItems(so.items);
    setIsFormOpen(true);
  };

  const handleSubmitDraft = (e: FormEvent) => {
    e.preventDefault();
    if (!customerId || draftedItems.length === 0 || hasInadequateStock()) return;

    // Validate FIFO violations across all lines
    const violations: string[] = [];
    draftedItems.forEach((line) => {
      if (line.lotId) {
        const violation = getFifoViolation(line.itemId, warehouseId, line.lotId);
        if (violation.violated && violation.selected && violation.oldest) {
          const itemPr = items.find(p => p.id === line.itemId);
          violations.push(
            `- Product: "${itemPr?.name}"\n  Selected Lot: "${violation.selected.lotNumber}"\n  Oldest Lot Available: "${violation.oldest.lotNumber}" (received on ${violation.oldest.dateReceived})`
          );
        }
      }
    });

    if (violations.length > 0) {
      const confirmOverride = window.confirm(
        `⚠️ FIFO STOCKING RULE VIOLATION DETECTED!\n\n` +
        `Saving this order will associate it with lots that violate First In, First Out (FIFO) priorities:\n\n` +
        violations.join('\n\n') +
        `\n\nAre you sure you want to OVERRIDE and permit this selection anyway?`
      );
      if (!confirmOverride) {
        return; // Halt submission!
      }
    }

    const chosenCustName = customers.find(c => c.id === customerId)?.name || 'Default Customer';
    const computed = calculateDraftTotals();

    const finalizedSOData = {
      soNumber,
      referenceNo,
      customerName: chosenCustName,
      customerId,
      shipmentDate,
      warehouseId,
      deliveryOption: deliveryOption === 'Others' ? `Others (Forwarder: ${forwarderName})` : deliveryOption,
      items: draftedItems,
      subtotal: computed.subtotal,
      tax: computed.tax,
      total: computed.total,
      notes,
      description,
      taxType,
      customTaxRate,
      discountType,
      discountValue,
      region,
      salesCluster: region,
      salesCategory,
      serviceCategory: (salesCategory === 'Services' || salesCategory === 'Both') 
        ? (serviceCategory === 'other' ? (customServiceCategory.trim() || 'Other Service') : serviceCategory) 
        : undefined,
      attachments,
      orderPurpose,
      machineSerialNumber
    };

    if (revisingSO) {
      onEditSO({
        ...revisingSO,
        ...finalizedSOData
      });
      setFocusedSO({
        ...revisingSO,
        ...finalizedSOData
      });
    } else {
      onCreateSO({
        ...finalizedSOData,
        orderDate: new Date().toISOString().split('T')[0],
        status: 'Draft'
      });
    }
    
    setIsFormOpen(false);
  };

  const renderMachineSerialModal = () => {
    if (!viewingMachineSerial) return null;
    const activeMachine = machineLogs.find(m => m.serialNumber === viewingMachineSerial);
    const relatedSOs = salesOrders.filter(so => so.machineSerialNumber === viewingMachineSerial);
    const maintenanceLogs = machineLogs.filter(m => m.serialNumber === viewingMachineSerial && (m.notes || m.description));

    // Handler to create a new machine log entry in fleet registry
    const handleProvisionMachine = () => {
      if (!onUpdateMachineLogs) return;
      
      const newLogObj: import('../types').MachineLog = {
        id: `M-${Date.now()}`,
        serialNumber: viewingMachineSerial,
        model: fleetModelText || 'Heavy Machinery Asset Unit',
        deliveryDate: new Date().toISOString().split('T')[0],
        warrantyStart: new Date().toISOString().split('T')[0],
        warrantyEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0],
        customerId: focusedSO?.customerId || '',
        customerName: focusedSO?.customerName || '',
        salesOrderId: focusedSO?.id || '',
        soNumber: focusedSO?.soNumber || '',
        status: (fleetStatus || 'Operational') as any,
        classification: fleetClassification,
        warrantyStatus: 'warranty/primecare',
        notes: fleetJournalNotes || `Delivered via Sales Order ref ${focusedSO?.soNumber || 'N/A'}.`,
        description: fleetJournalDesc || 'Newly provisioned heavy fleet inventory serial.',
        machineLocation: fleetLocation,
        warrantyPeriod: '24 Months',
        unitWarranty: 'Active'
      };

      onUpdateMachineLogs([...machineLogs, newLogObj]);
      setFleetFormMsg('🎉 Fleet machinery recorded successfully!');
    };

    // Handler to update existing machine asset status & add journals
    const handleUpdateLiveAsset = () => {
      if (!onUpdateMachineLogs || !activeMachine) return;

      let updatedArray = machineLogs.map(m => {
        if (m.serialNumber === viewingMachineSerial) {
          return {
            ...m,
            status: fleetStatus as any,
            classification: fleetClassification,
            machineLocation: fleetLocation,
            model: fleetModelText || m.model
          };
        }
        return m;
      });

      // If repair notes were written, prepend a new historical journal log entries
      if (fleetJournalDesc.trim() || fleetJournalNotes.trim()) {
        const newJournal: import('../types').MachineLog = {
          id: `M-JOURNAL-${Date.now()}`,
          serialNumber: viewingMachineSerial,
          model: fleetModelText || activeMachine.model,
          deliveryDate: new Date().toISOString().split('T')[0],
          warrantyStart: activeMachine.warrantyStart,
          warrantyEnd: activeMachine.warrantyEnd,
          customerId: activeMachine.customerId,
          customerName: activeMachine.customerName,
          salesOrderId: activeMachine.salesOrderId,
          soNumber: activeMachine.soNumber,
          status: fleetStatus as any,
          classification: fleetClassification,
          notes: fleetJournalNotes,
          description: fleetJournalDesc,
          machineLocation: fleetLocation,
          warrantyPeriod: activeMachine.warrantyPeriod,
          unitWarranty: activeMachine.unitWarranty
        };
        updatedArray = [newJournal, ...updatedArray];
      }

      onUpdateMachineLogs(updatedArray);
      setFleetFormMsg('💾 Heavy equipment asset records successfully synchronized!');
      setFleetJournalDesc('');
      setFleetJournalNotes('');
    };

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-2xl w-full border border-gray-150 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transform transition-all animate-in fade-in duration-200 text-left text-xs">
          {/* Header */}
          <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                <Wrench className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="text-sm font-bold text-gray-900">Heavy Equipment Asset Control Panel</h4>
                <p className="text-xs text-gray-400 font-mono">SN: {viewingMachineSerial}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setViewingMachineSerial(null)}
              className="p-1.5 hover:bg-gray-150 rounded-lg text-gray-400 hover:text-gray-900 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-5 text-left text-xs text-slate-705">
            {fleetFormMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-medium flex justify-between items-center">
                <span>{fleetFormMsg}</span>
                <button 
                  type="button"
                  onClick={() => setFleetFormMsg(null)}
                  className="text-emerald-955 font-bold underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}

            {activeMachine ? (
              <div className="space-y-4">
                {/* Visual Metadata & Status Overview */}
                <div className="grid grid-cols-2 gap-4 bg-indigo-50/25 p-4 rounded-xl border border-indigo-100/40">
                  <div>
                    <span className="text-[9px] font-bold text-indigo-700 tracking-wider font-mono block uppercase">Client Owner & SO Context</span>
                    <span className="text-xs font-bold text-slate-900 block mt-0.5">{activeMachine.customerName}</span>
                    <span className="text-[10px] text-gray-500 font-mono">SO ref: <b>{activeMachine.soNumber || 'N/A'}</b></span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-indigo-700 tracking-wider font-mono block uppercase">Warranty Horizon</span>
                    <span className="text-xs font-semibold text-gray-600 block mt-0.5">Expires: <b className="text-rose-600">{activeMachine.warrantyEnd}</b></span>
                    <span className="text-[10px] text-gray-400">Commission Date: {activeMachine.deliveryDate}</span>
                  </div>
                </div>

                {/* Edit Section */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                  <div className="border-b border-slate-200 pb-1.5 flex justify-between items-center">
                    <h5 className="font-extrabold text-indigo-900 uppercase font-mono tracking-wider text-[10px]">✏️ UPDATE LIVE FLEET PROPERTIES</h5>
                    <span className="text-[9px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded uppercase font-mono">Interactive</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block mb-1">Equipment Model Ref</label>
                      <input
                        type="text"
                        value={fleetModelText}
                        onChange={(e) => setFleetModelText(e.target.value)}
                        placeholder="e.g. Komatsu PC200-8 Excavator"
                        className="w-full bg-white border border-slate-205 rounded p-1.5 text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block mb-1">Live Site Geolocation / Depot</label>
                      <input
                        type="text"
                        value={fleetLocation}
                        onChange={(e) => setFleetLocation(e.target.value)}
                        placeholder="e.g. Block II Pit Site B, Davao"
                        className="w-full bg-white border border-slate-205 rounded p-1.5 text-xs text-slate-800 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block mb-1">Active Machine Status</label>
                      <select
                        value={fleetStatus}
                        onChange={(e) => setFleetStatus(e.target.value)}
                        className="w-full bg-white border border-slate-205 rounded p-1.5 text-xs text-slate-800 font-semibold cursor-pointer"
                      >
                        <option value="Operational">🟢 Operational</option>
                        <option value="Operational with Problem">🟡 Operational with Problem</option>
                        <option value="Active Maintenance">⚙️ Active Maintenance</option>
                        <option value="Breakdown">🔴 Breakdown / Critical</option>
                        <option value="Warranty Claim">⚠️ Warranty Claim</option>
                        <option value="Deployed">📦 Deployed</option>
                        <option value="Retired">❌ Retired</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9.5px] font-bold text-slate-500 block mb-1">Fleet Classification</label>
                      <select
                        value={fleetClassification}
                        onChange={(e) => setFleetClassification(e.target.value as any)}
                        className="w-full bg-white border border-slate-205 rounded p-1.5 text-xs text-slate-800 cursor-pointer"
                      >
                        <option value="Core Product">Core Deployed Product</option>
                        <option value="Service Campaign">Special Field Service Campaign</option>
                      </select>
                    </div>
                  </div>

                  {/* Add repair notes right inside */}
                  <div className="bg-white border border-slate-150 rounded-lg p-3 space-y-2 mt-2">
                    <span className="text-[9.5px] font-bold text-amber-800 font-mono block">📝 Append Field Repair / Telemetry Notes</span>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={fleetJournalDesc}
                        onChange={(e) => setFleetJournalDesc(e.target.value)}
                        placeholder="Log summary (e.g., 250H PMS Completed)"
                        className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-[11px]"
                      />
                      <input
                        type="text"
                        value={fleetJournalNotes}
                        onChange={(e) => setFleetJournalNotes(e.target.value)}
                        placeholder="Observations, replacement parts used..."
                        className="w-full bg-slate-50 border border-slate-205 rounded p-1.5 text-[11px]"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleUpdateLiveAsset}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 rounded transition-all cursor-pointer text-center text-[10.5px] shadow-3xs hover:shadow-2xs mt-2"
                  >
                    💾 Update Heavy Equipment Live Status
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/50 border border-amber-200 p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <h5 className="font-bold text-amber-900 text-xs">Unregistered Fleet Equipment Serial</h5>
                    <p className="text-[10.5px] text-amber-800">This serial number (<b>{viewingMachineSerial}</b>) does not exist in the live Machinery Registry database yet.</p>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-amber-150 space-y-2 mt-1.5">
                  <span className="text-[9px] font-mono font-bold text-indigo-800 block tracking-wider uppercase">✨ QUICK PROVISIONING ENROLLMENT FORM</span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[9.5px] font-semibold text-slate-500 block mb-1">Equipment Name / Model</label>
                      <input 
                        type="text"
                        value={fleetModelText}
                        onChange={(e) => setFleetModelText(e.target.value)}
                        placeholder="e.g. Komatsu PC200-8 Excavator"
                        className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-semibold text-slate-500 block mb-1">Initial Location</label>
                      <input 
                        type="text"
                        value={fleetLocation}
                        onChange={(e) => setFleetLocation(e.target.value)}
                        placeholder="e.g. Davao Depot Yard A"
                        className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleProvisionMachine}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded transition-all cursor-pointer text-center text-xs shadow-3xs hover:shadow-2xs mt-1"
                  >
                    ✨ Provision & Register Heavy Equipment Asset
                  </button>
                </div>
              </div>
            )}

            {/* Repair logs / Notes */}
            <div className="space-y-2.5 text-left pt-2 border-t border-slate-100">
              <h5 className="text-[10px] font-extrabold text-slate-650 uppercase tracking-widest font-mono">Field Inspection Journals & Logs ({maintenanceLogs.length})</h5>
              {maintenanceLogs.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {maintenanceLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-left text-xs">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded font-mono">{log.status}</span>
                        <span className="text-gray-400 font-mono font-medium">{log.deliveryDate || 'History Log'}</span>
                      </div>
                      {log.description && (
                        <p className="leading-snug">
                          <b>Desc / Event:</b> {log.description}
                        </p>
                      )}
                      {log.notes && (
                        <p className="italic bg-white p-2 rounded border border-slate-150 leading-snug">
                          {log.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No historical breakdown notes or field interventions found for this equipment.</p>
              )}
            </div>

            {/* Sales orders logs */}
            <div className="space-y-2.5 text-left font-sans pt-2 border-t border-slate-100">
              <h5 className="text-[10px] font-extrabold text-slate-650 uppercase tracking-widest font-mono">Associated Sales Orders History ({relatedSOs.length})</h5>
              {relatedSOs.length > 0 ? (
                <div className="divide-y divide-gray-100 border border-gray-150 rounded-xl overflow-hidden bg-white text-xs">
                  {relatedSOs.map((so) => (
                    <div key={so.id} className="p-3.5 flex justify-between items-center hover:bg-slate-50/50 transition-colors text-left">
                      <div>
                        <span className="font-mono text-xs font-bold text-indigo-705 block">{so.soNumber}</span>
                        <span className="text-[10px] text-gray-400 font-mono font-semibold">Purpose: {so.orderPurpose || 'Sales'} — Date: {so.orderDate || so.shipmentDate || 'Recent'}</span>
                      </div>
                      <div className="text-right font-mono">
                        <span className={`inline-block px-1.5 py-0.2 rounded-sm text-[9px] font-extrabold pb-0.5 border ${
                          so.status === 'Shipped' ? 'bg-green-50 text-green-700 border-green-200' :
                          so.status === 'Confirmed' ? 'bg-sky-50 text-sky-700 border-sky-105' :
                          'bg-indigo-50 text-indigo-700 border-indigo-105'
                        }`}>
                          {so.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic font-sans text-left">No sales orders currently linked with this equipment.</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-gray-100 flex justify-end shrink-0">
            <button
              type="button"
              onClick={() => setViewingMachineSerial(null)}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-250 font-bold text-slate-700 rounded-lg text-xs cursor-pointer transition-colors"
            >
              Close Asset Control Panel
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDeliveryReceiptModal = () => {
    if (!isDeliveryReceiptOpen || !focusedSO) return null;
    const selectedCust = customers.find(c => c.id === focusedSO.customerId);
    const originWarehouse = warehouses.find(w => w.id === focusedSO.warehouseId);
    
    const drNumber = selectedDRForView ? selectedDRForView.drNumber : `DR-${focusedSO.soNumber.replace('SO-', '')}`;
    const dispatchDate = selectedDRForView ? selectedDRForView.dispatchDate : (focusedSO.actualDeliveryDate || focusedSO.shipmentDate || new Date().toISOString().split('T')[0]);
    const dispatchedBy = selectedDRForView ? selectedDRForView.dispatchedBy : 'Logistics Supervisor';
    const notesValue = selectedDRForView ? selectedDRForView.notes : 'Shipment dispatched in compliance with sales layout criteria and transit security. All custom logs preserved.';

    return (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl flex flex-col my-8 max-h-[90vh] overflow-hidden transform transition-all animate-in zoom-in-95 duration-150 text-left">
          {/* Header Controller Bar */}
          <div className="bg-slate-50 p-4 border-b border-gray-150 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-indigo-600" />
              <div className="text-left font-sans">
                <span className="text-[10px] font-mono font-bold tracking-widest text-[#0e1e38] block uppercase">Official Land Delivery Protocol</span>
                <span className="text-xs text-slate-400 font-serif italic font-semibold">{drNumber} — BIR SEC Registered Sheet</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-sans">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="p-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 hover:border-emerald-800 text-[10px] font-mono font-bold rounded-md flex items-center gap-1 cursor-pointer shadow-xs transition-all uppercase"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Bill</span>
              </button>
              <button
                type="button"
                onClick={() => setIsDeliveryReceiptOpen(false)}
                className="p-1 hover:bg-gray-200 text-gray-500 rounded-md cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable DR Payload Area */}
          <div className="p-8 overflow-y-auto space-y-6 text-left selection:bg-indigo-100 flex-1">
            {/* Print Sheet Borders */}
            <div className="border border-slate-350 p-6 md:p-8 bg-slate-50/10 rounded-xl space-y-6 relative overflow-hidden font-sans">
              {/* Visual Background Stamp */}
              <div className="absolute top-[33%] left-[12%] right-[12%] rotate-[-25deg] text-red-100 border-4 border-red-50/20 px-8 py-4 pointer-events-none text-center select-none rounded animate-pulse">
                <span className="text-5xl font-mono uppercase tracking-[12px] font-black leading-none text-rose-50/30 font-sans">RELEASED FOR CARRIER</span>
              </div>

              {/* Document Logistical Header */}
              <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-slate-250 pb-6">
                <div className="text-left space-y-1">
                  <h1 className="text-base font-bold font-serif text-slate-900 tracking-tight leading-none text-left">PHILIPPINE CODA INDUSTRIES</h1>
                  <span className="text-[9px] text-gray-400 font-mono tracking-wider block font-semibold text-left">124 P. SENSON ST., SAN BUENAVENTURA DISTRICT, PILA, LAGUNA</span>
                  <span className="text-[9px] text-gray-400 font-mono tracking-wider block font-semibold text-left">VAT REG TIN No: 485-992-051-00000 | PH Carrier Transit Registry</span>
                </div>
                <div className="text-left md:text-right font-mono space-y-1">
                  <span className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-[9px] font-extrabold px-2.5 py-1 rounded inline-block uppercase tracking-wider">DELIVERY RECEIPT</span>
                  <div className="pt-1.5 text-[10px] space-y-0.5 text-left md:text-right font-mono">
                    <p><span className="text-gray-400 font-sans">DR Sheet #:</span> <b className="text-slate-900">{drNumber}</b></p>
                    <p><span className="text-gray-400 font-sans">Log Date:</span> <b className="text-slate-800">{dispatchDate}</b></p>
                    <p><span className="text-gray-400 font-sans">Origin Whse:</span> <b className="text-slate-800 font-sans">{originWarehouse?.name || 'Central Laguna Hub'}</b></p>
                  </div>
                </div>
              </div>

              {/* Transaction Context Pair Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[11px] leading-relaxed">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-205 space-y-1.5 text-left">
                  <span className="text-[9px] font-extrabold text-slate-550 uppercase tracking-widest font-sans block border-b border-slate-200 pb-1 mb-1">CONSIGNEE RECIPIENT BILL TO</span>
                  <p className="font-bold text-slate-900">{selectedCust?.name || 'BIR Register Account'}</p>
                  <p className="text-gray-500 font-medium font-sans">{selectedCust?.address || 'No registered corporate tax billing address.'}</p>
                  <p><span className="text-gray-400">Account Contact:</span> <span className="font-semibold text-slate-800">{selectedCust?.phone || 'N/A'}</span></p>
                  <p><span className="text-gray-400">TIN File Ref:</span> <span className="font-semibold text-slate-800 font-mono">{selectedCust?.email ? `TIN-${selectedCust.email.substring(0,6).toUpperCase()}` : 'VAT No.'}</span></p>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-205 space-y-1.5 text-left">
                  <span className="text-[9px] font-extrabold text-slate-550 uppercase tracking-widest font-sans block border-b border-slate-200 pb-1 mb-1">SHIPPING LOGISTICS PROTOCOL</span>
                  <p><span className="text-gray-400 font-sans">Transit Carrier:</span> <span className="font-bold text-slate-900">Laguna Land Transit Corp.</span></p>
                  <p><span className="text-gray-400 font-sans">Despatch Supervisor:</span> <span className="font-semibold text-slate-850 font-serif italic text-indigo-755">{dispatchedBy}</span></p>
                  <p><span className="text-gray-400">Associated Reference:</span> <span className="font-bold text-indigo-700 font-mono">{focusedSO.soNumber}</span></p>
                  {focusedSO.machineSerialNumber && (
                    <p className="bg-amber-50 text-amber-900 font-mono font-black text-[9px] px-2 py-0.5 rounded border border-amber-200/50 inline-block uppercase mt-0.5">
                      🚚 LINKED ASSET: SN #{focusedSO.machineSerialNumber}
                    </p>
                  )}
                </div>
              </div>

              {/* Verified Product Load manifest */}
              <div className="space-y-2 text-left">
                <span className="text-[9px] font-extrabold text-slate-550 uppercase tracking-widest font-mono block">VERIFIED LOAD LOGS PROTOCOL</span>
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-[#0e1e38] text-white text-[10px] font-bold uppercase tracking-wider font-mono">
                      <tr>
                        <th className="px-4 py-2.5 text-left">#</th>
                        <th className="px-4 py-2.5 text-left">SKU</th>
                        <th className="px-4 py-2.5 text-left">Item Name</th>
                        <th className="px-4 py-2.5 text-center">Batch Lots</th>
                        <th className="px-4 py-2.5 text-right">Qty Despatched</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 text-slate-705 text-left">
                      {(() => {
                        const drLines = selectedDRForView 
                          ? selectedDRForView.items 
                          : focusedSO.items.map(it => {
                              const matchObj = items.find(p => p.id === it.itemId);
                              return {
                                itemId: it.itemId,
                                sku: matchObj?.sku || 'N/A',
                                name: matchObj?.name || 'Direct Item Spec',
                                quantity: it.quantity,
                                unitPrice: it.unitPrice
                              };
                            });

                        return drLines.map((line, idx) => {
                          const itemObj = items.find(p => p.id === line.itemId);
                          
                          // Seek linked lot tracking strings
                          const matchedLots = (lots || []).filter(l => l.itemId === line.itemId && l.lotNumber.includes(focusedSO.soNumber.replace('SO-', '')));
                          const calculatedLotText = matchedLots.length > 0 
                            ? matchedLots.map(l => l.lotNumber).join(', ')
                            : `LOT-${focusedSO.soNumber.substring(3)}-${line.sku || idx}`;

                          return (
                            <tr key={line.itemId} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 font-mono text-gray-400">{idx+1}</td>
                              <td className="px-4 py-3 font-mono font-bold text-slate-900">{line.sku}</td>
                              <td className="px-4 py-3">
                                <span className="font-semibold text-slate-800 block leading-tight">{line.name}</span>
                                {itemObj?.brand && <span className="block text-[8px] text-gray-405 font-mono mt-0.5">Brand: {itemObj.brand}</span>}
                              </td>
                              <td className="px-4 py-3 text-center font-mono text-[9px] text-indigo-755 font-bold uppercase">{calculatedLotText}</td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-slate-950">{line.quantity} {itemObj?.unit || 'pcs'}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Box and Terms Conditions */}
              <div className="flex flex-col md:flex-row justify-between items-start gap-4 pt-2">
                <div className="text-[10px] text-slate-450 leading-relaxed font-sans w-full text-left">
                  <b>TERMS & CONDITIONS:</b> All physical goods listed on this Delivery Receipt must be counted and cross-inspected. Any claim for missing stock or shipping defect must be filed formally within 48 hours of transit release. Signatories verify goods arrived complete and fit for service operations.
                </div>
              </div>

              {/* Notes remark status from specific sheet */}
              <div className="p-3 bg-red-50/20 border border-slate-200 rounded-lg text-left text-[11px] text-slate-700 italic">
                <span className="font-mono text-[9px] block uppercase font-bold text-gray-500 mb-0.5 font-sans">DELIVERY DESPATCH OBSERVATIONS:</span>
                {notesValue}
              </div>

              {/* Official Signatures Row */}
              <div className="grid grid-cols-3 gap-6 pt-12 text-[10px] leading-snug">
                <div className="space-y-8 text-center border-t border-slate-350 pt-2.5">
                  <span className="font-bold text-slate-755 block text-xs font-serif italic text-emerald-800">
                    {dispatchedBy}
                  </span>
                  <span className="text-slate-450 uppercase font-mono block">Released (Planning & Dispatch)</span>
                </div>

                <div className="space-y-8 text-center border-t border-slate-330 pt-2.5">
                  <div className="h-4"></div>
                  <span className="text-slate-450 uppercase font-mono block">Checked By (Warehouse Security)</span>
                </div>

                <div className="space-y-8 text-center border-t border-slate-350 pt-2.5 font-sans">
                  <div className="h-4"></div>
                  <span className="text-slate-450 uppercase font-mono block">Customer Seal & Signature</span>
                </div>
              </div>
            </div>
          </div>

          {/* Close controls at bottom */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0 font-sans">
            <button
              type="button"
              onClick={() => setIsDeliveryReceiptOpen(false)}
              className="px-5 py-2 bg-slate-600 hover:bg-slate-700 text-xs font-semibold text-white rounded-lg cursor-pointer transition-colors"
            >
              Close Document Viewer
            </button>
          </div>
        </div>
      </div>
    );
  };

  const getStatusIcon = (status: SalesOrder['status']) => {
    switch (status) {
      case 'Draft':
        return <FileText className="w-3 h-3 text-slate-500" />;
      case 'Confirmed':
        return <ClipboardCheck className="w-3 h-3 text-amber-600" />;
      case 'On Going':
        return <Activity className="w-3 h-3 text-blue-600" />;
      case 'Shipped':
        return <Truck className="w-3 h-3 text-indigo-650" />;
      case 'Received':
        return <CheckCircle className="w-3 h-3 text-emerald-650" />;
      case 'Cancelled':
        return <Ban className="w-3 h-3 text-rose-500" />;
    }
  };

  const getStatusStyle = (status: SalesOrder['status']) => {
    switch (status) {
      case 'Draft': return 'bg-slate-100 text-slate-700 border-slate-200 font-semibold';
      case 'Confirmed': return 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
      case 'On Going': return 'bg-blue-50 text-blue-700 border-blue-200 font-bold animate-pulse';
      case 'Shipped': return 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold animate-pulse';
      case 'Received': return 'bg-emerald-55/10 text-emerald-700 border-emerald-250 font-extrabold shadow-3xs';
      case 'Cancelled': return 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Dynamic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 font-mono">Sales Orders (SO)</h1>
          <p className="text-sm text-gray-500">
            Dispatch stock to clients, manage BIR-registered customer corporate purchases, and print Philippine-compliant 12% VAT bills.
          </p>
        </div>
        <button
          onClick={handleOpenDrafting}
          disabled={!canEdit}
          className="inline-flex items-center gap-2 justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-bold text-white rounded-lg transition-colors shadow-xs hover:shadow-sm cursor-pointer"
          title="Create a new Sales Order (Shortcut: Ctrl+N or Ctrl+Alt+N)"
        >
          <Plus className="w-4 h-4" />
          <span>New Sales Order</span>
          <kbd className="ml-1 px-1.5 py-0.5 bg-indigo-700/60 border border-indigo-400/40 rounded font-mono text-[9px] text-indigo-150 hidden sm:inline-block">Ctrl+N</kbd>
        </button>
      </div>

      {/* Filtering SO Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex flex-col md:flex-row md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search SO Number, or Customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-10 pr-4 py-2 bg-gray-50 text-gray-800 rounded-lg border border-gray-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-semibold font-mono">Customer:</span>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-gray-700 font-bold focus:outline-hidden max-w-[200px] truncate"
            >
              <option value="All">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-semibold font-mono">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-gray-700 font-bold focus:outline-hidden"
            >
              <option value="All">All Transactions</option>
              <option value="Draft">Draft</option>
              <option value="Confirmed">Confirmed (Approved)</option>
              <option value="On Going">On Going</option>
              <option value="Shipped">Shipped (Fulfilled)</option>
              <option value="Received">Received (Delivered)</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Splits SO Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* SO Table list */}
        <div className="relative bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden lg:col-span-2">
          <div className="overflow-x-auto">
            {filteredSOs.length === 0 ? (
              <div className="py-20 text-center text-sm text-gray-400 font-medium">
                No matching client Sales Orders detected.
              </div>
            ) : (
              <>
              {currentUser?.role === 'Admin' && selectedSOIds.length > 0 && (
                <div className="bg-indigo-50 border-b border-indigo-150 p-3 px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-in fade-in duration-205">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 p-1 px-2.5 rounded-full select-none">
                      {selectedSOIds.length} Selected
                    </span>
                    <span className="text-xs text-indigo-900 font-bold">
                      Batch status transition selected Sales Orders to:
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (onBatchUpdateSOStatus) {
                          onBatchUpdateSOStatus(selectedSOIds, 'Confirmed');
                          setSelectedSOIds([]);
                        }
                      }}
                      className="bg-indigo-650 hover:bg-indigo-750 text-white font-extrabold text-[10px] p-2 px-3.5 rounded-lg shadow-sm transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      ✓ Confirmed
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (onBatchUpdateSOStatus) {
                          if (window.confirm(`⚠️ WARNING: Transition ${selectedSOIds.length} orders to Shipped?\nThis will deduct stock, adjust FIFO lots, register machine logs, and record transactions.`)) {
                            onBatchUpdateSOStatus(selectedSOIds, 'Shipped');
                            setSelectedSOIds([]);
                          }
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] p-2 px-3.5 rounded-lg shadow-sm transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      🚚 Shipped
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSOIds([])}
                      className="text-gray-500 hover:text-gray-700 text-[10px] font-bold p-2 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <table className="min-w-full divide-y divide-gray-100">
                <thead>
                  <tr className="bg-gray-55/45 border-b border-gray-100 text-left text-xs font-bold text-gray-500 uppercase tracking-widest font-mono select-none">
                    {currentUser?.role === 'Admin' && (
                      <th className="px-4 py-4 text-center w-12">
                        <input
                          type="checkbox"
                          checked={filteredSOs.length > 0 && selectedSOIds.length === filteredSOs.length}
                          onChange={() => {
                            if (selectedSOIds.length === filteredSOs.length) {
                              setSelectedSOIds([]);
                            } else {
                              setSelectedSOIds(filteredSOs.map(s => s.id));
                            }
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="px-6 py-4">SO Number</th>
                    <th className="px-6 py-4">Customer & Dispatch Hub</th>
                    <th className="px-6 py-4 font-mono">Invoice Value (12% VAT Inc.)</th>
                    <th className="px-6 py-4">Shipment Target</th>
                    <th className="px-6 py-4 text-center">Lifecycle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                  {filteredSOs.map(so => {
                    const srcWarehouse = warehouses.find(w => w.id === so.warehouseId)?.name || 'Central Site';
                    const matchedCustomer = customers.find(c => c.id === so.customerId);
                    const clientLabel = matchedCustomer ? matchedCustomer.name : so.customerName;
                    const isSelected = selectedSOIds.includes(so.id);
                    return (
                      <tr
                        key={so.id}
                        onClick={() => setFocusedSO(so)}
                        className={`hover:bg-indigo-50/15 cursor-pointer transition-colors ${focusedSO?.id === so.id ? 'bg-indigo-50/30' : ''} ${isSelected ? 'bg-indigo-50/5' : ''}`}
                      >
                        {currentUser?.role === 'Admin' && (
                          <td className="px-4 py-4 text-center select-none w-12" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedSOIds(prev =>
                                  prev.includes(so.id)
                                    ? prev.filter(id => id !== so.id)
                                    : [...prev, so.id]
                                );
                              }}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-6 py-4 font-mono font-bold text-gray-900">
                          <div>{so.soNumber}</div>
                          {so.referenceNo && (
                            <div className="text-[10px] text-indigo-650 font-semibold font-sans mt-0.5 bg-indigo-50/50 px-1 py-0.2 rounded inline-block max-w-full truncate">Ref: {so.referenceNo}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 space-y-0.5">
                          <div className="font-bold text-gray-805 text-sm leading-tight">{clientLabel}</div>
                          <div className="text-[10px] text-gray-400 font-mono">From: {srcWarehouse}</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-bold text-slate-800">
                          ₱{so.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 font-mono text-left">
                          <div className="text-gray-850 font-medium">Ship: {so.shipmentDate}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Created: {so.orderDate}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold rounded-full ${getStatusStyle(so.status)}`}>
                            {getStatusIcon(so.status)}
                            <span>{so.status}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </>
            )}
          </div>


        </div>

        {/* SO inspector Side */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-6 space-y-6">
          {focusedSO ? (
            <div className="space-y-6">
              {/* Header and visual status */}
              <div className="flex justify-between items-start gap-3 border-b border-gray-50 pb-4">
                <div className="space-y-0.5 text-left">
                  <span className="text-[10px] font-mono text-indigo-600 font-bold">PHILIPPINES SALES BILL</span>
                  <h3 className="text-xl font-extrabold text-gray-950 font-mono tracking-tight">{focusedSO.soNumber}</h3>
                  {focusedSO.referenceNo && (
                    <div className="mt-1 font-mono text-[10px] font-bold text-indigo-750 bg-indigo-50/50 border border-indigo-100 px-2 py-0.5 rounded inline-block">
                      REF: {focusedSO.referenceNo}
                    </div>
                  )}
                  {focusedSO.description && (
                    <p className="text-xs text-gray-650 italic mt-1 font-sans max-w-[240px] break-words">
                      <b>Project/Desc:</b> {focusedSO.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-full border ${getStatusStyle(focusedSO.status)}`}>
                    {getStatusIcon(focusedSO.status)}
                    <span>{focusedSO.status}</span>
                  </span>
                  
                  {focusedSO.status === 'Draft' && canEdit && (
                    <button
                      onClick={() => handleOpenEditDraft(focusedSO)}
                      className="inline-flex items-center gap-1 py-1 px-2.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-[10px] text-slate-600 font-bold rounded border border-slate-200 cursor-pointer transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit SO</span>
                    </button>
                  )}
                  {currentUser?.role === 'Admin' && onDeleteSO && (
                    <button
                      onClick={() => {
                        if (window.confirm(`⚠️ CRITICAL ACTION: Are you sure you want to permanently delete Sales Order ${focusedSO.soNumber}? This cannot be undone.`)) {
                          onDeleteSO(focusedSO.id);
                          setFocusedSO(null);
                        }
                      }}
                      className="inline-flex items-center gap-1 py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-[10px] text-rose-700 font-extrabold rounded border border-rose-200 cursor-pointer transition-colors mt-1"
                    >
                      <Trash2 className="w-3 h-3 text-rose-650" />
                      <span>Delete SO</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Customer & src info */}
              <div className="grid grid-cols-2 gap-4 text-xs text-left">
                <div>
                  <span className="text-gray-400 uppercase tracking-wider block font-bold text-[9px] mb-1 font-mono">Customer Account</span>
                  <span className="text-gray-800 font-bold block">
                    {customers.find(c => c.id === focusedSO.customerId)?.name || focusedSO.customerName}
                  </span>
                  {customers.find(c => c.id === focusedSO.customerId)?.tin && (
                    <span className="font-mono text-[10px] block text-indigo-700 font-semibold mt-0.5">
                      TIN: {customers.find(c => c.id === focusedSO.customerId)?.tin}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-gray-400 uppercase tracking-wider block font-bold text-[9px] mb-1 font-mono">Origin Depot</span>
                  <span className="text-gray-800 font-bold block">
                    {warehouses.find(w => w.id === focusedSO.warehouseId)?.name || 'Central Site'}
                  </span>
                  <span className="text-gray-400 uppercase tracking-wider block font-bold text-[9px] mt-1.5 mb-0.5 font-mono">Logistics Option</span>
                  <span className="text-indigo-600 font-bold block text-[11px]">
                    {focusedSO.deliveryOption || 'Standard Cargo'}
                  </span>
                </div>
              </div>

              {/* Region and Business Classification Category */}
              <div className="grid grid-cols-2 gap-4 text-xs text-left bg-slate-50/50 p-3 rounded-lg border border-gray-100">
                <div>
                  <span className="text-gray-400 uppercase tracking-wider block font-bold text-[9px] mb-1 font-mono flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-indigo-500 animate-pulse" />
                    <span>Sales Cluster</span>
                  </span>
                  <span className="text-gray-850 font-bold bg-indigo-50/40 text-indigo-800 px-2.5 py-1 rounded text-xs inline-block border border-indigo-100">
                    {focusedSO.salesCluster || focusedSO.region || 'Head Office'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 uppercase tracking-wider block font-bold text-[9px] mb-1 font-mono flex items-center gap-1">
                    <Tag className="w-3 h-3 text-emerald-500" />
                    <span>Transaction Class</span>
                  </span>
                  <span className="text-gray-850 font-bold bg-emerald-50/40 text-emerald-800 px-2.5 py-1 rounded text-xs inline-block border border-emerald-100">
                    {focusedSO.salesCategory || 'Parts'}
                    {focusedSO.serviceCategory && (
                      <span className="block text-[9.5px] text-emerald-600 mt-1 font-mono font-bold">
                        ({focusedSO.serviceCategory})
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Order lifecycle steps */}
              <div className="p-4 bg-indigo-50/45 rounded-xl border border-indigo-100/50 space-y-3">
                <div className="flex gap-2 items-center">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-extrabold text-indigo-900 uppercase tracking-widest font-mono">Life Cycle Status (Reversible)</span>
                </div>
                <p className="text-[11px] text-indigo-850 leading-relaxed text-left font-normal">
                  You can freely transition or reverse the state of this sales order. Reverting shipment automatically returns physical stock and lot allocations safely.
                </p>
                <div className="flex gap-2 pt-1">
                  <select
                    value={focusedSO.status}
                    onChange={(e) => {
                      const nextStatus = e.target.value as any;
                      if (nextStatus === 'Shipped') {
                        const shipViolations: string[] = [];
                        focusedSO.items.forEach((line) => {
                          if (line.lotId) {
                            const violation = getFifoViolation(line.itemId, focusedSO.warehouseId, line.lotId);
                            if (violation.violated && violation.selected && violation.oldest) {
                              const itemPr = items.find(p => p.id === line.itemId);
                              shipViolations.push(
                                `- Product: "${itemPr?.name}"\n  Selected Lot: "${violation.selected.lotNumber}"\n  Oldest Lot Available: "${violation.oldest.lotNumber}"`
                              );
                            }
                          }
                        });

                        if (shipViolations.length > 0) {
                          const confirmOverride = window.confirm(
                            `⚠️ FIFO COMPLIANCE TRIGGER WARNING!\n\n` +
                            `You are about to FULFILL / SHIP inventory with lot associations violating FIFO standards:\n\n` +
                            shipViolations.join('\n\n') +
                            `\n\nThis will lock the transaction ledger and programmatically decrease stock from non-sequential batches.\n\n` +
                            `Are you sure you want to proceed?`
                          );
                          if (!confirmOverride) return;
                        }
                      }

                      onUpdateSOStatus(focusedSO.id, nextStatus);
                    }}
                    className="flex-1 text-xs bg-white border border-gray-300 rounded-lg px-2.5 py-2 font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="On Going">On Going</option>
                    <option value="Shipped">Shipped (Fulfill)</option>
                    <option value="Received">Received (Delivered)</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Warehouse Pick List Section */}
              <div className="bg-white rounded-lg p-3.5 border border-gray-150 text-left flex items-center justify-between gap-4">
                <div className="text-left space-y-0.5">
                  <h6 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider font-mono">Warehouse Fulfillment</h6>
                  <p className="text-[10px] text-gray-400">Generate a simplified, printer-friendly summary of shelves, quantities, and barcodes.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPickListOpen(true)}
                  className="inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg transition-colors cursor-pointer border border-indigo-150 shadow-3xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Generate Pick List</span>
                </button>
              </div>

              {/* Delivery Receipt Sheets Section */}
              <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 text-left space-y-2.5">
                <div className="flex justify-between items-center bg-transparent">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#0e1e38] block flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-indigo-500" />
                    Delivery Receipt Sheets (DRs)
                  </span>
                  <button
                    type="button"
                    disabled={focusedSO.status === 'Draft' || focusedSO.status === 'Cancelled'}
                    onClick={() => {
                      setSelectedDRForView(null);
                      handleOpenCreateReceipt(focusedSO);
                    }}
                    className={`px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded font-mono transition-all flex items-center gap-0.5 ${
                      focusedSO.status === 'Draft' || focusedSO.status === 'Cancelled'
                        ? 'bg-gray-150 text-gray-400 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white cursor-pointer'
                    }`}
                  >
                    <Plus className="w-2.5 h-2.5" />
                    <span>New Receipt</span>
                  </button>
                </div>

                {/* List of related delivery sheets */}
                {(() => {
                  const relatedDRs = (explicitDeliveryReceipts || []).filter(dr => dr.soId === focusedSO.id);

                  return (
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                      {/* Standard full system receipt if no explicit sheets exist yet */}
                      {relatedDRs.length === 0 && (
                        <div className="p-2 border border-slate-150 bg-white hover:bg-slate-50 rounded flex items-center justify-between text-[11px] font-medium text-slate-800 leading-none">
                          <div className="space-y-0.5">
                            <span className="font-mono text-[10px] text-gray-500 block">SYSTEM DEFAULT FULL RECEIPT</span>
                            <span className="font-bold text-slate-900 block mt-0.5">{`DR-${focusedSO.soNumber.replace('SO-', '')}`}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDRForView(null);
                              setIsDeliveryReceiptOpen(true);
                            }}
                            className="p-1 px-2 text-[10px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200 rounded hover:bg-slate-200 hover:text-slate-900 flex items-center gap-0.5 cursor-pointer uppercase transition-all"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </button>
                        </div>
                      )}

                      {/* Display explicit custom delivery sheets */}
                      {relatedDRs.map(dr => (
                        <div key={dr.id} className="p-2 border border-emerald-100 bg-white hover:bg-emerald-50/40 rounded flex items-center justify-between text-[11px] font-medium text-slate-800 leading-none">
                          <div className="space-y-0.5">
                            <span className="font-mono text-[9px] text-indigo-700 uppercase font-black block tracking-wider">DELIVERY RECEIPT LOGGED</span>
                            <span className="font-bold text-slate-900 block mt-0.5">{dr.drNumber}</span>
                            <span className="text-[9px] font-mono text-gray-400 block font-normal">{dr.dispatchDate} • {dr.items.reduce((acc: number, it: any) => acc + (it.quantity || 0), 0)} items</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDRForView(dr);
                                setIsDeliveryReceiptOpen(true);
                              }}
                              className="p-1 px-2 text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded hover:bg-emerald-100 hover:text-emerald-950 flex items-center gap-0.5 cursor-pointer uppercase transition-all"
                            >
                              <Eye className="w-3 h-3 text-emerald-655" />
                              <span>View DR</span>
                            </button>
                            {onDeleteDeliveryReceipt && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteDeliveryReceipt(dr.id);
                                }}
                                title="Delete Delivery Receipt"
                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Printable QR Code Tracking Label for selected SO */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-left flex items-center justify-between gap-4">
                <div className="text-left space-y-0.5">
                  <h6 className="text-[11px] font-extrabold text-slate-350 uppercase tracking-wider font-mono">SO Packaging QR Label</h6>
                  <p className="text-[10px] text-slate-400">Generate a modular, high-fidelity printable scanner label for physical units.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrintLabelModalOpen(true)}
                  className="shrink-0 flex items-center gap-1.5 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-[10px] font-black rounded-lg cursor-pointer transition-transform hover:scale-103 shadow-inner"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Generate QR</span>
                </button>
              </div>

              {/* PAYMENT & INVOICING / COLLECTION PH REAL INTEGRATION */}
              <div id="billing-collection-panel" className="bg-slate-50 border border-slate-205 rounded-xl p-4 text-xs space-y-3.5 text-left">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-mono font-black text-[9px] uppercase tracking-wider text-slate-500">🇵🇭 BIR Billing & Collection Ledger</span>
                  {!isEditingBilling && canEdit ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingBilling(true);
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-850 cursor-pointer hover:underline inline-flex items-center gap-1"
                    >
                      ✏️ Edit Invoice / Payment
                    </button>
                  ) : isEditingBilling ? (
                    <span className="text-[10px] font-bold text-amber-600">Editing Mode</span>
                  ) : null}
                </div>

                {!isEditingBilling ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1 bg-white border border-slate-100 p-2 rounded-lg">
                        <span className="block text-[8px] uppercase font-bold text-gray-400 font-mono">Invoice Status</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`inline-block text-[9px] font-extrabold px-1.5 py-0.2 rounded-sm border ${focusedSO.invoiceCreated ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {focusedSO.invoiceCreated ? 'INVOICED' : 'UNINVOICED'}
                          </span>
                        </div>
                        {focusedSO.invoiceNumber && (
                          <div className="mt-1 text-[10.5px] font-medium text-slate-800 space-y-px">
                            <p><b>Doc #:</b> <span className="font-mono text-[9.5px] bg-slate-50 px-1 py-0.2 rounded">{focusedSO.invoiceNumber}</span></p>
                            <p><b>Date:</b> {focusedSO.invoiceDate || '—'}</p>
                            {focusedSO.invoiceRemarks && <p className="text-[9px] text-slate-400 italic">“{focusedSO.invoiceRemarks}”</p>}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1 bg-white border border-slate-100 p-2 rounded-lg">
                        <span className="block text-[8px] uppercase font-bold text-gray-400 font-mono">Collection Status</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`inline-block text-[9px] font-extrabold px-1.5 py-0.2 rounded-sm border ${focusedSO.isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            {focusedSO.isPaid ? 'PAID / RECEIVED' : 'UNPAID'}
                          </span>
                        </div>
                        {focusedSO.isPaid && (
                          <div className="mt-1 text-[10.5px] font-medium text-slate-850 space-y-0.5">
                            <p><b>Received Amt:</b> <span className="text-emerald-700 font-bold font-mono">₱{(focusedSO.amountPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></p>
                            {focusedSO.hasEwt && (
                              <div className="text-[9px] bg-amber-50 rounded border border-amber-100 p-1 mt-1 text-slate-700 space-y-px">
                                <p className="font-bold text-amber-800">2307 Withholding Tax deducted:</p>
                                <p>Rate: <b>{focusedSO.ewtRate}%</b> EWT</p>
                                <p>Amount: <b>₱{(focusedSO.ewtAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</b></p>
                              </div>
                            )}
                            <p className="mt-1"><b>Via:</b> {focusedSO.paymentMethod || 'Bank Transfer'}</p>
                            {focusedSO.paymentDate && <p><b>Date:</b> {focusedSO.paymentDate}</p>}
                            {focusedSO.paymentRemarks && <p className="text-[9.5px] text-gray-400 italic">“{focusedSO.paymentRemarks}”</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const updatedSO: SalesOrder = {
                        ...focusedSO,
                        invoiceCreated: billingInvoiceNumber !== '',
                        invoiceNumber: billingInvoiceNumber || undefined,
                        invoiceDate: billingInvoiceDate || undefined,
                        invoiceRemarks: billingInvoiceRemarks || undefined,
                        isPaid: billingIsPaid,
                        amountPaid: billingIsPaid ? Number(billingAmountPaid) : undefined,
                        hasEwt: billingIsPaid ? billingHasEwt : undefined,
                        ewtRate: (billingIsPaid && billingHasEwt) ? Number(billingEwtRate) : undefined,
                        ewtAmount: (billingIsPaid && billingHasEwt) ? Number(billingEwtAmount) : undefined,
                        paymentDate: billingIsPaid ? billingPaymentDate : undefined,
                        paymentMethod: billingIsPaid ? billingPaymentMethod : undefined,
                        paymentRemarks: billingIsPaid ? billingPaymentRemarks : undefined,
                      };
                      onEditSO(updatedSO);
                      setFocusedSO(updatedSO);
                      setIsEditingBilling(false);
                    }}
                    className="space-y-3.5 text-xs text-slate-705"
                  >
                    {/* INVOICE ENTRY SECTION */}
                    <div className="space-y-1.5 border-b border-slate-200/60 pb-3">
                      <span className="block text-[8px] font-extrabold uppercase tracking-wide text-indigo-700">1. Invoice details</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] text-slate-500 block mb-0.5">Invoice / DR Reference No.</label>
                          <input
                            type="text"
                            placeholder="e.g. SN-INV-2025"
                            value={billingInvoiceNumber}
                            onChange={(e) => setBillingInvoiceNumber(e.target.value)}
                            className="w-full p-1.5 border border-slate-200 rounded bg-white text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-500 block mb-0.5">Invoice Date</label>
                          <input
                            type="date"
                            value={billingInvoiceDate}
                            onChange={(e) => setBillingInvoiceDate(e.target.value)}
                            className="w-full p-1.5 border border-slate-200 rounded bg-white text-slate-800 text-[10.5px]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 block mb-0.5">Invoicing Remarks / Notes</label>
                        <input
                          type="text"
                          placeholder="Doc status, BIR series override, etc."
                          value={billingInvoiceRemarks}
                          onChange={(e) => setBillingInvoiceRemarks(e.target.value)}
                          className="w-full p-1.5 border border-slate-200 rounded bg-white text-slate-800"
                        />
                      </div>
                    </div>

                    {/* PAYMENT ENTRY SECTION */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="block text-[8px] font-extrabold uppercase tracking-wide text-emerald-700">2. Collection Status</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            id="billing-is-paid-chk"
                            checked={billingIsPaid}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setBillingIsPaid(checked);
                              if (checked) {
                                setBillingAmountPaid(focusedSO.total);
                                setBillingPaymentDate(new Date().toISOString().substring(0, 10));
                              }
                            }}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                          />
                          <label htmlFor="billing-is-paid-chk" className="text-[10px] font-bold text-slate-700 cursor-pointer">Mark as Paid</label>
                        </div>
                      </div>

                      {billingIsPaid && (
                        <div className="space-y-2.5 bg-white border border-slate-100 p-3 rounded-lg animate-fadeIn">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] text-slate-500 block mb-0.5">Date Paid</label>
                              <input
                                type="date"
                                required
                                value={billingPaymentDate}
                                onChange={(e) => setBillingPaymentDate(e.target.value)}
                                className="w-full p-1.5 border border-slate-200 rounded text-slate-800 text-[10.5px]"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-slate-500 block mb-0.5">Payment Method</label>
                              <select
                                value={billingPaymentMethod}
                                onChange={(e) => setBillingPaymentMethod(e.target.value)}
                                className="w-full p-1.5 border border-slate-200 rounded text-slate-800"
                              >
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Cash on Delivery">Cash (COD)</option>
                                <option value="Company Check">PDC / Company Check</option>
                                <option value="GCash">GCash / PayMaya</option>
                                <option value="Credit Card">Credit Card</option>
                              </select>
                            </div>
                          </div>

                          <div className="border-t border-slate-100 pt-2 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[9.5px] font-semibold text-slate-650">BIR 2307 Withholding Tax</span>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  id="billing-has-ewt-chk"
                                  checked={billingHasEwt}
                                  onChange={(e) => {
                                    const val = e.target.checked;
                                    setBillingHasEwt(val);
                                    handleAutoCalculateEwt(val, billingEwtRate);
                                  }}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-550 h-3.5 w-3.5 cursor-pointer"
                                />
                                <label htmlFor="billing-has-ewt-chk" className="text-[9.5px] font-semibold cursor-pointer text-slate-700">Deduct EWT</label>
                              </div>
                            </div>

                            {billingHasEwt && (
                              <div className="bg-amber-50/50 p-2 border border-amber-200/50 rounded space-y-2 animate-fadeIn text-[10.5px] text-slate-700">
                                <div className="flex justify-between items-center gap-1">
                                  <span>PH Tax Mode:</span>
                                  <span className="font-extrabold inline-block text-[9.5px] bg-indigo-50 text-indigo-700 px-1 py-0.2 rounded font-mono uppercase">
                                    {focusedSO.taxType === 'VAT' ? '12% VAT Applied' : 'Non-VAT/None'}
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9.5px] text-slate-500 block font-medium">withholding rate (%)</label>
                                  <select
                                    value={billingEwtRate}
                                    onChange={(e) => {
                                      const r = Number(e.target.value);
                                      setBillingEwtRate(r);
                                      handleAutoCalculateEwt(true, r);
                                    }}
                                    className="w-full p-1 bg-white border border-slate-200 rounded"
                                  >
                                    <option value={1}>1% - Sale of Goods/Parts (Standard)</option>
                                    <option value={2}>2% - Sale of Services / Contractors (Standard)</option>
                                    <option value={5}>5% - Rental / Corporate Creditable Tax</option>
                                    <option value={10}>10% - Professional / Specialized Fees</option>
                                  </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-slate-800">
                                  <div>
                                    <label className="text-[9px] text-amber-900 block font-semibold">withheld tax amount</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={billingEwtAmount}
                                      onChange={(e) => {
                                        const amt = Number(e.target.value);
                                        setBillingEwtAmount(amt);
                                        setBillingAmountPaid(Number((focusedSO.total - amt).toFixed(2)));
                                      }}
                                      className="w-full p-1 border border-slate-200 rounded font-mono bg-white font-bold"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-amber-900 block font-semibold">Net Cash Collected</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={billingAmountPaid}
                                      required
                                      onChange={(e) => setBillingAmountPaid(Number(e.target.value))}
                                      className="w-full p-1 border border-slate-200 rounded font-mono bg-white font-bold"
                                    />
                                  </div>
                                </div>
                                <div className="text-[9px] text-slate-500 font-medium">
                                  * Net EWT basis: <b>₱{(focusedSO.taxType === 'VAT' ? focusedSO.subtotal : focusedSO.total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> Net of VAT
                                </div>
                              </div>
                            )}

                            {!billingHasEwt && (
                              <div className="space-y-1">
                                <label className="text-[9px] text-slate-500 block font-mono">Amount Paid Received (PHP)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  required
                                  value={billingAmountPaid}
                                  onChange={(e) => setBillingAmountPaid(Number(e.target.value))}
                                  className="w-full p-1.5 border border-slate-204 rounded font-mono font-bold"
                                />
                              </div>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 block">Collection Notes / Reference Remarks</label>
                            <input
                              type="text"
                              placeholder="e.g. Cleared OR-543B, PDC Check #987654"
                              value={billingPaymentRemarks}
                              onChange={(e) => setBillingPaymentRemarks(e.target.value)}
                              className="w-full p-1.5 border border-slate-200 rounded"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2.5 pt-2 border-t border-slate-200/50">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingBilling(false);
                        }}
                        className="flex-1 py-1 px-3 border border-slate-230 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-650 font-black cursor-pointer text-center text-[10px]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-1 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg shadow-sm cursor-pointer text-center text-[10px]"
                      >
                        💾 Save Ledger record
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Billing Purpose & Pricing status indicators */}
              <div className="grid grid-cols-2 gap-3 text-xs text-left bg-indigo-50/20 p-3 rounded-lg border border-indigo-100/30">
                <div>
                  <span className="text-gray-400 font-mono font-bold text-[8px] uppercase tracking-wider block mb-1">Invoice Billing Category</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${focusedSO.orderPurpose === 'Warranty' ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-indigo-100 text-indigo-900 border border-indigo-200'}`}>
                    {focusedSO.orderPurpose === 'Warranty' ? '🛡️ Warranty dispatch' : '💼 Commercial sale'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 font-mono font-bold text-[8px] uppercase tracking-wider block mb-1">Price Configuration</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${canSeePricing ? 'bg-emerald-50 text-emerald-800 border border-emerald-100 font-semibold' : 'bg-rose-50 text-rose-800 border border-rose-100 font-semibold'}`}>
                    {canSeePricing ? 'Authorized pricing details shown' : 'Hidden financial params'}
                  </span>
                </div>
              </div>

              {/* Clickable Heavy machinery association details / Input box */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-gray-200 text-left space-y-2.5">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1 font-mono">
                    Associate Machine Serial Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SN-KUB-987"
                    disabled={!canEdit}
                    value={focusedSO.machineSerialNumber || ''}
                    onChange={(e) => {
                      const updated = {
                        ...focusedSO,
                        machineSerialNumber: e.target.value
                      };
                      onEditSO(updated);
                      setFocusedSO(updated);
                    }}
                    className="w-full text-xs px-3 py-1.5 bg-white border border-slate-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono disabled:opacity-50"
                  />
                </div>

                {focusedSO.machineSerialNumber && (
                  <div className="mt-1 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[8px] text-amber-800 uppercase tracking-wider font-extrabold font-mono">Associated Fleet Machinery</span>
                      <span className="text-[8px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded uppercase font-mono animate-pulse">Click below to view logs</span>
                    </div>
                    <div 
                      onClick={() => setViewingMachineSerial(focusedSO.machineSerialNumber || null)}
                      className="flex items-center gap-3 p-2.5 bg-white hover:bg-amber-50/40 border border-amber-250/60 hover:border-amber-300 rounded-lg cursor-pointer shadow-3xs hover:shadow-2xs transition-all duration-150 group"
                    >
                      <Wrench className="w-4 h-4 text-amber-500 shrink-0 group-hover:rotate-12 transition-transform" />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-slate-800 block truncate group-hover:text-amber-850 transition-colors">
                          SN: {focusedSO.machineSerialNumber}
                        </span>
                        {(() => {
                          const mObj = machineLogs?.find(m => m.serialNumber === focusedSO.machineSerialNumber);
                          if (mObj) {
                            return (
                              <>
                                <span className="text-[10px] text-emerald-600 font-bold block truncate">✓ Registered Fleet Model: {mObj.model}</span>
                                {mObj.machineLocation && (
                                  <span className="text-[9px] text-indigo-700 font-bold block truncate mt-0.5 flex items-center gap-1 font-mono">
                                    <span className="inline-block w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
                                    <span>Site: {mObj.machineLocation}</span>
                                  </span>
                                )}
                              </>
                            );
                          } else {
                            return (
                              <div className="mt-1.5 p-2 bg-rose-50 border border-rose-100 rounded-lg space-y-1.5">
                                <span className="text-[9px] text-rose-600 font-extrabold block uppercase tracking-wider font-mono">⚠️ Serial number unmapped in fleet tracker</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickRegisterMachine(focusedSO.machineSerialNumber!);
                                  }}
                                  className="w-full text-center py-1 bg-amber-500 hover:bg-amber-600 text-[10px] font-black text-white rounded cursor-pointer transition-colors"
                                >
                                  Register Unit in Fleet Tracker
                                </button>
                              </div>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Items in focused SO */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider font-mono text-left">Line Items Summary</h4>
                <div className="divide-y divide-gray-50 border border-gray-100 rounded-lg overflow-hidden bg-gray-50/20">
                   {focusedSO.items.map((line, pos) => {
                     const itemProfile = items.find(p => p.id === line.itemId);
                     return (
                       <div key={pos} className="p-3 text-xs bg-white space-y-1">
                         <div className="flex justify-between items-center">
                           <div className="min-w-0 text-left">
                             <span className="font-bold text-gray-900 block">{itemProfile?.name || 'Item Code'}</span>
                             <span className="font-mono text-[10px] text-gray-400 block">SKU: {itemProfile?.sku} — Qty: {line.quantity} pcs {line.category ? `(${line.category})` : ''}</span>
                           </div>
                           <div className="text-right font-mono font-bold text-gray-751">
                             ₱{(line.quantity * line.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                           </div>
                         </div>
                         {itemProfile?.description && (
                           <div className="text-[11px] text-gray-500 italic text-left pl-2 border-l border-gray-200">
                             Description: {itemProfile.description}
                           </div>
                         )}
                         {line.note && (
                           <div className="text-[11px] text-indigo-700 bg-indigo-50/30 px-2 py-1 rounded text-left border border-indigo-100/40">
                             ✍️ Line Note: {line.note}
                           </div>
                         )}
                       </div>
                     );
                   })}
                </div>
              </div>

              {/* Invoicing summary details */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono text-xs text-gray-600 space-y-2">
                <div className="flex justify-between text-indigo-750 font-bold border-b border-dashed border-gray-250 pb-2 mb-2">
                  <span className="font-sans text-[11px]">SO Creation Date:</span>
                  <span className="text-[11px]">{focusedSO.orderDate}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal value:</span>
                  <span>₱{focusedSO.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {focusedSO.discountType && focusedSO.discountType !== 'None' && (
                  <div className="flex justify-between text-red-650 font-medium">
                    <span>Discount ({focusedSO.discountType === 'Percentage' ? `${focusedSO.discountValue}%` : 'Fixed'}):</span>
                    <span>-₱{((focusedSO.discountType === 'Percentage' ? (focusedSO.subtotal * (focusedSO.discountValue || 0) / 100) : (focusedSO.discountValue || 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {focusedSO.discountType && focusedSO.discountType !== 'None' && (
                  <div className="flex justify-between text-gray-400 border-t border-dashed border-gray-200 pt-1">
                    <span>Subtotal After Disc:</span>
                    <span>₱{(Math.max(0, focusedSO.subtotal - ((focusedSO.discountType === 'Percentage' ? (focusedSO.subtotal * (focusedSO.discountValue || 0) / 100) : (focusedSO.discountValue || 0))))).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {focusedSO.taxType !== 'None' ? (
                  <div className="flex justify-between text-indigo-800">
                    <span>Philippine Tax ({focusedSO.taxType === 'VAT' ? 'VAT 12%' : focusedSO.taxType === 'Non-VAT' ? 'Non-VAT 0%' : `Custom ${focusedSO.customTaxRate || 12}%`}):</span>
                    <span>₱{focusedSO.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-gray-400 italic">
                    <span>Philippine Tax:</span>
                    <span>No Tax Applied</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2 text-sm font-bold text-gray-950">
                  <span>Grand Total (₱):</span>
                  <span>₱{focusedSO.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Notes */}
              {focusedSO.notes && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-left">
                  <span className="text-[9px] font-bold text-gray-400 block uppercase tracking-wider font-mono">Special Delivery Instructions</span>
                  <p className="text-[11px] text-gray-600 leading-normal mt-0.5">{focusedSO.notes}</p>
                </div>
              )}

              {/* File Attachments display with post-creation upload capabilities */}
              <div className="space-y-2 text-left bg-slate-50/40 p-3.5 rounded-xl border border-gray-150">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-550 font-mono flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Documents & Attachments ({(focusedSO.attachments || []).length})</span>
                  </span>
                  
                  {/* Post-creation direct simulation upload */}
                  <label className="text-[10px] bg-indigo-50 hover:bg-slate-100 text-indigo-700 font-bold px-2 py-1 rounded cursor-pointer transition-colors block">
                    <span>+ Attach File</span>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (!e.target.files) return;
                        const filesArray = Array.from(e.target.files);
                        const newRecords = filesArray.map((f: any) => ({
                          id: `att-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                          name: f.name,
                          size: f.size,
                          type: f.type,
                          dataUrl: '#',
                          uploadedAt: new Date().toISOString()
                        }));
                        const updated = {
                          ...focusedSO,
                          attachments: [...(focusedSO.attachments || []), ...newRecords]
                        };
                        onEditSO(updated);
                        setFocusedSO(updated);
                      }}
                    />
                  </label>
                </div>

                {(!focusedSO.attachments || focusedSO.attachments.length === 0) ? (
                  <p className="text-[10px] text-gray-400 italic py-1 pl-1">No file attachments bound yet. Use the tool above to attach receipts or logistics documents.</p>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    {focusedSO.attachments.map((att: any) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg"
                      >
                        <a
                          href="#"
                          onClick={(e) => { e.preventDefault(); alert(`Downloading file: ${att.name}`); }}
                          className="flex items-center gap-2 min-w-0 flex-1 hover:underline cursor-pointer"
                        >
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-semibold block truncate text-slate-800 text-left">{att.name}</span>
                            <span className="text-[9px] text-gray-400 font-mono font-medium block text-left">{(att.size / 1024).toFixed(1)} KB</span>
                          </div>
                        </a>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete attachment: "${att.name}"?`)) {
                              const remaining = (focusedSO.attachments || []).filter(a => a.id !== att.id);
                              const updated = { ...focusedSO, attachments: remaining };
                              onEditSO(updated);
                              setFocusedSO(updated);
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-rose-50 cursor-pointer"
                          title="Remove file"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Interactive Status Transition timeline */}
              <div className="space-y-3 text-left bg-slate-50/40 p-3.5 rounded-xl border border-gray-150">
                <div className="flex justify-between items-center bg-slate-50/10 pb-1 border-b border-gray-100/50 mb-1">
                  <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider font-mono">Order History & Status Trail</span>
                  <button
                    type="button"
                    onClick={handleExportAuditSO}
                    className="inline-flex items-center gap-1 text-[9px] font-bold text-indigo-650 hover:text-indigo-805 bg-white hover:bg-slate-100 border border-gray-200 hover:border-indigo-200 px-2.2 py-1 rounded shadow-3xs cursor-pointer transition-all uppercase tracking-wider font-mono shrink-0"
                    title="Export status history logs to CSV"
                  >
                    <Download className="w-3 h-3 text-indigo-500" />
                    <span>Export Audit Log</span>
                  </button>
                </div>
                <div className="relative pl-3.5 border-l border-indigo-200 space-y-4 ml-1.5">
                  {(focusedSO.statusHistory && focusedSO.statusHistory.length > 0 ? focusedSO.statusHistory : [
                    { status: 'Draft', date: focusedSO.orderDate || new Date().toISOString().split('T')[0], note: 'Sales Order drafted by sales team.', user: 'Operations' }
                  ]).map((hist, hIdx) => (
                    <div key={hIdx} className="relative">
                      {/* Interactive indicator pin */}
                      <span className={`absolute -left-[20.5px] top-1.5 w-2 h-2 rounded-full ring-4 ring-white ${
                        hist.status === 'Draft' ? 'bg-slate-500' :
                        hist.status === 'Confirmed' ? 'bg-amber-500' :
                        hist.status === 'On Going' || hist.status === 'Shipped' ? 'bg-indigo-500' :
                        hist.status === 'Received' ? 'bg-emerald-550' : 'bg-rose-550'
                      }`} />
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-bold text-slate-800">{hist.status}</span>
                          <span className="font-mono text-[9px] text-slate-400 font-bold">{hist.date}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-snug">{hist.note}</p>
                        {hist.user && (
                          <div className="flex justify-between items-center pt-0.5">
                            <span className="text-[9px] text-indigo-500 font-bold font-mono tracking-wide">Operator: {hist.user}</span>
                          </div>
                        )}

                        {/* Inline Quick Remark Textarea */}
                        <div className="mt-1.5 p-1.5 bg-white/80 rounded-md border border-gray-100 space-y-1">
                          <textarea
                            placeholder="Add instant remark to log note..."
                            value={soLogRemarks[hIdx] || ''}
                            onChange={(e) => setSoLogRemarks(prev => ({ ...prev, [hIdx]: e.target.value }))}
                            className="w-full text-[10px] p-1 bg-slate-50 border border-slate-200 rounded focus:outline-hidden focus:ring-1 focus:ring-indigo-505 font-sans leading-relaxed resize-none"
                            rows={1}
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                const val = soLogRemarks[hIdx];
                                if (val && val.trim()) {
                                  handleAppendSoLogRemark(hIdx, val);
                                  setSoLogRemarks(prev => ({ ...prev, [hIdx]: '' }));
                                }
                              }}
                              className="text-[9px] font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded cursor-pointer transition-colors"
                            >
                              Append Remark
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-sm text-gray-400 font-semibold space-y-2">
              <Eye className="w-8 h-8 text-indigo-400 mx-auto" />
              <p>Select a retail sales order to inspect BIR billing logs, dispatch instructions, and inventory status.</p>
            </div>
          )}
        </div>
      </div>

      {/* CREATE / EDIT SO DRAWER MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600 animate-pulse" />
                <h2 className="text-lg font-bold text-gray-900 font-mono">
                  {revisingSO ? 'Edit Sales Order Record' : 'Draft New Sales Order'}
                </h2>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitDraft} className="flex flex-col overflow-hidden flex-1">
              <div className="p-5 space-y-5 overflow-y-auto flex-1 bg-slate-50/10 min-h-0">
                {/* General Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-bold text-gray-600 font-mono">Sales Order Description / Purpose / Project Reference</label>
                    <input
                      type="text"
                      placeholder="e.g. Davao Fleet Parts & Maintenance Servicing Campaign"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-800 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 font-mono">Sales Order Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SO-2026-003"
                      value={soNumber}
                      onChange={(e) => setSoNumber(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 font-mono">Reference No. (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. PO-CUST-9902"
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 font-mono">Select Client (CRM) *</label>
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      required
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-semibold text-indigo-900 bg-white"
                    >
                      {customers.filter(c => c.status === 'Active').map(c => (
                        <option key={c.id} value={c.id}>{c.name} (TIN: {c.tin})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 font-mono">Order Billing Purpose *</label>
                    <select
                      value={orderPurpose}
                      onChange={(e) => setOrderPurpose(e.target.value as 'Sales' | 'Warranty')}
                      required
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-bold text-indigo-700 bg-white"
                    >
                      <option value="Sales">Standard Commercial Sale</option>
                      <option value="Warranty">Warranty Servicing & Parts Replacement</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 font-mono">Machinery Serial Number (Optional Fleet Assoc.)</label>
                    <div className="relative">
                      <input
                        type="text"
                        list="machine-serials"
                        placeholder="e.g. SN-HEX-Y9023, or search fleet..."
                        value={machineSerialNumber}
                        onChange={(e) => setMachineSerialNumber(e.target.value)}
                        className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-bold text-slate-900 bg-white"
                      />
                      <datalist id="machine-serials">
                        {machineLogs.map(m => m.serialNumber).filter((v, i, self) => self.indexOf(v) === i).map(sn => {
                          const mLog = machineLogs.find(m => m.serialNumber === sn);
                          return (
                            <option key={sn} value={sn}>{sn} {mLog ? `(${mLog.model})` : ''}</option>
                          );
                        })}
                      </datalist>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600">Expected Dispatch Date *</label>
                    <input
                      type="date"
                      required
                      value={shipmentDate}
                      onChange={(e) => setShipmentDate(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600">Source Dispatch Site *</label>
                    <select
                      value={warehouseId}
                      onChange={(e) => setWarehouseId(e.target.value)}
                      required
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-bold text-gray-800 bg-white"
                    >
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600">Delivery Logistical Option (Optional)</label>
                    <select
                      value={deliveryOption}
                      onChange={(e) => setDeliveryOption(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-700 bg-white cursor-pointer"
                    >
                      <option value="">-- No delivery option (Undetermined) --</option>
                      <option value="Standard Cargo">Standard Cargo</option>
                      <option value="DHL Express">DHL Express</option>
                      <option value="FedEx Courier">FedEx Courier</option>
                      <option value="Air Freight">Air Freight</option>
                      <option value="Sea Cargo">Sea Cargo</option>
                      <option value="Land Logistics / Lalamove">Land Logistics / Lalamove</option>
                      <option value="Warehouse Pickup">Warehouse Pickup</option>
                      <option value="Standard Mail">Standard Mail</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>

                  {deliveryOption === 'Others' && (
                    <div className="p-3 bg-amber-55/50 rounded-lg border border-amber-200/50 space-y-1.5 animate-in slide-in-from-top-1 duration-100">
                      <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wide block">Forwarder / Courier Name *</label>
                      <input
                        type="text"
                        required={deliveryOption === 'Others'}
                        placeholder="e.g. LBC Express, J&T, etc."
                        value={forwarderName}
                        onChange={(e) => setForwarderName(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 bg-white border border-amber-250 rounded-md focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-semibold text-slate-800"
                      />
                    </div>
                  )}

                  {/* Sales Cluster select */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 font-mono">Sales Cluster *</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={['Head Office', 'Homonhon', 'Davao', 'North Luzon', 'CODA', 'Freelance'].includes(region) ? region : 'Other'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'Other') {
                            setRegion('Custom Cluster');
                          } else {
                            setRegion(val);
                          }
                        }}
                        required
                        className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-800 bg-white"
                      >
                        <option value="Head Office">Head Office</option>
                        <option value="Homonhon">Homonhon</option>
                        <option value="Davao">Davao</option>
                        <option value="North Luzon">North Luzon</option>
                        <option value="CODA">CODA</option>
                        <option value="Freelance">Freelance</option>
                        <option value="Other">Others (Type custom)...</option>
                      </select>

                      {!['Head Office', 'Homonhon', 'Davao', 'North Luzon', 'CODA', 'Freelance'].includes(region) && (
                        <input
                          type="text"
                          required
                          value={region}
                          onChange={(e) => setRegion(e.target.value)}
                          placeholder="Type custom cluster name..."
                          className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg font-bold text-slate-700 bg-white focus:outline-indigo-500"
                        />
                      )}
                    </div>
                  </div>

                  {/* Sales Category/Classification select */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 font-mono">Sales Type / tracking *</label>
                    <select
                      value={salesCategory}
                      onChange={(e) => setSalesCategory(e.target.value as 'Parts' | 'Services' | 'Both')}
                      required
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-800 bg-white"
                    >
                      <option value="Parts">Parts Only</option>
                      <option value="Services">Services Only</option>
                      <option value="Both">Both (Parts & Services)</option>
                    </select>
                  </div>

                  {(salesCategory === 'Services' || salesCategory === 'Both') && (
                    <div className="space-y-2 p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg animate-in slide-in-from-top-1 duration-150 sm:col-span-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-indigo-950 font-mono">Service Category offered *</label>
                          <select
                            value={serviceCategory}
                            onChange={(e) => {
                              setServiceCategory(e.target.value);
                              if (e.target.value !== 'other') {
                                setCustomServiceCategory('');
                              }
                            }}
                            required
                            className="w-full text-xs px-3 py-2 bg-white border border-indigo-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-bold text-indigo-950 cursor-pointer"
                          >
                            <option value="">-- Select Service Type --</option>
                            <option value="Overhauling">Overhauling</option>
                            <option value="Onsite Services">Onsite Services</option>
                            <option value="Preventive Maintenance">Preventive Maintenance</option>
                            <option value="Inspection and Troubleshooting">Inspection and Troubleshooting</option>
                            <option value="Diagnostics">Diagnostics</option>
                            <option value="other">Other (Input manually...)</option>
                          </select>
                        </div>

                        {serviceCategory === 'other' && (
                          <div className="space-y-1 animate-in slide-in-from-left-1 duration-150">
                            <label className="text-xs font-bold text-indigo-950 font-mono">Custom Service Category Name *</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Electrical Retrofitting"
                              value={customServiceCategory}
                              onChange={(e) => setCustomServiceCategory(e.target.value)}
                              className="w-full text-xs px-3 py-2 bg-white border border-indigo-250 rounded-md focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-bold text-slate-800"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Line Items drafting */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider font-mono">Lines ({draftedItems.length})</span>
                    <button
                      type="button"
                      onClick={handleAddItemToDraft}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                    >
                      + Add Row Code
                    </button>
                  </div>

                  <div className="space-y-3 font-sans">
                    {draftedItems.map((row, idx) => {
                      const availableStock = checkStockLevel(row.itemId, warehouseId);
                      const isOverStock = row.quantity > availableStock;
                      const selectedItemObj = items.find(p => p.id === row.itemId);

                      return (
                        <div key={idx} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-left shadow-2xs">
                          {/* Row 1: SKU, Quantity, Unit Price, Total, Delete Button */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            {/* Select Dropdown (Expanded width to fill space) */}
                            <div className="md:col-span-6 text-left">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1 font-mono">
                                Select SKU Asset *
                              </label>
                              <select
                                value={row.itemId}
                                onChange={(e) => {
                                  handleUpdateDraftRow(idx, { itemId: e.target.value });
                                }}
                                className="w-full text-xs px-3 py-2 border border-slate-250 rounded-lg focus:outline-[#1F2937] focus:ring-1 focus:ring-indigo-500 font-bold bg-white text-indigo-900"
                              >
                                {items.map(p => (
                                  <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                                ))}
                              </select>
                            </div>

                            {/* Quantity */}
                            <div className="md:col-span-2 text-left">
                              <label className="text-[10px] font-bold text-gray-400 uppercase font-mono block mb-1">Quantity</label>
                              <input
                                type="number"
                                min={1}
                                id={`so-quantity-input-form-${idx}`}
                                placeholder="Qty"
                                value={row.quantity}
                                onChange={(e) => handleUpdateDraftRow(idx, { quantity: Math.max(1, parseInt(e.target.value) || 0) })}
                                className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-center font-mono font-bold ${
                                  isOverStock ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-gray-250 bg-white text-gray-900'
                                }`}
                              />
                            </div>

                            {/* Unit Price */}
                            <div className="md:col-span-2 font-mono text-left">
                              <label className="text-[10px] font-bold text-gray-400 uppercase font-mono block mb-1">Unit Price</label>
                              <input
                                type="number"
                                step="any"
                                min={0}
                                placeholder="Unit price"
                                value={row.unitPrice}
                                onChange={(e) => handleUpdateDraftRow(idx, { unitPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                                className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-right font-bold text-emerald-805 bg-white"
                              />
                            </div>

                            {/* Multiplied values UI */}
                            <div className="hidden sm:block md:col-span-1 text-right pr-2 text-xs font-mono font-bold text-gray-950 pb-2.5">
                              ₱{(row.quantity * row.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>

                            {/* Delete row */}
                            <div className="md:col-span-1 flex justify-end pb-1.5">
                              <button
                                type="button"
                                onClick={() => handleRemoveDraftRow(idx)}
                                disabled={draftedItems.length === 1}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* SKU and detailed description of product */}
                          {selectedItemObj && (
                            <div className="text-[11px] text-slate-700 bg-white border border-slate-200 p-2.5 rounded-lg flex flex-col sm:flex-row justify-between gap-1.5 font-sans">
                              <div>
                                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded mr-2 border border-slate-200">
                                  SKU: {selectedItemObj.sku}
                                </span>
                                <span className="font-semibold text-slate-800">
                                  {selectedItemObj.name}
                                </span>
                                {selectedItemObj.description ? (
                                  <span className="text-slate-505 block sm:inline sm:ml-2 italic">
                                    - {selectedItemObj.description}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 block sm:inline sm:ml-2 italic">
                                    (No internal catalog description available)
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-500 font-mono text-[9px] shrink-0 font-medium">
                                Base Sell Price: ₱{selectedItemObj.sellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} &nbsp;|&nbsp;
                                Category Class: {selectedItemObj.category}
                              </div>
                            </div>
                          )}

                          {/* Row 2: Line Allocation, Inventory Lot Location, and Line Note grouped together */}
                          <div className="bg-slate-100/60 p-3.5 rounded-xl border border-slate-200 mt-2.5">
                            <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest font-mono block mb-2 text-left">
                              ⚙️ Line Allocation, Inventory Lot Location, &amp; Customize Info
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            {/* Select Category/Allocation per line item */}
                            <div className="md:col-span-3 text-left">
                              <label className="text-[10px] font-bold text-gray-450 uppercase font-mono block mb-1">Line Allocation</label>
                              <select
                                value={row.category || 'Parts'}
                                onChange={(e) => handleUpdateDraftRow(idx, { category: e.target.value as 'Parts' | 'Services' })}
                                className="w-full text-xs px-2.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-semibold bg-white text-slate-800"
                              >
                                <option value="Parts">Parts</option>
                                <option value="Services text-slate-800">Services</option>
                              </select>
                            </div>

                            {/* Select Lot */}
                            <div className="md:col-span-4 text-left">
                              <label className="text-[10px] font-bold text-gray-455 uppercase font-mono block mb-1">Inventory Lot Location</label>
                              <select
                                value={row.lotId || ''}
                                onChange={(e) => {
                                  const selectedLotIdForLine = e.target.value || undefined;
                                  
                                  if (selectedLotIdForLine) {
                                    const violation = getFifoViolation(row.itemId, warehouseId, selectedLotIdForLine);
                                    if (violation.violated && violation.selected && violation.oldest) {
                                      const confirmOverride = window.confirm(
                                        `⚠️ FIFO STOCKING PRINCIPLE WARNING!\n\n` +
                                        `The lot "${violation.selected.lotNumber}" is NOT the oldest available lot for this product in the selected warehouse.\n\n` +
                                        `The oldest available lot is "${violation.oldest.lotNumber}" (received on ${new Date(violation.oldest.dateReceived).toLocaleDateString()}).\n\n` +
                                        `Dispensing the selected lot violates the FIFO (First In, First Out) principle.\n\n` +
                                        `Are you sure you want to select this lot?`
                                      );
                                      if (!confirmOverride) {
                                        return;
                                      }
                                    }
                                  }
                                  handleUpdateDraftRow(idx, { lotId: selectedLotIdForLine });
                                }}
                                className="w-full text-xs px-2.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium bg-white text-slate-800 font-sans"
                              >
                                <option value="">Auto-allocate (FIFO)</option>
                                {lots
                                  .filter(l => l.itemId === row.itemId && l.warehouseId === warehouseId && l.quantityRemaining > 0)
                                  .map(l => (
                                    <option key={l.id} value={l.id}>
                                      {l.lotNumber} ({l.quantityRemaining} remaining)
                                    </option>
                                  ))}
                              </select>
                            </div>

                            {/* Line Note */}
                            <div className="md:col-span-5 text-left font-sans">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1 font-mono">
                                ✍️ Line Note / customized instructions
                              </label>
                              <input
                                type="text"
                                value={row.note || ''}
                                onChange={(e) => handleUpdateDraftRow(idx, { note: e.target.value })}
                                placeholder="Add line item customized request..."
                                className="w-full text-xs px-3 py-2 bg-white border border-slate-250 rounded-lg text-slate-700 placeholder-slate-450 focus:outline-[#1F2937] focus:ring-1 focus:ring-indigo-500 font-medium"
                              />
                            </div>
                          </div>
                        </div>
                          
                          {/* Stock Notification indicator */}
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-[10px] text-gray-400 font-mono px-1 gap-1.5 pt-1.5">
                            <span>Site Stock Available: <strong className={availableStock === 0 ? 'text-red-500' : 'text-indigo-600'}>{availableStock} pcs</strong></span>
                            {row.lotId && getFifoViolation(row.itemId, warehouseId, row.lotId).violated && (
                              <span className="text-rose-600 font-bold flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                                FIFO Violation: Older Lot ({getFifoViolation(row.itemId, warehouseId, row.lotId).oldest?.lotNumber}) is available!
                              </span>
                            )}
                            {isOverStock && (
                              <span className="text-amber-600 font-bold flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                                <AlertCircle className="w-3 h-3" /> Exceeds available depot supply!
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Taxes & Discounts policy selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-xl border border-gray-150 text-left">
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider font-mono">VAT/Tax Config</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 font-mono">Option</label>
                        <select
                          value={taxType}
                          onChange={(e) => setTaxType(e.target.value as 'VAT' | 'Non-VAT' | 'Custom' | 'None')}
                          className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg bg-white font-semibold text-slate-800 focus:outline-[1px] focus:outline-indigo-500"
                        >
                          <option value="VAT">VAT</option>
                          <option value="Non-VAT">Non-VAT</option>
                          <option value="None">Choose to not add any option</option>
                        </select>
                      </div>

                      {taxType === 'Custom' && (
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-gray-400 font-mono">Custom Rate (%)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={customTaxRate}
                            onChange={(e) => setCustomTaxRate(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg font-mono font-bold focus:outline-[1px] focus:outline-indigo-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider font-mono">Discount Policy</span>
                    <div className="grid grid-cols-2 gap-2">
                       <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 font-mono">Type</label>
                        <select
                          value={discountType}
                          onChange={(e) => setDiscountType(e.target.value as 'Percentage' | 'Fixed' | 'None')}
                          className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg bg-white font-semibold text-slate-800 focus:outline-[1px] focus:outline-indigo-500"
                        >
                          <option value="None">None</option>
                          <option value="Percentage">Percentage (%)</option>
                          <option value="Fixed">Fixed Amount (₱)</option>
                        </select>
                      </div>

                      {discountType !== 'None' && (
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-gray-400 font-mono">Value</label>
                          <input
                            type="number"
                            min={0}
                            value={discountValue}
                            onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg font-mono font-bold focus:outline-[1px] focus:outline-indigo-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* File Upload zone with attachments listing */}
                <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-gray-150 text-left">
                  <span className="text-[11px] font-bold text-slate-700 uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                    <span>Upload Documents / Attachments</span>
                  </span>

                  <div className="border-2 border-dashed border-indigo-250 hover:border-indigo-400 transition-colors p-4 rounded-xl bg-indigo-50/10 text-center relative">
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="space-y-1">
                      <Paperclip className="w-5 h-5 mx-auto text-indigo-500 animate-bounce" />
                      <p className="text-xs font-semibold text-slate-700">Drag items here or click to select files</p>
                      <p className="text-[10px] text-gray-400 font-mono">PDF, XLS, DOCX, ZIP, JPG (max 10MB per file)</p>
                    </div>
                  </div>

                  {attachments.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {attachments.map((file) => (
                        <div key={file.id} className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg shrink-0 text-left">
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold text-gray-950 truncate">{file.name}</div>
                            <div className="text-[9px] text-gray-400 font-mono">{(file.size / 1024).toFixed(0)} KB</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(file.id)}
                            className="text-gray-400 hover:text-red-500 p-1 hover:bg-red-50 rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer inputs panel */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end bg-gray-50 p-4 rounded-xl border border-gray-150 text-left">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600">Dispatch Instructions / Shipping Conditions</label>
                    <textarea
                      rows={2.5}
                      placeholder="Special instructions for customer fulfillment..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full text-xs px-3.5 py-1.5 border border-gray-250 rounded-lg bg-white"
                    />
                  </div>

                  <div className="space-y-1.5 text-xs font-mono text-gray-650 text-right pr-2">
                    <div className="flex justify-between max-w-xs ml-auto">
                      <span>Subtotal gross:</span>
                      <span>₱{totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>

                    {discountType !== 'None' && (
                      <div className="flex justify-between max-w-xs ml-auto text-red-600 font-semibold">
                        <span>Discount ({discountType === 'Percentage' ? `${discountValue}%` : 'Fixed'}):</span>
                        <span>-₱{totals.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    {discountType !== 'None' && (
                      <div className="flex justify-between max-w-xs ml-auto text-gray-400 font-bold border-t border-dashed border-gray-200 pt-1">
                        <span>Subtotal After Disc:</span>
                        <span>₱{totals.subtotalAfterDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    {taxType !== 'None' && (
                      <div className="flex justify-between max-w-xs ml-auto text-indigo-800">
                        <span>
                          {taxType === 'VAT' ? 'Philippines VAT (12%):' : taxType === 'Non-VAT' ? 'Non-VAT (0%):' : `Custom Option Tax (${customTaxRate}%):`}
                        </span>
                        <span>₱{totals.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    <div className="flex justify-between max-w-xs ml-auto border-t border-gray-250 pt-1.5 text-sm font-bold text-gray-950 font-mono">
                      <span>Grand Total:</span>
                      <span>₱{totals.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
                {hasInadequateStock() && (
                  <span className="text-xs text-red-650 font-bold mr-auto flex items-center gap-1 pl-1">
                    <AlertCircle className="w-4 h-4 animate-ping" /> Cannot register order with insufficient stocking!
                  </span>
                )}
                
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={hasInadequateStock()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none text-xs font-bold text-white rounded-lg transition-colors cursor-pointer"
                >
                  Save Sales Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Machinery Explorer Modal - Dynamic */}
      {renderMachineSerialModal()}

      {/* COMPLIANT PHILIPPINES DELIVERY RECEIPT (DR) MODAL */}
      {isDeliveryReceiptOpen && focusedSO && (() => {
        const selectedCust = customers.find(c => c.id === focusedSO.customerId);
        const originWarehouse = warehouses.find(w => w.id === focusedSO.warehouseId);
        
        const drNumber = selectedDRForView ? selectedDRForView.drNumber : `DR-${focusedSO.soNumber.replace('SO-', '')}`;
        const dispatchDate = selectedDRForView ? selectedDRForView.dispatchDate : (focusedSO.actualDeliveryDate || focusedSO.shipmentDate || new Date().toISOString().split('T')[0]);
        const dispatchedBy = selectedDRForView ? selectedDRForView.dispatchedBy : 'Logistics Supervisor';
        const notesValue = selectedDRForView ? selectedDRForView.notes : 'Shipment dispatched in compliance with sales layout criteria and transit security. All custom logs preserved.';

        return (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl flex flex-col my-8 max-h-[90vh] overflow-hidden transform transition-all animate-in zoom-in-95 duration-150">
              {/* Header Controller Bar */}
              <div className="bg-slate-50 p-4 border-b border-gray-150 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs font-black text-slate-700 tracking-wide uppercase font-mono">
                    Delivery Receipt Document Generated Successfully
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      alert(`🖨️ Simulated Delivery Receipt Print triggered!\n\nStandard print layouts compiled for ${drNumber}.\n\n(A PDF generation pipeline has been simulated in this preview)`);
                    }}
                    className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-xs font-bold text-white rounded-md cursor-pointer transition-all duration-100"
                  >
                    Simulate Print DR
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDeliveryReceiptOpen(false)}
                    className="p-1 hover:bg-gray-200 text-gray-500 rounded-md cursor-pointer transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable DR Payload Area */}
              <div className="p-8 overflow-y-auto space-y-6 text-left selection:bg-indigo-100">
                {/* Print Sheet Borders */}
                <div className="border border-slate-350 p-6 md:p-8 bg-slate-50/10 rounded-xl space-y-6 relative overflow-hidden font-sans">
                  {/* Visual Background Stamp */}
                  <div className="absolute right-[-30px] top-[140px] opacity-[0.02] text-[180px] font-black rotate-[-25deg] select-none tracking-widest pointer-events-none">
                    DELIVERY
                  </div>

                  {/* Top Company Metadata Header */}
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-slate-250 pb-6">
                    <div className="space-y-1.5">
                      <h4 className="text-lg font-black text-slate-900 tracking-tight leading-none">
                        HEAVY FLEET DISTRIBUTORS INC.
                      </h4>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                        Heavy Machinery Parts, Supplies, Logistics & Field Services<br />
                        88 Pier 12, South Harbor, Port Area, Manila, Metro Manila, PH<br />
                        Tel: +63 (02) 8800-4560 | Tax Registration TIN: 005-985-712-000
                      </p>
                    </div>
                    <div className="text-left md:text-right space-y-1.5">
                      <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-bold text-[10px] tracking-widest uppercase font-mono">
                        Delivery Receipt (DR)
                      </span>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-800 font-mono">DR No: {drNumber}</p>
                        <p className="text-[10px] text-slate-500">Date Issued: {dispatchDate}</p>
                        <p className="text-[10px] text-slate-500 font-mono">Order Ref: {focusedSO.soNumber}</p>
                      </div>
                    </div>
                  </div>

                  {/* Customer details and Delivery Depot Address Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[11px] leading-relaxed">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-205 space-y-1.5">
                      <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase block font-mono">
                        DELIVER & BILL TO CUSTOMER
                      </span>
                      <div className="font-bold text-slate-800 text-xs">
                        {selectedCust?.name || focusedSO.customerName}
                      </div>
                      <p className="text-slate-600 font-medium whitespace-pre-line">
                        {selectedCust?.address || 'No Registered TIN Account Address on File'}
                      </p>
                      <p className="text-slate-500">
                        Phone: {selectedCust?.phone || 'N/A'} | Email: {selectedCust?.email || 'N/A'}
                      </p>
                      {selectedCust?.tin && (
                        <p className="font-mono text-[9px] font-extrabold text-indigo-700">
                          REGISTERED TAX TIN: {selectedCust.tin}
                        </p>
                      )}
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-205 space-y-1.5">
                      <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase block font-mono">
                        LOGISTICAL RELEASE INFO
                      </span>
                      <div>
                        <span>Dispatch Origin: </span>
                        <b className="text-slate-700">
                          {originWarehouse?.name || 'Central Site'} ({originWarehouse?.code || 'MAIN'})
                        </b>
                      </div>
                      <div>
                        <span>Est. Shipment Date: </span>
                        <b className="text-slate-700 font-mono">{dispatchDate}</b>
                      </div>
                      <div>
                        <span>Logistics Option: </span>
                        <b className="text-indigo-700 font-bold tracking-tight">
                          {focusedSO.deliveryOption || 'Standard Cargo'}
                        </b>
                      </div>
                      <div className="p-2 bg-slate-100 rounded-md border border-slate-200 mt-1 flex justify-between gap-2 items-center">
                        <div className="space-y-0.5">
                          <span className="text-[8px] font-bold text-slate-400 font-mono block">PAYMENT:</span>
                          <span className={`text-[9px] font-black tracking-wide ${focusedSO.isPaid ? 'text-emerald-700' : 'text-red-700'}`}>
                            {focusedSO.isPaid ? 'PAID ✓' : 'PENDING PAYMENT ✗'}
                          </span>
                        </div>
                        <div className="space-y-0.5 text-right">
                          <span className="text-[8px] font-bold text-slate-400 font-mono block">INVOICE ST:</span>
                          <span className={`text-[9px] font-black tracking-wide ${focusedSO.invoiceCreated ? 'text-blue-700' : 'text-amber-700'}`}>
                            {focusedSO.invoiceCreated ? 'INVOICED ✓' : 'NOT INVOICED ✗'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ordered items listing layout */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 font-mono text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                          <th className="px-4 py-2.5">SKU / Item</th>
                          <th className="px-4 py-2.5">Category</th>
                          <th className="px-4 py-2.5 text-center">Assigned Block Lot</th>
                          <th className="px-4 py-2.5 text-right">Qty Released</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 font-sans text-xs">
                        {(() => {
                          const drLines = selectedDRForView 
                            ? selectedDRForView.items 
                            : focusedSO.items.map(it => {
                                const originalItem = items.find(p => p.id === it.itemId);
                                return {
                                  itemId: it.itemId,
                                  sku: originalItem?.sku || 'SKU-N/A',
                                  name: originalItem?.name || 'Unknown Item Spec',
                                  quantity: it.quantity,
                                  unitPrice: it.unitPrice,
                                  category: it.category,
                                  lotId: it.lotId
                                };
                              });

                          return drLines.map((line, idx) => {
                            const matchedItem = items.find(p => p.id === line.itemId);
                            const associatedLot = lots.find(l => l.id === (line as any).lotId || l.itemId === line.itemId);
                            
                            return (
                              <tr key={idx} className="hover:bg-slate-50/60 font-medium whitespace-none">
                                <td className="px-4 py-3">
                                  <b className="text-slate-805 font-mono block">{line.sku}</b>
                                  <span className="text-slate-660 font-sans text-[10.5px] block">{line.name}</span>
                                </td>
                                <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">
                                  {(line as any).category || 'Parts'}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {associatedLot ? (
                                    <div className="space-y-0.5">
                                      <span className="font-mono text-[10px] bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded text-indigo-700 font-bold">
                                        {associatedLot.lotNumber}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic text-[10px]">No batch lot allocated</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                                  {line.quantity} pcs
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Terms Conditions (Without Pricing Totals Box) */}
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4 pt-2">
                    <div className="text-[10px] text-slate-450 leading-relaxed font-sans max-w-sm">
                      <b>TERMS & CONDITIONS:</b> All physical goods listed on this Delivery Receipt must be counted and cross-inspected. Any claim for missing stock or shipping defect must be filed formally within 48 hours of transit release. Signatories verify goods arrived complete and fit for service operations.
                    </div>
                  </div>

                  {/* Notes remark status from specific sheet */}
                  <div className="p-3 bg-red-50/20 border border-slate-200 rounded-lg text-left text-[11px] text-slate-700 italic">
                    <span className="font-mono text-[9px] block uppercase font-bold text-gray-500 mb-0.5 font-sans">DELIVERY DESPATCH OBSERVATIONS:</span>
                    {notesValue}
                  </div>

                  {/* Official Signatures Row */}
                  <div className="grid grid-cols-3 gap-6 pt-12 text-[10px] leading-snug">
                    <div className="space-y-8 text-center border-t border-slate-350 pt-2.5">
                      <span className="font-bold text-slate-750 block text-xs font-serif italic text-emerald-800">
                        {dispatchedBy}
                      </span>
                      <span className="text-slate-450 uppercase font-mono block">Released (Planning & Dispatch)</span>
                    </div>

                    <div className="space-y-8 text-center border-t border-slate-330 pt-2.5">
                      <div className="h-4"></div>
                      <span className="text-slate-450 uppercase font-mono block">Checked By (Warehouse Security)</span>
                    </div>

                    <div className="space-y-8 text-center border-t border-slate-350 pt-2.5 font-sans">
                      <div className="h-4"></div>
                      <span className="text-slate-450 uppercase font-mono block">Customer Seal & Signature</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Close controls at bottom */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsDeliveryReceiptOpen(false)}
                  className="px-5 py-2 bg-slate-600 hover:bg-slate-700 text-xs font-semibold text-white rounded-lg cursor-pointer transition-colors"
                >
                  Close Document Viewer
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PRINTER-FRIENDLY WAREHOUSE FULFILLMENT PICK LIST MODAL */}
      {isPickListOpen && focusedSO && (() => {
        const selectedCust = customers.find(c => c.id === focusedSO.customerId);
        const originWarehouse = warehouses.find(w => w.id === focusedSO.warehouseId);
        
        return (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl flex flex-col my-8 max-h-[90vh] overflow-hidden transform transition-all animate-in zoom-in-95 duration-150">
              
              {/* Header Controller Bar */}
              <div className="bg-slate-50 p-4 border-b border-gray-150 flex items-center justify-between no-print">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-indigo-600" />
                  <span className="text-xs font-black text-slate-700 tracking-wide uppercase font-mono">
                    Fulfillment Operations - Warehouse Pick Slip
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      window.print();
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white rounded-md cursor-pointer transition-all duration-100 flex items-center gap-1"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Slip</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPickListOpen(false)}
                    className="p-1.5 hover:bg-slate-200 text-gray-500 rounded-md cursor-pointer transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Printable Area */}
              <div className="p-8 overflow-y-auto flex-1 bg-white print:p-0" id="printable-pick-list">
                {/* Visual design resembling a real warehouse printout sheet */}
                <div className="border-4 border-double border-slate-800 p-6 space-y-6 text-slate-800 text-left font-sans text-xs">
                  
                  {/* Top Ticket Header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
                    <div>
                      <h3 className="text-xl font-black font-sans tracking-wide uppercase">WAREHOUSE PICK LIST</h3>
                      <p className="text-[10px] text-gray-500 font-mono tracking-widest uppercase mt-0.5">Physical Inventory Fulfillment Ticket</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block border-2 border-slate-800 px-3 py-1 text-base font-black font-mono">
                        {focusedSO.soNumber}
                      </span>
                      <p className="text-[9px] text-gray-400 font-mono mt-1">ISSUED DATE: {focusedSO.orderDate || new Date().toISOString().split('T')[0]}</p>
                    </div>
                  </div>

                  {/* Metadata fields */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 border border-slate-300 rounded font-mono text-[11px]">
                    <div className="space-y-1">
                      <p><span className="text-gray-450 uppercase font-black text-[9px] block">Dispatcher Origin</span>
                        <strong className="text-slate-900">{originWarehouse?.name || 'Main Warehouse Depot'} ({originWarehouse?.code || 'MAIN'})</strong>
                      </p>
                      <p className="pt-1"><span className="text-gray-450 uppercase font-black text-[9px] block">Storage Location</span>
                        <span>{originWarehouse?.location || 'Central Depot Axis'}</span>
                      </p>
                    </div>
                    
                    <div className="space-y-1">
                      <p><span className="text-gray-450 uppercase font-black text-[9px] block">Customer Assign</span>
                        <strong className="text-slate-900">{selectedCust?.name || focusedSO.customerName}</strong>
                      </p>
                      <p className="pt-1"><span className="text-gray-450 uppercase font-black text-[9px] block">Delivery Route Option</span>
                        <span className="font-bold text-slate-800">{focusedSO.deliveryOption || 'Standard Cargo'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Core checklist items */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-mono font-black tracking-widest text-slate-500 block">Fulfillment Lines Checklist</span>
                    
                    <div className="border border-slate-400 rounded overflow-hidden">
                      <table className="min-w-full divide-y divide-slate-300 text-left text-xs text-slate-800">
                        <thead>
                          <tr className="bg-slate-100 font-mono text-[9px] text-slate-600 font-black uppercase tracking-wider">
                            <th className="px-3 py-2 border-r border-slate-200">Checked</th>
                            <th className="px-3 py-2 border-r border-slate-200">SKU Code</th>
                            <th className="px-4 py-2 border-r border-slate-200">Item Name</th>
                            <th className="px-3 py-2 border-r border-slate-200 text-center">Fulfill Qty</th>
                            <th className="px-3 py-2">Assigned Lot / Shelf Reference</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-sans text-xs">
                          {focusedSO.items.map((line, idx) => {
                            const itemObj = items.find(p => p.id === line.itemId);
                            return (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="px-3 py-3 border-r border-slate-200 text-center">
                                  <div className="w-5 h-5 border-2 border-slate-800 rounded mx-auto flex items-center justify-center font-bold text-slate-900 font-mono">
                                    [ ]
                                  </div>
                                </td>
                                <td className="px-3 py-3 border-r border-slate-200 font-mono text-[11px] font-bold text-slate-750">
                                  {itemObj?.sku || 'SKU-000'}
                                </td>
                                <td className="px-4 py-3 border-r border-slate-200 text-slate-900">
                                  <div className="font-bold">{itemObj?.name || 'Generic Item'}</div>
                                  <div className="text-[10px] text-gray-500 font-mono">{itemObj?.category}</div>
                                </td>
                                <td className="px-3 py-3 border-r border-slate-200 text-center font-mono font-black text-sm text-slate-950">
                                  {line.quantity.toLocaleString()} pcs
                                </td>
                                <td className="px-3 py-3 font-mono text-[10px] text-slate-600 space-y-0.5">
                                  {line.lotId ? (
                                    <>
                                      <span className="font-bold text-slate-800">LOT:</span> {(lots || []).find(l => l.id === line.lotId)?.lotNumber || 'FIFO MATCH'}
                                    </>
                                  ) : (
                                    <span className="text-gray-455 italic">System Auto-FIFO Selection</span>
                                  )}
                                  <div className="text-[9px] text-gray-450 font-bold uppercase">SEC: SHELF-D{idx+1}</div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Operational Notes / Sign-offs */}
                  <div className="grid grid-cols-2 gap-6 pt-10 text-center">
                    <div className="space-y-8">
                      <div className="h-4"></div>
                      <div className="border-t border-slate-400 pt-2 font-mono text-[10px] uppercase text-gray-500 font-black">
                        Picker Handover Signature & Date
                      </div>
                    </div>
                    <div className="space-y-8">
                      <div className="h-4"></div>
                      <div className="border-t border-slate-400 pt-2 font-mono text-[10px] uppercase text-gray-500 font-black">
                        Warehouse Manager Verification
                      </div>
                    </div>
                  </div>

                  {/* Print barcode aesthetics */}
                  <div className="flex flex-col items-center pt-6 justify-center">
                    <div className="font-mono text-[9px] tracking-[4px] uppercase font-bold text-slate-700 border-x border-slate-800 px-6 py-1">
                      ||||| | | ||||| | |||| | ||| {focusedSO.soNumber} ||||| ||
                    </div>
                    <span className="text-[8px] text-gray-400 font-mono tracking-widest font-bold mt-1">AUTOMATED WORKFLOW WAREHOUSE SLIP V1.0</span>
                  </div>

                </div>
              </div>

              {/* Close controls at bottom */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end no-print">
                <button
                  type="button"
                  onClick={() => setIsPickListOpen(false)}
                  className="px-5 py-2 bg-slate-600 hover:bg-slate-700 text-xs font-semibold text-white rounded-lg cursor-pointer transition-colors"
                >
                  Close Document View
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ZOHO STYLE DELIVERY RECEIPT CREATOR MODAL */}
      {isCreateReceiptOpen && focusedSO && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-250 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-teal-750 to-indigo-850 bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-left">
                <Truck className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-base font-bold font-mono leading-none">NEW DELIVERY RECEIPT</h3>
                  <p className="text-[10px] text-indigo-200 font-sans mt-1">For Sales Order: {focusedSO.soNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateReceiptOpen(false)}
                className="text-indigo-200 hover:text-white p-1 rounded hover:bg-indigo-900/50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Scrollable Body */}
            <form
              onSubmit={(e) => {
                e.preventDefault();

                // Validate at least one item quantity is received/shipped > 0
                const hasSelectedItems = Object.entries(receiptForm.shippedAmounts).some(([itemId, qty]) => Number(qty) > 0);
                if (!hasSelectedItems) {
                  alert("⚠️ Warning: You must input a dispatch quantity (> 0) for at least one item to log a delivery.");
                  return;
                }

                // Call onShipSOBatch prop
                if (onShipSOBatch) {
                  onShipSOBatch(
                    focusedSO.id,
                    receiptForm.receiptNumber,
                    receiptForm.dispatchedBy,
                    receiptForm.dispatchDate,
                    receiptForm.notes,
                    receiptForm.shippedAmounts
                  );
                }

                setIsCreateReceiptOpen(false);
              }}
              className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-left bg-slate-50/50"
            >
              {/* Metadata Fields Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-gray-150">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-extrabold text-gray-400 font-mono block">Delivery Receipt Number *</label>
                  <input
                    type="text"
                    required
                    value={receiptForm.receiptNumber}
                    onChange={(e) => setReceiptForm({ ...receiptForm, receiptNumber: e.target.value })}
                    className="w-full text-xs font-mono font-bold text-gray-900 border border-gray-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-extrabold text-gray-400 font-mono block">Dispatch Date *</label>
                  <input
                    type="date"
                    required
                    value={receiptForm.dispatchDate}
                    onChange={(e) => setReceiptForm({ ...receiptForm, dispatchDate: e.target.value })}
                    className="w-full text-xs font-mono font-medium text-gray-950 border border-gray-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-extrabold text-gray-400 font-mono block">Dispatched By / Logistics *</label>
                  <input
                    type="text"
                    required
                    value={receiptForm.dispatchedBy}
                    onChange={(e) => setReceiptForm({ ...receiptForm, dispatchedBy: e.target.value })}
                    className="w-full text-xs font-medium text-gray-950 border border-gray-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* Items Despatch Matrix Grid */}
              <div className="space-y-2 text-left">
                <span className="text-[10px] uppercase font-extrabold text-gray-400 tracking-wider font-mono block">
                  Items Shipment Despatch matrix
                </span>
                
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-2xs">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-slate-50 border-b border-gray-200 text-slate-700 text-[10px] uppercase tracking-wider font-mono">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">SKU / Item Details</th>
                        <th className="px-4 py-3 text-right font-semibold">Ordered</th>
                        <th className="px-4 py-3 text-right font-semibold">Already Shipped</th>
                        <th className="px-4 py-3 text-right font-semibold">Balance to Ship</th>
                        <th className="px-4 py-3 text-center font-semibold w-32 font-mono">Qty Dispatched Now</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 text-slate-800">
                      {focusedSO.items.map((it) => {
                        const originalItem = items.find(p => p.id === it.itemId);
                        const alreadyShipped = it.shippedQuantity || 0;
                        const balance = Math.max(0, it.quantity - alreadyShipped);
                        const shippingNowValue = receiptForm.shippedAmounts[it.itemId] ?? 0;

                        return (
                          <tr key={it.itemId} className="hover:bg-slate-50/50 animate-in fade-in">
                            <td className="px-4 py-3">
                              <span className="font-bold text-slate-900 block">{originalItem?.name || 'Linked SKU Spec'}</span>
                              <div className="flex items-center gap-1.5 text-[9px] text-gray-400 font-mono mt-0.5 font-bold">
                                <span className="text-indigo-650 font-extrabold">{originalItem?.sku || 'N/A'}</span>
                                {originalItem?.unit && <span>({originalItem.unit})</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-slate-600">
                              {it.quantity}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-medium text-emerald-600">
                              {alreadyShipped}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-indigo-600">
                              {balance}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {balance <= 0 ? (
                                <span className="inline-block px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 rounded-full font-sans">
                                  Fully Despatched
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  max={balance}
                                  value={shippingNowValue === 0 ? '' : shippingNowValue}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const parsedVal = parseInt(e.target.value) || 0;
                                    const constrained = Math.min(Math.max(0, parsedVal), balance);
                                    setReceiptForm({
                                      ...receiptForm,
                                      shippedAmounts: {
                                        ...receiptForm.shippedAmounts,
                                        [it.itemId]: constrained
                                      }
                                    });
                                  }}
                                  className="w-24 text-center font-mono font-bold text-xs text-slate-950 border border-gray-300 rounded-lg p-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none focus:border-indigo-600 bg-indigo-50/10 focus:bg-white"
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-extrabold text-gray-400 font-mono block">Observations, Shipment Notes & Remarks</label>
                <textarea
                  rows={3}
                  placeholder="Record carrier tracking references, driver info, custom plate numbers, or package weight checks..."
                  value={receiptForm.notes}
                  onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
                  className="w-full text-xs font-medium text-gray-950 border border-gray-300 rounded-lg p-2.5 bg-white focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none focus:border-indigo-505 transition-all resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-200 shrink-0 font-sans">
                <button
                  type="button"
                  onClick={() => setIsCreateReceiptOpen(false)}
                  className="px-4 py-2 hover:bg-slate-100 text-slate-700 text-xs font-mono font-bold rounded-lg border border-slate-200 cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-mono font-bold rounded-lg shadow-xs hover:shadow-sm cursor-pointer transition-all"
                >
                  ✔ Commit Delivery Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable QR Code Label Generation Modal */}
      {isPrintLabelModalOpen && focusedSO && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 bg-slate-900 text-white">
              <div className="space-y-0.5">
                <h3 className="text-sm font-extrabold uppercase tracking-wider font-mono flex items-center gap-2">
                  <Printer className="w-4.5 h-4.5 text-indigo-400" />
                  <span>Sticker Label Generator</span>
                </h3>
                <p className="text-[11px] text-slate-400">Standard 4" x 3" warehouse physical tracking passport</p>
              </div>
              <button 
                onClick={() => setIsPrintLabelModalOpen(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Modal Body / Sticker Passport Canvas */}
            <div className="p-6 bg-slate-50 space-y-6">
              {/* Virtual Label Container */}
              <div id="so-printable-sticker-target" className="bg-white p-5 rounded-xl border-2 border-slate-950 shadow-sm space-y-4 font-sans select-none relative overflow-hidden">
                {/* Visual Label Watermark Border */}
                <div className="absolute top-0 right-0 w-16 h-16 bg-slate-100 rounded-bl-full border-b border-l border-slate-200 flex items-center justify-center pointer-events-none">
                  <span className="text-[9px] font-bold text-slate-400 rotate-45 transform translate-x-1.5 -translate-y-1">W-16</span>
                </div>

                {/* Subtitle / Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-950 pb-2.5">
                  <div className="text-left">
                    <span className="text-[9px] font-black uppercase text-indigo-650 tracking-wider block font-mono">Heavy Equipment Suite</span>
                    <span className="text-sm font-extrabold text-slate-950 tracking-tight block mt-0.5">{focusedSO.soNumber}</span>
                    <span className="text-[9px] text-slate-500 font-mono block mt-0.5">Ordered: {new Date(focusedSO.orderDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Class Label</span>
                    <span className="text-[10px] font-extrabold text-slate-950 block mt-0.5 uppercase tracking-wide bg-slate-100 rounded-sm px-1.5 py-0.5 border border-slate-200">
                      {focusedSO.status === 'Draft' ? 'PRE-SHIPPED' : focusedSO.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Destination & Assignment */}
                <div className="grid grid-cols-2 gap-3 text-left">
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-semibold text-gray-400 block uppercase font-mono">Consignee Client</span>
                    <span className="text-xs font-bold text-slate-950 block truncate">{focusedSO.customerName}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-semibold text-gray-400 block uppercase font-mono">Dispatched Node</span>
                    <span className="text-xs font-bold text-slate-950 block truncate">Depot: {focusedSO.warehouseDetails?.name || 'Central Facility'}</span>
                  </div>
                </div>

                {/* Machine Serial block if available */}
                <div className="p-2.5 bg-slate-100 rounded-lg border border-slate-200 text-left">
                  <span className="text-[8px] font-black text-indigo-650 block uppercase tracking-wider font-mono">Associated Asset Code</span>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs font-black text-slate-950 block font-mono">
                      SN: {focusedSO.machineSerialNumber || 'UNASSIGNED-SERIAL'}
                    </span>
                    <span className="text-[10px] text-slate-505 font-bold block truncate max-w-[150px]">
                      {focusedSO.machineSerialNumber ? (machineLogs?.find(m => m.serialNumber === focusedSO.machineSerialNumber)?.model || 'Heavy Machinery Unit') : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Barcodes & QR codes render split */}
                <div className="flex items-center gap-4 pt-2 border-t border-slate-250">
                  {/* Embedded high contrast QR code */}
                  <div className="p-1.5 bg-white border border-slate-300 rounded shadow-2xs flex-none shrink-0" title="Warehouse Verification Tag Code">
                    <VisualQRCode value={`${focusedSO.soNumber}|${focusedSO.machineSerialNumber || 'NOSERIAL'}`} size={75} />
                  </div>

                  {/* Redundant Barcode tracking line */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1.5">
                    <span className="text-[8px] font-bold text-slate-400 block uppercase text-left font-mono">Secondary verification code</span>
                    <div className="h-9 w-full bg-slate-50 border border-slate-200 rounded p-1 flex items-center justify-center">
                      <VisualBarcode value={focusedSO.soNumber} />
                    </div>
                    <span className="text-[8.5px] font-mono text-slate-500 font-bold block text-center mt-0.5 tracking-wider">{focusedSO.soNumber}</span>
                  </div>
                </div>
              </div>

              {/* Printing Helper Note */}
              <p className="text-[11px] text-gray-500 text-center font-medium leading-normal bg-amber-50 p-3 rounded-xl border border-amber-200">
                💡 <b>System integration ready:</b> Stickers utilize rugged 1D and 2D barcode redundancies to support handscanner lookups on physical cargo intakes.
              </p>
            </div>

            {/* Actions Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-150 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsPrintLabelModalOpen(false)}
                className="px-4 py-2 hover:bg-gray-100 text-gray-500 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Close View
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Physical Sticker</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rapid SO QR Scanner Modal removed */}
    </div>
  );
}
