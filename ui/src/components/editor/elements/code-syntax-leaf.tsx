import type { PlateLeafProps } from "platejs/react";
import { PlateLeaf } from "platejs/react";

export function CodeSyntaxLeaf({ leaf, children, ...props }: PlateLeafProps) {
  return (
    <PlateLeaf
      {...props}
      leaf={leaf}
      className={(leaf as Record<string, unknown>).className as string}
    >
      {children}
    </PlateLeaf>
  );
}
