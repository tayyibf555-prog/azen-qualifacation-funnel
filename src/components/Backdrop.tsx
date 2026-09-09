/** Ambient indigo bloom, matching the glow treatment on azen.io. */
export default function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ground">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(62% 58% at 50% -8%, oklch(0.28 0.16 260 / 0.30), transparent 72%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(46% 34% at 50% 108%, oklch(0.24 0.13 260 / 0.22), transparent 70%)",
        }}
      />
    </div>
  );
}
