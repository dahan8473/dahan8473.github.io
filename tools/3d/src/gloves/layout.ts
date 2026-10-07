// Where the gloves sit on the Muay Thai card, in fractions of the card's width
// (the card photo is 4:3, so its height is 0.75 of the width). They hang off the
// top edge toward the right corner, clear of the faces in the photo. The canvas
// box covers the photo from there, reaches a little above the card and past its
// right edge so the lace loop and the swing never clip; the hang point (the lace
// over the top edge) is at the canvas's horizontal middle.
export const PIC_H = 0.75;
export const HANG_AT = 0.84;
export const BOX = { left: HANG_AT - 0.225, width: 0.45, above: 0.1 };
export const BOX_H = BOX.above + PIC_H;
/** Hang point inside the canvas, as fractions of its width and height. */
export const HANG = { x: 0.5, y: BOX.above / BOX_H };
/** The card's right edge inside the canvas (fraction of its width). */
export const CARD_RIGHT = (1 - BOX.left) / BOX.width;
/** The card's left edge inside the canvas (negative: off to the left). */
export const CARD_LEFT = -BOX.left / BOX.width;
/** How much of the photo's height the hanging pair spans. */
export const FILL = 0.45;
/** Model height from the hang point to the lowest fist, meters (gloves.glb). */
export const MODEL_H = 0.32;
/** The card edge sits this far below the model origin (the lace's top), meters. */
export const EDGE_DROP = 0.0034;
export const FOV = 16;
/** World height the canvas shows at the card plane (z = 0). */
export const VIEW_H = (MODEL_H * BOX_H) / (FILL * PIC_H);
export const CAM_Z = VIEW_H / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);
/** Camera height: the canvas middle, below the hang point (world y = 0). */
export const CAM_Y = -VIEW_H * (0.5 - HANG.y);

const pct = (v: number) => +(v * 100).toFixed(3) + '%';

/** Placement for the mount element (inside a.hob-card) and its hover lift. */
export const PLACE_CSS = `
.hob-card:has(> .hob-gloves) { position: relative; }
.hob-gloves { position: absolute; z-index: 2; display: block; left: ${pct(BOX.left)}; top: 0; width: ${pct(BOX.width)}; margin-top: -${pct(BOX.above)}; aspect-ratio: ${BOX.width} / ${+BOX_H.toFixed(4)}; pointer-events: none; transition: transform 320ms cubic-bezier(.2, .8, .2, 1); }
@media (hover: hover) { .hob-card:hover .hob-gloves { transform: translateY(-3px); } }
@media (prefers-reduced-motion: reduce) { .hob-gloves { transition: none; } }
`;
