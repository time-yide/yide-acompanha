import { useCurrentFrame, useVideoConfig } from "remotion";
import { getEntryStyle, type AnimationKey } from "../utils/animations";

interface Props {
  word: string;
  start: number;
  end: number;
  isHighlighted: boolean;
  primaryColor: string;
  highlightColor: string | null;
  fontFamily: string;
  fontSize: number;
  hasShadow: boolean;
  shadowIntensity: number;
  animation: AnimationKey;
}

export function SubtitleWord(props: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const startFrame = props.start * fps;
  const endFrame = props.end * fps;
  const isActive = frame >= startFrame && frame < endFrame;
  if (frame < startFrame) return null;

  const color = props.isHighlighted && props.highlightColor && isActive
    ? props.highlightColor
    : props.primaryColor;

  const entry = getEntryStyle(props.animation, frame, fps, startFrame);

  const shadowAlpha = props.shadowIntensity / 100;
  const textShadow = props.hasShadow
    ? `2px 2px 4px rgba(0,0,0,${shadowAlpha}), -1px -1px 2px rgba(0,0,0,${shadowAlpha * 0.5})`
    : "none";

  return (
    <span
      style={{
        display: "inline-block",
        margin: "0 6px",
        color,
        fontFamily: props.fontFamily,
        fontSize: `${props.fontSize}px`,
        fontWeight: 700,
        textShadow,
        transform: entry.transform,
        opacity: entry.opacity,
      }}
    >
      {props.word}
    </span>
  );
}
