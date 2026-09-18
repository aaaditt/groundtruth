# 1. The concept

## The one-sentence version

Cities shake. A seismometer can hear the difference between a Tuesday and a Sunday.

## Why the ground shakes

Seismometers are built to detect earthquakes, but they are so sensitive that they also
record a constant background hum. Part of that hum is natural (ocean waves, wind,
weather). Above roughly 1 Hz, in cities, most of it is **us**: cars and trucks on roads,
trains and metros, construction, factories, footsteps, HVAC plant. Seismologists call
this *cultural noise* or *anthropogenic noise*, and for a century they treated it mainly
as a nuisance to be filtered out.

The vibration is tiny — a few tens of nanometres of ground displacement — but it is
**continuous, passive, and already being recorded worldwide**, 24 hours a day, by
instruments that no one installed for this purpose.

## The insight this project is built on

Human activity is rhythmic. People commute at roughly the same time each weekday,
rest on weekends, and stop almost entirely on public holidays. If cultural seismic
noise really is a physical trace of human activity, then that rhythm must be visible
in the vibration record — and if it is visible, a machine learning model should be
able to read it backwards:

> Given one day of ground vibration from a city, what day of the week was it?

This is a deliberately simple, checkable question. Nobody needs to be surveyed, no
phone location data is needed, and the ground truth (what day it actually was) is
free and perfectly accurate. If a model can answer it, that proves the seismic record
carries a real, learnable signature of collective human behaviour.

## From "what day is it?" to disruption detection

Once a model knows what a city's normal week looks like, the more useful question
follows immediately:

> Which days *don't* fit the pattern?

A day that breaks the learned rhythm is a day when the city did something unusual —
a public holiday, a strike, a storm, an evacuation, a lockdown. That is
**anomaly-based disruption detection**, and it is the second half of the project's
registered title. Crucially, it needs no labels: the model learns "normal" and flags
everything that deviates, so it can catch disruptions nobody thought to define in
advance.

## Why this is a good data science project

- **The data is real, public and free.** No surveys, no scraping, no privacy problem.
- **The labels are free and perfect.** The calendar tells you the day of the week.
- **It is falsifiable.** Either the model beats chance across many cities, or it doesn't.
- **It has a built-in control group.** Seismometers in remote areas with no people
  nearby should show *no* signal. They don't. (See `docs/04-results.md`.)
- **It has a real-world payoff.** Passive, privacy-preserving, infrastructure-free
  monitoring of whether a city is behaving normally.

## What we claim, and what we don't

**We claim:** ambient seismic noise contains enough information to identify weekdays
vs weekends with high accuracy in most cities, to guess the exact day of week far
better than chance, and to flag holidays and lockdowns as anomalies without ever
being shown one.

**We don't claim:** that this replaces traffic sensors or mobility data, that it works
everywhere (it doesn't — see the limitations in `docs/04-results.md`), or that any
seismometer can do it (rural stations can't — there's nothing to hear).
