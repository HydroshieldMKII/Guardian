import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 640;

export const useIsMobile = (breakpoint = MOBILE_BREAKPOINT): boolean => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);

  return isMobile;
};
