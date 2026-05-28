/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Warehouse, Item, Supplier, Customer } from '../types';
import { X, RefreshCw, Layers, Shield, HelpCircle } from 'lucide-react';

interface ResetSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleteSetup: (setupData: {
    warehouse: Warehouse;
    item: Item;
    supplier: Supplier;
    customer: Customer;
  }) => void;
  onLoadDefaults: () => void;
}

export const ResetSetupModal: React.FC<ResetSetupModalProps> = ({
  isOpen,
  onClose,
  onCompleteSetup,
  onLoadDefaults,
}) => {
  if (!isOpen) return null;

  // Manual reset initial values state
  const [whName, setWhName] = useState('Manila Hub Alpha');
  const [whCode, setWhCode] = useState('MHD-01');
  const [whLoc, setWhLoc] = useState('Metro Manila, Philippines');
  const [whEmail, setWhEmail] = useState('manila.warehouse@equiprime.ph');

  const [itemName, setItemName] = useState('Heavy Compactor X-200');
  const [itemSku, setItemSku] = useState('EQ-COMP-X200');
  const [itemCat, setItemCat] = useState('Machinery');
  const [itemBrand, setItemBrand] = useState('Caterpillar');
  const [itemUnit, setItemUnit] = useState('Units');
  const [itemPurchPrice, setItemPurchPrice] = useState(125000); // USD
  const [itemSellPrice, setItemSellPrice] = useState(7200000); // PHP

  const [suppName, setSuppName] = useState('CAT Global Supply');
  const [suppCurrency, setSuppCurrency] = useState('USD');
  const [suppExchangeRate, setSuppExchangeRate] = useState(56.5); // USD to PHP
  const [suppContact, setSuppContact] = useState('John Doe');
  const [suppEmail, setSuppEmail] = useState('orders@catglobalsupply.com');
  const [suppPhone, setSuppPhone] = useState('+1-309-675-1000');

  const [custName, setCustName] = useState('BuildCorp Metro Inc');
  const [custEmail, setCustEmail] = useState('procurement@buildcorp.ph');
  const [custPhone, setCustPhone] = useState('+63-2-8888-0000');
  const [custAddress, setCustAddress] = useState('Equitable Tower, Makati City');
  const [custTin, setCustTin] = useState('999-888-777-000');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const whId = 'wh-01';
    const suppId = 'supp-01';
    const itemId = 'item-01';
    const custId = 'cust-01';

    const warehouse: Warehouse = {
      id: whId,
      name: whName,
      code: whCode,
      location: whLoc,
      contactEmail: whEmail,
      status: 'Active',
    };

    const supplier: Supplier = {
      id: suppId,
      name: suppName,
      currency: suppCurrency,
      exchangeRate: suppExchangeRate,
      contactPerson: suppContact,
      email: suppEmail,
      phone: suppPhone,
      leadTimeDays: 7,
    };

    const item: Item = {
      id: itemId,
      sku: itemSku,
      name: itemName,
      description: `Premium grade heavy equipment configured for local infrastructure ventures.`,
      unit: itemUnit,
      purchasePrice: itemPurchPrice,
      sellingPrice: itemSellPrice,
      reorderPoint: 2,
      category: itemCat,
      brand: itemBrand,
      status: 'Active',
      stockByWarehouse: { [whId]: 5 }, // Pre-seed with 5 units of stock
      supplierId: suppId,
    };

    const customer: Customer = {
      id: custId,
      name: custName,
      email: custEmail,
      phone: custPhone,
      address: custAddress,
      tin: custTin,
      status: 'Active',
    };

    onCompleteSetup({ warehouse, item, supplier, customer });
  };

  return (
    <div id="reset-setup-modal" className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col text-slate-100">
        
        {/* Header */}
        <div className="flex border-b border-slate-800 px-6 py-4 justify-between items-center bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <RefreshCw className="h-5 w-5 text-indigo-400 animate-spin-slow" />
            <div>
              <h3 className="text-sm font-mono uppercase tracking-wider font-extrabold text-white">System Reinitialization Wizard</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Wipe database, load demonstration dataset, or configure fresh custom master parameters</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Quick Actions Panel */}
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
            <div className="flex gap-3">
              <Shield className="h-8 w-8 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-[12px] font-bold text-white uppercase tracking-wider">Demo Default Seed Data</h4>
                <p className="text-[11px] text-slate-400 max-w-lg mt-0.5">Wipe all current records and fill with factory-default warehouses, forklift tracking logs, heavy mining machinery, and local sales order mocks.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onLoadDefaults();
              }}
              className="bg-indigo-650 hover:bg-indigo-600 font-mono text-[11px] text-white font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 shadow"
            >
              <Layers className="h-3.5 w-3.5" />
              Reset & Load Demo Data
            </button>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-4 text-[10px] font-mono uppercase text-slate-500 tracking-wider">Or Define Custom Master Records</span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {/* Grid fields for Custom Entry */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 1. Warehouse */}
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4 space-y-3">
              <span className="text-[10px] uppercase font-mono font-black text-indigo-400 tracking-widest block">1. Initial Site / Warehouse</span>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">Warehouse Name</label>
                  <input
                    type="text"
                    value={whName}
                    onChange={(e) => setWhName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-[11px] px-3 py-1.5 rounded-lg text-white font-sans focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">Code</label>
                    <input
                      type="text"
                      value={whCode}
                      onChange={(e) => setWhCode(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-[11px] px-3 py-1.5 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">Contact Email</label>
                    <input
                      type="email"
                      value={whEmail}
                      onChange={(e) => setWhEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-[11px] px-3 py-1.5 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">Location Address</label>
                  <input
                    type="text"
                    value={whLoc}
                    onChange={(e) => setWhLoc(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-[11px] px-3 py-1.5 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* 2. Supplier */}
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4 space-y-3">
              <span className="text-[10px] uppercase font-mono font-black text-indigo-400 tracking-widest block">2. Primary Vendor / Supplier</span>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">Supplier Name</label>
                  <input
                    type="text"
                    value={suppName}
                    onChange={(e) => setSuppName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-[11px] px-3 py-1.5 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">Currency</label>
                    <input
                      type="text"
                      value={suppCurrency}
                      onChange={(e) => setSuppCurrency(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-[11px] px-3 py-1.5 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">Exchange Rate (Supplier unit to PHP)</label>
                    <input
                      type="number"
                      step="any"
                      value={suppExchangeRate}
                      onChange={(e) => setSuppExchangeRate(parseFloat(e.target.value) || 1)}
                      className="w-full bg-slate-900 border border-slate-800 text-[11px] px-3 py-1.5 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">Contact Name</label>
                    <input
                      type="text"
                      value={suppContact}
                      onChange={(e) => setSuppContact(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-[11px] px-3 py-1.5 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">Phone</label>
                    <input
                      type="text"
                      value={suppPhone}
                      onChange={(e) => setSuppPhone(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-[11px] px-3 py-1.5 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">Email</label>
                  <input
                    type="email"
                    value={suppEmail}
                    onChange={(e) => setSuppEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-[11px] px-3 py-1.5 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* 3. Catalog Item */}
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4 space-y-3">
              <span className="text-[10px] uppercase font-mono font-black text-indigo-400 tracking-widest block">3. First Catalog Item</span>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">Item / Machinery Name</label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-[11px] px-3 py-1.5 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">SKU</label>
                    <input
                      type="text"
                      value={itemSku}
                      onChange={(e) => setItemSku(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-[11px] px-3 py-1.5 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">Category</label>
                    <input
                      type="text"
                      value={itemCat}
                      onChange={(e) => setItemCat(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-[11px] px-3 py-1.5 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">Brand</label>
                    <input
                      type="text"
                      value={itemBrand}
                      onChange={(e) => setItemBrand(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-[11px] px-3 py-1.5 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">Buying Price ({suppCurrency})</label>
                    <input
                      type="number"
                      value={itemPurchPrice}
                      onChange={(e) => setItemPurchPrice(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-800 text-[11px] px-3 py-1.5 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">Selling Price (PHP)</label>
                    <input
                      type="number"
                      value={itemSellPrice}
                      onChange={(e) => setItemSellPrice(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-800 text-[11px] px-3 py-1.5 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Customer */}
            <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4 space-y-3">
              <span className="text-[10px] uppercase font-mono font-black text-indigo-400 tracking-widest block">4. Initial Customer Profile</span>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">Company / Customer Name</label>
                  <input
                    type="text"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-[11px] px-3 py-1.5 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">TIN (Tax ID)</label>
                    <input
                      type="text"
                      value={custTin}
                      onChange={(e) => setCustTin(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-[11px] px-3 py-1.5 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">Phone Representative</label>
                    <input
                      type="text"
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-[11px] px-3 py-1.5 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">Billing / Delivery Address</label>
                  <input
                    type="text"
                    value={custAddress}
                    onChange={(e) => setCustAddress(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-[11px] px-3 py-1.5 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-[11px] px-3 py-1.5 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>
            </div>

          </div>

          <p className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
            <HelpCircle className="h-3.5 w-3.5 text-slate-650" />
            Proceeding will purge all active purchase orders, sales transactions, stock transfer logs, and machine profiles.
          </p>

        </form>

        {/* Footer */}
        <div className="flex border-t border-slate-800 px-6 py-4 justify-between items-center bg-slate-900/40">
          <button
            type="button"
            onClick={onClose}
            className="border border-slate-800 text-slate-400 hover:text-white font-mono text-[11px] px-4 py-2 rounded-lg hover:bg-slate-900 transition-colors"
          >
            Cancel Wizard
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-[11px] px-5 py-2 rounded-lg transition-all shadow-md active:scale-95"
          >
            Wipe & Initialize Custom Setup
          </button>
        </div>

      </div>
    </div>
  );
};
