"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ShopProduct {
  product_id: number;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  image_url: string | null;
  affiliate_url: string | null;
  partner_name: string | null;
  featured: boolean | null;
  sort_order: number | null;
}

function ProductCard({ product }: { product: ShopProduct }) {
  return (
    <Card className="overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col">
      <div className="relative aspect-square bg-slate-100 dark:bg-slate-900">
        {product.image_url ? (
          <Image
            src={product.image_url || "/placeholder.svg"}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300 dark:text-slate-600">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
        )}
        {product.featured && (
          <span className="absolute top-2 left-2 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide bg-[#c9a84c] text-white rounded-full">
            Featured
          </span>
        )}
      </div>
      <CardContent className="flex flex-1 flex-col gap-1.5 p-3">
        {product.brand && (
          <p className="text-[9px] font-semibold uppercase tracking-wide text-[#c9a84c]">{product.brand}</p>
        )}
        <h3 className="text-xs font-bold leading-tight text-slate-800 dark:text-slate-100 line-clamp-2">{product.name}</h3>
        {product.description && (
          <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">{product.description}</p>
        )}
        <div className="mt-auto flex flex-col gap-2 pt-2">
          {product.partner_name && (
            <p className="text-[9px] text-slate-400 dark:text-slate-500">Partner: {product.partner_name}</p>
          )}
          <Button
            size="sm"
            className="h-8 w-full bg-[#c9a84c] text-white hover:bg-[#b89640] text-[11px]"
            disabled={!product.affiliate_url}
            onClick={() => product.affiliate_url && window.open(product.affiliate_url, "_blank", "noopener,noreferrer")}
          >
            Shop Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ShopTab() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("all");

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from("shop_products")
          .select("product_id, name, description, category, brand, image_url, affiliate_url, partner_name, featured, sort_order")
          .eq("active", true)
          .order("sort_order", { ascending: true, nullsFirst: false });
        if (!isMounted) return;
        if (fetchError) {
          setError("Could not load products. Please try again later.");
        } else {
          setProducts(data || []);
        }
      } catch {
        if (isMounted) setError("Could not load products. Please try again later.");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const categories = ["all", ...Array.from(new Set(products.map((p) => p.category).filter((c): c is string => !!c)))];
  const filtered = category === "all" ? products : products.filter((p) => p.category === category);
  const featured = filtered.filter((p) => p.featured);
  const rest = filtered.filter((p) => !p.featured);

  return (
    <div className="space-y-4">
      <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs flex items-center gap-2">
            <svg className="w-4 h-4 text-[#c9a84c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            MyGolf Shop
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-6">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square rounded-lg bg-slate-100 dark:bg-slate-700" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-slate-100 dark:bg-slate-700" />
                  <div className="mt-1.5 h-2 w-1/2 rounded bg-slate-100 dark:bg-slate-700" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <p className="text-sm font-semibold text-red-500">{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <svg className="w-12 h-12 text-slate-200 dark:text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">No products found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {categories.length > 2 && (
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold capitalize transition-colors ${
                        category === c
                          ? "bg-[#c9a84c] text-white"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                      }`}
                    >
                      {c === "all" ? "All" : c}
                    </button>
                  ))}
                </div>
              )}
              {featured.length > 0 && category === "all" && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#c9a84c]">Featured</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {featured.map((p) => (
                      <ProductCard key={p.product_id} product={p} />
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {(category === "all" ? rest : filtered).map((p) => (
                  <ProductCard key={p.product_id} product={p} />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
