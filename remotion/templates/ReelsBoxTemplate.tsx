import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { getFontFamily, type FontKey } from "../utils/fonts";

export type ReelsBoxProps = {
  videoUrl: string;
  words: Array<{ word: string; start: number; end: number }>;
  config: {
    primary_color: string;
    font_family: FontKey;
    font_size: number;
    position: "top" | "center" | "bottom";
    position_y_offset: number;
  };
};

const POSITION_STYLE = {
  top: { top: "10%" },
  center: { top: "50%", transform: "translateY(-50%)" },
  bottom: { bottom: "15%" },
};

function groupIntoLines(words: ReelsBoxProps["words"], maxWordsPerLine: number = 8) {
  const lines: Array<{ start: number; end: number; text: string }> = [];
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

export const ReelsBoxTemplate: React.FC<ReelsBoxProps> = ({ videoUrl, words, config }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const fontFamily = getFontFamily(config.font_family);
  const positionStyle = POSITION_STYLE[config.position];

  const lines = groupIntoLines(words);
  const active = lines.find((l) => time >= l.start && time < l.end);

  return (
    <AbsoluteFill>
      <OffthreadVideo src={videoUrl} />
      {active && (
        <div
          style={{
            position: "absolute",
            left: "10%",
            right: "10%",
            textAlign: "center",
            ...positionStyle,
            marginTop: `${config.position_y_offset}px`,
          }}
        >
          <div
            style={{
              display: "inline-block",
              backgroundColor: "rgba(0,0,0,0.75)",
              borderRadius: 8,
              padding: "12px 20px",
              color: config.primary_color,
              fontFamily,
              fontSize: `${config.font_size}px`,
              fontWeight: 500,
            }}
          >
            {active.text}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
