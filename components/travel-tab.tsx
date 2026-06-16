"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface TravelDeal {
  travel_id: number;
  name: string;
  description: string | null;
  destination: string | null;
  type: string | null;
  image_url: string | null;
  affiliate_url: string | null;
  partner_name: string | null;
  featured: boolean | null;
  sort_order: number | null;
}

const TYPE_LABELS: Record<string, string> = {
  package: "Package",
  hotel: "Hotel",
  tee_time: "Tee Time",
  transport: "Transport",
};

function TravelCard({ deal }: { deal: TravelDeal }) {
  return (
    <Card className="overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col">
      <div className="relative aspect-video bg-slate-100 dark:bg-slate-900">
        {deal.image_url ? (
          <Image
            src={deal.image_url || "/placeholder.svg"}
            alt={deal.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300 dark:text-slate-600">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}
        {deal.featured && (
          <span className="absolute top-2 left-2 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide bg-teal-500 text-white rounded-full">
            Featured
          </span>
        )}
        {deal.type && (
          <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide bg-slate-900/70 text-white rounded-full">
            {TYPE_LABELS[deal.type] || deal.type}
          </span>
        )}
      </div>
      <CardContent className="flex flex-1 flex-col gap-1.5 p-3">
        {deal.destination && (
          <p className="text-[9px] font-semibold uppercase tracking-wide text-teal-500 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {deal.destination}
          </p>
        )}
        <h3 className="text-xs font-bold leading-tight text-slate-800 dark:text-slate-100 line-clamp-2">{deal.name}</h3>
        {deal.description && (
          <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">{deal.description}</p>
        )}
        <div className="mt-auto flex flex-col gap-2 pt-2">
          {deal.partner_name && (
            <p className="text-[9px] text-slate-400 dark:text-slate-500">Partner: {deal.partner_name}</p>
          )}
          <Button
            size="sm"
            className="h-8 w-full bg-teal-500 text-white hover:bg-teal-600 text-[11px]"
            disabled={!deal.affiliate_url}
            onClick={() => deal.affiliate_url && window.open(deal.affiliate_url, "_blank", "noopener,noreferrer")}
          >
            View Deal
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TravelTab() {
  const [deals, setDeals] = useState<TravelDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<string>("all");

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from("travel_affiliates")
          .select("travel_id, name, description, destination, type, image_url, affiliate_url, partner_name, featured, sort_order")
          .eq("active", true)
          .order("sort_order", { ascending: true, nullsFirst: false });
        if (!isMounted) return;
        if (fetchError) {
          setError("Could not load travel deals. Please try again later.");
        } else {
          setDeals(data || []);
        }
      } catch {
        if (isMounted) setError("Could not load travel deals. Please try again later.");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const types = ["all", ...Array.from(new Set(deals.map((d) => d.type).filter((t): t is string => !!t)))];
  const filtered = type === "all" ? deals : deals.filter((d) => d.type === type);
  const featured = filtered.filter((d) => d.featured);
  const rest = filtered.filter((d) => !d.featured);

  return (
    <div className="space-y-4">
      <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs flex items-center gap-2">
            <svg className="w-4 h-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            MyGolf Travel
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-video rounded-lg bg-slate-100 dark:bg-slate-700" />
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">No travel deals found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {types.length > 2 && (
                <div className="flex flex-wrap gap-1.5">
                  {types.map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                        type === t
                          ? "bg-teal-500 text-white"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                      }`}
                    >
                      {t === "all" ? "All" : TYPE_LABELS[t] || t}
                    </button>
                  ))}
                </div>
              )}
              {featured.length > 0 && type === "all" && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-teal-500">Featured</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {featured.map((d) => (
                      <TravelCard key={d.travel_id} deal={d} />
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(type === "all" ? rest : filtered).map((d) => (
                  <TravelCard key={d.travel_id} deal={d} />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
