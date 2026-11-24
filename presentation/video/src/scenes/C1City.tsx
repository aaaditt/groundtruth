// C1 "A day under the city" (75 s): the 3D cutscene for slide 3.
//
// The camera circles a paper-diorama city at dawn, glides down to the road, the ground in
// front splits away to show the soil and rock, and the camera sinks to the seismometer in
// its vault. Then a clock runs slow -> fast -> slow through a whole day while the pen
// draws the REAL recording, and finally the city fades and the real line stays.
//
// Illustration, driven by real data:
//   - how many cars, buses and people are out = Brussels' real hourly rhythm (busyAt)
//   - how hard the seismometer's weight shakes = the real 15-minute reading (shakeAt)
//   - the line = the real recording, BE.UCC, Wednesday 15 January 2020 (city_day.json)
import React from "react";
import { ThreeCanvas } from "@remotion/three";
import { useCurrentFrame } from "remotion";
import { C, H, W } from "../theme";
import { busyAt, DAYS, shakeAt } from "../data";
import { Caption, Clock, fade, IllustrationTag, lerp, Note, ramp, Source, Stage, useSec } from "../lib";
import { DayAxes, DayTrace } from "../DayChart";
import { Atmosphere, CameraPath, DayLights, daylight, Shot, skyColor } from "../three/kit";
import { Buildings, Ground, People, Railway, Ripples, Street, Traffic } from "../three/City";
import { Metro, PitFill } from "../three/Metro";
import { Seismometer } from "../three/Seismometer";

const MORNING = 9 * 60 + 5; // the story starts on a winter morning, the sun still low

/** Local time shown in the scene at second t. */
const minuteAt = (t: number) => {
  if (t < 38) return MORNING + t * 1.2; // morning, barely moving
  if (t < 42) return lerp(MORNING + 38 * 1.2, 0, ramp(t, 38, 41.5, "inout")); // rewind to midnight
  if (t < 66) return 1440 * ramp(t, 42, 66, "inout"); // a whole day: slow, fast, slow
  return 1440;
};

const SHOTS: Shot[] = [
  { t: 0, pos: [58, 38, 66], look: [0, -3, 0], fov: 32 }, // wide, high, the whole block
  { t: 5, pos: [8, 30, 78], look: [0, -2, 0], fov: 32 },
  { t: 10, pos: [-48, 18, 50], look: [0, -1, 2], fov: 32 }, // the orbit comes round
  { t: 15.5, pos: [-21, 2.0, 9.9], look: [2, 0.9, 5.5], fov: 42 }, // street level, along the road
  { t: 20, pos: [2, 3.2, 24], look: [3.5, -1.5, 13], fov: 40 }, // the ground opens
  { t: 25.5, pos: [7, -4, 27], look: [4, -7, 13], fov: 38 }, // sinking past the layers
  { t: 31, pos: [5.4, -8.7, 18.6], look: [4.1, -9.4, 11.6], fov: 34 }, // the seismometer
  { t: 36.5, pos: [4.6, -9.1, 17.2], look: [4.3, -9.5, 11.6], fov: 32 },
  { t: 42, pos: [30, 8, 50], look: [0, -4.5, 4], fov: 30 }, // the day run: city + cut face
  { t: 66, pos: [-22, 9, 52], look: [0, -4.5, 4], fov: 30 },
];

// the chart card: a strip at the bottom during the day, then the whole frame at the end
const STRIP = { x0: 220, x1: 1700, y0: 800, y1: 960 };
const FULL = { x0: 200, x1: 1720, y0: 300, y1: 820 };

export const C1City: React.FC = () => {
  const frame = useCurrentFrame();
  const t = useSec();
  const minute = minuteAt(t);
  const busy = busyAt(minute);
  const day = daylight(minute);
  const night = 1 - day;
  const lit = 0.08 + 0.75 * night * (0.35 + 0.65 * busyAt(Math.min(minute, 1439)));
  const open = ramp(t, 17, 22.5, "inout");
  const shake = shakeAt(DAYS.wednesday, Math.min(minute, 1439));
  const jiggle = Math.min(0.26, 0.05 * shake) * (Math.sin(frame * 1.9) * 0.7 + Math.sin(frame * 3.3 + 1) * 0.3);
  const dayRun = ramp(t, 42, 66, "inout");
  const end = ramp(t, 66, 70, "inout");
  const card = {
    x0: lerp(STRIP.x0, FULL.x0, end),
    x1: lerp(STRIP.x1, FULL.x1, end),
    y0: lerp(STRIP.y0, FULL.y0, end),
    y1: lerp(STRIP.y1, FULL.y1, end),
  };

  return (
    <Stage>
      <ThreeCanvas width={W} height={H} shadows gl={{ antialias: true }} flat>
        <Atmosphere color={skyColor(minute)} near={110} far={300} />
        <DayLights minute={minute} extent={75} shadowSize={4096} />
        <CameraPath t={t} shots={SHOTS} />
        {/* a whole city; one section in front of the seismometer is dug out */}
        <Metro t={t} busy={busy} lit={night * (0.45 + 0.55 * busy) * 1.3} />
        <Ground />
        <PitFill open={open} />
        <Street night={night} />
        <Buildings lit={lit} />
        <Railway t={t} busy={busy} />
        <Traffic t={t} busy={busy} night={night} />
        <People t={t} busy={busy} />
        <Ripples t={t} busy={busy} strength={ramp(t, 19, 23) * (1 - end) * (0.25 + 0.75 * busy)} />
        <Seismometer jiggle={jiggle} drumTurn={-t * 0.6} lamp={1.2 + 1.5 * night} />
      </ThreeCanvas>

      {/* paper fades over the city at the end; the real line stays */}
      <div style={{ position: "absolute", inset: 0, background: C.paper, opacity: end }} />

      <Caption text="A day under the city" at={0.6} until={9} y={90} size={72} serif />
      <Caption text="Every car, bus, train and footstep pushes on the ground" at={10.5} until={17} y={90} />
      <Caption text="Each push sends a tiny wave down through the soil and rock" at={20} until={27.5} y={90} />
      <Caption text="A seismometer: a heavy weight on a spring. The ground moves; the weight lags behind." at={29.5} until={37.5} y={90} width={1250} />
      <Caption text="Now, one whole day" at={38.5} until={44} y={90} serif size={60} />

      {/* the clock and the recording during the day run */}
      <svg width={W} height={H} style={{ position: "absolute", opacity: fade(t, 39) * (1 - end) }}>
        <rect x={1610} y={60} width={250} height={300} rx={8} fill="rgba(250,249,244,0.92)" />
        <Clock minute={Math.min(minute, 1439.9)} x={1735} y={175} r={86} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: card.x0 - 60,
          top: card.y0 - 50,
          width: card.x1 - card.x0 + 120,
          height: card.y1 - card.y0 + 120,
          background: "rgba(250,249,244,0.94)",
          borderRadius: 8,
          boxShadow: `0 10px 40px rgba(22,27,33,${0.12 * (1 - end)})`,
          opacity: fade(t, 40),
        }}
      />
      <svg width={W} height={H} style={{ position: "absolute", opacity: fade(t, 40) }}>
        <DayAxes b={card} typicalLine={false} size={lerp(22, 30, end)} opacity={0.4 + 0.6 * end} />
        <DayTrace which="wednesday" b={card} progress={t < 42 ? 0 : dayRun} width={lerp(3, 5, end)} color={C.ink} />
      </svg>
      <Note text="Night: the pen barely moves" at={42.5} until={47} x={card.x0} y={card.y0 - 46} size={30} color={C.ink} />
      <Note text="05:00, the first buses. By 07:00, the whole city" at={49} until={55} x={card.x0} y={card.y0 - 46} size={30} color={C.ink} width={1200} />
      <Note text="High all day, fading through the evening" at={56} until={65} x={card.x0} y={card.y0 - 46} size={30} color={C.ink} />

      <Note text="A real recording: one reading every fifteen minutes" at={69} x={200} y={120} size={54} color={C.ink} width={1500} />
      <Note text="An ordinary Wednesday, 15 January 2020" at={70.2} x={200} y={196} size={40} color={C.city} width={1500} />
      <Source text="Real data: Lecocq et al. (2020), Science. The city is an illustration." at={69} />
      <IllustrationTag until={66} />
    </Stage>
  );
};
