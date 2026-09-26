"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { getToken } from "@/lib/auth";
import { getActiveBusinessId } from "@/lib/business";
import { authFetch } from "@/lib/api";

type Product = {
  id: string;
  name: string;
  price: string;
  unit: "unidad" | "kg";
  category: string | null;
  stock: string;
  active: boolean;
};

type ProductFormValues = {
  name: string;
  price: string;
  unit: "unidad" | "kg";
  category: string;
};

const emptyForm: ProductFormValues = { name: "", price: "", unit: "unidad", category: "" };

export default function ProductsPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newProduct, setNewProduct] = useState<ProductFormValues>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<ProductFormValues>(emptyForm);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
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
    // Matches SSR (checked=false) to avoid hydration mismatch; flips after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusinessId(activeBusinessId);
    setChecked(true);

    async function loadProducts() {
      setLoadError(null);
      try {
        const res = await authFetch(
          `/products?businessId=${activeBusinessId}&active=true`,
        );
        if (!res.ok) {
          setLoadError("No se pudieron cargar tus productos.");
          return;
        }
        const data = (await res.json()) as Product[];
        setProducts(data);
      } catch {
        setLoadError("No se pudo conectar con el servidor. Probá de nuevo.");
      }
    }

    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessId) return;
    setCreateError(null);
    setCreating(true);

    try {
      const res = await authFetch("/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          name: newProduct.name,
          price: newProduct.price,
          unit: newProduct.unit,
          category: newProduct.category || undefined,
        }),
      });
      if (!res.ok) {
        setCreateError("No se pudo crear el producto.");
        return;
      }
      const created = (await res.json()) as Product;
      setProducts((prev) => [...(prev ?? []), created]);
      setNewProduct(emptyForm);
      toast("Producto creado");
    } catch {
      setCreateError("No se pudo conectar con el servidor. Probá de nuevo.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setEditError(null);
    setEditValues({
      name: product.name,
      price: product.price,
      unit: product.unit,
      category: product.category ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function handleSaveEdit(id: string) {
    setEditError(null);
    setSavingEdit(true);

    try {
      const res = await authFetch(`/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editValues.name,
          price: editValues.price,
          unit: editValues.unit,
          category: editValues.category || undefined,
        }),
      });
      if (!res.ok) {
        setEditError("No se pudo guardar el producto.");
        return;
      }
      const updated = (await res.json()) as Product;
      setProducts((prev) => (prev ?? []).map((p) => (p.id === id ? updated : p)));
      setEditingId(null);
    } catch {
      setEditError("No se pudo conectar con el servidor. Probá de nuevo.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(id: string) {
    setLoadError(null);
    setDeleting(true);
    try {
      const res = await authFetch(`/products/${id}`, { method: "DELETE" });
      if (!res.ok) {
        // Close the dialog first: otherwise the failure feedback renders behind
        // the modal backdrop and the user sees nothing happen.
        setDeleteTarget(null);
        toast("No se pudo eliminar el producto.", "destructive");
        return;
      }
      setProducts((prev) => (prev ?? []).filter((p) => p.id !== id));
      setDeleteTarget(null);
      toast("Producto eliminado");
    } catch {
      setDeleteTarget(null);
      setLoadError("No se pudo conectar con el servidor. Probá de nuevo.");
      toast("No se pudo eliminar el producto.", "destructive");
    } finally {
      setDeleting(false);
    }
  }

  if (!checked) return null;

  if (products === null && !loadError) {
    return (
      <main className="flex min-h-dvh flex-1 flex-col items-center px-6 py-16">
        <div className="flex w-full max-w-2xl flex-col gap-6">
          <Skeleton data-testid="products-skeleton" className="h-48 w-full" />
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
            <CardTitle className="text-lg">Nuevo producto</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  required
                  value={newProduct.name}
                  onChange={(e) => setNewProduct((v) => ({ ...v, name: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="price">Precio</Label>
                <Input
                  id="price"
                  required
                  inputMode="decimal"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct((v) => ({ ...v, price: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="unit">Unidad</Label>
                <select
                  id="unit"
                  value={newProduct.unit}
                  onChange={(e) =>
                    setNewProduct((v) => ({ ...v, unit: e.target.value as "unidad" | "kg" }))
                  }
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="unidad">unidad</option>
                  <option value="kg">kg</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="category">Categoría</Label>
                <Input
                  id="category"
                  value={newProduct.category}
                  onChange={(e) => setNewProduct((v) => ({ ...v, category: e.target.value }))}
                />
              </div>
              {createError ? (
                <Alert variant="destructive" aria-live="polite">
                  <AlertDescription>{createError}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" disabled={creating}>
                {creating ? "Agregando…" : "Agregar producto"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Productos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {products && products.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no tenés productos.</p>
            ) : null}

            {products?.map((product, index) =>
              editingId === product.id ? (
                <div key={product.id} className="flex flex-col gap-2 rounded-md border p-3">
                  <Label htmlFor="edit-name">Nombre</Label>
                  <Input
                    id="edit-name"
                    value={editValues.name}
                    onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                  />
                  <Label htmlFor="edit-price">Precio</Label>
                  <Input
                    id="edit-price"
                    inputMode="decimal"
                    value={editValues.price}
                    onChange={(e) => setEditValues((v) => ({ ...v, price: e.target.value }))}
                  />
                  <Label htmlFor="edit-unit">Unidad</Label>
                  <select
                    id="edit-unit"
                    value={editValues.unit}
                    onChange={(e) =>
                      setEditValues((v) => ({ ...v, unit: e.target.value as "unidad" | "kg" }))
                    }
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="unidad">unidad</option>
                    <option value="kg">kg</option>
                  </select>
                  <Label htmlFor="edit-category">Categoría</Label>
                  <Input
                    id="edit-category"
                    value={editValues.category}
                    onChange={(e) => setEditValues((v) => ({ ...v, category: e.target.value }))}
                  />
                  {editError ? (
                    <Alert variant="destructive" aria-live="polite">
                      <AlertDescription>{editError}</AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      disabled={savingEdit}
                      onClick={() => handleSaveEdit(product.id)}
                    >
                      {savingEdit ? "Guardando…" : "Guardar"}
                    </Button>
                    <Button type="button" variant="outline" onClick={cancelEdit}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  key={product.id}
                  className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:fill-mode-backwards flex items-center justify-between gap-3 rounded-md border p-3"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{product.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {product.price} / {product.unit}
                      {product.category ? ` · ${product.category}` : ""} · stock {product.stock}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => startEdit(product)}>
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDeleteTarget(product)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              ),
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={deleteTarget ? `¿Eliminar "${deleteTarget.name}"?` : ""}
        description="Esta acción no se puede deshacer. El producto se quitará del inventario activo."
        confirmLabel="Eliminar producto"
        confirming={deleting}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
      />
    </main>
  );
}
