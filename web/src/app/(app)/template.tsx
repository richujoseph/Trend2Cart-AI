// Re-mounts on every navigation, so each screen fades in (0.25 s; off with reduced motion).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade">{children}</div>;
}
