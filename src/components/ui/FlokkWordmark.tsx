export function FlokkWordmark({
  size = 18,
  variant = "navy",
}: {
  size?: number;
  variant?: "navy" | "white";
}) {
  return (
    <span
      style={{
        fontFamily: "var(--font-dm-sans, 'DM Sans', sans-serif)",
        fontSize: size,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        lineHeight: 1,
        color: variant === "white" ? "#fff" : "#1B3A5C",
        display: "inline-block",
      }}
    >
      flokk<span style={{ color: "#C4664A" }}>.</span>
    </span>
  );
}
