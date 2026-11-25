// Every clip of the final talk, in slide order (docs/18-final-presentation-script.md).
// Each one ends by holding its last frame, so the speaker controls timing with a click.
// C* clips are 3D cutscenes (render with --gl=angle); S* clips are 2D.
// S11 (the live website, backup for Q&A) is not here: it is cut from
// site/media/groundtruth-demo.mp4 by presentation/clips.py.
import React from "react";
import { Composition } from "remotion";
import { FPS, H, W } from "./theme";
import { HOLD_LEAD, HoldAt } from "./lib";
import CUES from "./cues.json";
import { S00Questions, S01Christmas, S02Promises, S13Scorecard, S14Close } from "./scenes/Open3D";
import { C1City } from "./scenes/C1City";
import { C2Sea } from "./scenes/C2Sea";
import { C3Globe } from "./scenes/C3Globe";
import { C4Forest } from "./scenes/C4Forest";
import { C5Quake } from "./scenes/C5Quake";
import { S05Features, S06Weeks, S07Results, S08Mistakes, S12Limits } from "./scenes/Data3D";
import { S09Lockdown, S10Weekends } from "./scenes/World3D";

export const CLIPS: { id: string; seconds: number; component: React.FC; three?: boolean }[] = [
  { id: "S00-questions", seconds: 45, component: S00Questions },
  { id: "S01-christmas", seconds: 20, component: S01Christmas },
  { id: "S02-promises", seconds: 30, component: S02Promises },
  { id: "C1-city", seconds: 75, component: C1City, three: true },
  { id: "C3-globe", seconds: 40, component: C3Globe, three: true },
  { id: "C2-sea", seconds: 60, component: C2Sea, three: true },
  { id: "S05-features", seconds: 60, component: S05Features },
  { id: "C4-forest", seconds: 40, component: C4Forest, three: true },
  { id: "S06-weeks", seconds: 36, component: S06Weeks },
  { id: "S07-results", seconds: 45, component: S07Results },
  { id: "S08-mistakes", seconds: 60, component: S08Mistakes },
  { id: "S09-lockdown", seconds: 35, component: S09Lockdown },
  { id: "S10-weekends", seconds: 48, component: S10Weekends },
  { id: "C5-quake", seconds: 45, component: C5Quake, three: true },
  { id: "S12-limits", seconds: 22, component: S12Limits },
  { id: "S13-scorecard", seconds: 22, component: S13Scorecard },
  { id: "S14-close", seconds: 32, component: S14Close },
];

// The deck's holds (src/cues.json): at each cue with hold=true, a short clip whose story
// clock is stopped at the cue while cars, people and waves keep moving. It starts HOLD_LEAD
// seconds of background early so src/talk_build.py can turn it into a seamless loop.
const cueMap = CUES.clips as Record<string, { at: number; hold: boolean }[]>;
export const HOLDS = CLIPS.flatMap((c) =>
  (cueMap[c.id] || [])
    .filter((q) => q.hold)
    .map((q) => {
      const Comp = c.component;
      const Held: React.FC = () => (
        <HoldAt at={q.at}>
          <Comp />
        </HoldAt>
      );
      return { id: `${c.id}-hold-${Math.round(q.at * 10)}`, component: Held };
    }),
);

export const RemotionRoot: React.FC = () => (
  <>
    {CLIPS.map((c) => (
      <Composition key={c.id} id={c.id} component={c.component} durationInFrames={Math.round(c.seconds * FPS)} fps={FPS} width={W} height={H} />
    ))}
    {HOLDS.map((h) => (
      <Composition key={h.id} id={h.id} component={h.component} durationInFrames={Math.round((HOLD_LEAD + CUES.hold_seconds) * FPS)} fps={FPS} width={W} height={H} />
    ))}
  </>
);
