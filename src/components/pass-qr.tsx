import QRCode from "qrcode";

/**
 * Renders a QR code as an inline SVG so it stays sharp when the pass is
 * printed. The value is always built from a reference code, never user input.
 */
export async function PassQr({ value }: { value: string }) {
  const svg = await QRCode.toString(value, {
    type: "svg",
    margin: 1,
    width: 148,
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  return (
    <div
      role="img"
      aria-label="QR code for this appointment pass"
      className="h-[148px] w-[148px] [&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
