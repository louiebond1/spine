import React from 'react';
import {Img, staticFile, interpolate, Easing} from 'remotion';
// UI captures are 4320 x 2430 (1440 x 810 logical at 3x). Camera = logical centre + zoom (output px per logical px).
export const W = 1440, H = 810, DSF = 3;
export const glide = Easing.bezier(0.16, 1, 0.3, 1);
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);
// keys: [[frame, {cx, cy, z}], ...]; eased between keys.
export function track(keys, f, ease = glide) {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f0, a] = keys[i - 1], [f1, b] = keys[i];
    if (f <= f1) {
      const t = ease((f - f0) / Math.max(1, f1 - f0));
      const o = {};
      for (const k of Object.keys(a)) o[k] = a[k] + (b[k] - a[k]) * t;
      return o;
    }
  }
  return keys[keys.length - 1][1];
}
export const camTransform = ({cx, cy, z}) => `translate(${960 - cx * z}px, ${540 - cy * z}px) scale(${z})`;
export const Shot = ({src, opacity = 1, style}) =>
  <Img src={staticFile(src)} style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity, ...style}}/>;
// A real-pixel region of a capture, positioned in logical px (used to animate parts of the next state).
export const Region = ({src, x, y, w, h, opacity = 1, dy = 0}) =>
  <div style={{position: 'absolute', left: x, top: y + dy, width: w, height: h, overflow: 'hidden', opacity}}>
    <Img src={staticFile(src)} style={{position: 'absolute', left: -x, top: -y, width: W, height: H}}/>
  </div>;
export const Cursor = ({x, y, press = 0, opacity = 1}) =>
  <svg width="22" height="22" viewBox="0 0 24 24" style={{position: 'absolute', left: x - 4, top: y - 2, opacity,
    transform: `scale(${1 - 0.18 * press})`, transformOrigin: '4px 2px', filter: 'drop-shadow(0 1px 1.5px rgba(14,22,41,.35))'}}>
    <path d="M4 2l16 9.5-7 1.5-3.5 6.5z" fill="#181A20" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>;
export const Caption = ({text, f, start, dark = false}) => {
  const o = interpolate(f, [start, start + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const y = interpolate(f, [start, start + 14], [14, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: glide});
  return <>
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 300, opacity: o,
      background: dark ? 'linear-gradient(transparent, rgba(14,22,41,.75))' : 'linear-gradient(rgba(250,249,246,0), rgba(250,249,246,.96) 70%)'}}/>
    <div style={{position: 'absolute', left: 120, bottom: 96, opacity: o, transform: `translateY(${y}px)`,
      font: '600 60px "Inter Display", Inter, sans-serif', letterSpacing: '-0.02em', color: dark ? '#FAF9F6' : '#181A20'}}>{text}</div>
  </>;
};
