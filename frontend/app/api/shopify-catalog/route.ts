import { NextResponse } from "next/server";

// Server-side proxy that fetches the store's PUBLIC product + collection
// lists from Shopify's open /products.json and /collections.json endpoints.
//
// Why server-side: a browser fetch to anveshan-design.myshopify.com would be
// blocked by CORS. A server-side fetch (this route, runs on Vercel) has no
// CORS restriction. No Storefront token / custom app needed — these endpoints
// are public on any live Shopify storefront.
//
// Store domain is read from SHOPIFY_STORE_DOMAIN so production can be swapped
// in later by changing one env var (no code change).

const DEFAULT_DOMAIN = "anveshan-design.myshopify.com";

type CatalogItem = { handle: string; title: string };

// Cache the upstream result for 5 minutes so every dashboard load doesn't
// hammer the Shopify storefront.
export const revalidate = 300;

async function fetchList(
  domain: string,
  path: "products.json" | "collections.json",
): Promise<CatalogItem[]> {
  const url = `https://${domain}/${path}?limit=250`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const rows: any[] =
    path === "products.json" ? (data.products ?? []) : (data.collections ?? []);
  return rows
    .filter((r) => r && r.handle)
    .map((r) => ({ handle: String(r.handle), title: String(r.title ?? r.handle) }));
}

export async function GET() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN || DEFAULT_DOMAIN;
  try {
    const [products, collections] = await Promise.all([
      fetchList(domain, "products.json"),
      fetchList(domain, "collections.json"),
    ]);
    return NextResponse.json({ domain, products, collections });
  } catch {
    return NextResponse.json(
      { domain, products: [], collections: [], error: "fetch_failed" },
      { status: 200 },
    );
  }
}
