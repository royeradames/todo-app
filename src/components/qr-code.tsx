"use client";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
export function QrCode({
  value,
  description,
}: {
  value: string;
  description: string;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(value, {
      width: 240,
      margin: 2,
      color: { dark: "#202c28", light: "#fffefb" },
    })
      .then((url) => {
        if (active) setImage(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [value]);
  if (failed)
    return (
      <p className="notice warning">
        The QR code could not be shown. Use the manual code below.
      </p>
    );
  if (!image)
    return (
      <p role="status" className="code-caption">
        Preparing QR code…
      </p>
    );
  return (
    // Generated private data URI: never send an authenticator QR through image optimization.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="qr"
      src={image}
      width={180}
      height={180}
      alt={description}
    />
  );
}
