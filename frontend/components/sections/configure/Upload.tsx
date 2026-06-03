"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Link2, Monitor, RotateCcw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  PopupSummary,
  PopupTypeCard,
  Position,
  PositionBenchmark,
} from "@/lib/types";

// No file format or size restriction — accept any image.
const ACCEPT = "image/*";

// Default fallback banner — replaced by whatever the user uploads.
const DUMMY_BANNER = "/hero-banner.jpeg";

// Swap to dummy if the real banner URL fails to load (broken URL, HTML page, CORS, etc).
function onImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  const el = e.currentTarget;
  if (!el.dataset.fallback) {
    el.dataset.fallback = "1";
    el.src = DUMMY_BANNER;
  }
}

type Status = "idle" | "saving" | "submitted";

const POSITIONS: Position[] = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

const POSITION_LABEL: Record<Position, string> = {
  "top-left": "Top left",
  "top-center": "Top center",
  "top-right": "Top right",
  "middle-left": "Middle left",
  center: "Center",
  "middle-right": "Middle right",
  "bottom-left": "Bottom left",
  "bottom-center": "Bottom center",
  "bottom-right": "Bottom right",
};

const ALIGN: Record<Position, string> = {
  "top-left": "items-start justify-start",
  "top-center": "items-start justify-center",
  "top-right": "items-start justify-end",
  "middle-left": "items-center justify-start",
  center: "items-center justify-center",
  "middle-right": "items-center justify-end",
  "bottom-left": "items-end justify-start",
  "bottom-center": "items-end justify-center",
  "bottom-right": "items-end justify-end",
};

export default function Upload() {
  const [popupTypes, setPopupTypes] = useState<PopupTypeCard[]>([]);
  const [popups, setPopups] = useState<PopupSummary[]>([]);
  const [targetPopupId, setTargetPopupId] = useState<string>("");

  useEffect(() => {
    api.getPopupTypes().then(setPopupTypes);
    api.getPopups().then(setPopups);
  }, []);

  useEffect(() => {
    if (!targetPopupId && popupTypes.length) {
      setTargetPopupId(popupTypes[0].id);
    }
  }, [popupTypes, targetPopupId]);

  const popup = popups.find((p) => p.id === targetPopupId);

  const refreshPopups = async () => {
    const fresh = await api.getPopups();
    setPopups(fresh);
  };

  // Resolve banner: uploaded URL → falls back to dummy hero image
  const resolvedBanner = popup?.bannerUrl || DUMMY_BANNER;

  return (
    <div className="space-y-5">
      <PopupTypePicker
        popupTypes={popupTypes}
        value={targetPopupId}
        onChange={setTargetPopupId}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <BrowseUploadCard
          targetPopupId={targetPopupId}
          onSaved={refreshPopups}
        />
        <CdnUrlCard
          targetPopupId={targetPopupId}
          currentUrl={popup?.bannerUrl}
          onSaved={refreshPopups}
        />
      </div>

      <BannerPreviewCard
        banner={resolvedBanner}
        hasUpload={!!popup?.bannerUrl}
        targetPopupId={targetPopupId}
        onReset={refreshPopups}
      />

      <PositionSection
        targetPopupId={targetPopupId}
        currentPosition={popup?.position}
        bannerUrl={resolvedBanner}
        onSaved={refreshPopups}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Popup type picker                                                          */
/* -------------------------------------------------------------------------- */

function PopupTypePicker({
  popupTypes,
  value,
  onChange,
}: {
  popupTypes: PopupTypeCard[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">
          Choose popup to update
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Banner + position you set here apply to this popup type.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {popupTypes.map((p) => {
            const isActive = p.id === value;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onChange(p.id)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  isActive
                    ? "border-foreground/30 bg-accent font-medium"
                    : "hover:bg-accent/50",
                )}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Browse file upload                                                         */
/* -------------------------------------------------------------------------- */

function BrowseUploadCard({
  targetPopupId,
  onSaved,
}: {
  targetPopupId: string;
  onSaved: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    setFile(null);
    setError(null);
    setStatus("idle");
  }, [targetPopupId]);

  const validate = (f: File): string | null => {
    if (!f.type.startsWith("image/")) return "Pick an image file.";
    return null;
  };

  const onPick = () => {
    setError(null);
    inputRef.current?.click();
  };

  const onPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const err = validate(f);
    if (err) {
      setError(err);
      return;
    }
    setFile(f);
    setStatus("idle");
    setError(null);
  };

  const onSave = async () => {
    if (!file || error || !targetPopupId) return;
    setStatus("saving");
    try {
      const result = await api.uploadBanner(file);
      const url = (result as { url?: string }).url;
      if (url) await api.setPopupBanner(targetPopupId, url);
      setStatus("submitted");
      onSaved();
    } catch (e) {
      setError((e as Error).message || "Upload failed.");
      setStatus("idle");
    }
  };

  const onRemove = () => {
    setFile(null);
    setStatus("idle");
    setError(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <div className="flex items-center gap-2">
            <ImagePlus className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Browse file</CardTitle>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload from your device &middot; any image format &middot; any size
          </p>
        </div>
        {status === "submitted" && (
          <Badge
            variant="secondary"
            className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
          >
            Submitted
          </Badge>
        )}
      </CardHeader>

      <Separator />

      <CardContent className="p-5">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={onPicked}
        />

        {!file ? (
          <button
            type="button"
            onClick={onPick}
            disabled={!targetPopupId}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-muted/30 px-6 py-10 transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ImagePlus className="h-7 w-7 text-muted-foreground" />
            <div className="text-sm font-medium">Choose a banner</div>
            <div className="text-xs text-muted-foreground">
              Any image format &middot; any size &middot; same image used on
              both mobile & desktop
            </div>
          </button>
        ) : (
          <div className="flex gap-4">
            <div className="flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{file.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB
              </div>
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      </CardContent>

      <Separator />
      <div className="flex items-center justify-end gap-2 p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={!file || status === "saving"}
        >
          Remove
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={!file || !!error || status !== "idle" || !targetPopupId}
        >
          {status === "saving"
            ? "Saving…"
            : status === "submitted"
              ? "Submitted"
              : "Save"}
        </Button>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* CDN URL                                                                    */
/* -------------------------------------------------------------------------- */

function CdnUrlCard({
  targetPopupId,
  currentUrl,
  onSaved,
}: {
  targetPopupId: string;
  currentUrl: string | undefined;
  onSaved: () => void;
}) {
  const [url, setUrl] = useState(currentUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    setUrl(currentUrl ?? "");
    setError(null);
    setStatus("idle");
  }, [currentUrl, targetPopupId]);

  const validate = (u: string): string | null => {
    if (!u.trim()) return "Paste a URL.";
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== "https:")
        return "URL must start with https:// (CDNs serve over https).";
    } catch {
      return "Not a valid URL.";
    }
    return null;
  };

  const onSave = async () => {
    const err = validate(url);
    if (err) {
      setError(err);
      return;
    }
    if (!targetPopupId) return;
    setStatus("saving");
    setError(null);
    try {
      await api.setPopupBanner(targetPopupId, url.trim());
      setStatus("submitted");
      onSaved();
    } catch (e) {
      setError((e as Error).message || "Save failed.");
      setStatus("idle");
    }
  };

  const onClear = () => {
    setUrl("");
    setError(null);
    setStatus("idle");
  };

  const previewOk = !validate(url);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">CDN URL</CardTitle>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Paste an https image URL hosted on Cloudinary, ImageKit, Bunny.net,
            Shopify CDN, etc.
          </p>
        </div>
        {status === "submitted" && (
          <Badge
            variant="secondary"
            className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
          >
            Submitted
          </Badge>
        )}
      </CardHeader>

      <Separator />

      <CardContent className="p-5">
        <label className="text-xs font-medium text-muted-foreground">
          Image URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (status === "submitted") setStatus("idle");
            setError(null);
          }}
          placeholder="https://res.cloudinary.com/anveshan/image/upload/banner.webp"
          disabled={!targetPopupId}
          className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />

        {previewOk && (
          <div className="mt-4 flex h-24 w-full items-center justify-center overflow-hidden rounded-md border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              onError={onImgError}
              className="h-full w-full object-contain"
            />
          </div>
        )}

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      </CardContent>

      <Separator />
      <div className="flex items-center justify-end gap-2 p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={!url || status === "saving"}
        >
          Clear
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={!url || status === "saving" || !targetPopupId}
        >
          {status === "saving"
            ? "Saving…"
            : status === "submitted"
              ? "Submitted"
              : "Save"}
        </Button>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Banner preview — both mobile + desktop, single banner                      */
/* -------------------------------------------------------------------------- */

function BannerPreviewCard({
  banner,
  hasUpload,
  targetPopupId,
  onReset,
}: {
  banner: string;
  hasUpload: boolean;
  targetPopupId: string;
  onReset: () => void;
}) {
  const [resetting, setResetting] = useState(false);

  const onResetClick = async () => {
    if (!targetPopupId || !hasUpload || resetting) return;
    setResetting(true);
    try {
      await api.setPopupBanner(targetPopupId, "");
      onReset();
    } finally {
      setResetting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold">
              Banner preview
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Same image rendered responsively on each device.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!hasUpload && (
              <Badge variant="outline" className="text-[10px]">
                Showing dummy
              </Badge>
            )}
            {hasUpload && (
              <Button
                size="sm"
                variant="outline"
                onClick={onResetClick}
                disabled={resetting}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {resetting ? "Resetting…" : "Reset to default"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid items-start gap-6 sm:grid-cols-[1fr_auto]">
          <DesktopFrame banner={banner} />
          <MobileFrame banner={banner} />
        </div>
      </CardContent>
    </Card>
  );
}

function DesktopFrame({ banner }: { banner: string }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Monitor className="mr-1 inline h-3.5 w-3.5" /> Desktop view
      </div>
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="ml-3 truncate rounded bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
            anveshan.farm
          </span>
        </div>
        <div className="relative flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-muted/20 to-muted/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={banner}
            alt=""
            onError={onImgError}
            className="max-h-[80%] max-w-[70%] rounded-md object-contain shadow-md ring-1 ring-border"
          />
        </div>
      </div>
    </div>
  );
}

function MobileFrame({ banner }: { banner: string }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Smartphone className="mr-1 inline h-3.5 w-3.5" /> Mobile view
      </div>
      <div className="relative mx-auto h-[320px] w-[170px] rounded-[28px] border-[6px] border-foreground/80 bg-background shadow-md">
        <div className="absolute left-1/2 top-0 h-3 w-16 -translate-x-1/2 rounded-b-lg bg-foreground/80" />
        <div className="flex h-full w-full items-end overflow-hidden rounded-[20px] bg-gradient-to-br from-muted/20 to-muted/40 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={banner}
            alt=""
            onError={onImgError}
            className="w-full rounded-md object-cover shadow-md ring-1 ring-border"
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Position picker + live preview                                             */
/* -------------------------------------------------------------------------- */

function PositionSection({
  targetPopupId,
  currentPosition,
  bannerUrl,
  onSaved,
}: {
  targetPopupId: string;
  currentPosition: Position | undefined;
  bannerUrl: string;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Position>(
    currentPosition ?? "bottom-left",
  );
  const [benchmarks, setBenchmarks] = useState<PositionBenchmark[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getPositionBenchmarks().then(setBenchmarks);
  }, []);

  useEffect(() => {
    if (currentPosition) setSelected(currentPosition);
  }, [currentPosition, targetPopupId]);

  const ctrFor = useMemo(() => {
    const map = new Map(benchmarks.map((b) => [b.position, b.ctr]));
    return (p: Position) => map.get(p) ?? 0;
  }, [benchmarks]);

  const onApply = async () => {
    if (!targetPopupId || selected === currentPosition) return;
    setSaving(true);
    await api.setPopupPosition(targetPopupId, selected);
    setSaving(false);
    setSaved(true);
    onSaved();
    setTimeout(() => setSaved(false), 1500);
  };

  const dirty = selected !== currentPosition;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Position</CardTitle>
        <p className="text-xs text-muted-foreground">
          Where this popup appears on the page. Live preview shows both
          devices.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 lg:grid-cols-5">
          {/* Picker */}
          <div className="lg:col-span-2">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Pick a slot</span>
              {currentPosition && (
                <span className="text-muted-foreground">
                  Current:{" "}
                  <span className="font-medium text-foreground">
                    {POSITION_LABEL[currentPosition]}
                  </span>
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {POSITIONS.map((p) => {
                const isSelected = p === selected;
                const isCurrent = p === currentPosition;
                const ctr = ctrFor(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelected(p)}
                    className={cn(
                      "relative flex h-20 flex-col items-center justify-center rounded-md border-2 p-2 text-center transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-muted-foreground/40 hover:bg-accent/30",
                    )}
                  >
                    <div className="text-[10px] font-medium leading-tight">
                      {POSITION_LABEL[p]}
                    </div>
                    <div
                      className={cn(
                        "mt-1 text-[10px] tabular-nums",
                        ctr >= 18
                          ? "text-emerald-600 dark:text-emerald-400"
                          : ctr <= 10
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground",
                      )}
                    >
                      {ctr}% CTR
                    </div>
                    {isCurrent && (
                      <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live previews — both devices */}
          <div className="grid gap-4 lg:col-span-3 sm:grid-cols-[1fr_auto]">
            <PositionedDesktopPreview
              position={selected}
              bannerUrl={bannerUrl}
            />
            <PositionedMobilePreview
              position={selected}
              bannerUrl={bannerUrl}
            />
          </div>
        </div>

        <Separator className="my-5" />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Moving to{" "}
            <span className="font-medium text-foreground">
              {POSITION_LABEL[selected]}
            </span>{" "}
            ({ctrFor(selected)}% CTR benchmark).
          </p>
          <Button
            size="sm"
            onClick={onApply}
            disabled={!targetPopupId || !dirty || saving}
          >
            {saving ? "Applying…" : saved ? "Applied" : "Apply position"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PositionedDesktopPreview({
  position,
  bannerUrl,
}: {
  position: Position;
  bannerUrl: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Monitor className="mr-1 inline h-3.5 w-3.5" /> Desktop
      </div>
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-400" />
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
        </div>
        <div className="relative aspect-[16/10] w-full bg-gradient-to-br from-muted/20 to-muted/40">
          <div className={cn("absolute inset-3 flex", ALIGN[position])}>
            <PopupChip bannerUrl={bannerUrl} sizeClass="h-16 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PositionedMobilePreview({
  position,
  bannerUrl,
}: {
  position: Position;
  bannerUrl: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Smartphone className="mr-1 inline h-3.5 w-3.5" /> Mobile
      </div>
      <div className="relative mx-auto h-[260px] w-[140px] rounded-[24px] border-[5px] border-foreground/80 bg-background shadow-md">
        <div className="absolute left-1/2 top-0 h-2.5 w-12 -translate-x-1/2 rounded-b-lg bg-foreground/80" />
        <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-gradient-to-br from-muted/20 to-muted/40">
          <div className={cn("absolute inset-2 flex", ALIGN[position])}>
            <PopupChip bannerUrl={bannerUrl} sizeClass="h-12 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PopupChip({
  bannerUrl,
  sizeClass,
}: {
  bannerUrl: string;
  sizeClass: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-md border bg-card shadow-md ring-2 ring-primary/30",
        sizeClass,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bannerUrl}
        alt=""
        onError={onImgError}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
