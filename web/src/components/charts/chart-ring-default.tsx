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
import { Ring, RingCenter, RingChart } from "@/components/ui/charts";

const chartData = [
  { label: "Organic", maxValue: 5000, value: 4250 },
  { label: "Paid", maxValue: 5000, value: 3120 },
  { label: "Email", maxValue: 5000, value: 2100 },
  { label: "Social", maxValue: 5000, value: 1580 },
  { label: "Referral", maxValue: 5000, value: 1050 },
];

export const ChartRingDefault = () => (
  <Card>
    <CardHeader>
      <CardTitle>Ring Chart</CardTitle>
      <CardDescription>
        Sessions by channel against a 5,000 goal, October 2026
      </CardDescription>
    </CardHeader>
    <CardContent>
      <RingChart
        ariaLabel="Ring Chart"
        className="mx-auto"
        data={chartData}
        size={300}
      >
        {chartData.map((item, index) => (
          <Ring index={index} key={item.label} />
        ))}
        <RingCenter defaultLabel="Total Sessions" />
      </RingChart>
    </CardContent>
    <CardFooter className="flex-col items-start gap-2 text-sm">
      <div className="flex gap-2 font-medium leading-none">
        Organic reached 85% of its goal{" "}
        <TrendingUp aria-hidden="true" className="size-4" />
      </div>
      <div className="text-muted-foreground leading-none">
        12,100 sessions across five channels
      </div>
    </CardFooter>
  </Card>
);

export default ChartRingDefault;
