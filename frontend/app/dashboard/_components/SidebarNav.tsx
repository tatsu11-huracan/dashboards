"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard/customs",  label: "通関部",    icon: "📋", color: "blue" },
  { href: "/dashboard/bonded",   label: "保税部",    icon: "🏭", color: "green" },
  { href: "/dashboard/delivery", label: "配送部",    icon: "🚚", color: "amber" },
  { href: "/dashboard/sales",    label: "営業・管理", icon: "📊", color: "purple" },
];

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-2 py-2">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-1 transition-colors ${
              isActive
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:bg-gray-700/60 hover:text-gray-200"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
            {isActive && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
