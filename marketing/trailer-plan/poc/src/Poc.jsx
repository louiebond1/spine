import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate, Easing} from 'remotion';
import {homography, matrix3d, rectCorners, lerpQuad} from './geom';
import {InteractionLayer} from './Interaction';
import {Caption, W, H} from './ui';

// Plate layer: a photograph (or, for the geometry test, a flat card) with the screen quad in plate pixels.
// The real UI frame is corner-pinned onto the quad. The "dive" warps the whole plate so the quad becomes the frame.
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};
const DIVE0 = 96, DIVE1 = 132;           // frames
const dive = Easing.bezier(0.7, 0, 0.2, 1);

export const Poc = ({plate, plateW, plateH, quad, caption}) => {
  const f = useCurrentFrame();
  // Base camera on the plate: cover the frame, slow push toward the screen centre.
  const cover = Math.max(1920 / plateW, 1080 / plateH) * 1.12;
  const qc = quad.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]);
  const push = interpolate(f, [0, DIVE0], [1.0, 1.06], clamp);
  const drift = [Math.sin(f / 37) * 2.2, Math.cos(f / 53) * 1.6];
  const s = cover * push;
  const fit = (o, S, size, out) => Math.min(-4, Math.max(out - size * S + 4, o));
  const ox = fit(960 - qc[0] * s, s, plateW, 1920) + drift[0], oy = fit(540 - qc[1] * s, s, plateH, 1080) + drift[1];
  // Where the quad sits on screen at the moment the dive starts (base transform frozen there).
  const s0 = cover * 1.06, ox0 = fit(960 - qc[0] * s0, s0, plateW, 1920), oy0 = fit(540 - qc[1] * s0, s0, plateH, 1080);
  const baseAt = (S, OX, OY) => quad.map(([x, y]) => [x * S + OX, y * S + OY]);
  const q0 = baseAt(s0, ox0, oy0);
  const t = dive(interpolate(f, [DIVE0, DIVE1], [0, 1], clamp));
  const qT = lerpQuad(q0, rectCorners(1920, 1080), t);
  const warp = f >= DIVE0 ? matrix3d(homography(q0, qT)) : 'none';
  const baseT = f >= DIVE0 ? `translate(${ox0}px,${oy0}px) scale(${s0})` : `translate(${ox}px,${oy}px) scale(${s})`;
  // UI pinned into plate pixels: UI rect (1440 x 810 logical) -> quad.
  const pin = matrix3d(homography(rectCorners(W, H), quad));
  const integ = 1 - t;                      // screen-integration effects fade out during the dive
  const handed = f >= DIVE1;
  const lf = f - DIVE1;                      // interaction-local frame (starts on the queue at full frame)
  return <AbsoluteFill style={{background: '#0E1629', overflow: 'hidden'}}>
    {!handed && <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '0 0', transform: warp}}>
      <div style={{position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: baseT}}>
        <Img src={staticFile(plate)} style={{position: 'absolute', left: 0, top: 0, width: plateW, height: plateH}}/>
        <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: pin}}>
          <Img src={staticFile('ui/01-queue.png')} style={{position: 'absolute', width: W, height: H,
            filter: `brightness(${0.9 + 0.1 * t}) contrast(${0.94 + 0.06 * t}) blur(${0.7 * integ}px)`}}/>
          {/* Screen sheen and vignette, as if photographed */}
          <div style={{position: 'absolute', inset: 0, opacity: integ,
            background: 'linear-gradient(115deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 38%), radial-gradient(ellipse at 60% 45%, rgba(0,0,0,0) 55%, rgba(14,22,41,.18) 100%)'}}/>
        </div>
      </div>
    </div>}
    {handed && <InteractionLayer f={lf}/>}
    {!handed && caption && <Caption text={caption} f={f} start={24} dark/>}
    {handed && <Caption text="Answered with your company's own rules." f={lf} start={186}/>}
    <Img src={staticFile(`grain/g${f % 8}.png`)} style={{position: 'absolute', inset: 0, width: 1920, height: 1080, mixBlendMode: 'overlay', opacity: handed ? 0.03 : 0.09 - 0.06 * t}}/>
  </AbsoluteFill>;
};
