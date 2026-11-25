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
import { FunnelChart, type FunnelStage } from "@/components/ui/charts";

const chartData: FunnelStage[] = [
  { displayValue: "12.4k", label: "Visitors", value: 12_400 },
  { displayValue: "6.8k", label: "Leads", value: 6800 },
  { displayValue: "3.2k", label: "Qualified", value: 3200 },
  { displayValue: "1.5k", label: "Proposals", value: 1500 },
  { displayValue: "620", label: "Closed", value: 620 },
];

export const ChartFunnelDefault = () => (
  <Card>
    <CardHeader>
      <CardTitle>Funnel Chart</CardTitle>
      <CardDescription>Sales pipeline, Q3 2026</CardDescription>
    </CardHeader>
    <CardContent>
      <FunnelChart
        ariaLabel="Funnel Chart"
        color="var(--chart-1)"
        data={chartData}
        layers={3}
      />
    </CardContent>
    <CardFooter className="flex-col items-start gap-2 text-sm">
      <div className="flex gap-2 font-medium leading-none">
        5% of visitors closed, up from 4.1% in Q2{" "}
        <TrendingUp aria-hidden="true" className="size-4" />
      </div>
      <div className="text-muted-foreground leading-none">
        July 1 to September 30, 2026
      </div>
    </CardFooter>
  </Card>
);

export default ChartFunnelDefault;
