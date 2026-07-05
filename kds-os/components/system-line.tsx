export function SystemLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[13px] leading-relaxed text-ink-500">
      <span className="text-signal-400">›</span> {children}
    </p>
  );
}