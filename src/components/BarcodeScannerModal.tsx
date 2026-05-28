/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Item, Warehouse } from '../types';
import { X, Search, Camera, QrCode, AlertCircle, ShoppingBag, ArrowRight, ShieldCheck } from 'lucide-react';
import jsQR from 'jsqr';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  warehouses: Warehouse[];
  onNavigate: (tab: string) => void;
  onAdjustStock?: (
    itemId: string,
    warehouseId: string,
    adjustmentType: 'add' | 'remove' | 'set',
    qty: number,
    reason: string
  ) => void;
  canAdjustStock?: boolean;
}

const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  items,
  warehouses,
  onNavigate,
  onAdjustStock,
  canAdjustStock = false,
}) => {
  if (!isOpen) return null;

  const [activeMode, setActiveMode] = useState<'text' | 'camera'>('text');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [matchedItem, setMatchedItem] = useState<Item | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Manual adjustment form inside scanner
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(warehouses[0]?.id || '');
  const [adjType, setAdjType] = useState<'add' | 'remove' | 'set'>('add');
  const [adjQty, setAdjQty] = useState(1);
  const [adjReason, setAdjReason] = useState('Warehouse barcode scanning adjustment');
  const [adjustmentStatus, setAdjustmentStatus] = useState<string | null>(null);

  // Camera elements
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Search/Input Match
  const handleKeyboardLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const query = barcodeInput.trim().toUpperCase();
    if (!query) return;

    // Search by SKU, ID, or lot reference
    const found = items.find(
      (it) =>
        it.sku.toUpperCase() === query ||
        it.id.toUpperCase() === query ||
        it.name.toUpperCase().includes(query)
    );

    if (found) {
      setMatchedItem(found);
      setCameraError(null);
    } else {
      setMatchedItem(null);
      setCameraError(`Could not find items fitting SKU/Barcode: "${query}"`);
    }
  };

  const handleSelectMatchedItem = (item: Item) => {
    setMatchedItem(item);
    setBarcodeInput(item.sku);
  };

  // Camera stream handler
  useEffect(() => {
    if (activeMode !== 'camera' || !isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [activeMode, isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
        videoRef.current.play();
        animationFrameRef.current = requestAnimationFrame(scanQRCodeFrame);
      }
    } catch (err: any) {
      console.error('Camera access failed:', err);
      setCameraError('Permission to access device camera was denied or unsupported in this view.');
      setActiveMode('text');
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const scanQRCodeFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code) {
          const barcodeValue = code.data.trim();
          setBarcodeInput(barcodeValue);
          
          // Attempt lookup immediately
          const found = items.find(
            (it) =>
              it.sku.toUpperCase() === barcodeValue.toUpperCase() ||
              it.id.toUpperCase() === barcodeValue.toUpperCase()
          );

          if (found) {
            setMatchedItem(found);
            // Play physical success beep or set visual state
            setActiveMode('text');
            stopCamera();
            return;
          }
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(scanQRCodeFrame);
  };

  const executeAdjustment = () => {
    if (!matchedItem || !onAdjustStock) return;
    onAdjustStock(matchedItem.id, selectedWarehouseId, adjType, adjQty, adjReason);
    setAdjustmentStatus(`Successfully adjusted ${matchedItem.name} inventory by ${adjType === 'add' ? '+' : adjType === 'remove' ? '-' : '='}${adjQty}`);
    setTimeout(() => setAdjustmentStatus(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col text-slate-100 max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-900/40">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-mono uppercase tracking-wider font-extrabold text-white">Interactive Sku & Serial Scanner</h3>
              <p className="text-[11px] text-slate-400">Scan QR codes/Barcodes or simulate keypad scanner lookups</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 bg-slate-950/50">
          <button
            onClick={() => setActiveMode('text')}
            className={`flex-1 py-3 text-xs font-mono uppercase font-bold tracking-wider border-b-2 text-center transition-all ${
              activeMode === 'text'
                ? 'border-indigo-500 text-white bg-slate-900/30'
                : 'border-transparent text-slate-400 hover:text-slate-205'
            }`}
          >
            Keyboard SKU Input & Lookup
          </button>
          <button
            onClick={() => setActiveMode('camera')}
            className={`flex-1 py-3 text-xs font-mono uppercase font-bold tracking-wider border-b-2 text-center transition-all flex items-center justify-center gap-2 ${
              activeMode === 'camera'
                ? 'border-indigo-500 text-white bg-slate-900/30'
                : 'border-transparent text-slate-400 hover:text-slate-205'
            }`}
          >
            <Camera className="h-4 w-4 text-indigo-400" />
            Live Device Camera QR Scanner
          </button>
        </div>

        {/* Content Box */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {cameraError && (
            <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-xl flex items-start gap-2.5 text-[11px] text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 animate-pulse" />
              <span>{cameraError}</span>
            </div>
          )}

          {adjustmentStatus && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-900/60 rounded-xl flex items-start gap-2.5 text-[11px] text-emerald-300 font-mono">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{adjustmentStatus}</span>
            </div>
          )}

          {activeMode === 'text' ? (
            <div className="space-y-4">
              <form onSubmit={handleKeyboardLookup} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Enter SKU Code (e.g. EQ-MIN-REXC360, EQ-COMP-X200) or Name..."
                    className="w-full bg-slate-950 border border-slate-800 text-xs pl-9 pr-4 py-2.5 rounded-xl text-white focus:outline-none focus:border-indigo-500 placeholder-slate-600 font-mono"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-550 text-white text-[11px] font-mono px-5 py-2.5 rounded-xl transition-all"
                >
                  Lookup Code
                </button>
              </form>

              {/* Sample list helper */}
              {!matchedItem && (
                <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4">
                  <span className="text-[10px] uppercase font-mono font-black text-indigo-400 tracking-wider mb-2.5 block">Suggested SKU Warehouse Quick Test Items</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.slice(0, 4).map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => handleSelectMatchedItem(it)}
                        className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg hover:border-indigo-500 text-left transition-all flex items-center justify-between"
                      >
                        <div>
                          <p className="text-[11px] font-bold text-white leading-tight">{it.name}</p>
                          <p className="text-[9px] font-mono text-indigo-400 mt-1">{it.sku}</p>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{it.brand}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative border-4 border-indigo-500/25 rounded-2xl overflow-hidden bg-black aspect-video w-full max-w-md h-64 flex items-center justify-center">
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
                
                {/* Visual scanner guides */}
                <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none">
                  <div className="flex justify-between">
                    <div className="border-t-4 border-l-4 border-indigo-400 w-6 h-6 rounded-tl-lg" />
                    <div className="border-t-4 border-r-4 border-indigo-400 w-6 h-6 rounded-tr-lg" />
                  </div>
                  <div className="w-full h-0.5 bg-indigo-500/80 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-bounce" />
                  <div className="flex justify-between">
                    <div className="border-b-4 border-l-4 border-indigo-400 w-6 h-6 rounded-bl-lg" />
                    <div className="border-b-4 border-r-4 border-indigo-400 w-6 h-6 rounded-br-lg" />
                  </div>
                </div>

                <div className="absolute bottom-3 bg-slate-950/80 px-3 py-1 rounded-full border border-slate-800 text-[10px] font-mono text-slate-300">
                  Align physical QR code within scanner bounds
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveMode('text')}
                className="text-[11px] font-mono text-slate-400 hover:text-white"
              >
                ← Switch back to manual entry option
              </button>
            </div>
          )}

          {/* Matched Item Details Panel */}
          {matchedItem && (
            <div className="bg-slate-950 border border-indigo-950 rounded-xl p-5 space-y-4 animate-in slide-in-from-bottom duration-200">
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <div className="p-2.5 bg-indigo-950/40 border border-indigo-900/30 rounded-lg shrink-0">
                    <ShoppingBag className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold uppercase font-mono tracking-wider text-slate-100">{matchedItem.name}</h4>
                    <span className="inline-block mt-1 font-mono text-[10px] font-bold bg-indigo-950 px-2 py-0.5 text-indigo-300 rounded border border-indigo-900">
                      SKU Ref: {matchedItem.sku}
                    </span>
                    <span className="inline-block mt-1 ml-2 font-mono text-[10px] font-bold bg-slate-900 px-2 py-0.5 text-slate-300 rounded border border-slate-800">
                      Cat: {matchedItem.category}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 font-mono">Retail Value</p>
                  <p className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                    ₱{matchedItem.sellingPrice?.toLocaleString() || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Stock quantities across sites */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2 border-t border-b border-slate-850">
                {warehouses.map((wh) => {
                  const stock = matchedItem.stockByWarehouse?.[wh.id] || 0;
                  return (
                    <div key={wh.id} className="p-2 bg-slate-900/50 rounded border border-slate-800">
                      <p className="text-[9px] font-mono text-slate-400 truncate">{wh.name}</p>
                      <p className="text-[12px] font-mono font-bold mt-0.5 text-white">{stock} {matchedItem.unit}</p>
                    </div>
                  );
                })}
              </div>

              {/* Adjust Stock Panel (if user has permissions) */}
              {canAdjustStock && onAdjustStock ? (
                <div className="p-3 bg-slate-900/40 rounded-lg border border-slate-850 space-y-3">
                  <span className="text-[10px] uppercase font-mono font-black text-indigo-400 tracking-wider block">Scan Reconciliation Adjustment Form</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[9px] font-mono text-slate-400 uppercase block mb-1">Target Site</label>
                      <select
                        value={selectedWarehouseId}
                        onChange={(e) => setSelectedWarehouseId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-[10px] px-2.5 py-1.5 rounded text-white focus:outline-none"
                      >
                        {warehouses.map((wh) => (
                          <option key={wh.id} value={wh.id}>
                            {wh.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-mono text-slate-400 uppercase block mb-1">Type</label>
                      <select
                        value={adjType}
                        onChange={(e) => setAdjType(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 text-[10px] px-2.5 py-1.5 rounded text-white focus:outline-none"
                      >
                        <option value="add">Add (+)</option>
                        <option value="remove">Deduct (-)</option>
                        <option value="set">Set (=)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-mono text-slate-400 uppercase block mb-1">Volume Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={adjQty}
                        onChange={(e) => setAdjQty(parseInt(e.target.value) || 1)}
                        className="w-full bg-slate-950 border border-slate-800 text-[10px] px-2.5 py-1.5 rounded text-white focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Input optional reasoning..."
                      value={adjReason}
                      onChange={(e) => setAdjReason(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 text-[10px] px-2.5 py-1.5 rounded text-white placeholder-slate-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={executeAdjustment}
                      className="bg-indigo-650 hover:bg-indigo-600 text-white font-mono text-[10px] font-bold px-3.5 rounded transition-all"
                    >
                      Post Adjust
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Navigation trigger options */}
              <div className="flex justify-end gap-2 text-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate('items');
                  }}
                  className="text-indigo-400 hover:text-white flex items-center gap-1 font-mono hover:bg-indigo-950/20 px-3 py-1.5 rounded"
                >
                  View Details in Catalog <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-slate-800 bg-slate-900/40">
          <p className="text-[10px] text-slate-500 font-mono">
            Scanning powered by Equiprime Heavy Hub Engine & jsQR library
          </p>
          <button
            onClick={onClose}
            className="border border-slate-800 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-[11px] font-mono hover:bg-slate-950 transition-colors"
          >
            Close Scanner
          </button>
        </div>

      </div>
    </div>
  );
};

export default BarcodeScannerModal;
