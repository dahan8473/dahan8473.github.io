// Colors and look per theme. Dark keeps the tsi-globe values.
export const ACCENT = '#88c0d0';

export interface Palette {
  land: string;
  water: string;
  blend: number;
  scale: number;
  sphereOpacity: number;
  /** Share of the water color the sphere shows unlit (keeps light mode papery). */
  sphereGlow: number;
  light: string;
  lightIntensity: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  aces: boolean;
  backdrop: number;
  stars: number;
  marker: string;
  markerCore: string;
  markerHalo: number;
}

export const DARK: Palette = {
  land: '#fff0d1',
  water: '#0d111a',
  blend: 0.96,
  scale: 0.09,
  sphereOpacity: 0.81,
  sphereGlow: 0,
  light: '#ffd0b8',
  lightIntensity: 0.9,
  bloomStrength: 0.6,
  bloomRadius: 0.48,
  bloomThreshold: 0,
  aces: true,
  backdrop: 0.85,
  stars: 1,
  marker: ACCENT,
  markerCore: '#e5f4f8',
  markerHalo: 0.55
};

export const LIGHT: Palette = {
  land: '#1f242d',
  water: '#e6eaf0',
  blend: 0.42,
  scale: 0.09,
  sphereOpacity: 0.94,
  sphereGlow: 0.72,
  light: '#ffffff',
  lightIntensity: 0.45,
  bloomStrength: 0,
  bloomRadius: 0.3,
  bloomThreshold: 0,
  aces: false,
  backdrop: 0,
  stars: 0,
  marker: ACCENT,
  markerCore: '#2c7389',
  markerHalo: 0.8
};
