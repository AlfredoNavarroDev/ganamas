"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getToken } from "@/lib/auth";
import { getActiveBusinessId } from "@/lib/business";
import { authFetch } from "@/lib/api";
import { limaTodayRange, limaWeekRange, limaMonthRange, type DateRange } from "@/lib/date-ranges";

type Tab = "day" | "week" | "month";

type Summary = {
  revenue: string;
  profit: string;
  count: number;
  avgTicket: string;
  topProduct: { productId: string; productName: string; profit: string } | null;
  byPaymentMethod: { paymentMethod: string; revenue: string }[];
};

type DayClosing = {
  id: string;
  closedDate: string;
  closedAt: string;
  snapshot: Summary;
};

type Business = { id: string; name: string; active: boolean; dailyProfitGoal: string | null };

const TABS: { key: Tab; label: string }[] = [
  { key: "day", label: "Día" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
];

function rangeForTab(tab: Tab): DateRange {
  if (tab === "day") return limaTodayRange();
  if (tab === "week") return limaWeekRange();
  return limaMonthRange();
}

function soles(amount: string): string {
  return `S/ ${amount}`;
}

function formatLimaTime(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function KpisPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>("day");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [todayClosing, setTodayClosing] = useState<DayClosing | null>(null);
  const [history, setHistory] = useState<DayClosing[] | null>(null);
  const [closing, setClosing] = useState(false);

  const [business, setBusiness] = useState<Business | null>(null);
  const [goalInput, setGoalInput] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const activeBusinessId = getActiveBusinessId();
    if (!activeBusinessId) {
      router.replace("/dashboard");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusinessId(activeBusinessId);
    setChecked(true);
    loadTodayClosing(activeBusinessId);
    loadHistory(activeBusinessId);
    loadBusiness(activeBusinessId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!businessId) return;
    loadSummary(businessId, activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, activeTab]);

  async function loadSummary(activeBusinessId: string, tab: Tab) {
    setSummary(null);
    setLoadError(null);
    try {
      const { from, to } = rangeForTab(tab);
      const res = await authFetch(
        `/reports/summary?businessId=${activeBusinessId}&from=${from}&to=${to}`,
      );
      if (!res.ok) {
        setLoadError("No se pudo cargar el resumen.");
        return;
      }
      const data = (await res.json()) as Summary;
      setSummary(data);
    } catch {
      setLoadError("No se pudo conectar con el servidor. Probá de nuevo.");
    }
  }

  async function loadTodayClosing(activeBusinessId: string) {
    try {
      const res = await authFetch(`/closings/today?businessId=${activeBusinessId}`);
      if (res.status === 404) {
        setTodayClosing(null);
        return;
      }
      if (!res.ok) return;
      setTodayClosing((await res.json()) as DayClosing);
    } catch {
      // El botón queda habilitado; el usuario puede reintentar el cierre.
    }
  }

  async function loadHistory(activeBusinessId: string) {
    try {
      const res = await authFetch(`/closings?businessId=${activeBusinessId}`);
      if (!res.ok) return;
      setHistory((await res.json()) as DayClosing[]);
    } catch {
      // El historial queda vacío; no es crítico para el flujo principal.
    }
  }

  async function loadBusiness(activeBusinessId: string) {
    try {
      const res = await authFetch(`/businesses?active=true`);
      if (!res.ok) return;
      const data = (await res.json()) as Business[];
      setBusiness(data.find((b) => b.id === activeBusinessId) ?? null);
    } catch {
      // La meta queda sin mostrar; no es crítico para el resto del dashboard.
    }
  }

  async function handleSaveGoal() {
    if (!business) return;
    setSavingGoal(true);
    try {
      const res = await authFetch(`/businesses/${business.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyProfitGoal: goalInput }),
      });
      if (!res.ok) {
        toast("No se pudo guardar la meta.", "destructive");
        return;
      }
      setBusiness((await res.json()) as Business);
      setGoalInput("");
    } catch {
      toast("No se pudo conectar con el servidor. Probá de nuevo.", "destructive");
    } finally {
      setSavingGoal(false);
    }
  }

  async function handleClose() {
    if (!businessId) return;
    setClosing(true);
    try {
      const res = await authFetch("/closings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      if (res.status === 409) {
        toast("El día ya estaba cerrado.", "destructive");
        loadTodayClosing(businessId);
        return;
      }
      if (!res.ok) {
        toast("No se pudo cerrar el día.", "destructive");
        return;
      }
      const created = (await res.json()) as DayClosing;
      setTodayClosing(created);
      setHistory((prev) => [created, ...(prev ?? [])]);
      toast("Día cerrado");
    } catch {
      toast("No se pudo conectar con el servidor. Probá de nuevo.", "destructive");
    } finally {
      setClosing(false);
    }
  }

  if (!checked) return null;

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center px-6 py-16">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← Volver
        </Link>

        {loadError ? (
          <Alert variant="destructive" aria-live="polite">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex gap-2">
          {TABS.map((tab) => (
            <Button
              key={tab.key}
              type="button"
              variant={activeTab === tab.key ? "default" : "outline"}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {summary === null && !loadError ? (
          <Skeleton data-testid="kpis-skeleton" className="h-64 w-full" />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumen</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">Ingresos</span>
                  <span className="text-lg font-medium" data-testid="kpi-revenue">
                    {soles(summary?.revenue ?? "0.00")}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">Ganancia</span>
                  <span className="text-lg font-medium" data-testid="kpi-profit">
                    {soles(summary?.profit ?? "0.00")}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">Ventas</span>
                  <span className="text-lg font-medium">{summary?.count ?? 0}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">Ticket promedio</span>
                  <span className="text-lg font-medium">{soles(summary?.avgTicket ?? "0.00")}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Producto top</CardTitle>
              </CardHeader>
              <CardContent>
                {summary?.topProduct ? (
                  <p>
                    {summary.topProduct.productName} · ganancia {soles(summary.topProduct.profit)}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin ventas en este período.</p>
                )}
              </CardContent>
            </Card>

            {activeTab === "day" && business ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Meta diaria</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {business.dailyProfitGoal ? (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {soles(summary?.profit ?? "0.00")} / {soles(business.dailyProfitGoal)}
                        </span>
                        <span className="font-medium">
                          {Math.min(
                            Math.round(
                              (Number(summary?.profit ?? 0) / Number(business.dailyProfitGoal)) * 100,
                            ),
                            100,
                          )}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${Math.min(
                              (Number(summary?.profit ?? 0) / Number(business.dailyProfitGoal)) * 100,
                              100,
                            )}%`,
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setGoalInput(business.dailyProfitGoal ?? "")}
                      >
                        Editar
                      </Button>
                    </>
                  ) : null}
                  {!business.dailyProfitGoal || goalInput ? (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="daily-goal">Meta diaria de ganancia</Label>
                      <Input
                        id="daily-goal"
                        inputMode="decimal"
                        value={goalInput}
                        onChange={(e) => setGoalInput(e.target.value)}
                      />
                      <Button type="button" disabled={savingGoal} onClick={handleSaveGoal}>
                        {savingGoal ? "Guardando…" : "Guardar meta"}
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Por método de pago</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {summary && summary.byPaymentMethod.length > 0 ? (
                  summary.byPaymentMethod.map((row) => (
                    <div key={row.paymentMethod} className="flex justify-between text-sm">
                      <span className="capitalize">{row.paymentMethod}</span>
                      <span>{soles(row.revenue)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sin ventas en este período.</p>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === "day" ? (
          <Button type="button" onClick={handleClose} disabled={closing || todayClosing !== null}>
            {todayClosing
              ? `Cerrado a las ${formatLimaTime(todayClosing.closedAt)}`
              : closing
                ? "Cerrando…"
                : "Cerrar día"}
          </Button>
        ) : null}

        <details className="rounded-2xl border border-[color:var(--glass-border)] bg-[var(--glass-bg)] p-4 backdrop-blur-[var(--glass-blur)]">
          <summary className="cursor-pointer text-sm font-medium">Historial de cierres</summary>
          <div className="mt-3 flex flex-col gap-2">
            {history && history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no cerraste ningún día.</p>
            ) : null}
            {history?.map((item, index) => (
              <div
                key={item.id}
                className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:fill-mode-backwards flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <span>{item.closedDate}</span>
                <span className="text-muted-foreground">
                  Ingresos {soles(item.snapshot.revenue)} · Ganancia {soles(item.snapshot.profit)}
                </span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </main>
  );
}