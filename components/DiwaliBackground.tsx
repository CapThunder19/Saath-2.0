import type { CSSProperties } from "react";

export default function DiwaliBackground() {
  return (
    <div className="diwali-background" aria-hidden="true">
      <div className="festive-stars" />
      {Array.from({ length: 6 }, (_, index) => (
        <div className={`skyshot skyshot-${index + 1}`} key={index} style={{ "--delay": `${index * -1.7}s` } as CSSProperties}>
          <span className="skyshot-trail" />
          {Array.from({ length: 16 }, (_, ray) => (
            <span className="skyshot-ray" key={ray} style={{ "--angle": `${ray * 22.5}deg`, "--reach": `${ray % 2 ? 85 : 115}px` } as CSSProperties}><i /></span>
          ))}
        </div>
      ))}
      <div className="diya-row">
        {Array.from({ length: 7 }, (_, index) => (
          <div className="diya" key={index} style={{ "--flicker-delay": `${index * -.37}s` } as CSSProperties}>
            <span className="diya-glow" /><span className="diya-flame" /><span className="diya-wick" /><span className="diya-bowl" />
          </div>
        ))}
      </div>
    </div>
  );
}
