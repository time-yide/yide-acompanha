import { AbsoluteFill, OffthreadVideo } from "remotion";
import { SubtitleWord } from "../components/SubtitleWord";
import { getFontFamily, type FontKey } from "../utils/fonts";
import type { AnimationKey } from "../utils/animations";

export type SubmagicProps = {
  videoUrl: string;
  words: Array<{ word: string; start: number; end: number }>;
  config: {
    primary_color: string;
    highlight_color: string | null;
    font_family: FontKey;
    font_size: number;
    position: "top" | "center" | "bottom";
    position_y_offset: number;
    has_shadow: boolean;
    shadow_intensity: number;
    animation: AnimationKey;
  };
};

const POSITION_STYLE = {
  top: { top: "10%" },
  center: { top: "50%", transform: "translateY(-50%)" },
  bottom: { bottom: "15%" },
};

export const SubmagicTemplate: React.FC<SubmagicProps> = ({ videoUrl, words, config }) => {
  const fontFamily = getFontFamily(config.font_family);
  const positionStyle = POSITION_STYLE[config.position];

  return (
    <AbsoluteFill>
      <OffthreadVideo src={videoUrl} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          textAlign: "center",
          padding: "0 10%",
          ...positionStyle,
          marginTop: `${config.position_y_offset}px`,
        }}
      >
        {words.map((w, i) => (
          <SubtitleWord
            key={i}
            word={w.word}
            start={w.start}
            end={w.end}
            isHighlighted={true}
            primaryColor={config.primary_color}
            highlightColor={config.highlight_color}
            fontFamily={fontFamily}
            fontSize={config.font_size}
            hasShadow={config.has_shadow}
            shadowIntensity={config.shadow_intensity}
            animation={config.animation}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
