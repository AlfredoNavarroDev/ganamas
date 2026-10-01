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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { getToken } from "@/lib/auth";
import { getActiveBusinessId } from "@/lib/business";
import { authFetch } from "@/lib/api";

type Product = {
  id: string;
  name: string;
  unit: "unidad" | "kg";
  stock: string;
  avgCost: string;
};

type Purchase = {
  id: string;
  product: { id: string; name: string; unit: "unidad" | "kg" };
  quantity: string;
  unitCost: string;
  totalCost: string;
  purchasedAt: string;
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

export default function PurchasesPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[] | null>(null);
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const { toast } = useToast();

  const parsedQuantity = Number(quantity) || 0;
  const parsedUnitCost = Number(unitCost) || 0;
  const totalCost = parsedQuantity * parsedUnitCost;

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
    // Matches SSR (checked=false) to avoid hydration mismatch; flips after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusinessId(activeBusinessId);
    setChecked(true);
    loadProducts(activeBusinessId);
    loadPurchases(activeBusinessId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProducts(activeBusinessId: string) {
    try {
      const res = await authFetch(`/products?businessId=${activeBusinessId}&active=true`);
      if (!res.ok) return;
      const data = (await res.json()) as Product[];
      setProducts(data);
      if (data.length > 0) {
        setProductId((prev) => prev || data[0].id);
      }
    } catch {
      setLoadError("No se pudo conectar con el servidor. Probá de nuevo.");
    }
  }

  async function loadPurchases(activeBusinessId: string) {
    setLoadError(null);
    try {
      const res = await authFetch(`/purchases?businessId=${activeBusinessId}`);
      if (!res.ok) {
        setLoadError("No se pudieron cargar tus compras.");
        return;
      }
      const data = (await res.json()) as { data: Purchase[]; total: number };
      setPurchases(data.data);
      setTotal(data.total);
    } catch {
      setLoadError("No se pudo conectar con el servidor. Probá de nuevo.");
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessId || !productId) return;
    setCreateError(null);
    setCreating(true);

    try {
      const res = await authFetch("/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, productId, quantity, unitCost }),
      });
      if (!res.ok) {
        setCreateError("No se pudo registrar la compra.");
        return;
      }
      const created = (await res.json()) as Purchase;
      setPurchases((prev) => [created, ...(prev ?? [])]);
      setTotal((prev) => (prev ?? 0) + 1);
      setQuantity("");
      setUnitCost("");
      toast("Compra registrada");
      loadProducts(businessId);
    } catch {
      setCreateError("No se pudo conectar con el servidor. Probá de nuevo.");
    } finally {
      setCreating(false);
    }
  }

  if (!checked) return null;

  if (purchases === null && !loadError) {
    return (
      <main className="flex min-h-dvh flex-1 flex-col items-center px-6 py-16">
        <div className="flex w-full max-w-2xl flex-col gap-6">
          <Skeleton data-testid="purchases-skeleton" className="h-48 w-full" />
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
            <CardTitle className="text-lg">Nueva compra</CardTitle>
          </CardHeader>
          <CardContent>
            {products && products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Creá un producto primero para poder registrar compras.
              </p>
            ) : (
              <form onSubmit={handleCreate} className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="product">Producto</Label>
                  <Select value={productId} onValueChange={(value) => setProductId(value as string)}>
                    <SelectTrigger id="product">
                      <SelectValue>
                        {(value: string) => {
                          const product = products?.find((p) => p.id === value);
                          return product
                            ? `${product.name} (stock ${product.stock} ${product.unit})`
                            : value;
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} (stock {p.stock} {p.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="quantity">Cantidad comprada</Label>
                  <Input
                    id="quantity"
                    required
                    inputMode="decimal"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="unit-cost">Costo unitario</Label>
                  <Input
                    id="unit-cost"
                    required
                    inputMode="decimal"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
                  <span className="text-sm text-muted-foreground">Total pagado</span>
                  <span className="text-2xl font-bold text-primary">
                    {soles(totalCost.toFixed(2))}
                  </span>
                </div>
                {createError ? (
                  <Alert variant="destructive" aria-live="polite">
                    <AlertDescription>{createError}</AlertDescription>
                  </Alert>
                ) : null}
                <Button type="submit" disabled={creating}>
                  {creating ? "Registrando…" : "Registrar compra"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Compras</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {purchases && purchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no registraste compras.</p>
            ) : null}

            {purchases?.map((purchase, index) => (
              <div
                key={purchase.id}
                className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:fill-mode-backwards flex items-center justify-between gap-3 rounded-md border p-3"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{purchase.product.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {purchase.quantity} {purchase.product.unit} × {soles(purchase.unitCost)} ·{" "}
                    {formatLimaDate(purchase.purchasedAt)}
                  </span>
                </div>
                <span className="font-medium">{soles(purchase.totalCost)}</span>
              </div>
            ))}

            {purchases && total !== null && total > purchases.length ? (
              <p className="text-sm text-muted-foreground">
                Mostrando {purchases.length} de {total} compras.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
