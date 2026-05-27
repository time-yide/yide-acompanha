import { Composition, registerRoot } from "remotion";
import { SubmagicTemplate } from "./templates/SubmagicTemplate";
import { TikTokTemplate } from "./templates/TikTokTemplate";
import { ReelsBoxTemplate } from "./templates/ReelsBoxTemplate";

const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
const VIDEO_FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="submagic"
        component={SubmagicTemplate}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        fps={VIDEO_FPS}
        durationInFrames={VIDEO_FPS * 90}
        defaultProps={{
          videoUrl: "",
          words: [],
          config: {
            primary_color: "#FFFFFF",
            highlight_color: "#FFD600",
            font_family: "inter" as const,
            font_size: 56,
            position: "center" as const,
            position_y_offset: 0,
            has_shadow: true,
            shadow_intensity: 70,
            animation: "pop" as const,
          },
        }}
      />
      <Composition
        id="tiktok"
        component={TikTokTemplate}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        fps={VIDEO_FPS}
        durationInFrames={VIDEO_FPS * 90}
        defaultProps={{
          videoUrl: "",
          words: [],
          config: {
            primary_color: "#FFFFFF",
            font_family: "archivo_black" as const,
            font_size: 48,
            position: "bottom" as const,
            position_y_offset: 0,
            has_shadow: true,
            shadow_intensity: 80,
          },
        }}
      />
      <Composition
        id="reels_box"
        component={ReelsBoxTemplate}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        fps={VIDEO_FPS}
        durationInFrames={VIDEO_FPS * 90}
        defaultProps={{
          videoUrl: "",
          words: [],
          config: {
            primary_color: "#FFFFFF",
            font_family: "inter" as const,
            font_size: 42,
            position: "bottom" as const,
            position_y_offset: 0,
          },
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
