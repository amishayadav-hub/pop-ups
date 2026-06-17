"use client";

import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "./AuthProvider";

export type SubItem = { id: string; name: string; icon?: ReactNode };
export type NavSection = { id: string; name: string; items: SubItem[] };

type SidebarProps = {
  sections: NavSection[];
  activeId: string;
  onSelect: (id: string) => void;
};

function initialsFor(email: string | null | undefined): string {
  if (!email) return "?";
  const name = email.split("@")[0];
  const parts = name.split(/[._-]/).filter(Boolean);
  if (parts.length === 0) return name.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function displayNameFor(email: string | null | undefined): string {
  if (!email) return "User";
  const name = email.split("@")[0];
  return name
    .split(/[._-]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export default function Sidebar({ sections, activeId, onSelect }: SidebarProps) {
  const { user, signOut } = useAuth();
  const email = user?.email ?? null;
  const initials = initialsFor(email);
  const displayName = displayNameFor(email);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-[#1F5F57]">
      <div className="flex h-14 items-center gap-2 border-b border-white/15 px-4">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-[#F5EFE0] text-[#1F5F57] text-sm font-semibold">
          N
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-[#F5EFE0]">NexCent</span>
          <span className="text-[11px] text-[#F5EFE0]/70">
            Popup manager
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {sections.map((section) => (
          <div key={section.id} className="mb-4">
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#F5EFE0] dark:text-[#F5EFE0]">
              {section.name}
            </div>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const isActive = item.id === activeId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                      isActive
                        ? "bg-white/15 font-medium text-[#F5EFE0]"
                        : "text-[#F5EFE0]/75 hover:bg-white/10 hover:text-[#F5EFE0]",
                    )}
                  >
                    {item.icon && (
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center [&_svg]:h-4 [&_svg]:w-4",
                          isActive ? "text-[#F5EFE0]" : "text-[#F5EFE0]/75",
                        )}
                      >
                        {item.icon}
                      </span>
                    )}
                    <span className="truncate">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/15 p-3">
        <div className="flex items-center gap-2.5 rounded-md p-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F5EFE0] text-xs font-semibold text-[#1F5F57]">
            {initials}
          </div>
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-sm font-medium text-[#F5EFE0]">
              {displayName}
            </span>
            <span className="truncate text-[11px] text-[#F5EFE0]/70">
              Admin &middot; {email ?? "—"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            title="Sign out"
            className="rounded-md p-1.5 text-[#F5EFE0]/80 transition-colors hover:bg-white/10 hover:text-[#F5EFE0]"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
