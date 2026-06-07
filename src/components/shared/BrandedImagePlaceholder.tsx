import { Bird } from "lucide-react";

export function BrandedImagePlaceholder({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #1B3A5C 0%, #C4664A 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <Bird size={28} color="rgba(255,255,255,0.45)" strokeWidth={1.5} />
    </div>
  );
}
