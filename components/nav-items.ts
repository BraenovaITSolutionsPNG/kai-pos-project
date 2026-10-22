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
  BookOpen,
  BarChart3,
  Users,
  Calculator,
  QrCode,
  Receipt,
  Megaphone,
  MessageSquare,
  Calendar,
  FileSpreadsheet,
  Building2,
  Gift,
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
  { title: "Branches", href: "/owner", icon: Building2 },
];

export const laterNav: NavItem[] = [
  { title: "Tables", href: "/tables", icon: Table },
  { title: "Kitchen", href: "/kitchen", icon: ChefHat },
  { title: "Inventory", href: "/inventory", icon: Boxes },
  { title: "Recipes", href: "/recipes", icon: BookOpen },
  { title: "Reports", href: "/reports", icon: BarChart3 },
  { title: "Accounting", href: "/accounting", icon: FileSpreadsheet },
  { title: "Loyalty", href: "/loyalty", icon: Gift },
  { title: "Cashup", href: "/cashup", icon: Calculator },
  { title: "Staff", href: "/staff", icon: Users },
  { title: "Digital Menu", href: "/digital-menu", icon: QrCode },
  { title: "Shift Schedule", href: "/shifts", icon: Calendar },
  { title: "Promotions", href: "/promotions", icon: Megaphone },
  { title: "Bills", href: "/bills", icon: Receipt },
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "Contact", href: "/contact", icon: MessageSquare },
];