import { Monitor, Smartphone, Tablet, Tv } from "lucide-react";

const ICON_CLASS = "size-[18px]";

export function DeviceIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  if (p.includes("tv") || p.includes("roku") || p.includes("fire")) {
    return <Tv className={ICON_CLASS} />;
  }
  if (p.includes("ios") || p.includes("android") || p.includes("mobile")) {
    return <Smartphone className={ICON_CLASS} />;
  }
  if (p.includes("tablet") || p.includes("ipad")) {
    return <Tablet className={ICON_CLASS} />;
  }
  return <Monitor className={ICON_CLASS} />;
}
