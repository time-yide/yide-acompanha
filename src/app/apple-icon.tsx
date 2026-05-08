import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#3DC4BC",
          fontSize: 126,
          fontWeight: 900,
          letterSpacing: -6,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        Y
      </div>
    ),
    { ...size },
  );
}
