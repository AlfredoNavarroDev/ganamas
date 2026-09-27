import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-lg flex-col items-center text-center">
        
        <h1
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:[animation-delay:75ms] motion-safe:fill-mode-backwards mt-5 text-6xl font-bold tracking-tight text-primary sm:text-7xl"
        >
          Ganamás
        </h1>

        <p
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:[animation-delay:150ms] motion-safe:fill-mode-backwards mt-2 text-2xl font-medium tracking-tight text-foreground sm:text-3xl"
        >
          para Zuhhey
        </p>

        <p
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:[animation-delay:225ms] motion-safe:fill-mode-backwards mt-5 max-w-md text-base text-pretty text-muted-foreground"
        >
          Esto lo hago con amor hermanita querida.
          Deseo que puedas seguir adelante y esta es mi forma de demostrate mi apoyo sincero.
          Te amo hermanita, tu eres como mi segunda madre y te debo muchas cosas, te quiero mucho.
        </p>

        <Button
          size="lg"
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:[animation-delay:300ms] motion-safe:fill-mode-backwards mt-8 h-11 px-6 text-base"
          render={<Link href="/login" />}
          nativeButton={false}
        >
          Iniciar sesión
        </Button>
      </div>

      <p className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 motion-safe:[animation-delay:375ms] motion-safe:fill-mode-backwards mt-16 text-xs text-muted-foreground">
        Hecho por tu hermano, con todo mi amor y solo para ti.
      </p>
    </main>
  );
}
