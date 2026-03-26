"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface TrendDataPoint {
  label: string;
  [key: string]: string | number;
}

interface TrendSeries {
  dataKey: string;
  name: string;
  color: string;
}

interface TrendChartProps {
  title: string;
  data: TrendDataPoint[];
  series: TrendSeries[];
  height?: number;
}

export function TrendChart({ title, data, series, height = 300 }: TrendChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
            <Tooltip
              formatter={(value: number) => [`€ ${value.toLocaleString("it-IT")}`, ""]}
              labelStyle={{ fontWeight: "bold" }}
            />
            <Legend iconType="circle" iconSize={8} />
            {series.map((s) => (
              <Line
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
