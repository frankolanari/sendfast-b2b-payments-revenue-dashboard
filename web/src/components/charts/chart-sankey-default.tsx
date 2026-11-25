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
  SankeyChart,
  type SankeyData,
  SankeyLink,
  SankeyNode,
  SankeyTooltip,
} from "@/components/ui/charts";

const chartData: SankeyData = {
  links: [
    { source: 0, target: 6, value: 4200 },
    { source: 0, target: 9, value: 2800 },
    { source: 0, target: 7, value: 1500 },
    { source: 1, target: 7, value: 3100 },
    { source: 1, target: 8, value: 2200 },
    { source: 1, target: 6, value: 800 },
    { source: 2, target: 6, value: 2800 },
    { source: 2, target: 10, value: 1900 },
    { source: 2, target: 8, value: 600 },
    { source: 3, target: 7, value: 2100 },
    { source: 3, target: 8, value: 1400 },
    { source: 3, target: 6, value: 900 },
    { source: 4, target: 6, value: 1800 },
    { source: 4, target: 9, value: 1200 },
    { source: 4, target: 7, value: 700 },
    { source: 5, target: 10, value: 3500 },
    { source: 5, target: 7, value: 1800 },
    { source: 5, target: 8, value: 1100 },
    { source: 6, target: 11, value: 2100 },
    { source: 6, target: 12, value: 4800 },
    { source: 6, target: 13, value: 3600 },
    { source: 7, target: 11, value: 4500 },
    { source: 7, target: 12, value: 3200 },
    { source: 7, target: 13, value: 1500 },
    { source: 8, target: 11, value: 2800 },
    { source: 8, target: 12, value: 1900 },
    { source: 8, target: 13, value: 600 },
    { source: 9, target: 11, value: 800 },
    { source: 9, target: 12, value: 2400 },
    { source: 9, target: 13, value: 800 },
    { source: 10, target: 11, value: 1200 },
    { source: 10, target: 12, value: 1800 },
    { source: 10, target: 13, value: 2400 },
  ],
  nodes: [
    { category: "source", name: "Organic Search" },
    { category: "source", name: "Paid Search" },
    { category: "source", name: "Paid Social" },
    { category: "source", name: "Email" },
    { category: "source", name: "Referral" },
    { category: "source", name: "Direct" },
    { category: "landing", name: "Blog" },
    { category: "landing", name: "Pricing" },
    { category: "landing", name: "Product" },
    { category: "landing", name: "Docs" },
    { category: "landing", name: "Homepage" },
    { category: "outcome", name: "Converted" },
    { category: "outcome", name: "Engaged" },
    { category: "outcome", name: "Bounced" },
  ],
};

/** Room beside the outer columns for the node names and totals. */
const chartMargin = { left: 120, right: 120 };

export const ChartSankeyDefault = () => (
  <Card>
    <CardHeader>
      <CardTitle>Sankey Chart</CardTitle>
      <CardDescription>
        Sessions by source, landing page and outcome, October 2026
      </CardDescription>
    </CardHeader>
    <CardContent className="overflow-x-auto">
      <SankeyChart
        ariaLabel="Sankey Chart"
        aspectRatio="16 / 9"
        className="min-w-xl"
        data={chartData}
        margin={chartMargin}
      >
        <SankeyLink />
        <SankeyNode />
        <SankeyTooltip />
      </SankeyChart>
    </CardContent>
    <CardFooter className="flex-col items-start gap-2 text-sm">
      <div className="flex gap-2 font-medium leading-none">
        33% of sessions converted{" "}
        <TrendingUp aria-hidden="true" className="size-4" />
      </div>
      <div className="text-muted-foreground leading-none">
        34,400 sessions from six sources this month
      </div>
    </CardFooter>
  </Card>
);

export default ChartSankeyDefault;
