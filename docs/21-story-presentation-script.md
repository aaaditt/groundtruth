# 21. GroundTruth: the story talk (v3)

**About 15 minutes, 3 speakers, 28 beats + 2 backup slides.** Replaces the all-video talk
(`docs/18`, kept as the previous version). Same results, told as one story that climbs:
*last time → what the ground records → which shaking is us → how a model reads a day →
what it gets wrong, and why that's useful → what didn't work → then scale it up: 33 cities,
7 years, and a test running every night.*

Revised after three read-only reviews (a data-science grader, a story coach, a smartboard
designer): every number on screen now carries its source, the 7-year model is introduced
as a new model rather than "the same model, better", and a limits beat is back.

**Two ways to present it, same script:**
1. **Live deck** (`site/talk/`, a web page that behaves like slides): clicker or arrow keys,
   Next/Back buttons at the bottom, **swipe with three or more fingers** to change slide,
   one finger to use the globe or a chart. Clips play inside it; live pages open inside it.
   **Every clip stops at each of its beats and waits for you** (Space, clicker, Next or one
   tap on the screen). At a stop the camera and captions hold still but the city keeps
   moving: cars drive, people walk, the sea rolls. Pressing Next while a clip is still
   playing jumps straight to its stop, so if you're behind you catch up at once; Back
   returns to the previous stop. The stops are listed in
   `presentation/video/src/cues.json`.
2. **PowerPoint** (`presentation/GroundTruth-story.pptx`): the same beats as stills and
   embedded clips; live beats become their fallback. For submission and as the backup.

**Formats:** `[STATIC]` a still you talk over · `[DIAGRAM]` a block diagram that builds one
group of boxes per press (it shows how the parts connect; the slides after it open each box) · `[VIDEO name]` a clip that plays to its next
stop and waits there (one press per stop) · `[LIVE page]` the real website inside the deck; if it hasn't loaded in 5 seconds
its fallback appears by itself.

**The room will not participate.** Every question is rhetorical and answered at once.

**Source labels on screen** (small, under every number):
- **R1–R13 · 2019–20 · 149 seismometers** — the published data (Lecocq et al. 2020).
- **R12 · 2025–26 · 7 cities** — recent data, the band test.
- **R16–R18 · 2019–26 · 33 cities** — the 7-year models. Different data, features and model:
  not comparable one to one with R1.

**Speakers, one block each** (≈5 minutes per person):

| # | Beat | Format | Speaker | Time |
|---|---|---|---|---|
| 1 | You shook the ground today | VIDEO S00 (3 stops) | Aadit | 0:25 |
| 2 | Weekday or weekend? | VIDEO S01 | Aadit | 0:30 |
| 3 | Last time: one question | STATIC | Aadit | 0:20 |
| 4 | What a seismometer records | VIDEO C1 (cut) | Aadit | 0:40 |
| 5 | Who listened to cities before us | DIAGRAM research (3 presses) | Shraddha | 0:40 |
| 6 | Where they stopped, and where we start | DIAGRAM gap (3 presses) | Shraddha | 0:35 |
| 7 | Seismometers on six continents | LIVE research map (fb C3) | Aradhya | 0:25 |
| 8 | Where every recording comes from | DIAGRAM sources (3 presses) | Aradhya | 0:30 |
| 9 | Two kinds of shaking | VIDEO C2 (cut) | Aradhya | 0:25 |
| 10 | The spectrum: the sea and us | STATIC spectrum | Aradhya | 0:30 |
| 11 | The sea band can't read the week | STATIC band test | Aradhya | 0:25 |
| 12 | From the ground to a guess | DIAGRAM docs/03's six steps (3 presses) | Shraddha | 0:35 |
| 13 | One day becomes 25 numbers | VIDEO S05 (cut) | Shraddha | 0:35 |
| 14 | A hundred trees vote | VIDEO C4 | Shraddha | 0:35 |
| 15 | Tested on weeks it never saw | STATIC CV diagram | Shraddha | 0:30 |
| 16 | It reads the day | STATIC results | Aadit | 0:45 |
| 17 | Its mistakes find holidays | VIDEO S08 | Aradhya, Aadit | 0:55 |
| 18 | From a mistake to an alarm | DIAGRAM alarm (3 presses) | Aadit | 0:35 |
| 19 | The weekend moves | STATIC | Aradhya | 0:40 |
| 20 | The dare, done properly | VIDEO C5 (cut) → STATIC | Aradhya | 0:50 |
| 21 | What didn't work | STATIC | Shraddha | 0:30 |
| 22 | Now scale it: 33 cities, 7 years | STATIC method card | Aadit | 0:35 |
| 23 | Does more data make it smarter? | STATIC learning curve | Shraddha | 0:35 |
| 24 | What runs every night | DIAGRAM live system (3 presses) | Shraddha | 0:40 |
| 25 | Ask the ground | LIVE globe#ask (fb S11) | Aadit | 0:55 |
| 26 | A test running every night | LIVE today.html (fb still) | Shraddha | 0:30 |
| 27 | Five promises, kept (scorecard, no read-out) | STATIC | Aadit | 0:08 |
| 28 | Still useless? | VIDEO S14 | Aadit | 0:40 |
| B1 | *Backup:* memorisation | STATIC | — | — |
| B2 | *Backup:* running live | VIDEO S11 | — | — |

≈ 16:00 with hand-offs. If short of time, cut 19's Salfit half, then 21's last sentence,
then beat 21 itself. Never cut 2, 6, 12, 17, 23, 25. The six diagrams (5, 6, 8, 12, 18, 24)
each build in three presses: say one sentence per press, then move on.

---

# The script

### 1 · YOU SHOOK THE GROUND TODAY — `[VIDEO S00, 3 stops]`
> **[Aadit]** *(no greeting)* Every one of you shook the ground on the way here. By car, by
> bus, on foot. A few billionths of a metre, but you did. And somewhere under this city, an
> instrument wrote it down. Here's one day of that writing.

### 2 · WEEKDAY OR WEEKEND? — `[VIDEO S01]`
> **[Aadit]** One whole day under Brussels, midnight to midnight. Look at the morning.
> Weekday, or weekend? *(one beat — don't wait)* It was a Wednesday: **Christmas Day, 2019.**
> Our model said **Sunday**. In a few minutes you'll see why it was right to be wrong.

### 3 · LAST TIME — `[STATIC]`
> *The proposal's question in large type; five small promises underneath.*
> **[Aadit]** Two months ago we asked one question: **can a seismometer tell what day it
> is?** We made five promises. Short answer: we kept all five, then kept going. So, what is
> it actually hearing?

### 4 · WHAT A SEISMOMETER RECORDS — `[VIDEO C1, cut]`
> **[Aadit]** Every car, bus and footstep pushes on the ground and sends a tiny wave down
> through the rock. A seismometer is a weight on a spring: the ground moves, the weight
> lags, and it measures the difference. Seismologists built these for earthquakes, and
> everything else they call noise. This is an ordinary Wednesday in January 2020 under
> Brussels: quiet at night, a jump at seven, high all day. **The noise is a city waking
> up.** Shraddha, who else has listened?

### 5 · WHO LISTENED TO CITIES BEFORE US — `[DIAGRAM research, 3 presses]` *(docs/02, "Papers")*
> **[Shraddha]** We're not the first to listen to cities. In 2009 a team in Bucharest sorted
> city noise into its daily and weekly cycles; in 2017, Barcelona traced it to traffic, the
> metro and crowds. *(Next)* Then the pandemic. Lecocq and colleagues showed lockdowns cut
> human noise by **up to half**, at 268 stations: that's the paper whose data we use. Sicily
> and Tokyo compared the noise with **phone mobility data** and found it tracked how people
> moved. *(Next)* And most recently, people either **strip city noise out** to see
> earthquakes better, as in Long Beach, or **map it street by street** with fifty
> kilometres of fibre-optic cable, as in San Jose.

### 6 · WHERE THEY STOPPED, AND WHERE WE START — `[DIAGRAM gap, 3 presses]`
> **[Shraddha]** So where did they stop? They measured **averages**: an hour, a type of
> day, a lockdown. We guess **one day at a time**, graded only on weeks the model never saw.
> They studied one city or one event; we used **149 seismometers**, then **33 cities over
> seven years**, and tested a city the model never heard. *(Next)* They needed phone data to
> compare with; our model needs none, and **its own mistakes find holidays** without labels.
> They removed people to see earthquakes; we kept people as the signal, and tested that
> idea on earthquakes too. It didn't help, and we'll show you. *(Next)* And they needed
> dense arrays or new fibre; we use seismometers **already in the ground**, and a test runs
> every night. Aradhya, where do ours come from?

### 7 · SEISMOMETERS ON SIX CONTINENTS — `[LIVE research.html]` *(fallback: C3)*
> **[Aradhya]** Here they are: **158 seismometers** on six continents, one reading every
> fifteen minutes, late 2019 to mid-2020. *(touch Brussels)* Brussels is this one, in
> Uccle. Holidays and lockdown are set aside, which leaves **17,027 ordinary days** to learn
> from. So whose recordings are these?

### 8 · WHERE EVERY RECORDING COMES FROM — `[DIAGRAM sources, 3 presses]` *(site/data/sources.json)*
> **[Aradhya]** Every recording has an owner. The 2019 to 2020 recordings are Lecocq and
> colleagues' published data. *(Next)* Everything since, 2019 to today, comes from
> **EarthScope's** public noise spectra; the earthquakes from the **US Geological Survey's**
> catalogue; and holidays and weekends from **public calendars**, never from the shaking
> itself. *(Next)* Behind them are **59 seismic networks**, and 54 have a DOI you can cite.
> On the website, click any station and it shows its network and DOI.

### 9 · TWO KINDS OF SHAKING — `[VIDEO C2, cut]`
> **[Aradhya]** Not all shaking is us. The **slow** wobbles, one every few seconds, are the
> **ocean**, waves hitting coasts hundreds of kilometres away. The **fast** ones, several a
> second, are engines, wheels and feet.

### 10 · THE SPECTRUM — `[STATIC spectrum]` *(R12 data · Brussels · 2025–26)*
> **[Aradhya]** Held still. Left, the ocean: 11 a.m. and 3 a.m. are almost the same line;
> the sea doesn't keep office hours. Right, **4 to 14 hertz**: daytime is about **forty
> times** stronger than night. That gap is us, so that's the band we listen to.

### 11 · THE SEA BAND CAN'T READ THE WEEK — `[STATIC band test]` *(R12 · 2025–26 · 7 cities)*
> **[Aradhya]** And we tested it. Same model, same days, five bands. The ocean band reads
> weekday vs weekend **51%** of the time: a coin toss. Every band where people are scores
> above 95%, and the people band, 4 to 14 hertz, is best: **almost 99%**.
> Shraddha, how does a model listen?

### 12 · FROM THE GROUND TO A GUESS — `[DIAGRAM docs/03's six steps, 3 presses]` *(docs/03)*
> **[Shraddha]** Before the details, the whole method on one page: the **six steps of our
> methodology document** (docs/03). The data: each day becomes **one row**, only the 4 to 14
> hertz band, glitches dropped, every clock moved to local time. Then **25 features**. Then
> the **labels**: weekends and holidays come from public calendars, and only ordinary days
> ever train. *(Next)* The model: a **forest** of a hundred trees votes on the day, and we
> only grade it on **whole weeks it never saw**. *(Next)* And step six turns its surprise
> into a detector of **unusual days**. The next slides open these steps one by one.

### 13 · ONE DAY BECOMES 25 NUMBERS — `[VIDEO S05, cut]`
> **[Shraddha]** The first boxes, up close. A model can't look at a picture, so each day
> becomes 25 numbers. Twenty-four say *when* the city was busy, hour by hour: the **shape**.
> One says how loud the whole day was compared with that station's usual day: the
> **level**. Every station is different, some by a motorway, some in a basement; the shape
> is what makes them comparable.

### 14 · A HUNDRED TREES VOTE — `[VIDEO C4]`
> **[Shraddha]** The next box: the model is a **random forest**, a hundred decision trees,
> each asking a few yes/no questions. A real one from Brussels: *at six in the morning, was
> the ground still no busier than the rest of the day?* Yes leads to weekend. On a Wednesday
> it never saw, **97 of 100 trees say weekday**, but they split on *which* weekday.

### 15 · TESTED ON WEEKS IT NEVER SAW — `[STATIC CV diagram]`
> **[Shraddha]** And the last box: grading. We never grade it on a week it studied. Monday
> and Tuesday are near-twins, so we hide **whole weeks**, five rounds. And we score it so
> that always guessing "weekday" gets 50, not five out of seven: **balanced accuracy**.
> Aadit, how did it do?

### 16 · IT READS THE DAY — `[STATIC results]` *(R1, R2, R6 · 2019–20 · 149 seismometers)*
> **[Aadit]** One forest per seismometer. Weekday or weekend: **95%** in a typical city. The
> exact day: **47%**, where guessing gets 14. In three of the emptiest places in the data,
> a mountain, the Kalahari, the tip of Chile, it's near chance. **No people, no rhythm.**
> And the shape matters: loudness alone names the exact day **30%** of the time; with the
> shape, **47%**.

### 17 · ITS MISTAKES FIND HOLIDAYS — `[VIDEO S08]` *(R7, R8)*
> **[Aradhya]** Back to Christmas: a Wednesday it had never seen, and it said **Sunday**,
> and so did the models at 71% of seismometers. On weekday holidays it never saw, it said
> "weekend" **76%** of the time; on ordinary weekdays, **5%**. It learned how people
> behave, not the calendar.
> **[Aadit]** Rank every day by how surprised it was, and the holidays float to the top.
> Here is how that works.

### 18 · FROM A MISTAKE TO AN ALARM — `[DIAGRAM alarm, 3 presses]` *(R7, R8)*
> **[Aadit]** How does a mistake become an alarm? Follow Christmas through the boxes. A day
> it never saw: a Wednesday. The forest says **Sunday**, and gives Wednesday no chance at
> all. *(Next)* So how surprised is it? One minus the chance it gave the real day: **one**,
> the maximum. *(Next)* Then compare it with ordinary days: ninety-five out of a hundred are
> less surprising than this line. Above the line, flag it. No labels, no list of holidays.
> Across every seismometer, that alarm beat the standard unusual-day alarm at **110 of
> 147**. We never built a holiday detector. We taught it normal.

### 19 · THE WEEKEND MOVES — `[STATIC]` *(R3, R9, R10)*
> **[Aradhya]** A model trained on all the *other* cities still reads a new one: **83%**.
> Trained only on Saturday–Sunday countries, it calls Salfit's **Fridays** weekend: it
> recognises rest, not the name of the day. Jeddah, our third Friday city, didn't transfer.
> And when the UAE moved its weekend in 2022, we wrote the prediction down **before**
> downloading anything: Sundays got **20% quieter**, luck would do that about 3 times in
> 1,000. One sensor, 90 km from Sharjah, and Fridays got busier, which we didn't predict.

### 20 · THE DARE, DONE PROPERLY — `[VIDEO C5, cut → STATIC]` *(R19, R22)*
> **[Aradhya]** Last time's dare: if we know what a city sounds like at eight on a Tuesday,
> can we **subtract the people** and find small earthquakes underneath? On fifteen-minute
> averages: not supported, p = 0.053, and outside one Puerto Rico swarm a simple rolling
> median did best. A quake lasts seconds; fifteen minutes blurs it away. So we wrote a
> proper test down in advance: **second-by-second recordings**, years the first test never
> touched, at most 100 quakes per station so no swarm decides it. Result: with the people subtracted, **413** found; the raw recording, **501**.
> **Not supported**: it made things worse. A plain rolling baseline of the last five minutes
> did best, **524**. A city's weekly rhythm is the right model for reading the day, and the
> wrong one for finding a quake that lasts seconds. Detecting quakes that happened; never predicting them.
> Shraddha, what else didn't work?

### 21 · WHAT DIDN'T WORK — `[STATIC]` *(R4, R6, R8)*
> **[Shraddha]** Three honest ones. Lockdown didn't make weekdays look like Sundays: only
> about a quarter were called weekend; it looked like no day the model had heard. Our
> shape-plus-level split doesn't beat raw hourly numbers; it's about as good, and easier to
> compare. And all of this is one season, with national holidays only. So: what happens
> with years?

### 22 · NOW SCALE IT — `[STATIC method card]` *(R15–R17 · 2019–26 · 33 cities)*
> *Card: 33 cities · Jan 2019 – Sep 2026 · 72,395 ordinary days · one model per city ·
> 3 frequency bands × 48 half-hours · gradient boosting · whole weeks held out.*
> **[Aadit]** We went back to the source: seven years, every station from the study that is
> still recording and publicly served, plus Sharjah. **33 cities, 72,000 ordinary days.**
> This is a new, bigger model: three frequency bands, every half hour, gradient boosting,
> still tested only on weeks it never saw. A new experiment, so new numbers.

### 23 · DOES MORE DATA MAKE IT SMARTER? — `[STATIC learning curve]` *(R16–R18)*
> **[Shraddha]** The obvious bet: seven years makes it much smarter. Weekend or not:
> **97%**. But the exact day climbs from **38%** at 100 days to **57%** with all of them,
> and flattens. One model for all 33 cities together: worse in every city. A Tuesday just
> sounds like a Thursday. Show it the **week around** the day instead: **96%**.

### 24 · WHAT RUNS EVERY NIGHT — `[DIAGRAM live system, 3 presses]` *(pulse.yml, src/pulse.py, src/ask.py)*
> **[Shraddha]** So how does a website know what the ground did last night? Follow the
> boxes. The seismometers record all day; EarthScope publishes their spectra about two days
> later; and every morning at six, a **GitHub Action** wakes up and downloads the new days.
> *(Next)* Two models score each day: the **frozen** one, trained on one year and never
> changed, and a **learner** that guesses a day first and only then studies it. *(Next)*
> The answers are saved in the repository, Vercel publishes them, and the globe, Ask and
> City Pulse read them. Ask's seven-year models are built once on a laptop and saved the
> same way. Aadit, show them.

### 25 · ASK THE GROUND — `[LIVE globe.html#ask/BE.UCC..HHZ/2019-12-25]` *(fallback: S11)*
> **[Aadit]** Here it is, live: 33 cities, any day from 2019 to last September.
> *(Brussels, Christmas 2019)* From the day alone: Sunday, sure of it. From the week around
> it: Wednesday, sure of it. **A Wednesday that looked like a day off.**
> *(Next → the globe on Mon 23 Mar 2020)* And this is the week the world stopped. *(let it
> sit two seconds)* Of the 24 cities we measure clearly, **12** were at least 15% quieter
> than their normal that Monday; a week later, **17**. Nobody told the globe there was a
> pandemic. *(R15)*

### 26 · A TEST RUNNING EVERY NIGHT — `[LIVE today.html]` *(fallback: still)*
> **[Shraddha]** And this is the learner from the diagram, running. Every night this page
> guesses yesterday **before** it's told, frozen and learning side by side. Does learning
> help? We wrote the test down before writing the code, and our own guess is *probably not
> much*, because more data already flattened. The verdict comes in January; until then
> these numbers say *interim*.

### 27 · FIVE PROMISES, KEPT — `[STATIC scorecard]`
> *(no read-out: let it sit while you walk to the centre, then Next)*

### 28 · STILL USELESS? — `[VIDEO S14]`
> **[Aadit]** So: seismometers. Still useless? There's a network already buried under many
> of the world's cities, recording for decades, free. It hears a neighbourhood, not a
> person: no phones, no cameras. And ours is running tonight. **Everyone measures how loud
> the ground is. We taught a model what normal sounds like, and its mistakes tell us when
> something happened.** That's GroundTruth. Thank you.

### B1 · BACKUP: DOES IT REMEMBER WHAT IT STUDIED? — `[STATIC memorisation]` *(R20, exploratory)*
> If asked "can it even name the days it trained on?": same 7-year models, days it trained
> on **[R20 seen]**, weeks it never saw **[R20 unseen]**. The gap is memorisation, which is
> why every number in this talk is on unseen weeks. (Exploratory: not pre-registered.)

### B2 · BACKUP: RUNNING LIVE — `[VIDEO S11]`

---

# Rehearsal notes
- **Hand-offs are spoken:** "Aradhya, where does it come from?" · "Shraddha, how does a
  model listen?" · "Aadit, how did it do?" · "Shraddha, what else didn't work?" ·
  "So: what happens with years?"
- **Live slides:** open the deck 10 minutes early on the classroom machine. If a fallback
  appears, keep talking; it says the same thing. `L` forces the fallback.
- **Beat 25 step:** the next click reloads the globe on 23 Mar 2020 by itself; don't tap
  around.
- **Words to avoid:** "predicts earthquakes", "proves", "it learns everything", "went up
  from 95 to 97" (different experiments). Say "in a typical city" before 95%.
- **Q&A:** `docs/18` Q&A still holds. New: "Isn't more data always better?" → beat 23.
  "Does it remember its training days?" → B1. "Is 57% honest?" → it's the best of 8
  configurations on the same data, so slightly optimistic (R17).
