# 6. Presentation guide

Course: Foundations of Data Science (BITS Pilani).
Slot: **22 September 2026**.
Title: *Learning Urban Activity Rhythms from Ambient Seismic Noise for Anomaly-Based
Disruption Detection.*
Team: Aadit Chandra, Aradhya Gupta, Shraddha Pradeep.

> **Superseded for the proposal presentation.** See
> [`09-presentation-script.md`](09-presentation-script.md), which deliberately omits
> all classifier results — the proposal should describe what we will build, not report
> work that isn't part of the semester project yet. The slide order and Q&A prep below
> remain useful background.

## Suggested slide order

**1. Hook (no title slide theatrics, just the question)**
"This is a recording from a seismometer in New York. Can you tell me what day of the
week it was?" Show one day's curve with the label hidden.

**2. The physics**
Traffic, trains, footsteps and machinery shake the ground by tens of nanometres.
Seismometers record it continuously. Above ~1 Hz, in cities, most of the background
hum is people. Cite Lecocq et al. 2020, Díaz et al. 2017, Groos & Ritter 2009.

**3. The idea**
If human activity is rhythmic, the rhythm must be in the vibration record. Two
questions: can a model read the day of the week off it? And can it spot days that
break the pattern?

**4. The data**
158 real seismometers, 28,749 station-days, Nov 2019 – May 2020, from the published
dataset of Lecocq et al. (2020), *Science*. Professional networks plus Raspberry Shake
home sensors. Emphasise: real, public, peer-reviewed, no synthetic data.

**5. The signal — the money slide**
`outputs/plots/AM_R7885_weekly_rhythm.png`. Weekdays overlap in a sharp commute shape;
Saturday sits below; Sunday is lowest and starts latest. The pattern is visible before
any machine learning happens.

**6. Method in one slide**
Day → 24 hourly medians (local time!) → shape (24) + level (1) → random forest.
Trained only on normal days. Tested with whole weeks held out.

**7. Result 1: it works, in 149 cities**
`outputs/plots/accuracy_by_station.png`. Median 94.9% weekday vs weekend (chance 50%),
47.3% exact day (chance 14.3%), best 73.9%.

**8. Result 2: the control group**
Mammoth Lakes, Kule (Botswana), Puerto Williams — at or near chance. Few people, little signal.
And accuracy rises with population density (ρ = 0.39). Plus: label the weekend
correctly per country and Jeddah jumps 53% → 90%, Amatzia 73% → 96%. This is the slide
that proves you're measuring humans, not an artefact.

**9. Where it fails, and how it fails**
`outputs/plots/AM_R7885_confusion.png`. Tuesday/Wednesday/Thursday get mixed up,
weekends almost never do. Cities genuinely behave the same on midweek days.

**10. Generalisation**
One model, tested only on cities it never trained on: 83% weekday vs weekend.
The rhythm is partly universal, but local models are much better.

**11. Disruption detection**
`outputs/plots/disruptions_global.png`. Trained only on normal days, never a holiday.
On weekday public holidays the model says "weekend" 75.6% of the time, vs 5.5% for
ordinary weekdays. Flagged as anomalous: public holidays 46%, lockdown 35%, normal
days 5% by construction.

**12. The moment**
Thanksgiving in New York and All Saints' Day in Brussels are among each city's most
anomalous days, and the anomaly score uses no calendar at all. On Thanksgiving the
model calls a Thursday "Sunday" with 61% confidence.

**13. Live demo**
```bash
python src/predict.py --station AM.R7885 --date 2019-11-28
```
Have a normal Wednesday ready too, so it doesn't look cherry-picked. Rehearse it, and
screenshot the output as a backup slide in case the laptop misbehaves.

**14. The honest negative result**
Lockdown did *not* look like a permanent Sunday — only 26% of lockdown weekdays were
called "weekend" (vs 76% of holiday weekdays), although 35% of lockdown days were
flagged as anomalous. Lockdown created a
third pattern, quieter and flatter than either. Supervised classification had to pick a
familiar label; unsupervised anomaly detection didn't have to.

**15. Limitations**
~108 normal days per station, one season, national (not regional) holidays only, no
precision/recall yet, one-day weekends defeat the current model, data ends mid-2020.

**16. Future work**
Validate flags against official public-holiday calendars; live data via FDSN; a station
near Dubai; anomaly typing (holiday vs weather vs strike).

## Speaker notes: things worth saying out loud

- "The labels were free. The calendar already knows what day it was."
- "A $400 home seismometer in New York matches research-grade instruments."
- "Our best evidence that this is real is where it *fails*: the mountain stations."
- "We hold out whole weeks, not random days, because consecutive days are correlated."
- "Balanced accuracy, because always guessing 'weekday' would score 71%."

## Questions you should expect

**"Couldn't you just use traffic data?"**
Yes, where it exists. Seismometers are already installed, need no new infrastructure,
record no personal data, and work the same way in places with no traffic-sensing
network at all.

**"Is 47% on day-of-week actually good?"**
It's more than 3× chance, and the confusion matrix shows the errors are almost entirely
between midweek days, which really do look alike. The weekday/weekend result at 95% is
the robust headline.

**"How do you know it's people and not weather/seasons?"**
Three things: rural stations sit at chance; accuracy scales with population density;
and the weekly period matches the human calendar, which weather doesn't have.

**"Isn't detecting Christmas trivial?"**
Christmas, yes. Thanksgiving and All Saints' Day are not — nothing in the code knows
those dates exist. The system found them from the vibration pattern alone.

**"Did you use ChatGPT/Claude to build this?"**
Yes, and it's documented in `docs/07-build-log.md`, including the bugs and the wrong
turn we took with synthetic data before switching to the real dataset. Every number in
the presentation comes from scripts in this repository run on real data, and the whole
thing reproduces with one command.

**"What would you do with more time?"**
Precision/recall against real holiday calendars, live FDSN data, and a station in Dubai
where the working week is Mon–Fri but the weekend is Sat–Sun — which would also test
the weekend-definition limitation directly. Note this needs *new* acquisition: there is
no UAE station in the current dataset and the recordings end in May 2020. See
`docs/08-roadmap.md`.

## Division of labour (suggestion)

One person on the physics and data provenance (slides 2–4), one on method and
evaluation (5–10), one on disruption detection and the demo (11–14). Everyone should
be able to answer the "how do you know it's people?" question.

---

## Final evaluation: the live demo (added 2026-11-04)

Open https://groundtruth-seismic.vercel.app/ on the projector. Suggested 4-minute path:

0. **The tour** (the front page). Click "Take the two-minute tour" and scroll: the
   Brussels Wednesday draws itself, the Sunday appears, then March 2020 runs down the
   drum record city by city. Let the audience shout "weekday" or "weekend" at the quiz.
   On a laptop that has seen the tour before, the big button says "Open the globe";
   use the small "Replay the tour" link under it.
1. **Today** (`today.html`). "Every morning a GitHub Action downloads yesterday's ground
   vibration for 7 cities. Every day on this page is one the model never trained on."
   Point at a city: the darkest letter is the weekday it looked like, the underline the
   real day, and the track record sits next to the training score. Show Dublin's October
   Bank Holiday spike (called Sunday, P = 1.00).
2. **Predictions board** (bottom of Today). "We wrote these down *before* the days and
   committed them to the public repository. The site grades them by itself, and wrong
   ones stay up." Thanksgiving (26 Nov) is the headline one.
3. **Guess the day** (`game.html`). Ask the audience to call out the weekday for one
   day, then reveal. Tick "Holidays only" for a Christmas or Thanksgiving: the ground
   sounds like a Sunday. LA's Veterans Day sounds like a Monday, and the model knows.
4. **Time-travel globe** (`globe.html`). Click "March 2020 lockdowns": the Americas and
   Europe go blue together. Then "Christmas Day 2020", and click Brussels for its whole
   2020 as a calendar (blue spring, red summer as the city reopened). Say the honest part:
   colours compare each day with recent weeks, so long events fade after ~8 weeks.
5. **Research map** (`research.html`). 158 seismometers; dark = rhythm easy to read. The
   band chart: ocean waves (0.1–1 Hz) at chance, which is the proof that we measure
   people, not nature.

**Backup:** screenshot each page the day before. If the venue's internet fails, the
repo's `site/` folder holds the same pages (they need a web address to load their data,
so screenshots are the safer fallback).

**Likely questions**
- *"Isn't 25% of Montreal's days flagged a failure?"* It's drift, shown honestly: the
  training year misses Feb–May, and a regional holiday isn't in the national calendar.
- *"Could the model just be learning the date?"* No: it sees only the 25 numbers
  describing one day's vibration, and whole weeks are held out.
- *"Privacy?"* Neighbourhood-scale vibration, hourly. It can't identify anyone.
