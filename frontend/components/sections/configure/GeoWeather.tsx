"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudRain, Snowflake, Sun, Thermometer, Wind } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { City, WeatherCondition, WeatherRule } from "@/lib/types";

const WEATHER: { id: WeatherCondition; label: string; icon: React.ReactNode }[] = [
  { id: "rainy", label: "Rainy", icon: <CloudRain className="h-3.5 w-3.5" /> },
  { id: "sunny", label: "Sunny", icon: <Sun className="h-3.5 w-3.5" /> },
  { id: "cold", label: "Cold", icon: <Snowflake className="h-3.5 w-3.5" /> },
  { id: "hot", label: "Hot", icon: <Thermometer className="h-3.5 w-3.5" /> },
  { id: "windy", label: "Windy", icon: <Wind className="h-3.5 w-3.5" /> },
  { id: "cloudy", label: "Cloudy", icon: <Cloud className="h-3.5 w-3.5" /> },
];

export default function GeoWeather() {
  const [cities, setCities] = useState<City[]>([]);
  const [rule, setRule] = useState<WeatherRule | null>(null);

  useEffect(() => {
    api.getCities().then(setCities);
    api.getWeatherRule().then(setRule);
  }, []);

  const toggleCity = (code: string) => {
    setCities((cs) =>
      cs.map((c) => {
        if (c.code !== code) return c;
        const next = !c.enabled;
        api.toggleCity(code, next);
        return { ...c, enabled: next };
      }),
    );
  };

  const toggleWeather = (cond: WeatherCondition) => {
    if (!rule) return;
    const next = rule.conditions.includes(cond)
      ? rule.conditions.filter((c) => c !== cond)
      : [...rule.conditions, cond];
    setRule({ ...rule, conditions: next });
    api.setWeatherRule(next);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Indian cities</CardTitle>
            <Badge variant="outline">
              {cities.filter((c) => c.enabled).length} of {cities.length} live
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Target upper-middle-class, health-conscious urban audiences.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {cities.map((c) => (
            <div
              key={c.code}
              className="flex items-center justify-between rounded-md border bg-background px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-7 w-10 place-items-center rounded border bg-muted text-[10px] font-semibold">
                  {c.code}
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {c.region}
                  </div>
                </div>
              </div>
              <Switch
                checked={c.enabled}
                onCheckedChange={() => toggleCity(c.code)}
                aria-label={`Toggle ${c.name}`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Weather triggers</CardTitle>
          <p className="text-xs text-muted-foreground">
            Show popups only when the visitor's local weather matches.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {WEATHER.map((w) => {
              const isActive = rule?.conditions.includes(w.id);
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => toggleWeather(w.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
                  )}
                >
                  {w.icon}
                  {w.label}
                </button>
              );
            })}
          </div>

          {rule && (
            <div className="mt-5 rounded-lg border bg-muted/40 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Active rule
                </div>
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Live
                </span>
              </div>
              <div className="mt-2 text-sm font-medium">{rule.name}</div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                Triggers on
                {rule.conditions.length === 0 ? (
                  <span className="italic">no conditions</span>
                ) : (
                  rule.conditions.map((c) => (
                    <Badge key={c} variant="secondary" className="capitalize">
                      {c}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
