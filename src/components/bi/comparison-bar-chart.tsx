"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface ComparisonDataPoint {
  label: string;
  corrente: number;
  precedente: number;
}

interface ComparisonBarChartProps {
  title: string;
  data: ComparisonDataPoint[];
  height?: number;
  correnteLabel?: string;
  precedenteLabel?: string;
}

export function ComparisonBarChart({
  title,
  data,
  height = 300,
  correnteLabel = "Periodo corrente",
  precedenteLabel = "Periodo precedente",
}: ComparisonBarChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
            <Tooltip formatter={(value) => [`€ ${Number(value).toLocaleString("it-IT")}`, ""]} />
            <Legend iconType="square" iconSize={10} />
            <Bar dataKey="corrente" name={correnteLabel} fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="precedente" name={precedenteLabel} fill="#93c5fd" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
