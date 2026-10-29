import Image from "next/image";
import Link from "next/link";
import type { GuardNavigation } from "./types";

const LOGOS = [
  { src: "/logo_dark.svg", className: "block dark:hidden" },
  { src: "/logo_white.svg", className: "hidden dark:block" },
];

export function NavbarLogo({ onNavigate }: { onNavigate: GuardNavigation }) {
  return (
    <Link
      href="/"
      onClick={(e) => onNavigate(e, "/")}
      className="-ml-2 flex shrink-0 items-center rounded-lg transition-opacity hover:opacity-80"
    >
      {LOGOS.map((logo) => (
        <Image
          key={logo.src}
          src={logo.src}
          alt="Guardian"
          width={1024}
          height={768}
          className={`${logo.className} h-[52px] w-auto sm:h-[60px]`}
          priority
        />
      ))}
    </Link>
  );
}
