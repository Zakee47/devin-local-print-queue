"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ABOUT_PHOTOS } from "./data";

// Four event photos; click to open the 1600px version in a lightbox.
export default function Quad() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState<(typeof ABOUT_PHOTOS)[number] | null>(null);

  const openPhoto = (photo: (typeof ABOUT_PHOTOS)[number]) => {
    setActive(photo);
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  return (
    <>
      <div className="dl-quad">
        {ABOUT_PHOTOS.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => openPhoto(photo)}
            aria-label={`Open photo: ${photo.alt}`}
            data-reveal
            style={{ ["--d" as string]: `${0.08 * i}s` }}
          >
            <Image
              src={`/landing/about/about-${photo.id}-800.webp`}
              alt={photo.alt}
              width={800}
              height={450}
              sizes="(max-width: 900px) 50vw, 330px"
              unoptimized
            />
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="dl-lb"
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
        onClose={() => setActive(null)}
      >
        <button type="button" aria-label="Close" onClick={close}>
          ×
        </button>
        {active ? (
          <Image
            src={`/landing/about/about-${active.id}-1600.webp`}
            alt={active.alt}
            width={1600}
            height={899}
            sizes="92vw"
            unoptimized
          />
        ) : null}
      </dialog>
    </>
  );
}
