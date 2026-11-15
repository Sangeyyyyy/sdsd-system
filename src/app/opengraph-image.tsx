import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_DESCRIPTION } from "@/lib/site";

export const alt =
  "SDSD Q — ID Verification Appointments at the SDSD Office, DNSC";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The logo does not depend on request data, so read it once at module scope.
const logoData = await readFile(
  join(process.cwd(), "public", "sdsd-logo.png"),
  "base64",
);
const logoSrc = `data:image/png;base64,${logoData}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#073a12",
          padding: "64px 72px",
          position: "relative",
        }}
      >
        {/* Gold accent bar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 16,
            height: "100%",
            backgroundColor: "#f7d117",
          }}
        />

        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 116,
              height: 128,
              backgroundColor: "#ffffff",
              borderRadius: 24,
            }}
          >
            <img src={logoSrc} width={88} height={100} />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginLeft: 28,
            }}
          >
            <div
              style={{
                color: "#ffdf45",
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: 5,
              }}
            >
              DNSC · SDSD OFFICE
            </div>
            <div
              style={{
                color: "#ffffff",
                fontSize: 76,
                fontWeight: 700,
                marginTop: 6,
                lineHeight: 1.05,
              }}
            >
              SDSD Q
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "#ffffff",
              fontSize: 48,
              fontWeight: 700,
              lineHeight: 1.15,
            }}
          >
            ID Verification Appointments
          </div>
          <div
            style={{
              color: "#bae3c1",
              fontSize: 28,
              marginTop: 18,
              lineHeight: 1.3,
            }}
          >
            {SITE_DESCRIPTION}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
