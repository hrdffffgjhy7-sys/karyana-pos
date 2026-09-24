import {
  LayoutDashboard,
  ReceiptText,
  Files,
  Users,
  HandCoins,
  Package,
  BarChart3,
  Download,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "New Bill", href: "/bill/new", icon: ReceiptText },
  { title: "Bills", href: "/bills", icon: Files },
  { title: "Customers", href: "/customers", icon: Users },
  { title: "Udhaar", href: "/udhaar", icon: HandCoins },
  { title: "Products", href: "/products", icon: Package },
  { title: "Reports", href: "/reports", icon: BarChart3 },
  { title: "Downloads", href: "/downloads", icon: Download },
  { title: "Settings", href: "/settings", icon: Settings },
];