import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';
import {Shot, Region, Cursor, Caption, track, camTransform, glide, inOut, W, H} from './ui';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};
// Logical coordinates from the capture manifest (meta.json).
const CLAIM = [1024, 329], SEND = [914, 359], COMPOSER = [560, 359];

export const InteractionLayer = ({f}) => {
  const cam = track([
    [0, {cx: 720, cy: 405, z: 1.3333}],
    [14, {cx: 720, cy: 405, z: 1.3333}],
    [44, {cx: 700, cy: 335, z: 2.15}],
    [66, {cx: 700, cy: 335, z: 2.15}],
    [92, {cx: 680, cy: 300, z: 1.9}],
    [150, {cx: 680, cy: 320, z: 1.9}],
    [180, {cx: 688, cy: 400, z: 2.3}],
  ], f);
  // States
  const queue = f < 74, hover = f >= 50 && f < 74;
  const tFade = interpolate(f, [66, 74], [0, 1], clamp);
  const typed = f >= 112 && f < 146;
  const replied = f >= 146;
  const bubbleIn = interpolate(f, [146, 160], [0, 1], {...clamp, easing: glide});
  const histIn = interpolate(f, [152, 164], [0, 1], clamp);
  // Cursor path
  const cur = track([
    [0, {x: 900, y: 640, o: 0}], [22, {x: 900, y: 640, o: 1}], [52, {x: CLAIM[0], y: CLAIM[1], o: 1}],
    [74, {x: CLAIM[0], y: CLAIM[1], o: 1}], [100, {x: COMPOSER[0], y: COMPOSER[1], o: 1}],
    [116, {x: COMPOSER[0], y: COMPOSER[1], o: 1}], [138, {x: SEND[0], y: SEND[1], o: 1}],
    [156, {x: SEND[0] + 40, y: SEND[1] + 60, o: 0}],
  ], f, inOut);
  const press = (f >= 58 && f < 64) || (f >= 140 && f < 146) ? 1 : 0;
  return <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: camTransform(cam)}}>
    {queue && <Shot src={hover ? 'ui/02-queue-hover.png' : 'ui/01-queue.png'}/>}
    {f >= 66 && !replied && <Shot src="ui/03-thread.png" opacity={tFade} style={{transform: `translateY(${(1 - tFade) * 8}px)`}}/>}
    {typed && <Region src="ui/04-thread-typed.png" x={284} y={330} w={800} h={60} opacity={interpolate(f, [112, 116], [0, 1], clamp)}/>}
    {replied && <>
      {/* The real "after" capture. The new message and history entry are revealed from it, nothing is drawn. */}
      <Shot src="ui/06-replied.png"/>
      <div style={{position: 'absolute', left: 280, top: 318, width: 806, height: 104, background: '#FAF9F6', opacity: 1 - bubbleIn}}/>
      <Region src="ui/06-replied.png" x={280} y={318} w={806} h={104} opacity={bubbleIn} dy={(1 - bubbleIn) * 18}/>
      <div style={{position: 'absolute', left: 1112, top: 372, width: 270, height: 40, background: '#FFFFFF', opacity: 1 - histIn}}/>
    </>}
    <Cursor x={cur.x} y={cur.y} opacity={cur.o} press={press}/>
  </div>;
};

export const Interaction = () => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{background: '#FAF9F6', overflow: 'hidden'}}>
    <InteractionLayer f={f}/>
    <Caption text="Answered with your company's own rules." f={f} start={186}/>
  </AbsoluteFill>;
};
