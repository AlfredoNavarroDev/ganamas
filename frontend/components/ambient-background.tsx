function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-1/4 -left-1/4 size-[60vw] rounded-full bg-primary/35 blur-[120px] motion-safe:animate-[ambient-drift-a_80s_ease-in-out_infinite]" />
      <div className="absolute top-1/3 -right-1/4 size-[55vw] rounded-full bg-secondary/40 blur-[120px] motion-safe:animate-[ambient-drift-b_90s_ease-in-out_infinite]" />
      <div className="absolute -bottom-1/4 left-1/4 size-[50vw] rounded-full bg-accent/30 blur-[120px] motion-safe:animate-[ambient-drift-a_70s_ease-in-out_infinite]" />
    </div>
  );
}

export { AmbientBackground };
