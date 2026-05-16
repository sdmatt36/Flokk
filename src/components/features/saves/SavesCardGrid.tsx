import type { ReactNode } from "react";

type Props = { children: ReactNode };

export function SavesCardGrid({ children }: Props) {
  return (
    <div className="grid grid-cols-3 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1" style={{ gap: "16px" }}>
      {children}
    </div>
  );
}
