/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useState, useEffect } from 'react';
import * as d3 from 'd3';
import { Warehouse, Item, StockTransfer } from '../types';
import { Layers, AlertCircle, HelpCircle } from 'lucide-react';

interface WarehouseTreemapProps {
  warehouses: Warehouse[];
  items: Item[];
  onSelectWarehouse: (warehouseId: string | null) => void;
  onExecuteStockTransfer?: (transfer: Omit<StockTransfer, 'id' | 'transferNumber' | 'status'>) => void;
}

const WarehouseTreemap: React.FC<WarehouseTreemapProps> = ({
  warehouses,
  items,
  onSelectWarehouse,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 350 });

  // Handle ResizeObserver to keep fluid design
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries || !entries[0]) return;
      const { width } = entries[0].contentRect;
      // Guarantee adequate height for legible squares
      setDimensions({
        width: Math.max(width, 300),
        height: 350
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute Hierarchy dataset
  const treemapData = useMemo(() => {
    // Generate hierarchical tree node structure
    // Root -> Warehouses -> SKU Items
    const rootNodes: any = {
      name: "distribution",
      children: warehouses.map((wh) => {
        // Collect matches spanning this warehouse ID
        const children = items
          .map((item) => {
            const stock = item.stockByWarehouse?.[wh.id] || 0;
            return {
              name: item.name,
              sku: item.sku,
              value: stock,
              brand: item.brand,
              unit: item.unit,
              whId: wh.id,
              whName: wh.name,
            };
          })
          .filter((ch) => ch.value > 0);

        return {
          name: wh.name,
          id: wh.id,
          code: wh.code,
          children,
        };
      }).filter(whNode => whNode.children.length > 0)
    };

    if (rootNodes.children.length === 0) return null;

    // Build hierarchy with D3
    const hierarchy = d3.hierarchy(rootNodes)
      .sum((d: any) => d.value)
      .sort((a: any, b: any) => (b.value || 0) - (a.value || 0));

    // Initialize treemap engine
    const treemap = d3.treemap()
      .size([dimensions.width, dimensions.height])
      .paddingOuter(4)
      .paddingTop(24)
      .paddingInner(3)
      .round(true);

    treemap(hierarchy);
    return hierarchy;
  }, [warehouses, items, dimensions]);

  // Leaf Nodes rendering data list
  const leaves = useMemo(() => {
    if (!treemapData) return [];
    return treemapData.leaves();
  }, [treemapData]);

  // Warehouse Group Headings for rendering text overlay bounds
  const parents = useMemo(() => {
    if (!treemapData) return [];
    return treemapData.descendants().filter(d => d.depth === 1);
  }, [treemapData]);

  // Generates categorical color map for high-contrast presentation representation
  const colorScale = useMemo(() => {
    return d3.scaleOrdinal<string>()
      .domain(warehouses.map(w => w.id))
      .range([
        '#6366f1', // Indigo
        '#0ea5e9', // Sky Blue
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#8b5cf6', // Violet
        '#ec4899', // Pink
      ]);
  }, [warehouses]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-505" />
          <h3 className="text-xs font-mono uppercase font-extrabold text-gray-800 tracking-wider">
            Site Density D3 Stock Hotspot Treemap
          </h3>
          <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full">
            D3.js Tree Engine
          </span>
        </div>
        <p className="text-[11px] text-gray-400 font-medium">
          Box depth mirrors physical stockpile volume of individual machinery units.
        </p>
      </div>

      <div ref={containerRef} className="relative w-full overflow-hidden select-none bg-gray-50/50 rounded-xl border border-gray-100">
        {leaves.length === 0 ? (
          <div className="h-[350px] flex flex-col justify-center items-center text-center p-8 text-gray-400">
            <AlertCircle className="h-8 w-8 text-gray-300 mb-2" />
            <p className="text-xs font-mono uppercase">Inactive Stock levels across all depots</p>
            <p className="text-[10px] text-gray-400 mt-1">Please create inventory stock records via Purchase Receipts before density rendering can engage.</p>
          </div>
        ) : (
          <svg width={dimensions.width} height={dimensions.height} className="block overflow-hidden rounded-xl font-sans">
            {/* Outline rectangles for warehouse boundaries */}
            {parents.map((parent: any, idx) => {
              const whId = parent.data.id;
              const whCode = parent.data.code;
              const whName = parent.data.name;
              
              const x0 = parent.x0;
              const y0 = parent.y0;
              const x1 = parent.x1;
              const y1 = parent.y1;
              const width = Math.max(0, x1 - x0);
              const height = Math.max(0, y1 - y0);

              if (width < 30 || height < 30) return null;

              return (
                <g key={`parent-${whId}-${idx}`} className="cursor-pointer" onClick={() => onSelectWarehouse(whId)}>
                  <rect
                    x={x0}
                    y={y0}
                    width={width}
                    height={height}
                    fill="#f8fafc"
                    stroke="#e2e8f0"
                    strokeWidth="1.5"
                    className="hover:fill-slate-100 transition-colors duration-150"
                  />
                  {/* Category Title label */}
                  <text
                    x={x0 + 6}
                    y={y0 + 16}
                    fontSize="10"
                    fontWeight="bold"
                    fontFamily="font-mono"
                    className="fill-gray-600 uppercase tracking-widest font-mono select-none pointer-events-none"
                  >
                    🏢 {whName} ({whCode})
                  </text>
                </g>
              );
            })}

            {/* Render item leaf cells */}
            {leaves.map((leaf: any, idx) => {
              const x0 = leaf.x0;
              const y0 = leaf.y0;
              const x1 = leaf.x1;
              const y1 = leaf.y1;
              const width = Math.max(0, x1 - x0);
              const height = Math.max(0, y1 - y0);

              const itemData = leaf.data;
              const whId = itemData.whId;
              const value = itemData.value;
              const sku = itemData.sku;
              const name = itemData.name;
              const baseColor = colorScale(whId);

              if (width < 6 || height < 6) return null;

              return (
                <g
                  key={`leaf-${sku}-${idx}`}
                  className="cursor-pointer group"
                  onClick={() => onSelectWarehouse(whId)}
                >
                  {/* Item Rectangle Box */}
                  <rect
                    x={x0}
                    y={y0}
                    width={width}
                    height={height}
                    fill={baseColor}
                    fillOpacity="0.8"
                    stroke="#ffffff"
                    strokeWidth="1"
                    className="hover:fill-opacity-95 transition-opacity"
                  />
                  {/* Mini custom Tooltip simulation using HTML inside SVG if width allows or standard tooltips */}
                  <title>
                    {name} &#10;SKU Code: {sku} &#10;Depot quantity: {value} {itemData.unit}
                  </title>

                  {/* Cell Text Labels if box is large enough */}
                  {width > 45 && height > 35 && (
                    <g className="pointer-events-none select-none">
                      <text
                        x={x0 + 5}
                        y={y0 + 14}
                        fontSize="9"
                        fontWeight="black"
                        className="fill-white font-mono break-all"
                      >
                        {sku}
                      </text>
                      {height > 50 && (
                        <text
                          x={x0 + 5}
                          y={y0 + 26}
                          fontSize="9"
                          className="fill-indigo-50/85 truncate w-full"
                        >
                          {name.substring(0, Math.floor(width / 6))}
                        </text>
                      )}
                      <text
                        x={x0 + 5}
                        y={y1 - 6}
                        fontSize="10"
                        fontWeight="black"
                        className="fill-white font-mono"
                      >
                        {value} u.
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono text-gray-400 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
        <span className="font-bold uppercase tracking-wider text-gray-500">Color Reference Index:</span>
        {warehouses.map((wh) => (
          <div key={wh.id} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded shrink-0" style={{ backgroundColor: colorScale(wh.id) }} />
            <span>{wh.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WarehouseTreemap;
