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
  ChartTooltip,
  Grid,
  Line,
  LineChart,
  XAxis,
} from "@/components/ui/charts";

const chartData = [
  { date: new Date(2026, 9, 2), pageviews: 4500, users: 1200 },
  { date: new Date(2026, 9, 3), pageviews: 4800, users: 1350 },
  { date: new Date(2026, 9, 4), pageviews: 4200, users: 1100 },
  { date: new Date(2026, 9, 5), pageviews: 5100, users: 1450 },
  { date: new Date(2026, 9, 6), pageviews: 4900, users: 1380 },
  { date: new Date(2026, 9, 7), pageviews: 5400, users: 1520 },
  { date: new Date(2026, 9, 8), pageviews: 5800, users: 1600 },
  { date: new Date(2026, 9, 9), pageviews: 5200, users: 1480 },
  { date: new Date(2026, 9, 10), pageviews: 5500, users: 1550 },
  { date: new Date(2026, 9, 11), pageviews: 5000, users: 1420 },
  { date: new Date(2026, 9, 12), pageviews: 6100, users: 1680 },
  { date: new Date(2026, 9, 13), pageviews: 6400, users: 1750 },
  { date: new Date(2026, 9, 14), pageviews: 5900, users: 1620 },
  { date: new Date(2026, 9, 15), pageviews: 5700, users: 1580 },
  { date: new Date(2026, 9, 16), pageviews: 6200, users: 1720 },
  { date: new Date(2026, 9, 17), pageviews: 6800, users: 1850 },
  { date: new Date(2026, 9, 18), pageviews: 6500, users: 1780 },
  { date: new Date(2026, 9, 19), pageviews: 6000, users: 1650 },
  { date: new Date(2026, 9, 20), pageviews: 7100, users: 1920 },
  { date: new Date(2026, 9, 21), pageviews: 6900, users: 1880 },
  { date: new Date(2026, 9, 22), pageviews: 6400, users: 1750 },
  { date: new Date(2026, 9, 23), pageviews: 7300, users: 1980 },
  { date: new Date(2026, 9, 24), pageviews: 7600, users: 2050 },
  { date: new Date(2026, 9, 25), pageviews: 7100, users: 1920 },
  { date: new Date(2026, 9, 26), pageviews: 7800, users: 2100 },
  { date: new Date(2026, 9, 27), pageviews: 8100, users: 2180 },
  { date: new Date(2026, 9, 28), pageviews: 7600, users: 2050 },
  { date: new Date(2026, 9, 29), pageviews: 8400, users: 2250 },
  { date: new Date(2026, 9, 30), pageviews: 8700, users: 2320 },
  { date: new Date(2026, 9, 31), pageviews: 9000, users: 2400 },
];

export const ChartLineDefault = () => (
  <Card>
    <CardHeader>
      <CardTitle>Line Chart</CardTitle>
      <CardDescription>Users and pageviews, October 2026</CardDescription>
    </CardHeader>
    <CardContent>
      <LineChart ariaLabel="Line Chart" aspectRatio="2 / 1" data={chartData}>
        <Grid horizontal />
        <Line dataKey="users" label="Users" stroke="var(--chart-1)" />
        <Line dataKey="pageviews" label="Pageviews" stroke="var(--chart-2)" />
        <XAxis />
        <ChartTooltip />
      </LineChart>
    </CardContent>
    <CardFooter className="flex-col items-start gap-2 text-sm">
      <div className="flex gap-2 font-medium leading-none">
        Users up 100% this month{" "}
        <TrendingUp aria-hidden="true" className="size-4" />
      </div>
      <div className="text-muted-foreground leading-none">
        Daily users and pageviews for the last 30 days
      </div>
    </CardFooter>
  </Card>
);

export default ChartLineDefault;
