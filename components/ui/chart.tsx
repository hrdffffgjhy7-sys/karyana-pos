"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

export interface ChartPoint {
  label: string;
  sales: number;
  profit?: number;
  bills?: number;
}

function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

export function BarChart({
  data,
  height = 220,
  className,
}: {
  data: ChartPoint[];
  height?: number;
  className?: string;
}) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const padL = 44;
  const padR = 8;
  const padT = 16;
  const padB = 26;

  const d = useMemo(() => {
    const max = Math.max(...data.map((p) => p.sales), 1);
    const w = Math.max(width - padL - padR, 10);
    const h = height - padT - padB;
    const step = w / Math.max(data.length, 1);
    const barW = Math.min(Math.max(step * 0.6, 3), 28);

    const y = (v: number) => padT + h - (v / max) * h;
    const x = (i: number) => padL + step * i + (step - barW) / 2;

    const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      y: padT + h - f * h,
      label: formatNumber(max * f),
    }));

    return { max, w, h, step, barW, y, x, grid };
  }, [data, width, height]);

  if (!width) return <div ref={ref} className={cn("w-full", className)} />;

  return (
    <div ref={ref} className={cn("w-full", className)}>
      <svg width={width} height={height} className="overflow-visible">
        {d.grid.map((g, i) => (
          <line key={i} x1={padL} x2={width - padR} y1={g.y} y2={g.y} stroke="currentColor" className="text-muted/40" strokeWidth={1} />
        ))}
        {d.grid.map((g, i) => (
          <text key={i} x={padL - 6} y={g.y + 3} textAnchor="end" fontSize={10} className="fill-muted-foreground">
            {g.label}
          </text>
        ))}
        {data.map((p, i) => {
          const barH = p.sales === 0 ? 2 : Math.max((p.sales / d.max) * d.h, 2);
          const bY = padT + d.h - barH;
          const fill = "url(#barGrad)";
          return (
            <g key={i}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(158 60% 32%)" />
                  <stop offset="100%" stopColor="hsl(160 55% 45%)" stopOpacity="0.75" />
                </linearGradient>
              </defs>
              <rect x={d.x(i)} y={bY} width={d.barW} height={barH} rx={4} fill={fill}>
                <title>{`${p.label}: ${formatNumber(p.sales)}`}</title>
              </rect>
              <text x={d.x(i) + d.barW / 2} y={height - 8} textAnchor="middle" fontSize={9} className="fill-muted-foreground">
                {p.label.split(",")[0]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function AreaChart({
  data,
  height = 220,
  className,
}: {
  data: ChartPoint[];
  height?: number;
  className?: string;
}) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const padL = 44;
  const padR = 8;
  const padT = 16;
  const padB = 26;

  const d = useMemo(() => {
    const max = Math.max(...data.map((p) => p.sales), 1);
    const w = Math.max(width - padL - padR, 10);
    const h = height - padT - padB;
    const step = w / Math.max(data.length - 1, 1);
    const pts = data.map((p, i) => ({
      x: padL + (data.length > 1 ? step * i : 0),
      y: padT + h - (p.sales / max) * h,
      ...p,
    }));
    return { max, w, h, pts, grid: [0, 0.5, 1].map((f) => ({ y: padT + h - f * h, label: formatNumber(max * f) })) };
  }, [data, width, height]);

  if (!width) return <div ref={ref} className={cn("w-full", className)} />;

  const line = d.pts.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `M ${d.pts[0]?.x ?? 0},${d.h + padT} L ${line} L ${d.pts[d.pts.length - 1]?.x ?? 0},${d.h + padT} Z`;

  return (
    <div ref={ref} className={cn("w-full", className)}>
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(158 60% 40%)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(158 60% 40%)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {d.grid.map((g, i) => (
          <g key={i}>
            <line x1={padL} x2={width - padR} y1={g.y} y2={g.y} stroke="currentColor" className="text-muted/40" strokeWidth={1} />
            <text x={padL - 6} y={g.y + 3} textAnchor="end" fontSize={10} className="fill-muted-foreground">
              {g.label}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#areaGrad)" />
        <polyline points={line} fill="none" stroke="hsl(158 60% 34%)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {d.pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="hsl(158 60% 34%)" stroke="hsl(var(--background))" strokeWidth={1.5}>
            <title>{`${p.label}: ${formatNumber(p.sales)}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}