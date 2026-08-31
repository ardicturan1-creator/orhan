import type { Club } from "./types";

/** Prosedürel kulüp arması — 5 dış şekil × 5 iç motif, SVG olarak üretilir. */

const SHAPES = ["shield", "round", "flag", "diamond", "hex"];
const MOTIFS = ["plain", "stripes", "halves", "chevron", "quarters"];

export function crestShape(club: Club): string {
  return SHAPES[club.crest % SHAPES.length];
}
export function crestMotif(club: Club): string {
  return MOTIFS[(club.crest * 3 + club.short.length) % MOTIFS.length];
}

function pathFor(shape: string, s: number): string {
  switch (shape) {
    case "round":
      return `M${s / 2},1 A${s / 2 - 1},${s / 2 - 1} 0 1 1 ${s / 2 - 0.02},${1} Z`;
    case "flag":
      return `M2,2 H${s - 2} V${s * 0.62} Q${s / 2},${s - 1} 2,${s * 0.66} Z`;
    case "diamond":
      return `M${s / 2},1 L${s - 1},${s / 2} L${s / 2},${s - 1} L1,${s / 2} Z`;
    case "hex":
      return `M${s * 0.28},2 H${s * 0.72} L${s - 2},${s * 0.42} L${s * 0.72},${s - 2} H${s * 0.28} L2,${s * 0.42} Z`;
    default:
      return `M2,2 H${s - 2} V${s * 0.55} Q${s - 2},${s * 0.85} ${s / 2},${s - 1} Q2,${s * 0.85} 2,${s * 0.55} Z`;
  }
}

export function crestSvg(club: Club, size = 40): string {
  const s = 100;
  const p = club.kit.primary;
  const sec = club.kit.secondary;
  const motif = crestMotif(club);
  const shape = crestShape(club);
  const clipId = "cl" + club.id + Math.round(size);
  const mono = club.short.slice(0, 3).toUpperCase();
  const stars = club.rating >= 83 ? 3 : club.rating >= 78 ? 2 : club.rating >= 72 ? 1 : 0;

  let inner = "";
  if (motif === "stripes") {
    for (let i = 0; i < 5; i++) {
      inner += `<rect x="${s * 0.1 + i * s * 0.16}" y="0" width="${s * 0.08}" height="${s}" fill="${sec}" opacity="0.85"/>`;
    }
  } else if (motif === "halves") {
    inner = `<rect x="${s / 2}" y="0" width="${s / 2}" height="${s}" fill="${sec}" opacity="0.9"/>`;
  } else if (motif === "chevron") {
    inner = `<path d="M0,${s * 0.3} L${s / 2},${s * 0.5} L${s},${s * 0.3} L${s},${s * 0.52} L${s / 2},${s * 0.72} L0,${s * 0.52} Z" fill="${sec}" opacity="0.92"/>`;
  } else if (motif === "quarters") {
    inner = `<rect x="0" y="0" width="${s / 2}" height="${s / 2}" fill="${sec}" opacity="0.9"/><rect x="${s / 2}" y="${s / 2}" width="${s / 2}" height="${s / 2}" fill="${sec}" opacity="0.9"/>`;
  }

  const starRow = stars > 0
    ? Array.from({ length: stars }, (_, i) => `<circle cx="${s / 2 + (i - (stars - 1) / 2) * 11}" cy="${s * 0.86}" r="3.4" fill="#ffd54a" stroke="#3a2a00" stroke-width="0.6"/>`).join("")
    : "";

  return `<svg viewBox="0 0 ${s} ${s}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
<defs><clipPath id="${clipId}"><path d="${pathFor(shape, s)}"/></clipPath></defs>
<g clip-path="url(#${clipId})">
<rect x="0" y="0" width="${s}" height="${s}" fill="${p}"/>
${inner}
<rect x="0" y="0" width="${s}" height="${s}" fill="none" stroke="${sec}" stroke-width="4"/>
<rect x="0" y="${s * 0.63}" width="${s}" height="${s * 0.1}" fill="#00000055"/>
</g>
<text x="${s / 2}" y="${s * 0.56}" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="${s * 0.3}" fill="${sec}" stroke="#00000088" stroke-width="1.2" paint-order="stroke">${mono}</text>
${starRow}
<path d="${pathFor(shape, s)}" fill="none" stroke="${sec}" stroke-width="3.5" opacity="0.95"/>
</svg>`;
}
