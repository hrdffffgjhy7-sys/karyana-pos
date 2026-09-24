"use client";

import * as React from "react";
import Link from "next/link";
import {
  Banknote,
  Receipt,
  Users,
  Package,
  HandCoins,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { Shell } from "@/components/layout/shell";
import { useSettings } from "@/hooks/use-settings";
import { getDashboardStats, getSalesSeries, getLatestBills, type DayPoint } from "@/db/stats";
import type { DashboardStats, Bill } from "@/types";
import { formatMoney, relativeTime } from "@/lib/format";
import { StatCard } from "@/components/ui/stat-card";
import { AreaChart } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { settings } = useSettings();
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [seriesToday, setSeriesToday] = React.useState<DayPoint[]>([]);
  const [series7, setSeries7] = React.useState<DayPoint[]>([]);
  const [series30, setSeries30] = React.useState<DayPoint[]>([]);
  const [latest, setLatest] = React.useState<Bill[]>([]);

  React.useEffect(() => {
    (async () => {
      const [s, t, s7, s30, l] = await Promise.all([
        getDashboardStats(),
        getSalesSeries(6),
        getSalesSeries(7),
        getSalesSeries(30),
        getLatestBills(6),
      ]);
      setStats(s);
      setSeriesToday(t);
      setSeries7(s7);
      setSeries30(s30);
      setLatest(l);
    })();
  }, []);

  const sym = settings?.currencySymbol || "Rs.";

  return (
    <Shell>
      <PageHeader
        title="IMRAN ARAIN KARYANA — Dashboard"
        subtitle="Today's overview of sales, customers, udhaar and inventory."
      />

      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Today's Sales" value={formatMoney(stats.todaySales, settings ?? undefined)} icon={<Banknote />} accent="green" onClick={() => (window.location.href = "/bills")} />
          <StatCard label="Today's Bills" value={String(stats.todayBills)} icon={<Receipt />} accent="blue" onClick={() => (window.location.href = "/bills")} />
          <StatCard label="Today's Profit" value={formatMoney(stats.todayProfit, settings ?? undefined)} icon={<TrendingUp />} accent="default" />
          <StatCard label="Total Customers" value={String(stats.totalCustomers)} icon={<Users />} onClick={() => (window.location.href = "/customers")} />
          <StatCard label="Total Products" value={String(stats.totalProducts)} icon={<Package />} onClick={() => (window.location.href = "/products")} />
          <StatCard label="Total Udhaar" value={formatMoney(stats.totalUdhaar, settings ?? undefined)} icon={<HandCoins />} accent="red" onClick={() => (window.location.href = "/udhaar")} />
          <StatCard
            label="Low Stock Products"
            value={String(stats.lowStockProducts)}
            icon={<AlertTriangle />}
            accent={stats.lowStockProducts > 0 ? "amber" : "default"}
            onClick={() => (window.location.href = "/products")}
          />
          <StatCard label="Total Bills" value={String(stats.billCount)} icon={<Receipt />} onClick={() => (window.location.href = "/bills")} />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sales Charts</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="today">
              <TabsList>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="7">Last 7 Days</TabsTrigger>
                <TabsTrigger value="30">Last 30 Days</TabsTrigger>
              </TabsList>
              <TabsContent value="today">
                <AreaChart data={seriesToday} height={240} />
              </TabsContent>
              <TabsContent value="7">
                <AreaChart data={series7} height={240} />
              </TabsContent>
              <TabsContent value="30">
                <AreaChart data={series30} height={240} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Today's Bills</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/bills">
                View all <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {latest.length === 0 ? (
              <EmptyState title="No bills yet" description="Create your first bill from the New Bill screen." action={<Button asChild><Link href="/bill/new">New Bill</Link></Button>} />
            ) : (
              <div className="space-y-2">
                {latest.map((b) => (
                  <Link key={b.id} href="/bills" className="flex items-center justify-between rounded-lg border p-2.5 transition-colors hover:bg-muted/50">
                    <div>
                      <p className="text-sm font-semibold">{b.invoiceNo}</p>
                      <p className="text-xs text-muted-foreground">{b.customerName || "Walk-in Customer"} • {relativeTime(b.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{sym} {formatNumberShort(b.grandTotal)}</p>
                      <Badge variant={b.status === "Paid" ? "success" : "warning"}>{b.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild><Link href="/bill/new">+ New Bill (Ctrl+N)</Link></Button>
          <Button variant="outline" asChild><Link href="/customers">Customers</Link></Button>
          <Button variant="outline" asChild><Link href="/products">Products</Link></Button>
          <Button variant="outline" asChild><Link href="/udhaar">Udhaar</Link></Button>
          <Button variant="outline" asChild><Link href="/reports">Reports</Link></Button>
          <Button variant="outline" asChild><Link href="/downloads">Downloads</Link></Button>
        </CardContent>
      </Card>
    </Shell>
  );
}

function formatNumberShort(n: number) {
  if (n >= 100000) return (n / 100000).toFixed(1) + "L";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}