import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function useDisableScroll() {
  const pathname = usePathname();

  useEffect(() => {
    const isAuthPage = pathname === "/login" || pathname === "/setup";

    if (isAuthPage) {
      // Disable scroll
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      // Enable scroll
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }

    return () => {
      // Cleanup: enable scroll
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [pathname]);
}
