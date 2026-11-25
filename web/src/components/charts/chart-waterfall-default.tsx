"use client";

import { TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarXAxis,
  BarYAxis,
  ChartTooltip,
  Grid,
  Waterfall,
  WaterfallChart,
} from "@/components/ui/charts";

const chartData = [
  { label: "FY 2025", total: true, value: 4200 },
  { label: "New logos", value: 1350 },
  { label: "Expansion", value: 620 },
  { label: "Pricing", value: 310 },
  { label: "Churn", value: -540 },
  { label: "Downgrades", value: -210 },
  { label: "FX", value: -90 },
  { label: "FY 2026", total: true },
];

const formatThousands = (value: number) =>
  `$${(value / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 })}M`;

export const ChartWaterfallDefault = () => (
  <Card>
    <CardHeader>
      <CardTitle>Waterfall Chart</CardTitle>
      <CardDescription>
        Annual recurring revenue, fiscal 2025 to 2026
      </CardDescription>
    </CardHeader>
    <CardContent>
      <WaterfallChart ariaLabel="Waterfall Chart" data={chartData}>
        <Grid horizontal />
        <Waterfall dataKey="value" formatValue={formatThousands} />
        <BarXAxis showAllLabels />
        <BarYAxis formatValue={formatThousands} />
        <ChartTooltip />
      </WaterfallChart>
    </CardContent>
    <CardFooter className="flex-col items-start gap-2 text-sm">
      <div className="flex gap-2 font-medium leading-none">
        Recurring revenue up 34% year over year{" "}
        <TrendingUp aria-hidden="true" className="size-4" />
      </div>
      <div className="text-muted-foreground leading-none">
        New logos added more than churn and downgrades took away
      </div>
    </CardFooter>
  </Card>
);

export default ChartWaterfallDefault;
