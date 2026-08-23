import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  Package,
  Tags,
  Settings,
  Table,
  ChefHat,
  Boxes,
  BarChart3,
  Users,
  Calculator,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
  disabled?: boolean;
}

export const mainNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "POS", href: "/pos", icon: ShoppingCart },
  { title: "Orders", href: "/orders", icon: ClipboardList },
  { title: "Products", href: "/products", icon: Package },
  { title: "Categories", href: "/categories", icon: Tags },
];

export const laterNav: NavItem[] = [
  { title: "Tables", href: "/tables", icon: Table },
  { title: "Kitchen", href: "/kitchen", icon: ChefHat },
  { title: "Inventory", href: "/inventory", icon: Boxes },
  { title: "Reports", href: "/reports", icon: BarChart3 },
  { title: "Cashup", href: "/cashup", icon: Calculator },
  { title: "Staff", href: "/staff", icon: Users },
  { title: "Settings", href: "/settings", icon: Settings },
];