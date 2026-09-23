"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { clearToken, getToken } from "@/lib/auth";
import { getActiveBusinessId, setActiveBusinessId } from "@/lib/business";
import { authFetch } from "@/lib/api";

type Business = { id: string; name: string; active: boolean };

export default function DashboardPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newBusinessName, setNewBusinessName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    // Matches SSR (checked=false) to avoid hydration mismatch; flips after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecked(true);

    async function loadBusinesses() {
      setLoadError(null);
      try {
        const res = await authFetch("/businesses?active=true");
        if (!res.ok) {
          setLoadError("No se pudieron cargar tus negocios.");
          return;
        }
        const data = (await res.json()) as Business[];
        setBusinesses(data);
        if (data.length > 0) {
          const stored = getActiveBusinessId();
          const validId = stored && data.some((b) => b.id === stored) ? stored : data[0].id;
          setActiveBusinessId(validId);
          setActiveId(validId);
        }
      } catch {
        setLoadError("No se pudo conectar con el servidor. Probá de nuevo.");
      }
    }

    loadBusinesses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    setCreating(true);

    try {
      const res = await authFetch("/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBusinessName }),
      });
      if (!res.ok) {
        setCreateError("No se pudo crear el negocio.");
        return;
      }
      const business = (await res.json()) as Business;
      setBusinesses([business]);
      setActiveBusinessId(business.id);
      setActiveId(business.id);
      setNewBusinessName("");
    } catch {
      setCreateError("No se pudo conectar con el servidor. Probá de nuevo.");
    } finally {
      setCreating(false);
    }
  }

  function handleSwitchBusiness(event: ChangeEvent<HTMLSelectElement>) {
    const id = event.target.value;
    setActiveBusinessId(id);
    setActiveId(id);
  }

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  if (!checked) return null;

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-background px-6 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Sesión iniciada</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {loadError ? (
            <Alert variant="destructive" aria-live="polite">
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : null}

          {businesses && businesses.length === 0 ? (
            <form onSubmit={handleCreateBusiness} className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="business-name">Creá tu primer negocio</Label>
                <Input
                  id="business-name"
                  required
                  value={newBusinessName}
                  onChange={(e) => setNewBusinessName(e.target.value)}
                />
              </div>
              {createError ? (
                <Alert variant="destructive" aria-live="polite">
                  <AlertDescription>{createError}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" disabled={creating}>
                {creating ? "Creando…" : "Crear negocio"}
              </Button>
            </form>
          ) : null}

          {businesses && businesses.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="business-switch">Negocio activo</Label>
              <select
                id="business-switch"
                value={activeId ?? ""}
                onChange={handleSwitchBusiness}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {activeId ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/dashboard/products" />}
              >
                Productos
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/dashboard/sales" />}
              >
                Ventas
              </Button>
            </div>
          ) : null}

          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="size-4" />
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
