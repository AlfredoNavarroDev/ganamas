import Link from "next/link";
import { Zap, TrendingUp, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: Zap,
    title: "Registro en segundos",
    description: "Pensado para el celular: anota una venta sin perder al cliente de vista.",
  },
  {
    icon: TrendingUp,
    title: "Corte semanal y rentabilidad",
    description: "Mejor día, mejor hora, producto que más deja. Sin sacar cuentas a mano.",
  },
  {
    icon: TriangleAlert,
    title: "Alerta de stock bajo",
    description: "Sabés qué reponer antes de que se te acabe en el mostrador.",
  },
] as const;

export default function Home() {
  return (
    <main className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <Badge
          variant="outline"
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
        >
          Registro de ventas y compras
        </Badge>

        <h1
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:[animation-delay:75ms] motion-safe:fill-mode-backwards mt-4 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl md:text-5xl"
        >
          Registrá rápido.
          <br />
          Decidí con datos.
        </h1>

        <p
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:[animation-delay:150ms] motion-safe:fill-mode-backwards mt-4 max-w-sm text-base text-pretty text-muted-foreground"
        >
          Reemplazá el cuaderno de papel: anotá ventas y compras desde el
          celular y mirá qué te conviene vender.
        </p>

        <Button
          size="lg"
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:[animation-delay:225ms] motion-safe:fill-mode-backwards mt-8 h-11 px-6 text-base"
          render={<Link href="/login" />}
          nativeButton={false}
        >
          Iniciar sesión
        </Button>
      </div>

      <div className="mt-16 flex w-full max-w-md flex-col gap-5 border-t border-border pt-10">
        {features.map(({ icon: Icon, title, description }, i) => (
          <div
            key={title}
            className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:fill-mode-backwards flex items-start gap-3 text-left"
            style={{ animationDelay: `${300 + i * 75}ms` }}
          >
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Icon className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-16 text-xs text-muted-foreground">ganamas · uso interno</p>
    </main>
  );
}
