"use client";

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

interface Business {
  id: string;
  name: string;
  plan: string;
  is_active: boolean;
  created_at: string;
  restaurant_count: number;
}

export function AdminOverviewCharts({ businesses }: { businesses: Business[] }) {
  // Plan distribution
  const planCounts = businesses.reduce((acc, b) => {
    acc[b.plan] = (acc[b.plan] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const planData = Object.entries(planCounts).map(([name, value]) => ({ name, value }));

  // Active vs suspended
  const activeCount = businesses.filter((b) => b.is_active).length;
  const suspendedCount = businesses.length - activeCount;
  const statusData = [
    { name: "Active", value: activeCount },
    { name: "Suspended", value: suspendedCount },
  ];

  // Business growth over time (group by month)
  const growthMap = new Map<string, number>();
  businesses.forEach((b) => {
    const month = b.created_at.slice(0, 7);
    growthMap.set(month, (growthMap.get(month) || 0) + 1);
  });
  const growthData = Array.from(growthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));

  // Restaurants per plan
  const restaurantsByPlan = businesses.reduce((acc, b) => {
    acc[b.plan] = (acc[b.plan] || 0) + b.restaurant_count;
    return acc;
  }, {} as Record<string, number>);
  const restaurantData = Object.entries(restaurantsByPlan).map(([name, value]) => ({ name, value }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={planData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {planData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active vs suspended</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={statusData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business growth</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={growthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Restaurants by plan</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={restaurantData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

