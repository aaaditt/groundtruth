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

`groundtruth/features.py` has `BAND = "4.0-14.0"`. The dataset also has 0.1–1 Hz (mostly ocean
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
Sat–Sun weekend in 2022. Note that this requires new acquisition: it is **not**
possible with the dataset we have. See the section at the end of this document.

## 6. Anomaly typing *(research-level)*

Currently a day is "unusual" or not. Cluster the anomalous days by *how* they deviate
(quiet all day, late start, missing evening peak) to distinguish holidays from strikes,
storms and lockdowns.

## 7. Better temporal models *(research-level)*

We throw away the order of hours — the random forest treats hour 8 and hour 9 as
unrelated columns. A 1-D CNN or a small sequence model could exploit the shape
directly. With ~115 days per station this needs pooling across stations to avoid
overfitting, so it pairs naturally with the global model.

## 8. Subtracting human noise to reveal small earthquakes *(research-level, not implemented)*

Every other item on this list treats cultural noise as the signal. This one inverts the
framing and hands a cleaner record back to seismology.

Small earthquakes are hard to detect in cities for exactly the reason this project
exists: a minor tremor is buried under rush-hour traffic. That is the main reason urban
seismometers are considered less scientifically useful than remote ones — the
anthropogenic noise that we are modelling is precisely what hides real events.

**The idea.** If a model can learn what a station normally sounds like at a given hour,
on a given day of the week, that prediction becomes a *learned, time-varying noise
floor*. Subtract it from the recording and what remains is the residual — which should
make smaller events detectable than a fixed threshold allows, because the threshold now
moves with the city's own rhythm instead of being set for the worst case.

**Why it is plausible.** Lecocq et al. (2020) report that during COVID lockdowns,
earthquake signals normally concealed by human activity became visible on urban sensors,
particularly during daytime hours. The pandemic demonstrated the effect by accident. The
proposal is to recover part of it with a model rather than waiting for a lockdown.

**How it would be evaluated.** Take a public earthquake catalogue (USGS or a regional
network) listing small events near a chosen station during the recording window. Run
detection on the same recordings twice — once raw, once after subtracting the learned
noise floor — and compare how many catalogued events are recovered at a matched
false-alarm rate. The catalogue is the ground truth; the comparison is against the
station's own raw record, so the only variable is the subtraction.

**Honest risks.**

- **The residual may simply not be clean enough.** Traffic is not stationary and not
  perfectly periodic. A model that predicts the *average* Tuesday 08:00 will not predict
  the particular lorry that passed at 08:03, and that unpredicted variance may swamp the
  events we are hoping to expose. This is the risk that decides the whole idea.
- **Validation depends on there being events to find.** It needs a station with enough
  catalogued small earthquakes nearby during Nov 2019 – May 2020. Seismically quiet
  cities cannot test it at all, so station choice comes before method.
- **Our current pipeline actively destroys the target signal.** `docs/03-methodology.md`
  discards any 15-minute sample more than 100× above the station's median, then takes a
  *median* per hour — both chosen so that a passing truck or a small earthquake cannot
  dominate an hour. Those are the right choices for measuring rhythm and exactly the
  wrong ones here. This work cannot reuse the committed 25-feature daily table; it would
  need the raw 15-minute RMS, and realistically the underlying waveforms.
- **Band suitability is an open question.** The 4–14 Hz band we use is reasonable for
  *local* micro-earthquakes, whose energy is genuinely high-frequency. It is the wrong
  band for distant or large events, so any claim would be scoped to small nearby ones.

**Status: future work. Nothing here has been implemented and no numbers are attached to
it.** It is recorded because it changes what the project is *for*, not because we have
results.

## Things deliberately *not* on this list

- Deep learning for its own sake: the dataset is too small per station.
- **Predicting** earthquakes: nobody can, and claiming it would discredit the rest of
  the work. Note this is a different thing from item 8, which is about *detecting*
  small events that have already happened by removing a learned noise floor.
- Real-time streaming infrastructure: out of scope for a course project.

---

## Not possible with the current dataset: the UAE working-week change

On 1 January 2022 the UAE moved its official weekend from Friday–Saturday to
Saturday–Sunday. As a natural experiment with a known date this would be ideal, but it
cannot be done with the Lecocq companion dataset:

1. **No UAE station exists in it.** `Table S1 - Lockdown stations.csv` lists 185
   stations across 80 countries; there are no Emirates, Qatar, Kuwait or Bahrain
   entries. The nearest are Jeddah (SA), Amatzia (IL), Salfit (PS), Qavazang (IR) and
   Nilore (PK).
2. **The dates do not overlap.** Recordings run ~31 Oct 2019 to late May 2020 — roughly
   nineteen months before the change took effect.

It remains valid future work via live FDSN web services, which would need a separate
acquisition pipeline using the authors' SeismoRMS method. Until that exists it must not
be presented as a result.

The cross-country weekend signature (`docs/04-results.md`) tests the same hypothesis —
that the pattern is human rather than an arbitrary weekly period — using data already
in hand.
