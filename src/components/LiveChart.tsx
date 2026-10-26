import React, { useState } from 'react';
import { ChartPoint } from '../services/marketData';
import { formatUSD } from '../utils/amsterdamTime';
import { Activity, ArrowUpRight, TrendingUp } from 'lucide-react';

interface LiveChartProps {
  data: ChartPoint[];
  currentPrice: number;
}

export const LiveChart: React.FC<LiveChartProps> = ({ data, currentPrice }) => {
  const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null);

  if (data.length === 0) return null;

  const prices = data.map((d) => d.price);
  const minPrice = Math.min(...prices) * 0.995;
  const maxPrice = Math.max(...prices) * 1.005;
  const range = maxPrice - minPrice;

  // SVG coordinate calculations
  const width = 600;
  const height = 180;
  const paddingX = 20;
  const paddingY = 25;

  const getX = (index: number) => paddingX + (index / (data.length - 1)) * (width - 2 * paddingX);
  const getY = (val: number) => height - paddingY - ((val - minPrice) / range) * (height - 2 * paddingY);

  // Build SVG path for primary trend line
  const pointsString = data
    .map((d, i) => `${getX(i).toFixed(1)},${getY(d.price).toFixed(1)}`)
    .join(' L ');
  const primaryPath = `M ${pointsString}`;

  // Area under line
  const areaPath = `${primaryPath} L ${getX(data.length - 1).toFixed(1)},${height - paddingY} L ${getX(0).toFixed(1)},${height - paddingY} Z`;

  // Secondary smoothed baseline wave matching mockup's dual line (yellow/orange wave)
  const secondaryPoints = data
    .map((d, i) => {
      const smoothed = d.price - 480 + Math.sin(i * 0.8) * 220;
      return `${getX(i).toFixed(1)},${getY(smoothed).toFixed(1)}`;
    })
    .join(' L ');
  const secondaryPath = `M ${secondaryPoints}`;

  const firstPrice = data[0].price;
  const priceChange = currentPrice - firstPrice;
  const priceChangePct = (priceChange / firstPrice) * 100;

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800/80 p-5 shadow-xl backdrop-blur-sm relative overflow-hidden group">
      {/* Header of Chart */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h2 className="text-sm font-bold text-slate-200 tracking-wide flex items-center gap-1.5">
            <span>Live line chart of last 7 days of Digital coin</span>
            <span className="text-xs font-mono font-normal text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-1.5 py-0.5 rounded">
              BTC / USD
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-base font-extrabold font-mono text-emerald-400 tabular-nums">
              {formatUSD(currentPrice)}
            </div>
            <div className="text-[11px] font-mono text-emerald-400/90 flex items-center justify-end gap-0.5">
              <TrendingUp className="w-3 h-3 inline" />
              <span>{priceChange >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}% (7d)</span>
            </div>
          </div>
        </div>
      </div>

      {/* SVG Canvas matching image.png wireframe with green and yellow flowing lines */}
      <div className="relative w-full aspect-[600/180]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
        >
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="emeraldStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
            <linearGradient id="orangeStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path d={areaPath} fill="url(#chartGradient)" />

          {/* Secondary trend line (yellow/gold) */}
          <path
            d={secondaryPath}
            fill="none"
            stroke="url(#orangeStroke)"
            strokeWidth="2"
            strokeDasharray="4 4"
            className="opacity-70"
          />

          {/* Primary trend line (emerald/cyan) */}
          <path
            d={primaryPath}
            fill="none"
            stroke="url(#emeraldStroke)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points on Hover */}
          {data.map((point, idx) => {
            const cx = getX(idx);
            const cy = getY(point.price);
            const isHovered = hoveredPoint?.time === point.time;

            return (
              <g key={idx} className="cursor-pointer">
                {isHovered && (
                  <line
                    x1={cx}
                    y1={paddingY}
                    x2={cx}
                    y2={height - paddingY}
                    stroke="rgba(148, 163, 184, 0.4)"
                    strokeDasharray="2 2"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 6 : 3}
                  className={`transition-all ${
                    isHovered
                      ? 'fill-cyan-300 stroke-slate-900 stroke-2'
                      : 'fill-emerald-400 opacity-60'
                  }`}
                  onMouseEnter={() => setHoveredPoint(point)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              </g>
            );
          })}
        </svg>

        {/* Hovered Price Tooltip */}
        {hoveredPoint && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-950/90 border border-cyan-500/50 rounded-lg px-3 py-1 shadow-lg pointer-events-none flex items-center gap-2">
            <span className="text-[11px] text-slate-400">{hoveredPoint.time}</span>
            <span className="text-xs font-mono font-bold text-cyan-300 tabular-nums">
              {formatUSD(hoveredPoint.price)}
            </span>
          </div>
        )}
      </div>

      {/* Axis Days Bar */}
      <div className="flex justify-between items-center text-[11px] font-mono text-slate-500 px-3 pt-2 border-t border-slate-800/60 mt-1">
        <span>7 Days Ago</span>
        <span>4 Days Ago</span>
        <span>2 Days Ago</span>
        <span className="text-emerald-400 font-semibold">Today (Live)</span>
      </div>
    </div>
  );
};
