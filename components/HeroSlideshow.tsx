"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { PHOTOS } from "@/lib/photos";

const INTERVAL_MS = 4500;

// Cross-fades through every event photo. Renders the <img>s directly so they
// stay children of .hero-photo and pick up its rounded-corner styles.
export default function HeroSlideshow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setActive((i) => (i + 1) % PHOTOS.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      {PHOTOS.map((photo, i) => (
        <Image
          key={photo.src}
          src={photo.src}
          alt={i === active ? photo.alt : ""}
          aria-hidden={i !== active}
          fill
          sizes="(max-width: 860px) 100vw, 50vw"
          className={i === active ? "is-active" : undefined}
          preload={i === 0}
        />
      ))}
    </>
  );
}
