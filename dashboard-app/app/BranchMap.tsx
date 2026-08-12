"use client";

import { useEffect, useRef } from "react";

export type BranchMapStat = {
  name: string;
  critical: number;
  excess: number;
  correct: number;
  stockSummary: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const coordinates: Record<string, [number, number]> = {
  "Brisas del Golf": [9.0643, -79.4382],
  "Costa del Este": [9.0117, -79.4782],
  Marbella: [8.9815, -79.5156],
  "Via Argentina": [8.9898, -79.5324],
};

export function BranchMap({
  branches,
  selected,
  onSelect,
}: {
  branches: BranchMapStat[];
  selected: string;
  onSelect: (branch: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || branches.length === 0) return;
    let cancelled = false;
    let cleanup = () => {};

    void import("leaflet").then((leaflet) => {
      if (cancelled || !containerRef.current) return;
      const L = leaflet.default;
      const map = L.map(containerRef.current, {
        zoomControl: false,
        scrollWheelZoom: false,
        attributionControl: true,
      });
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      const points: [number, number][] = [];
      branches.forEach((branch) => {
        const point = coordinates[branch.name];
        if (!point) return;
        points.push(point);
        const level = branch.critical > 0 ? "critical" : branch.excess > 0 ? "warning" : "ok";
        const active = selected === branch.name ? " active" : "";
        const marker = L.marker(point, {
          icon: L.divIcon({
            className: "branch-pin-shell",
            html: `<button class="branch-pin ${level}${active}" aria-label="Ver ${escapeHtml(branch.name)}"><span>⌂</span><b>${branch.critical + branch.excess}</b></button>`,
            iconSize: [52, 52],
            iconAnchor: [26, 48],
          }),
        }).addTo(map);

        marker.bindPopup(
          `<div class="map-popup"><small>SUCURSAL</small><strong>${escapeHtml(branch.name)}</strong><div><span>${branch.critical} quiebres</span><span>${branch.excess} excesos</span></div><p class="map-stock"><small>STOCK ACTUAL</small><b>${escapeHtml(branch.stockSummary)}</b></p><button>Ver detalle →</button></div>`,
          { closeButton: false, offset: [0, -34] },
        );
        marker.on("click", () => onSelect(branch.name));
        if (selected === branch.name) marker.openPopup();
      });

      if (points.length) map.fitBounds(points, { padding: [36, 36], maxZoom: 13 });
      cleanup = () => map.remove();
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [branches, selected, onSelect]);

  return <div ref={containerRef} className="branch-map" aria-label="Mapa de sucursales" />;
}
