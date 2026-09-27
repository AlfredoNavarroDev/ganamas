"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { getToken } from "@/lib/auth";
import { getActiveBusinessId } from "@/lib/business";
import { authFetch } from "@/lib/api";
import { limaTodayRange } from "@/lib/date-ranges";

type Product = {
  id: string;
  name: string;
  price: string;
  unit: "unidad" | "kg";
  stock: string;
  active: boolean;
};

type Sale = {
  id: string;
  product: { id: string; name: string; unit: "unidad" | "kg" };
  quantity: string;
  listPrice: string;
  unitPrice: string;
  discount: string;
  total: string;
  paymentMethod: "efectivo" | "yape" | "plin";
  soldAt: string;
};

const PAYMENT_METHODS: Sale["paymentMethod"][] = ["efectivo", "yape", "plin"];

function formatLimaTime(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function soles(amount: string): string {
  return `S/ ${amount}`;
}

export default function SalesPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[] | null>(null);
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<Sale["paymentMethod"]>("efectivo");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const selectedProduct = products?.find((p) => p.id === productId) ?? null;

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
    loadSales(activeBusinessId);
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
        setUnitPrice((prev) => prev || data[0].price);
      }
    } catch {
      setLoadError("No se pudo conectar con el servidor. Probá de nuevo.");
    }
  }

  async function loadSales(activeBusinessId: string) {
    setLoadError(null);
    try {
      const { from, to } = limaTodayRange();
      const res = await authFetch(
        `/sales?businessId=${activeBusinessId}&from=${from}&to=${to}`,
      );
      if (!res.ok) {
        setLoadError("No se pudieron cargar tus ventas.");
        return;
      }
      const data = (await res.json()) as { data: Sale[] };
      setSales(data.data);
    } catch {
      setLoadError("No se pudo conectar con el servidor. Probá de nuevo.");
    }
  }

  function handleProductChange(id: string) {
    setProductId(id);
    const product = products?.find((p) => p.id === id);
    if (product) setUnitPrice(product.price);
  }

  async function handleCreateSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessId || !productId) return;
    setCreateError(null);
    setCreating(true);

    try {
      const res = await authFetch("/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          productId,
          quantity,
          unitPrice,
          paymentMethod,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setCreateError(
          body?.message?.toLowerCase().includes("insufficient stock")
            ? "Stock insuficiente."
            : "No se pudo registrar la venta.",
        );
        return;
      }
      const created = (await res.json()) as Sale;
      setSales((prev) => [created, ...(prev ?? [])]);
      setQuantity("");
      toast("Venta registrada");
      loadProducts(businessId);
    } catch {
      setCreateError("No se pudo conectar con el servidor. Probá de nuevo.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setLoadError(null);
    setDeleting(true);
    try {
      const res = await authFetch(`/sales/${id}`, { method: "DELETE" });
      if (!res.ok) {
        // Close the dialog first: otherwise the failure feedback renders behind
        // the modal backdrop and the user sees nothing happen.
        setDeleteTarget(null);
        toast("No se pudo eliminar la venta.", "destructive");
        return;
      }
      setSales((prev) => (prev ?? []).filter((s) => s.id !== id));
      setDeleteTarget(null);
      if (businessId) loadProducts(businessId);
      toast("Venta eliminada");
    } catch {
      setDeleteTarget(null);
      setLoadError("No se pudo conectar con el servidor. Probá de nuevo.");
      toast("No se pudo eliminar la venta.", "destructive");
    } finally {
      setDeleting(false);
    }
  }

  if (!checked) return null;

  if (sales === null && !loadError) {
    return (
      <main className="flex min-h-dvh flex-1 flex-col items-center px-6 py-16">
        <div className="flex w-full max-w-2xl flex-col gap-6">
          <Skeleton data-testid="sales-skeleton" className="h-48 w-full" />
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
            <CardTitle className="text-lg">Nueva venta</CardTitle>
          </CardHeader>
          <CardContent>
            {products && products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Creá un producto primero para poder registrar ventas.
              </p>
            ) : (
              <form onSubmit={handleCreateSale} className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="product">Producto</Label>
                  <Select value={productId} onValueChange={(value) => handleProductChange(value as string)}>
                    <SelectTrigger id="product">
                      <SelectValue>
                        {(value: string) => {
                          const product = products?.find((p) => p.id === value);
                          return product ? `${product.name} (${product.stock} ${product.unit})` : value;
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.stock} {p.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="quantity">Cantidad</Label>
                  <Input
                    id="quantity"
                    required
                    inputMode="decimal"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="unit-price">Precio unitario</Label>
                  <Input
                    id="unit-price"
                    required
                    inputMode="decimal"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                  />
                  {selectedProduct ? (
                    <p className="text-xs text-muted-foreground">
                      Precio de lista: {soles(selectedProduct.price)}. Si el cliente regateó,
                      cambiá este precio por el que realmente cobraste.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="payment-method">Método de pago</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(value) => setPaymentMethod(value as Sale["paymentMethod"])}
                  >
                    <SelectTrigger id="payment-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {createError ? (
                  <Alert variant="destructive" aria-live="polite">
                    <AlertDescription>{createError}</AlertDescription>
                  </Alert>
                ) : null}
                <Button type="submit" disabled={creating}>
                  {creating ? "Registrando…" : "Registrar venta"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ventas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {sales && sales.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no registraste ventas.</p>
            ) : null}

            {sales?.map((sale, index) => (
              <div
                key={sale.id}
                className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:fill-mode-backwards flex items-center justify-between gap-3 rounded-md border p-3"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{sale.product.name}</span>
                    {Number(sale.discount) > 0 ? (
                      <Badge variant="default">Regateo -{soles(sale.discount)}</Badge>
                    ) : null}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {sale.quantity} {sale.product.unit} × {sale.unitPrice} = {sale.total} ·{" "}
                    {sale.paymentMethod} · {formatLimaTime(sale.soldAt)}
                  </span>
                  {Number(sale.discount) > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      Precio de lista: {soles(sale.listPrice)}
                    </span>
                  ) : null}
                </div>
                <Button type="button" variant="outline" onClick={() => setDeleteTarget(sale)}>
                  Eliminar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="¿Eliminar esta venta?"
        description="Esta acción no se puede deshacer y devolverá el stock al inventario."
        confirmLabel="Eliminar venta"
        confirming={deleting}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
      />
    </main>
  );
}
