/* ============================================================
 * 图标库：农作物 & 收集物 的自绘 SVG 矢量插图
 * 无外部依赖、无版权风险，与暖色主题风格统一
 * ============================================================ */
"use strict";

const ICON = (body) =>
  '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' + body + "</svg>";

/* 通用兜底图标 */
const GENERIC_ICON = ICON(
  '<circle cx="32" cy="32" r="18" fill="#cfe3b8"/>' +
  '<path d="M32 50V24M32 24c-5-4-10-4-14 0M32 24c5-4 10-4 14 0" stroke="#5f9e3f" stroke-width="4" fill="none" stroke-linecap="round"/>'
);

/* ---------- 农作物 ---------- */
const CROP_ICONS = {
  parsnip: ICON(
    '<path d="M32 52c-3-8-5-18 0-26 5 8 3 18 0 26z" fill="#eee0bf"/>' +
    '<path d="M32 26c-3-5-8-9-14-12M32 26c-1-7-3-14-1-20M32 26c3-5 8-9 14-12" stroke="#6b9e3a" stroke-width="4" fill="none" stroke-linecap="round"/>'
  ),
  potato: ICON(
    '<ellipse cx="32" cy="34" rx="18" ry="14" fill="#b98a54"/>' +
    '<ellipse cx="26" cy="30" rx="2" ry="1.5" fill="#8a6135"/><ellipse cx="36" cy="40" rx="2" ry="1.5" fill="#8a6135"/><ellipse cx="38" cy="26" rx="1.5" ry="1" fill="#8a6135"/>'
  ),
  greenbean: ICON(
    '<path d="M22 16c6 12 14 20 22 30" stroke="#5f9e3f" stroke-width="10" fill="none" stroke-linecap="round"/>' +
    '<path d="M22 16c6 12 14 20 22 30" stroke="#7cb342" stroke-width="5" fill="none" stroke-linecap="round"/>'
  ),
  cauliflower: ICON(
    '<circle cx="32" cy="26" r="15" fill="#f4ecd8"/>' +
    '<circle cx="26" cy="22" r="8" fill="#faf6ea"/><circle cx="38" cy="24" r="8" fill="#faf6ea"/><circle cx="32" cy="30" r="8" fill="#e8e0cc"/>' +
    '<path d="M18 46c-2-10 2-18 10-24M46 46c2-10-2-18-10-24" stroke="#5f9e3f" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    '<path d="M26 52h12" stroke="#5f9e3f" stroke-width="5" stroke-linecap="round"/>'
  ),
  strawberry: ICON(
    '<path d="M32 22c10 4 16 12 16 20 0 8-7 14-16 14s-16-6-16-14c0-8 6-16 16-20z" fill="#e05252"/>' +
    '<g fill="#f7d27a"><circle cx="27" cy="38" r="1.3"/><circle cx="33" cy="44" r="1.3"/><circle cx="38" cy="36" r="1.3"/><circle cx="30" cy="50" r="1.3"/><circle cx="37" cy="48" r="1.3"/><circle cx="26" cy="46" r="1.3"/></g>' +
    '<path d="M32 22l-9-6M32 22l9-6M32 22l-5-8M32 22l5-8" stroke="#5f9e3f" stroke-width="4" stroke-linecap="round"/>'
  ),
  kale: ICON(
    '<path d="M32 52c-2-8-2-16 2-22M32 52c4-6 4-14 0-20" stroke="#5f9e3f" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    '<path d="M32 30c-10-2-16-10-16-18 8 2 14 8 16 18z" fill="#7cb342"/>' +
    '<path d="M32 30c10-2 16-10 16-18-8 2-14 8-16 18z" fill="#5f9e3f"/>'
  ),
  blueberry: ICON(
    '<circle cx="26" cy="36" r="10" fill="#5a86c5"/><circle cx="38" cy="36" r="10" fill="#4a74b0"/><circle cx="32" cy="26" r="9" fill="#6f9fc4"/>' +
    '<circle cx="30" cy="24" r="3" fill="#9cc0dd"/>' +
    '<path d="M32 26c-3-4-6-7-6-11M32 26c3-4 6-7 6-11" stroke="#5f9e3f" stroke-width="3" stroke-linecap="round"/>'
  ),
  melon: ICON(
    '<circle cx="32" cy="34" r="20" fill="#7cb342"/>' +
    '<path d="M18 26c4-2 8 0 10 3M28 22c3-1 6 0 8 2M32 16c-4-3-8-2-10 2M42 24c2-1 4-1 6 0" stroke="#5f9e3f" stroke-width="3" fill="none"/>'
  ),
  tomato: ICON(
    '<circle cx="32" cy="36" r="18" fill="#e05252"/>' +
    '<ellipse cx="27" cy="32" rx="4" ry="2.5" fill="#f0735f" transform="rotate(-30 27 32)"/>' +
    '<path d="M32 20l-6-6M32 20l6-6M32 20l-10-2M32 20l10-2M32 20l-4-9" stroke="#5f9e3f" stroke-width="4" stroke-linecap="round"/>'
  ),
  hotpepper: ICON(
    '<path d="M30 20c4-2 10-2 12 2 2 5 0 10-4 16-3-6-6-12-8-18z" fill="#e05252"/>' +
    '<path d="M44 38c2 8 0 14-6 16-3-8-1-14 6-16z" fill="#d14040"/>' +
    '<path d="M30 20c-2-4-1-8 2-12" stroke="#5f9e3f" stroke-width="4" stroke-linecap="round"/>'
  ),
  wheat: ICON(
    '<path d="M32 54V26" stroke="#c99a3f" stroke-width="4" stroke-linecap="round"/>' +
    '<ellipse cx="32" cy="22" rx="4" ry="9" fill="#f4c542"/><ellipse cx="32" cy="14" rx="3.5" ry="8" fill="#e0a53a"/>' +
    '<path d="M26 40c4-2 8-2 12 0M25 48c4-2 8-2 12 0" stroke="#c99a3f" stroke-width="3" fill="none" stroke-linecap="round"/>'
  ),
  corn: ICON(
    '<path d="M20 22c-3 10-3 20 0 30h24c3-10 3-20 0-30z" fill="#f4c542"/>' +
    '<path d="M26 24c2 8 2 18 0 26M32 22c0 9 0 19 0 28M38 24c-2 8-2 18 0 26" stroke="#e0a53a" stroke-width="2"/>' +
    '<path d="M14 16c4-4 12-6 18-6M50 16c-4-4-12-6-18-6" stroke="#5f9e3f" stroke-width="5" fill="none" stroke-linecap="round"/>'
  ),
  sunflower: ICON(
    '<g fill="#f4c542"><ellipse cx="32" cy="14" rx="4" ry="8"/><ellipse cx="32" cy="50" rx="4" ry="8"/><ellipse cx="14" cy="32" rx="8" ry="4"/><ellipse cx="50" cy="32" rx="8" ry="4"/><ellipse cx="19" cy="19" rx="4" ry="8" transform="rotate(45 19 19)"/><ellipse cx="45" cy="45" rx="4" ry="8" transform="rotate(45 45 45)"/><ellipse cx="45" cy="19" rx="4" ry="8" transform="rotate(-45 45 19)"/><ellipse cx="19" cy="45" rx="4" ry="8" transform="rotate(-45 19 45)"/></g>' +
    '<circle cx="32" cy="32" r="13" fill="#8a5a33"/><circle cx="32" cy="32" r="11" fill="#a06a3f"/>'
  ),
  pumpkin: ICON(
    '<path d="M32 20c-10-4-20 4-20 14 0 10 8 18 20 18s20-8 20-18c0-10-10-18-20-14z" fill="#e08a2e"/>' +
    '<path d="M24 22c-1 8-1 18 0 28M32 20c0 10 0 20 0 30M40 22c1 8 1 18 0 28" stroke="#c9701f" stroke-width="3" fill="none"/>' +
    '<path d="M32 20c-2-4-4-6-4-10M32 20c2-4 4-6 4-10" stroke="#5f9e3f" stroke-width="4" stroke-linecap="round"/>'
  ),
  cranberry: ICON(
    '<circle cx="24" cy="38" r="9" fill="#c0392b"/><circle cx="40" cy="38" r="9" fill="#e05252"/><circle cx="32" cy="28" r="8" fill="#d14040"/>' +
    '<circle cx="24" cy="38" r="2.5" fill="#e8847a"/><circle cx="40" cy="38" r="2.5" fill="#e8847a"/>' +
    '<path d="M32 28c-4-5-8-8-8-13M32 28c4-5 8-8 8-13" stroke="#5f9e3f" stroke-width="3" stroke-linecap="round"/>'
  ),
  eggplant: ICON(
    '<path d="M32 24c-8 4-12 14-12 24 0 4 2 6 4 6 6 0 16 0 16-6 0-10-4-20-8-24z" fill="#7b5aa6"/>' +
    '<path d="M32 24c-3-4-4-8-2-12M32 24c3-4 4-8 2-12" stroke="#5f9e3f" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M24 22c4-3 8-3 12 0" stroke="#5f9e3f" stroke-width="4" fill="none"/>'
  ),
  yam: ICON(
    '<path d="M32 52c-2-10 2-20 4-28 1-4 2-8 1-12-1-3-3-4-5-4s-4 1-5 4c-1 4 0 8 1 12 2 8 6 18 4 28z" fill="#a06a3f"/>' +
    '<path d="M32 16c-2-4-6-6-11-8" stroke="#8a5a33" stroke-width="4" fill="none" stroke-linecap="round"/>'
  ),
  amaranth: ICON(
    '<path d="M32 52V34" stroke="#9c4a5c" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M32 34c-9-2-14-9-14-16 7 1 12 6 14 16z" fill="#c2536b"/>' +
    '<path d="M32 34c9-2 14-9 14-16-7 1-12 6-14 16z" fill="#a8405a"/>'
  ),
  artichoke: ICON(
    '<path d="M32 20c-8 3-13 10-13 18 0 6 3 9 7 9h12c4 0 7-3 7-9 0-8-5-15-13-18z" fill="#6b9e3a"/>' +
    '<path d="M32 20c-4 3-7 7-8 12M32 20c4 3 7 7 8 12M32 20v16" stroke="#5f9e3f" stroke-width="3" fill="none"/>' +
    '<path d="M32 18v-6" stroke="#5f9e3f" stroke-width="4" stroke-linecap="round"/>'
  ),
};

/* ---------- 收集物 ---------- */
const COLLECT_ICONS = {
  "wild-horseradish": ICON(
    '<path d="M32 52c-3-10-5-20 0-30 5 10 3 20 0 30z" fill="#f2e6c8"/>' +
    '<path d="M32 22c-3-5-8-8-13-11M32 22c3-5 8-8 13-11" stroke="#7cb342" stroke-width="4" fill="none" stroke-linecap="round"/>'
  ),
  daffodil: ICON(
    '<g fill="#f4c542"><ellipse cx="32" cy="20" rx="5" ry="9"/><ellipse cx="32" cy="44" rx="5" ry="9"/><ellipse cx="20" cy="32" rx="9" ry="5"/><ellipse cx="44" cy="32" rx="9" ry="5"/></g>' +
    '<circle cx="32" cy="32" r="9" fill="#f7b733"/><circle cx="32" cy="32" r="5" fill="#e08a2e"/>' +
    '<path d="M32 50V58" stroke="#5f9e3f" stroke-width="4" stroke-linecap="round"/>'
  ),
  leek: ICON(
    '<path d="M32 54V26" stroke="#f2f6e8" stroke-width="12" stroke-linecap="round"/>' +
    '<path d="M32 26c-8-2-12-8-12-14 8 2 12 6 12 14z" fill="#7cb342"/>' +
    '<path d="M32 26c8-2 12-8 12-14-8 2-12 6-12 14z" fill="#5f9e3f"/>'
  ),
  dandelion: ICON(
    '<g fill="#f4c542"><circle cx="32" cy="20" r="6"/><circle cx="32" cy="44" r="6"/><circle cx="20" cy="32" r="6"/><circle cx="44" cy="32" r="6"/><circle cx="24" cy="24" r="5"/><circle cx="40" cy="40" r="5"/><circle cx="40" cy="24" r="5"/><circle cx="24" cy="40" r="5"/></g>' +
    '<circle cx="32" cy="32" r="8" fill="#e08a2e"/>' +
    '<path d="M32 50V58" stroke="#5f9e3f" stroke-width="4" stroke-linecap="round"/>'
  ),
  "spring-onion": ICON(
    '<path d="M32 56V30" stroke="#f2f6e8" stroke-width="8" stroke-linecap="round"/>' +
    '<path d="M32 30c-6-2-9-7-9-13M32 30c6-2 9-7 9-13" stroke="#6b9e3a" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    '<path d="M32 56c-3 2-6 2-8 0M32 56c3 2 6 2 8 0" stroke="#f2f6e8" stroke-width="3" fill="none"/>'
  ),
  "spice-berry": ICON(
    '<circle cx="26" cy="38" r="9" fill="#e05252"/><circle cx="38" cy="38" r="9" fill="#e08a2e"/><circle cx="32" cy="28" r="8" fill="#d14040"/>' +
    '<path d="M32 28c-4-5-8-8-8-13M32 28c4-5 8-8 8-13" stroke="#5f9e3f" stroke-width="3" stroke-linecap="round"/>'
  ),
  grape: ICON(
    '<circle cx="24" cy="30" r="7" fill="#8e6bb8"/><circle cx="40" cy="30" r="7" fill="#7b5aa6"/><circle cx="32" cy="22" r="7" fill="#9a78c4"/><circle cx="26" cy="42" r="7" fill="#7b5aa6"/><circle cx="38" cy="42" r="7" fill="#8e6bb8"/><circle cx="32" cy="48" r="7" fill="#6b4f9e"/>' +
    '<path d="M32 22c-3-4-4-7-4-11" stroke="#5f9e3f" stroke-width="4" stroke-linecap="round"/>'
  ),
  "sweet-pea": ICON(
    '<g fill="#e88bb5"><ellipse cx="32" cy="20" rx="5" ry="8"/><ellipse cx="32" cy="44" rx="5" ry="8"/><ellipse cx="20" cy="32" rx="8" ry="5"/><ellipse cx="44" cy="32" rx="8" ry="5"/></g>' +
    '<circle cx="32" cy="32" r="7" fill="#f0a8c8"/>' +
    '<path d="M32 50V58" stroke="#5f9e3f" stroke-width="4" stroke-linecap="round"/>'
  ),
  "fiddlehead-fern": ICON(
    '<path d="M32 54C32 40 32 30 38 24c4-4 9-4 12-2" stroke="#5f9e3f" stroke-width="6" fill="none" stroke-linecap="round"/>' +
    '<path d="M50 22c0-4-2-7-5-8" stroke="#7cb342" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    '<circle cx="45" cy="15" r="3" fill="#7cb342"/>'
  ),
  "common-mushroom": ICON(
    '<path d="M20 38c0-9 5-15 12-15s12 6 12 15c0 6-5 8-12 8s-12-2-12-8z" fill="#b98a54"/>' +
    '<path d="M28 40V54M36 40V54" stroke="#f2e6c8" stroke-width="8" stroke-linecap="round"/>'
  ),
  "wild-plum": ICON(
    '<circle cx="32" cy="36" r="16" fill="#8e6bb8"/>' +
    '<ellipse cx="27" cy="31" rx="4" ry="3" fill="#a98cc8" transform="rotate(-30 27 31)"/>' +
    '<path d="M32 22c-1-4-2-6-5-8" stroke="#8a5a33" stroke-width="3" stroke-linecap="round"/>'
  ),
  hazelnut: ICON(
    '<circle cx="32" cy="38" r="14" fill="#a06a3f"/>' +
    '<path d="M22 40c-2-6 0-12 5-16" stroke="#7a4f2c" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    '<circle cx="28" cy="34" r="2" fill="#7a4f2c"/>' +
    '<path d="M28 24c-3-3-4-6-3-9M34 24c2-3 3-6 2-9" stroke="#8a5a33" stroke-width="3" stroke-linecap="round"/>'
  ),
  blackberry: ICON(
    '<circle cx="26" cy="34" r="8" fill="#3d2a4d"/><circle cx="38" cy="34" r="8" fill="#4a3458"/><circle cx="32" cy="26" r="7" fill="#553a66"/><circle cx="28" cy="44" r="7" fill="#4a3458"/><circle cx="38" cy="44" r="7" fill="#3d2a4d"/><circle cx="32" cy="48" r="6" fill="#553a66"/>' +
    '<path d="M32 26c-3-4-4-7-4-10M32 26c3-4 4-7 4-10" stroke="#5f9e3f" stroke-width="3" stroke-linecap="round"/>'
  ),
  chanterelle: ICON(
    '<path d="M22 34c-2-8 3-14 10-14s12 6 10 14c-2 4-6 6-10 6s-8-2-10-6z" fill="#e0a53a"/>' +
    '<path d="M32 40c-2 8-2 12 0 14M32 40c2 8 2 12 0 14" stroke="#f2c96a" stroke-width="7" fill="none" stroke-linecap="round"/>'
  ),
  "winter-root": ICON(
    '<path d="M32 52c-3-10-4-20 0-30 4 10 3 20 0 30z" fill="#d9b98a"/>' +
    '<path d="M32 22c-2-4-6-7-10-9M32 22c2-4 6-7 10-9" stroke="#b98a54" stroke-width="4" fill="none" stroke-linecap="round"/>'
  ),
  "crystal-fruit": ICON(
    '<path d="M32 14l12 14-12 22L20 28z" fill="#6f9fc4"/>' +
    '<path d="M32 14l12 14H20l12-14z" fill="#9cc0dd"/>' +
    '<path d="M20 28h24" stroke="#4a74a8" stroke-width="2"/>'
  ),
  "snow-yam": ICON(
    '<path d="M32 52c-4-9-5-18 0-28 5 10 4 19 0 28z" fill="#f4ecd8"/>' +
    '<path d="M32 24c-2-4-5-7-9-9M32 24c2-4 5-7 9-9" stroke="#d9c9a6" stroke-width="4" fill="none" stroke-linecap="round"/>'
  ),
  crocus: ICON(
    '<path d="M24 30c0-6 3-10 8-10s8 4 8 10c-5-2-11-2-16 0z" fill="#8e6bb8"/>' +
    '<path d="M32 30c-4 4-6 8-6 13M32 30c4 4 6 8 6 13" stroke="#5f9e3f" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<path d="M24 28c-2-3-3-6-2-9M40 28c2-3 3-6 2-9" stroke="#7b5aa6" stroke-width="3" fill="none" stroke-linecap="round"/>'
  ),
  holly: ICON(
    '<path d="M24 26c-6-2-10 2-11 8 6 2 10-2 11-8z" fill="#5f9e3f"/>' +
    '<path d="M40 26c6-2 10 2 11 8-6 2-10-2-11-8z" fill="#6b9e3a"/>' +
    '<circle cx="28" cy="44" r="5" fill="#d14040"/><circle cx="38" cy="46" r="5" fill="#e05252"/><circle cx="32" cy="40" r="4" fill="#c0392b"/>'
  ),
};
