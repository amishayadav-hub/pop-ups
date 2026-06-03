"use client";

import { useState } from "react";
import {
  Boxes,
  LayoutDashboard,
  Layers,
  MapPin,
  Sliders,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { LoginScreen, NoAdminScreen } from "@/components/LoginScreen";
import Sidebar, { type NavSection } from "@/components/Sidebar";
import Dashboard from "@/components/sections/overview/Dashboard";
import AllPopups from "@/components/sections/overview/AllPopups";
import Upload from "@/components/sections/configure/Upload";
import GeoWeather from "@/components/sections/configure/GeoWeather";
import PopupTypes from "@/components/sections/configure/PopupTypes";
import ScoringStudio from "@/components/sections/configure/ScoringStudio";
import Conversions from "@/components/sections/analytics/Conversions";

const SECTIONS: NavSection[] = [
  {
    id: "overview",
    name: "Overview",
    items: [
      { id: "dashboard", name: "Dashboard", icon: <LayoutDashboard /> },
      { id: "all-popups", name: "All popups", icon: <Layers /> },
    ],
  },
  {
    id: "configure",
    name: "Configure",
    items: [
      { id: "upload", name: "Upload", icon: <UploadCloud /> },
      { id: "geo-weather", name: "Geo & weather", icon: <MapPin /> },
      { id: "popup-types", name: "Popup types", icon: <Boxes /> },
      { id: "scoring-studio", name: "Scoring Studio", icon: <Sliders /> },
    ],
  },
  {
    id: "analytics",
    name: "Analytics",
    items: [{ id: "conversions", name: "Conversions", icon: <TrendingUp /> }],
  },
];

const TITLES: Record<string, { section: string; sub: string; blurb: string }> = {
  dashboard: {
    section: "Overview",
    sub: "Dashboard",
    blurb: "Live metrics and active popup status.",
  },
  "all-popups": {
    section: "Overview",
    sub: "All popups",
    blurb: "Every popup type with status and performance.",
  },
  upload: {
    section: "Configure",
    sub: "Upload",
    blurb: "Upload banner per device + pick popup position.",
  },
  "geo-weather": {
    section: "Configure",
    sub: "Geo & weather",
    blurb: "Target popups by country and weather conditions.",
  },
  "popup-types": {
    section: "Configure",
    sub: "Popup types",
    blurb: "Enable or pause popup variants.",
  },
  "scoring-studio": {
    section: "Configure",
    sub: "Scoring Studio",
    blurb: "Live-tune scoring weights, threshold, and skip gates.",
  },
  conversions: {
    section: "Analytics",
    sub: "Conversions",
    blurb: "Intent tiers, conversion by type, and full funnel.",
  },
};

export default function Page() {
  const { user, isAdmin, loading } = useAuth();
  const [activeId, setActiveId] = useState("dashboard");
  const meta = TITLES[activeId];

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/30 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) return <LoginScreen />;
  if (!isAdmin) return <NoAdminScreen email={user.email ?? ""} />;

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar
        sections={SECTIONS}
        activeId={activeId}
        onSelect={setActiveId}
      />

      <main className="flex-1 overflow-x-hidden">
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
            <div>
              <h1 className="text-lg font-semibold leading-tight">
                {meta.sub}
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">{meta.blurb}</p>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-8 py-6">
          {activeId === "dashboard" && (
            <Dashboard onJumpToPosition={() => setActiveId("upload")} />
          )}
          {activeId === "all-popups" && <AllPopups />}
          {activeId === "upload" && <Upload />}
          {activeId === "geo-weather" && <GeoWeather />}
          {activeId === "popup-types" && <PopupTypes />}
          {activeId === "scoring-studio" && <ScoringStudio />}
          {activeId === "conversions" && <Conversions />}
        </div>
      </main>
    </div>
  );
}
