// One real day of shaking under Brussels, 15-minute readings, local time.
import React from "react";
import { C, TEXT } from "./theme";
import { DAYS, DAY_LOG_MAX, DAY_LOG_MIN, Day } from "./data";
import { PenLine } from "./lib";

export type Box = { x0: number; x1: number; y0: number; y1: number }; // y0 top, y1 bottom

export const dayPoints = (day: Day, b: Box) =>
  day.samples.map(([m, v]) => [
    b.x0 + (m / 1440) * (b.x1 - b.x0),
    b.y1 - ((Math.log10(v) - DAY_LOG_MIN) / (DAY_LOG_MAX - DAY_LOG_MIN)) * (b.y1 - b.y0),
  ]);

export const yOfTimes = (times: number, b: Box) =>
  b.y1 - ((Math.log10(times) - DAY_LOG_MIN) / (DAY_LOG_MAX - DAY_LOG_MIN)) * (b.y1 - b.y0);

export const DayAxes: React.FC<{ b: Box; opacity?: number; typicalLine?: boolean; size?: number }> = ({
  b,
  opacity = 1,
  typicalLine = true,
  size = 30,
}) => {
  const hours = [0, 6, 12, 18, 24];
  const y1 = yOfTimes(1, b);
  return (
    <g opacity={opacity} fontFamily={TEXT}>
      <line x1={b.x0} y1={b.y1} x2={b.x1} y2={b.y1} stroke={C.rule} strokeWidth={2} />
      {hours.map((h) => {
        const x = b.x0 + (h / 24) * (b.x1 - b.x0);
        return (
          <g key={h}>
            <line x1={x} y1={b.y0} x2={x} y2={b.y1} stroke={C.rule} strokeWidth={1} strokeDasharray="2 8" />
            <text x={x} y={b.y1 + size + 10} fontSize={size} fill={C.graphite} textAnchor="middle">
              {`${String(h % 24 === 0 && h > 0 ? 24 : h).padStart(2, "0")}:00`}
            </text>
          </g>
        );
      })}
      {typicalLine ? (
        <>
          <line x1={b.x0} y1={y1} x2={b.x1} y2={y1} stroke={C.graphite} strokeWidth={1.5} strokeDasharray="10 10" opacity={0.7} />
          <text x={b.x1} y={y1 + size + 6} fontSize={size - 2} fill={C.graphite} textAnchor="end">
            typical level for this seismometer
          </text>
        </>
      ) : null}
    </g>
  );
};

export const DayTrace: React.FC<{
  which: "wednesday" | "sunday" | "christmas";
  b: Box;
  progress: number;
  color?: string;
  width?: number;
  opacity?: number;
  tip?: boolean;
}> = ({ which, b, progress, color = C.ink, width = 4, opacity = 1, tip = true }) => (
  <PenLine pts={dayPoints(DAYS[which], b)} progress={progress} color={color} width={width} opacity={opacity} tip={tip} />
);
