# 8. Roadmap — what to do next

Ordered by value for effort. Items 1–2 are worth doing before the presentation if there
is time; the rest are genuine future work.

## 1. Validate anomalies against real holiday calendars *(highest value, ~1 hour)*

Right now Thanksgiving and All Saints' Day are anecdotes. Turn them into a metric:

```bash
pip install holidays
```

For each station, get its country's public holidays (`holidays.country_holidays(code)`,
and Table S1 has the country code). Then:
- Exclude those dates from the baseline/training set first — otherwise real holidays
  are polluting "normal".
- Re-run `src/detect_disruptions.py`.
- Report **precision and recall** of the anomaly flags against the holiday list.

"Our detector catches X% of public holidays at a Y% false-alarm rate" is a much
stronger claim than a list of examples.

## 2. A map of the stations *(~30 min, great slide)*

Table S1 has latitude and longitude; `outputs/station_scores.csv` has each station's
accuracy. Plot world coordinates coloured by weekday/weekend accuracy. Shows coverage
and makes the density effect visual.

## 3. Baseline model comparison *(~20 min, good methodology slide)*

Run logistic regression alongside the random forest. If a simple linear model does
nearly as well, that's an honest and interesting finding; if it doesn't, it justifies
the forest. Either way it shows you compared alternatives.

## 4. Frequency-band ablation *(~30 min)*

`src/features.py` has `BAND = "4.0-14.0"`. The dataset also has 0.1–1 Hz (mostly ocean
microseism — should be *worse* if our reasoning is right), 1–20 and 4–20 Hz. Re-running
with each band tests the physical claim that human activity lives in the high-frequency
band.

## 5. Live / fresher data *(half a day, future work)*

The dataset stops in May 2020. To go further:
- Raspberry Shake FDSN: `obspy.clients.fdsn.Client("RASPISHAKE")`;
  station map at https://stationview.raspberryshake.org/
- IRIS/EarthScope: `Client("IRIS")`; station search at https://ds.iris.edu/gmap/
- Compute 15-minute RMS in 4–14 Hz the same way the authors do, in
  https://github.com/ThomasLecocq/SeismoRMS
- Write the result in the same CSV layout as `PaperZero_RMS/` and the rest of this
  pipeline works unchanged.

A station near **Dubai** would be a strong local angle — and a test of the
weekend-definition limitation, since the UAE working week changed to Mon–Fri with a
Sat–Sun weekend in 2022.

## 6. Anomaly typing *(research-level)*

Currently a day is "unusual" or not. Cluster the anomalous days by *how* they deviate
(quiet all day, late start, missing evening peak) to distinguish holidays from strikes,
storms and lockdowns.

## 7. Better temporal models *(research-level)*

We throw away the order of hours — the random forest treats hour 8 and hour 9 as
unrelated columns. A 1-D CNN or a small sequence model could exploit the shape
directly. With ~115 days per station this needs pooling across stations to avoid
overfitting, so it pairs naturally with the global model.

## Things deliberately *not* on this list

- Deep learning for its own sake: the dataset is too small per station.
- Predicting earthquakes: different problem, different frequency band, not what this is.
- Real-time streaming infrastructure: out of scope for a course project.
