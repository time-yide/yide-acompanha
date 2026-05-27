import { spring, interpolate } from "remotion";

export type AnimationKey = "pop" | "fade" | "slide" | "none";

export function getEntryStyle(
  animation: AnimationKey,
  frame: number,
  fps: number,
  startFrame: number,
): { transform: string; opacity: number } {
  const relFrame = frame - startFrame;
  if (animation === "none") {
    return { transform: "scale(1)", opacity: 1 };
  }
  if (animation === "pop") {
    const scale = spring({ frame: relFrame, fps, config: { damping: 12, stiffness: 200 }, from: 0.6, to: 1 });
    return { transform: `scale(${scale})`, opacity: 1 };
  }
  if (animation === "fade") {
    const opacity = interpolate(relFrame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
    return { transform: "scale(1)", opacity };
  }
  if (animation === "slide") {
    const y = interpolate(relFrame, [0, 10], [20, 0], { extrapolateRight: "clamp" });
    return { transform: `translateY(${y}px)`, opacity: 1 };
  }
  return { transform: "scale(1)", opacity: 1 };
}
