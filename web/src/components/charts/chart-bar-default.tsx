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
  Bar,
  BarChart,
  BarXAxis,
  ChartTooltip,
  Grid,
} from "@/components/ui/charts";

const chartData = [
  { month: "Jan", revenue: 12_000 },
  { month: "Feb", revenue: 15_500 },
  { month: "Mar", revenue: 11_000 },
  { month: "Apr", revenue: 18_500 },
  { month: "May", revenue: 16_800 },
  { month: "Jun", revenue: 21_200 },
];

export const ChartBarDefault = () => (
  <Card>
    <CardHeader>
      <CardTitle>Bar Chart</CardTitle>
      <CardDescription>Monthly revenue, January to June 2026</CardDescription>
    </CardHeader>
    <CardContent>
      <BarChart
        ariaLabel="Bar Chart"
        aspectRatio="2 / 1"
        data={chartData}
        xDataKey="month"
      >
        <Grid horizontal />
        <Bar dataKey="revenue" label="Revenue" />
        <BarXAxis />
        <ChartTooltip />
      </BarChart>
    </CardContent>
    <CardFooter className="flex-col items-start gap-2 text-sm">
      <div className="flex gap-2 font-medium leading-none">
        Revenue up 77% since January{" "}
        <TrendingUp aria-hidden="true" className="size-4" />
      </div>
      <div className="text-muted-foreground leading-none">
        Total revenue per month for the first half of 2026
      </div>
    </CardFooter>
  </Card>
);

export default ChartBarDefault;
