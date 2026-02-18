import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const isLocal = process.env.NEXT_PUBLIC_APP_ENV === "local";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "6px",
          background: isLocal ? "#22c55e" : "#f97316",
          color: "white",
          fontSize: "20px",
          fontWeight: 700,
        }}
      >
        {isLocal ? "D" : "외"}
      </div>
    ),
    { ...size },
  );
}
