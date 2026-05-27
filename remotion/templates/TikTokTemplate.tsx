import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { getFontFamily, type FontKey } from "../utils/fonts";

export type TikTokProps = {
  videoUrl: string;
  words: Array<{ word: string; start: number; end: number }>;
  config: {
    primary_color: string;
    font_family: FontKey;
    font_size: number;
    position: "top" | "center" | "bottom";
    position_y_offset: number;
    has_shadow: boolean;
    shadow_intensity: number;
  };
};

const POSITION_STYLE = {
  top: { top: "10%" },
  center: { top: "50%", transform: "translateY(-50%)" },
  bottom: { bottom: "15%" },
};

interface Line { start: number; end: number; text: string }

function groupIntoLines(words: TikTokProps["words"], maxWordsPerLine: number = 6): Line[] {
  const lines: Line[] = [];
  let current: typeof words = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = words[i - 1];
    if (current.length >= maxWordsPerLine || (prev && w.start - prev.end > 1.0)) {
      if (current.length > 0) {
        lines.push({
          start: current[0].start,
          end: current[current.length - 1].end,
          text: current.map((c) => c.word).join(" "),
        });
        current = [];
      }
    }
    current.push(w);
  }
  if (current.length > 0) {
    lines.push({
      start: current[0].start,
      end: current[current.length - 1].end,
      text: current.map((c) => c.word).join(" "),
    });
  }
  return lines;
}

export const TikTokTemplate: React.FC<TikTokProps> = ({ videoUrl, words, config }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const fontFamily = getFontFamily(config.font_family);
  const positionStyle = POSITION_STYLE[config.position];

  const lines = groupIntoLines(words);
  const active = lines.find((l) => time >= l.start && time < l.end);

  const shadowAlpha = config.shadow_intensity / 100;
  const textShadow = config.has_shadow
    ? `3px 3px 0px rgba(0,0,0,${shadowAlpha}), -1px -1px 0px rgba(0,0,0,${shadowAlpha})`
    : "none";

  return (
    <AbsoluteFill>
      <OffthreadVideo src={videoUrl} />
      {active && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            textAlign: "center",
            padding: "0 10%",
            ...positionStyle,
            marginTop: `${config.position_y_offset}px`,
            color: config.primary_color,
            fontFamily,
            fontSize: `${config.font_size}px`,
            fontWeight: 900,
            textShadow,
          }}
        >
          {active.text}
        </div>
      )}
    </AbsoluteFill>
  );
};
