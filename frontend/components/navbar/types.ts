import type { MouseEvent } from "react";
import type { NavItem, NavKey } from "./nav-items";

export type GuardNavigation = (event: MouseEvent, href: string) => void;

export interface NavLinksProps {
  items: NavItem[];
  activeKey: NavKey | null;
  onNavigate: GuardNavigation;
}
