"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PHOTOS } from "@/lib/photos";

const INTERVAL_MS = 5000;

export default function PhotoCarousel() {
  const n = PHOTOS.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  const go = (i: number) => setActive(((i % n) + n) % n);

  useEffect(() => {
    if (paused || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setActive((i) => (i + 1) % n), INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused, n]);

  return (
    <div
      className="photo-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Saath photo gallery"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(active - 1);
        if (e.key === "ArrowRight") go(active + 1);
      }}
    >
      <div
        className="carousel-stage"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
          touchX.current = null;
        }}
      >
        {PHOTOS.map((photo, i) => {
          // Shortest signed distance from the active slide, wrapping around.
          let d = (i - active + n) % n;
          if (d > n / 2) d -= n;
          const pos = ["center", "near", "far"][Math.abs(d)] ?? "hidden";
          return (
            <div
              key={photo.src}
              className={`carousel-slide is-${pos}`}
              style={{ "--d": d } as React.CSSProperties}
              aria-hidden={d !== 0}
              onClick={d !== 0 ? () => go(i) : undefined}
            >
              <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 680px) 85vw, 560px" />
            </div>
          );
        })}
        <button className="carousel-arrow is-prev" onClick={() => go(active - 1)} aria-label="Previous photo">‹</button>
        <button className="carousel-arrow is-next" onClick={() => go(active + 1)} aria-label="Next photo">›</button>
      </div>

      <div className="carousel-meta">
        <p aria-live="polite">
          <span>{String(active + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}</span> {PHOTOS[active].caption}
        </p>
        <div className="carousel-dots">
          {PHOTOS.map((photo, i) => (
            <button
              key={photo.src}
              className={i === active ? "is-active" : undefined}
              onClick={() => go(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === active}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
