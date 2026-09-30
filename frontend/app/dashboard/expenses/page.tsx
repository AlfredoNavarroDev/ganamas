"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { getToken } from "@/lib/auth";
import { getActiveBusinessId } from "@/lib/business";
import { authFetch } from "@/lib/api";

type Expense = {
  id: string;
  amount: string;
  description: string;
  expensedAt: string;
};

function soles(amount: string): string {
  return `S/ ${amount}`;
}

function formatLimaDate(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function ExpensesPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);

  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
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
    loadExpenses(activeBusinessId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadExpenses(activeBusinessId: string) {
    setLoadError(null);
    try {
      const res = await authFetch(`/expenses?businessId=${activeBusinessId}`);
      if (!res.ok) {
        setLoadError("No se pudieron cargar tus gastos.");
        return;
      }
      const data = (await res.json()) as { data: Expense[]; total: number };
      setExpenses(data.data);
      setTotal(data.total);
    } catch {
      setLoadError("No se pudo conectar con el servidor. Probá de nuevo.");
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessId) return;
    setCreateError(null);
    setCreating(true);

    try {
      const res = await authFetch("/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, amount, description }),
      });
      if (!res.ok) {
        setCreateError("No se pudo registrar el gasto.");
        return;
      }
      const created = (await res.json()) as Expense;
      setExpenses((prev) => [created, ...(prev ?? [])]);
      setAmount("");
      setDescription("");
      toast("Gasto registrado");
    } catch {
      setCreateError("No se pudo conectar con el servidor. Probá de nuevo.");
    } finally {
      setCreating(false);
    }
  }

  if (!checked) return null;

  if (expenses === null && !loadError) {
    return (
      <main className="flex min-h-dvh flex-1 flex-col items-center px-6 py-16">
        <div className="flex w-full max-w-2xl flex-col gap-6">
          <Skeleton data-testid="expenses-skeleton" className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
    );
  }

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

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nuevo gasto</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="amount">Monto</Label>
                <Input
                  id="amount"
                  required
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              {createError ? (
                <Alert variant="destructive" aria-live="polite">
                  <AlertDescription>{createError}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" disabled={creating}>
                {creating ? "Agregando…" : "Agregar gasto"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Gastos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {expenses && expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no registraste gastos.</p>
            ) : null}

            {expenses?.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="flex flex-col">
                  <span className="font-medium">{expense.description}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatLimaDate(expense.expensedAt)}
                  </span>
                </div>
                <span className="font-medium">{soles(expense.amount)}</span>
              </div>
            ))}

            {expenses && total !== null && total > expenses.length ? (
              <p className="text-sm text-muted-foreground">
                Mostrando {expenses.length} de {total} gastos.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
