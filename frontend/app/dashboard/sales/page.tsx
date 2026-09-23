"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getToken } from "@/lib/auth";
import { getActiveBusinessId } from "@/lib/business";
import { authFetch } from "@/lib/api";

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
  unitPrice: string;
  total: string;
  paymentMethod: "efectivo" | "yape" | "plin";
  soldAt: string;
};

const PAYMENT_METHODS: Sale["paymentMethod"][] = ["efectivo", "yape", "plin"];

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
      const res = await authFetch(`/sales?businessId=${activeBusinessId}`);
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
      loadProducts(businessId);
    } catch {
      setCreateError("No se pudo conectar con el servidor. Probá de nuevo.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setLoadError(null);
    try {
      const res = await authFetch(`/sales/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setLoadError("No se pudo eliminar la venta.");
        return;
      }
      setSales((prev) => (prev ?? []).filter((s) => s.id !== id));
      if (businessId) loadProducts(businessId);
    } catch {
      setLoadError("No se pudo conectar con el servidor. Probá de nuevo.");
    }
  }

  if (!checked) return null;

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center bg-background px-6 py-16">
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
                  <select
                    id="product"
                    value={productId}
                    onChange={(e) => handleProductChange(e.target.value)}
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {products?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.stock} {p.unit})
                      </option>
                    ))}
                  </select>
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
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="payment-method">Método de pago</Label>
                  <select
                    id="payment-method"
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value as Sale["paymentMethod"])
                    }
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
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

            {sales?.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{sale.product.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {sale.quantity} {sale.product.unit} × {sale.unitPrice} = {sale.total} ·{" "}
                    {sale.paymentMethod}
                  </span>
                </div>
                <Button type="button" variant="outline" onClick={() => handleDelete(sale.id)}>
                  Eliminar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
