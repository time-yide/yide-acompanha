import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon512() {
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
          fontSize: 358,
          fontWeight: 900,
          letterSpacing: -18,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        Y
      </div>
    ),
    { ...size },
  );
}
