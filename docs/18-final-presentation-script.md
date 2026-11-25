# 18. GroundTruth: final presentation script (v2)

**About 15 minutes, 3 speakers, 17 slides, each with a clip.**
This is the sequel to the proposal talk (`docs/09`). Last time we asked a question and
made **five promises**. The deck added a sixth, harder item: "subtract the people". We
call that one *the dare*. This time we show each one. Five held, and so did an extra test
we wrote down in advance. The dare didn't, and we say so.

**Speakers:** **[Aadit]**, **[Shraddha]**, **[Aradhya]**. They trade every 30 to 90
seconds, as in the proposal talk. Every hand-off is one sentence that gives the next
person their question by name.

- **Aadit:** the idea, the physics, what it's for.
- **Shraddha:** the method and the testing.
- **Aradhya:** the data, the holidays and the tests we wrote down in advance.

**The look matches the proposal deck:** light paper, Newsreader for headings, IBM Plex
for text. Every slide is a 3D scene: the city (with the ground cut open under it), the sea,
the globe, the forest, the earthquake, and the data itself as 3D sculptures on a paper
table, where every marble, tile and column is a real value.

## How this talk works

- **Slides and speech are one thing.** Every slide is a clip. You talk over it, and each
  clip **holds on its last frame**, so nothing runs away from you.
- **`▶ Cn` / `▶ Sn` means "click: the clip starts"** on the **bold cue word** just before
  it.
- **Every number is real.** Curves and numbers come from the JSON that
  `src/presentation_data.py` writes from the real data. The 3D city, road, ground, sea and
  seismometer are drawings and say *Illustration* on screen, but they move with real data:
  the traffic follows Brussels' real hourly rhythm.

| # | On screen | Speakers | Time | Clip |
|---|---|---|---|---|
| 0 | Questions | Aadit, Shraddha, Aradhya | 0:45 | S00 Questions |
| 1 | Weekday or weekend? | Aadit | 0:30 | S01 Christmas |
| 2 | Last time, we promised | Shraddha, Aradhya | 0:40 | S02 Promises |
| 3 | A day under the city | Aadit, Shraddha | 1:35 | C1 City (3D) |
| 4 | 158 seismometers | Aradhya, Shraddha | 0:50 | C3 Globe (3D) |
| 5 | Two kinds of shaking | Aadit, Aradhya | 1:20 | C2 Sea and city (3D) |
| 6 | One day becomes 25 numbers | Aadit, Shraddha | 1:05 | S05 Features |
| 7 | A hundred trees vote | Aradhya, Shraddha | 0:55 | C4 Forest (3D) |
| 8 | Tested on weeks it never saw | Shraddha, Aradhya | 0:40 | S06 Weeks |
| 9 | It reads the day | Aadit, Shraddha | 0:55 | S07 Results |
| 10 | Its mistakes find holidays | Aradhya, Aadit | 1:30 | S08 Mistakes |
| 11 | Lockdown | Shraddha | 0:35 | S09 Lockdown |
| 12 | The weekend moves | Aradhya, Aadit | 0:55 | S10 Weekends |
| 13 | The dare: subtract the people | Aradhya, Shraddha | 1:00 | C5 Earthquake (3D) |
| 14 | What else didn't work | Shraddha | 0:25 | S12 Limits |
| 15 | The scorecard | all three | 0:25 | S13 Scorecard |
| 16 | Still useless? | Aadit | 0:50 | S14 Close |
| — | *Backup, for Q&A:* running live | — | — | S11 Live |

That's 15:00 including hands and pauses. Each speaker talks for about 5 minutes.

---

# The script

### 0 · QUESTIONS — *(0:00–0:45)* `▶ S00 Questions`

> *3D: walking along the city's main road in the morning rush, then rising over the city.
> Each question writes itself on a paper card as it's asked.*

> **[Aadit]** *(walks out, no greeting)*
> Hands up if you got here today by car, by bus, or on your own two feet.
>
> *(every hand goes up)*
>
> Keep them up. Every one of you just shook the ground. Not much: a few tens of
> nanometres. But it shook.

> **[Shraddha]**
> Hands down. Next one. Without looking at your phone: what day is it? *(answers)*
> How do you *know*? *(take one or two: "lectures", "the traffic")* Right. You know from
> how the city behaves.

> **[Aradhya]**
> Last one. Who remembers the question we asked in this room last time? *(let someone
> try; if nobody does, say it)* **Can a seismometer tell what day of the week it is?**

> **[Aadit]**
> Today you get the answer. **Here's one day.**

### 1 · WEEKDAY OR WEEKEND? — *(0:45–1:15)* `▶ S01 Christmas`

> *3D: the same city, almost empty; that day's real rhythm drives the street. The real
> day of shaking draws itself in a strip; at the reveal, a Christmas tree appears.*

> **[Aadit]**
> This line is the ground under a city: one whole day, midnight to midnight.
>
> Hands up: was this a **weekday, or a weekend?**
>
> *(take the hands)*
>
> It was a Wednesday. **Christmas Day, 2019.** *(two-second pause)* Our model looked at
> it and said: Sunday. Hold on to that. In ten minutes you'll see why it was right to be
> wrong.

### 2 · LAST TIME, WE PROMISED — *(1:15–1:55)* `▶ S02 Promises`

> *3D: paper signs rise one by one on the city's plaza, numbered as in the proposal:
> five promises, then the dare.*

> **[Shraddha]**
> Two months ago we hadn't built anything. So instead we made you five promises.

> **[Aradhya]**
> A model that reads the day from the ground. A test of whether the **shape** of a day
> (*when* the city is busy) beats how loud it is. Letting its **mistakes** find unusual
> days. Showing it holidays it had never seen. And moving it to **another city**.
>
> And on our last slide, a dare: **subtract the people** and see the small earthquakes
> underneath.
>
> Today you see all of it, including the part that didn't work. But first, what is a
> seismometer actually hearing? Aadit, take us down.

### 3 · A DAY UNDER THE CITY — *(1:55–3:30)* `▶ C1 City`

> *3D illustration. The camera circles a small city at dawn and glides down to the road.
> The ground splits open into a cross-section, and deep below sits a seismometer. Then a
> clock runs slow, fast, slow through one whole day while the real recording draws itself.*

> **[Aadit]**
> Every car on that road pushes on the ground. So does every bus, train and footstep.
> Each push sends a tiny wave down through the soil and rock, like ripples on a pond.
>
> *(the camera reaches the seismometer)*
>
> This is a **seismometer**. A heavy weight hangs on a spring. When the ground moves, the
> weight lags behind, and the instrument measures that tiny difference.

> **[Shraddha]**
> Seismologists built these for earthquakes. All the everyday shaking, they call
> **noise**, and they throw it away. So let's watch the "noise" for one whole day.
>
> *(the clock starts at midnight)*
>
> When do you think this city wakes up? Shout a time.
>
> *(take a guess or two)*
>
> At night the pen barely moves. Around five, the first buses. By seven the whole city is
> moving and the line jumps. High all day, fading through the evening.
>
> *(the city fades; the line remains)*
>
> And that line isn't drawn by us. It's a **real recording**, one reading every fifteen
> minutes, of an ordinary Wednesday in January 2020. **The noise they throw away is a city
> waking up and going to sleep.**
>
> Which city? Aradhya.

### 4 · 158 SEISMOMETERS — *(3:30–4:25)* `▶ C3 Globe`

> *3D globe. 158 pins rise at the real station locations, and the camera settles on
> Brussels.*

> **[Aradhya]**
> Our data comes from a 2020 paper in *Science* by Thomas Lecocq and colleagues, who
> showed the ground went quiet in the COVID lockdowns and **published the recordings**:
> **158 seismometers** on six continents, a reading every fifteen minutes, late 2019 to
> mid-2020. Nearly **29,000 days** of real recording.
>
> *(the camera settles on Belgium)*
>
> We'll follow one of them: **BE.UCC**, in Uccle, in the south of Brussels. That's the one
> you just watched. The Wednesday was Brussels, and so was Christmas.

> **[Shraddha]**
> One rule from the start: the answer key never comes from the shaking. Which days are
> weekends comes from each country's calendar, and in Palestine that's Friday. Holidays,
> the Christmas weeks and lockdown are **set aside**; the model never trains on them. That
> leaves **17,027 ordinary days** to learn from.
>
> But Aadit, is all that shaking even us?

### 5 · TWO KINDS OF SHAKING — *(4:25–5:45)* `▶ C2 Sea and city`

> *3D. The camera rises and pulls out to a coastline: sea swells push long, slow waves
> into the ground, and the city makes short, quick ones. Then it dives into a landscape
> made from a year of Brussels' recent recordings, hour by hour.*

> **[Aadit]**
> Not all of it. Something much bigger shakes the ground too.
>
> Every vibration has a speed: how many times a second it wobbles, measured in **hertz**.
> *(the sea)* The **slow** wobbles, one every few seconds, come from the **ocean**: waves
> hitting coastlines hundreds of kilometres away shake the whole continent. *(the city)*
> The **fast** ones, several times a second, are engines, wheels and feet.
>
> *(the camera dives into the landscape)*
>
> This landscape is a year of Brussels' recent recordings, split by speed. The ridge at
> the back is the sea. As the clock runs, it doesn't move: the ocean doesn't care what time
> it is. The front rises at six in the morning and sinks at night. **That's us.**

> **[Aradhya]**
> We tested that on a year of recent data from seven cities, one speed band at a time.
> Quick vote: which band reads the week? Ocean band? *(hands)* People band? *(hands)*
>
> *(bars grow)*
>
> The ocean: **51%**, a coin toss. The people band, **4 to 14 hertz**: almost **99%**.
> **Same data, same model: it only works where the people are.**
>
> So now we know what to listen to. Shraddha, how does a model listen?

### 6 · ONE DAY BECOMES 25 NUMBERS — *(5:45–6:50)* `▶ S05 Features`

> *3D sculpture: the 96 real readings of the Brussels Wednesday as beads, which become
> 24 columns; the columns re-base on a glass sheet (the day's average) into "shape", and
> one more column is the "level".*

> **[Shraddha]**
> A model can't look at a picture; it needs numbers. Here's how one day becomes them.
> Aadit cleans the data first.

> **[Aadit]**
> Readings a hundred times above or below a station's normal are sensor glitches, so they
> go. And everything moves to **local time**: rush hour is eight in the morning *where the
> seismometer is*.

> **[Shraddha]**
> Then one number per hour. *(the dots collapse into 24 bars)* The **median** of the
> hour's four readings, so one passing lorry can't drag it up, and its **logarithm**, so
> "ten times louder" becomes "one step up".
>
> Then we split the day in two. *(the curve splits)* The **shape** is each hour minus the
> day's average: *when* the day was busy. The **level** is how loud the day was, compared
> with that station's usual day.

> **[Aadit]**
> Why split? Every seismometer is different: next to a motorway, in a basement, even
> recording in different units. The shape is what makes cities comparable.

> **[Shraddha]**
> Twenty-four numbers for the shape, one for the level. **That's all the model ever
> sees.** Aradhya, what does it do with them?

### 7 · A HUNDRED TREES VOTE — *(6:50–7:45)* `▶ C4 Forest`

> *3D. One tree grows; its branches are the real questions it learned. Then a forest of
> a hundred grows around it, and each tree lights up with its vote.*

> **[Aradhya]**
> The model is a **random forest**: a hundred decision trees, each asking a few yes-or-no
> questions. *(the first branch)* This is a real one from Brussels. Its first question:
> **at six in the morning, was the ground still no busier than the rest of that day?** Yes
> leads mostly to weekends; no, to weekdays. Each tree learns from a random slice of days,
> so they differ. Then they **vote**.

> **[Shraddha]**
> *(the forest lights up)*
> Here's an ordinary Wednesday the forest never saw. **Ninety-seven of the hundred trees
> say weekday.** But which weekday? They split between Monday, Tuesday, Thursday and
> Friday; only five say Wednesday. Sure about the weekend, unsure about the exact day.
> Remember that.

> **[Aradhya]**
> Why trees? Each city has only about **115 ordinary days**. That's far too few for deep
> learning, and forests are good on small tables.

### 8 · TESTED ON WEEKS IT NEVER SAW — *(7:45–8:25)* `▶ S06 Weeks`

> *3D: a calendar of tiles; whole weeks rise and turn orange as "test", round by round.*

> **[Shraddha]**
> **Now the honest part.** Monday and Tuesday of the same week are almost twins. If one
> is in training and the other in the test, the model gets a hint. So we never split a
> week. Whole weeks are held out, in five rounds, and every score for a city comes from
> weeks its model **never saw**.

> **[Aradhya]**
> And we grade fairly. In Brussels, a model that always says "weekday" is right 72% of the
> time while knowing nothing. So we use **balanced accuracy**: how often it's right on
> weekdays and on weekends, averaged. **Guessing gets 50%.**

> **[Shraddha]**
> So how did it do, Aadit?

### 9 · IT READS THE DAY — *(8:25–9:20)* `▶ S07 Results`

> *3D: 149 marbles, one per seismometer, drop onto a ruler from 0% to 100%; a flag marks
> the typical city.*

> **[Aadit]**
> **Promise one.** *(the dots fall)* One forest per seismometer: **149** of them. Weekday
> or weekend, in a typical city it's right **95%** of the time. The exact day is harder:
> **47%**, where guessing gets one in seven.
>
> *(three dots near the left glow)*
>
> And three we picked in advance as controls: a mountain near Mammoth Lakes, the Kalahari
> desert, the tip of Chile. Almost nobody lives there, and the model is at or near chance.
> **No people, no rhythm.**

> **[Shraddha]**
> **Promise two**: shape against loudness. Loudness alone, what the field usually
> measures, names the exact day **30%** of the time. Add the shape: **47%**. That's
> **seventeen points**, and **141 of 149** seismometers improve. **The shape carries the
> information.**
>
> But the best part is when it's wrong. Aradhya.

### 10 · ITS MISTAKES FIND HOLIDAYS — *(9:20–10:50)* `▶ S08 Mistakes`

> *3D: Brussels' calendar as tiles, coloured by the model's guess; Christmas lifts out.
> Then two towers (holidays vs ordinary weekdays), then the most surprising days as
> columns.*

> **[Aradhya]**
> Remember the day from the start? Christmas 2019, a Wednesday the model had never seen.
> It said **Sunday**, and so did the models in 71% of cities.
>
> Quick one: raise your hand if you went to work on Christmas Day. *(almost none)*
> Neither did Brussels.
>
> *(holidays across all cities light up)*
>
> That's the **holiday test**. On weekday holidays it never saw, it said "weekend" **76%**
> of the time; on ordinary weekdays, **5%**. Christmas, **86%**. Veterans Day, when most
> American offices stay open, **19%**. It learned how people behave, not the calendar.

> **[Aadit]**
> *(the days are ranked; holidays rise to the top)*
> And the **mistakes promise**: turn that surprise into a detector. We call it
> **confusion**: how unlikely the model thought the real day was. Rank every day by
> confusion, and the holidays rise to the top.
>
> We compared it with the standard alarm, which just measures how far a day sits from
> normal days. Confusion wins in **110 of 147 cities**.
>
> **We never built a holiday detector. We taught it what normal looks like, and its
> confusion did the finding.**

### 11 · LOCKDOWN — *(10:50–11:25)* `▶ S09 Lockdown`

> *3D: the city, day by day from November to May; the street follows each real day's
> level and empties in March. Then how often the alarm rang.*

> **[Shraddha]**
> *(a beat after Aadit's line)* So what happens when a whole country stops at once?
>
> Brussels drops in March 2020. We expected lockdown weekdays to look like Sundays.
> Mostly they didn't: only about a quarter were called "weekend". But the standard alarm,
> which normally rings on one day in twenty, rang on **a third** of them.
>
> Here the alarm beats confusion, and that's the lesson. A holiday looks like a familiar
> day on the wrong date. **Lockdown looked like no day the model had ever heard.**
>
> Aradhya, what about cities it's never heard at all?

### 12 · THE WEEKEND MOVES — *(11:25–12:20)* `▶ S10 Weekends`

> *3D globe: a city it never heard (83%), then it turns to Salfit and its week, then to
> the UAE's Sundays before and after 2022.*

> **[Aradhya]**
> **The last promise: another city.** We trained one model on all the *other* cities and
> tested it on a city it had never seen. It still gets **83%**.
>
> Harder: we trained only on Saturday–Sunday countries and showed it Salfit, in
> Palestine. It called Salfit's **Fridays** weekend and its **Sundays** working days. **It
> recognises rest, not the name of the day.** (Jeddah, our third Friday city, didn't
> transfer.)

> **[Aadit]**
> *(Sundays before and after 2022)*
> Then the world ran an experiment for us. In January 2022 the UAE moved its weekend to
> include Sunday. We wrote our prediction down **before downloading any data**. At a UAE
> seismometer, Sundays got **20% quieter**: luck alone would do that about three times in
> a thousand. In the year before, as a check, nothing changed.
>
> That leaves the dare. Aradhya.

### 13 · THE DARE: SUBTRACT THE PEOPLE — *(12:20–13:20)* `▶ C5 Earthquake`

> *3D. Rush hour, with ripples from every car. From deep below, a tiny earthquake wave
> rises and disappears among them. The traffic is "subtracted"... then the result card.*

> **[Aradhya]**
> If we know what a city sounds like at eight on a normal Tuesday, can we **subtract the
> people** and see the small earthquake buried underneath?
>
> We wrote the test down before running it: over five thousand earthquake-and-station
> pairs. With the subtraction we found **998**. Without it, **953**. We set the bar in
> advance: less than a 5% chance it's luck. We got 5.3%.
>
> *(two-second pause)* **Not supported.**
>
> Almost all of that lead comes from one station in Puerto Rico, in an earthquake swarm.
> Elsewhere, subtracting did *worse*. An average Tuesday can't know about today's lorries,
> and a fifteen-minute reading blurs a quake that lasts seconds.

> **[Shraddha]**
> The cleaned record itself works: for Brussels it removes **62%** of the everyday wobble.
> It just doesn't uncover hidden earthquakes. We promised to report what didn't work.
> This is it.

### 14 · WHAT ELSE DIDN'T WORK — *(13:20–13:45)* `▶ S12 Limits`

> *3D: three columns: one season, seven years, the week around it.*

> **[Shraddha]**
> One more: **the exact day**. Later we downloaded seven years of recordings for 33
> cities and pushed it from 47 to **57%**. More days helped, then flattened. The limit is
> what one day holds: a Tuesday and a Thursday simply sound alike.

### 15 · THE SCORECARD — *(13:45–14:10)* `▶ S13 Scorecard`

> *3D: the plaza signs again, now with the results, each stamped with a tick; the dare
> gets "not yet".*

> **[Aradhya]** Read the day: **95%**.
> **[Shraddha]** Shape beats loudness: **plus seventeen points**.
> **[Aadit]** Mistakes find holidays: **110 of 147 cities**.
> **[Aradhya]** Holidays it never saw: **76% called weekend**.
> **[Shraddha]** Another city: **83%**.
> **[Aadit]** And the dare, subtracting the people: **not yet.**

### 16 · STILL USELESS? — *(14:10–15:00)* `▶ S14 Close`

> *3D: from the seismometer, up out of the ground and over the city at dusk as the
> windows light up. The real day draws once more, then the title and the website.*

> **[Aadit]**
> So. Seismometers. Still useless?
>
> *(two-second pause)*
>
> There's a sensor network already buried under many of the world's cities. It has
> recorded for decades, and the data is free. It measures a neighbourhood's vibration,
> not people: no phones, no cameras. And ours is running tonight, on our website.
>
> Every one of you shook the ground getting here today. Somewhere under this city, a
> seismometer heard the shape of it.
>
> **Everyone measures how loud the ground is. We taught a model what the ground normally
> sounds like, and its mistakes told us when something happened.**
>
> *(title card)* That's GroundTruth. Thank you. We'd be happy to take questions.

---

# Q&A

| Topic | Lead |
|---|---|
| The idea, the physics, what it's for, privacy | **Aadit** |
| Features, the model, testing, the live site | **Shraddha** |
| Data, labels, holidays, UAE, earthquakes | **Aradhya** |

**"Isn't this just the Lecocq paper?"** *(Aadit)*
They measured how *loud* the ground was, around lockdown dates they already knew. We
predict the *day* from the *shape* of the vibration, and use the model's mistakes to find
days nobody told it about. Shape adds 17 points over loudness alone on the exact day.

**"Isn't 95% just because weekends are obvious?"** *(Shraddha)*
Partly; weekends really are different. The harder tests are the exact day (47% against
14%) and the holidays it never saw (76% called weekend).

**"Couldn't it be weather, not people?"** *(Aadit)*
Three checks. The ocean band scores 51%, a coin toss. Empty places score near chance. And
the weekend moves with the country; weather doesn't know Palestine rests on Friday.

**"Doesn't raw hourly data beat your shape split?"** *(Shraddha)*
Slightly (by 0.5 and 1.7 points, Result 6). We don't claim the split adds accuracy. We
claim the shape carries information beyond loudness, which it does: +17 points on the
exact day.

**"Why only 4–14 Hz?"** *(Aadit)*
It's the paper's choice, and we tested it against four other bands on seven cities.
4–14 Hz is best overall (98.6%), with 1–4 Hz close behind (98.4%), which is also traffic.
Dublin shows why the narrow band matters: 98.6% at 4–14 Hz, 50% at 1–4 Hz.

**"Precision is only 0.33. Isn't the detector useless?"** *(Aradhya)*
Holidays are about 4% of days, and the threshold flags 5% of normal days by design, so
even a perfect detector at that threshold has low precision. The threshold-free score
(PR-AUC) is 0.63, against 0.33 for the standard anomaly score and 0.04 by chance.

**"If confusion is your detector, why is lockdown caught by the anomaly score?"** *(Shraddha)*
They detect different things. Confusion catches a familiar day on the wrong date (a
holiday looks like a Sunday). The anomaly score catches days unlike any normal day, and
lockdown was that: 27.6% vs 21.3% flagged (Result 8). With Result 4's per-day scoring it
flags 34.5%, about seven times the normal rate.

**"Your earthquake lead is one station?"** *(Aradhya)*
Yes. AM.RCCD1 in Puerto Rico supplies 3,436 of the 5,236 pairs and all of the lead.
Without it, raw beats learned, 275 to 254 (p = 0.04), and a simple rolling median beats
both (346). That's why we report it as not supported.

**"p = 0.053 is so close. Isn't that basically significant?"** *(Aradhya)*
We fixed 0.05 before running it, so no. And the gain comes from one station; the honest
next test would use second-by-second recordings, not 15-minute summaries.

**"Is 57% (or 96%) for the exact day trivial?"** *(Shraddha)*
57% used a different source (33 stations, three bands, gradient boosting) and was picked
from 8 configurations, so it's slightly optimistic. 96% answers a different question:
given the week, the model finds the weekend and counts. A control with the same split but
one day scores 54.7%.

**"Class weighting raised false alarms. Did you tune it on the holidays?"** *(Shraddha)*
No. It was chosen because it matches the balanced-accuracy metric, a reason that holds
before seeing any result. False alarms went from 2.7% to 5.6% (Result 5).

**"UAE rests on one station. Cherry-picked?"** *(Aradhya)*
The hypothesis was committed before any download. Both placebos were null: Sunday in the
year before +5% (p = 0.73), Saturday −3% (p = 0.52). Limits: one station, about 90 km
from Sharjah city, and Friday got 53% busier, which we didn't predict and report anyway.

**"Is it live?"** *(Shraddha, show the backup clip S11)*
Every night the website scores the latest days, about two days behind, with models that
never saw them. In the five cities we validated, it still reads weekday vs weekend at 97
to 100%.

**"Can it identify people?"** *(Aadit)*
The signal is a whole neighbourhood's combined vibration, summarised per hour. It cannot
identify, locate or follow a person, and we don't try (final report, section 7).

---

# Rehearsal notes

- **The hand-offs are the talk.** Each is one sentence naming the next person ("Aadit,
  take us down." / "Which city? Aradhya." / "Shraddha, how does a model listen?").
  Rehearse them until they snap. Stand in speaking order (Aadit, Shraddha, Aradhya), so a
  hand-off is a glance, not a walk.
- **Five audience moments:** the opening hands, the Christmas vote, "shout a time"
  (slide 3), the band vote (slide 5), and "who worked on Christmas" (slide 10). Ask,
  wait, count. Don't rush them, and keep each under 10 seconds.
- **Four pauses, two seconds each:** after "Christmas Day, 2019" (slide 1), after
  "Sunday" (slide 10), before "Not supported" (slide 13), and after "Still useless?"
  (slide 16).
- **Slide 10 is the heart.** Slow down; it pays off the opening.
- **Slide 15 is a quick-fire round:** one line each, no gaps. It's the most fun part to
  rehearse.
- **If you run over,** cut slide 14 first, then the Veterans Day sentence. Never cut 5,
  10 or 13.
- **Words to avoid:** "predicts earthquakes", "proves", "can't identify anyone even in
  principle". Say "in a typical city" before 95%.
- **Every number is in the clip.** If you blank, read the screen.

**Before presenting:**
- [ ] Rebuild data and clips (`presentation/README.md`).
- [ ] Play every clip fullscreen on the classroom machine; check legibility from the back
      row.
- [ ] Time a full run: 15:00 ± 0:30.
- [ ] Check the City Pulse page loads, in case of a live question.
