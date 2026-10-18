"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface BannerItem {
  name: string;
  logo_url: string;
}

export function RotatingClubBanner() {
  const [items, setItems] = useState<BannerItem[]>([]);

  useEffect(() => {
    async function fetchClubs() {
      const supabase = createClient();
      const { data } = await supabase
        .from("golf_clubs")
        .select("club_name, logo_url")
        .order("club_name");

      const bannerItems: BannerItem[] = [
        { name: "MyGolf-Digital", logo_url: "/images/mygolf-digital-logo.png" },
      ];

      if (data) {
        data.forEach((club) => {
          bannerItems.push({
            name: club.club_name,
            logo_url: club.logo_url || "/images/mygolf-digital-logo.png",
          });
        });
      }

      // Duplicate the list to create seamless infinite scroll
      setItems([...bannerItems, ...bannerItems]);
    }
    fetchClubs();
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="w-full overflow-hidden py-3 bg-gradient-to-r from-teal-900/80 via-emerald-900/80 to-teal-900/80 backdrop-blur-sm border-y border-teal-700/30">
      <div className="flex animate-scroll items-center gap-10">
        {items.map((item, idx) => (
          <div
            key={`${item.name}-${idx}`}
            className="flex-shrink-0 flex items-center gap-2.5 px-2"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/20 shadow-md bg-white flex-shrink-0">
              <img
                src={item.logo_url}
                alt={`${item.name} logo`}
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
            </div>
            <span className="text-[11px] font-semibold text-white/90 whitespace-nowrap tracking-wide">
              {item.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
