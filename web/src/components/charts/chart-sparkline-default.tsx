"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  dailyOrders,
  dailyRevenue,
  dailyVisitors,
  type SparklinePoint,
} from "@/components/charts/data/sparkline-metrics";
import {
  AreaSparkline,
  BarSparkline,
  LineSparkline,
} from "@/components/ui/charts";

const compact = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  notation: "compact",
});

/** The hovered day of a series (its last when nothing is hovered): its date, figure and change since the first day. */
const readout = (data: SparklinePoint[], index: number | null) => {
  const point = data[index ?? data.length - 1];
  const change = ((point.value - data[0].value) / data[0].value) * 100;
  return {
    change: `${change >= 0 ? "↑" : "↓"} ${Math.abs(change).toFixed(1)}%`,
    color: change >= 0 ? "var(--chart-positive)" : "var(--chart-negative)",
    day: point.date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
    }),
    value: compact.format(point.value),
  };
};

export const ChartSparklineDefault = () => {
  const [revenueIndex, setRevenueIndex] = useState<number | null>(null);
  const [visitorsIndex, setVisitorsIndex] = useState<number | null>(null);
  const [ordersIndex, setOrdersIndex] = useState<number | null>(null);
  const revenue = useMemo(
    () => readout(dailyRevenue, revenueIndex),
    [revenueIndex]
  );
  const visitors = useMemo(
    () => readout(dailyVisitors, visitorsIndex),
    [visitorsIndex]
  );
  const orders = useMemo(
    () => readout(dailyOrders, ordersIndex),
    [ordersIndex]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sparkline</CardTitle>
        <CardDescription>
          Storefront, October 16 - November 8, 2026
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-baseline justify-between gap-2 text-muted-foreground text-xs">
            <span>Revenue</span>
            <span className="tabular-nums">{revenue.day}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-2xl tabular-nums">
              {`$${revenue.value}`}
            </span>
            <span
              className="text-xs tabular-nums"
              style={{ color: revenue.color }}
            >
              {revenue.change}
            </span>
          </div>
          <AreaSparkline
            ariaLabel="Sparkline: revenue"
            data={dailyRevenue}
            dataKey="value"
            height={40}
            hoverIndex={revenueIndex}
            onHoverChange={setRevenueIndex}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-baseline justify-between gap-2 text-muted-foreground text-xs">
            <span>Visitors</span>
            <span className="tabular-nums">{visitors.day}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-2xl tabular-nums">
              {visitors.value}
            </span>
            <span
              className="text-xs tabular-nums"
              style={{ color: visitors.color }}
            >
              {visitors.change}
            </span>
          </div>
          <LineSparkline
            ariaLabel="Sparkline: visitors"
            color="var(--chart-2)"
            data={dailyVisitors}
            dataKey="value"
            endDot
            height={40}
            hoverIndex={visitorsIndex}
            onHoverChange={setVisitorsIndex}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-baseline justify-between gap-2 text-muted-foreground text-xs">
            <span>Orders</span>
            <span className="tabular-nums">{orders.day}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-2xl tabular-nums">
              {orders.value}
            </span>
            <span
              className="text-xs tabular-nums"
              style={{ color: orders.color }}
            >
              {orders.change}
            </span>
          </div>
          <BarSparkline
            ariaLabel="Sparkline: orders"
            color="var(--chart-3)"
            data={dailyOrders}
            dataKey="value"
            height={40}
            hoverIndex={ordersIndex}
            onHoverChange={setOrdersIndex}
          />
        </div>
      </CardContent>
      <CardFooter className="text-muted-foreground text-sm">
        Hover a sparkline, or tab to it and use the arrow keys, to read a day
      </CardFooter>
    </Card>
  );
};

export default ChartSparklineDefault;
