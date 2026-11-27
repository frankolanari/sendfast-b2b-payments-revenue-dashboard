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
import { contributionWeeks } from "@/components/charts/data/contributions";
import {
  HeatmapCells,
  HeatmapChart,
  type HeatmapColumn,
  HeatmapInteractionBoundary,
  HeatmapInteractionProvider,
  HeatmapLegend,
  HeatmapTooltip,
  HeatmapXAxis,
  HeatmapYAxis,
} from "@/components/ui/charts";

const chartData: HeatmapColumn[] = contributionWeeks.map((days, week) => ({
  bin: week,
  bins: days.map((count, day) => ({
    bin: day,
    count,
    date: new Date(2025, 10, 2 + week * 7 + day),
  })),
}));

const totalContributions = contributionWeeks
  .flat()
  .reduce((sum, count) => sum + count, 0);

export const ChartHeatmapDefault = () => (
  <Card>
    <CardHeader>
      <CardTitle>Heatmap Chart</CardTitle>
      <CardDescription>
        Daily contributions, November 2025 to October 2026
      </CardDescription>
    </CardHeader>
    <CardContent>
      <HeatmapInteractionProvider>
        <HeatmapInteractionBoundary className="flex flex-col gap-3">
          <HeatmapChart ariaLabel="Heatmap Chart" data={chartData}>
            <HeatmapCells inactiveOpacity={1} inactiveScale={1} />
            <HeatmapXAxis />
            <HeatmapYAxis />
            <HeatmapTooltip instant />
          </HeatmapChart>
          <HeatmapLegend inactiveOpacity={1} inactiveScale={1} />
        </HeatmapInteractionBoundary>
      </HeatmapInteractionProvider>
    </CardContent>
    <CardFooter className="flex-col items-start gap-2 text-sm">
      <div className="flex gap-2 font-medium leading-none">
        {totalContributions.toLocaleString("en-US")} contributions in the last
        year <TrendingUp aria-hidden="true" className="size-4" />
      </div>
      <div className="text-muted-foreground leading-none">
        One cell per day, one column per week, Sunday first
      </div>
    </CardFooter>
  </Card>
);

export default ChartHeatmapDefault;
