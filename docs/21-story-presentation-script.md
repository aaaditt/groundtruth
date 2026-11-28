# 21. GroundTruth: the story talk (v3)

**About 15 minutes, 3 speakers, 34 beats + 2 backup slides.** Replaces the all-video talk
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
| 16 | How one guess is made | DIAGRAM guess (3 presses) | Shraddha | 0:45 |
| 17 | What the model looks at | DIAGRAM importance (2 presses) | Aadit | 0:35 |
| 18 | Where it gets it wrong | DIAGRAM confusion matrix (3 presses) | Aadit | 0:45 |
| 19 | It reads the day | STATIC results | Aadit | 0:45 |
| 20 | Its mistakes find holidays | VIDEO S08 | Aradhya, Aadit | 0:55 |
| 21 | From a mistake to an alarm | DIAGRAM alarm (3 presses) | Aadit | 0:35 |
| 22 | The weekend moves | STATIC | Aradhya | 0:40 |
| 23 | The dare, done properly | VIDEO C5 (cut) → STATIC | Aradhya | 0:50 |
| 24 | What didn't work | STATIC | Shraddha | 0:30 |
| 25 | Now scale it: 33 cities, 7 years | STATIC method card | Aadit | 0:35 |
| 26 | Does more data make it smarter? | STATIC learning curve | Shraddha | 0:35 |
| 27 | Everything we built | DIAGRAM sitemap (3 presses) | Aradhya | 0:35 |
| 28 | The front page: a two-minute tour | LIVE index.html (fb still) | Aradhya | 0:25 |
| 29 | Ask the ground | LIVE globe#ask (fb S11) | Aadit | 0:55 |
| 30 | What runs every night | DIAGRAM live system (3 presses) | Shraddha | 0:40 |
| 31 | City Pulse: every night | LIVE today.html, 3 steps (fb still) | Shraddha | 0:45 |
| 32 | Guess the day | LIVE game.html (fb still) | Aradhya | 0:35 |
| 33 | Five promises, kept (scorecard, no read-out) | STATIC | Aadit | 0:08 |
| 34 | Still useless? | VIDEO S14 | Aadit | 0:40 |
| B1 | *Backup:* memorisation | STATIC | — | — |
| B2 | *Backup:* running live | VIDEO S11 | — | — |

≈ 19:53 with hand-offs (limit 20 minutes). If short of time, cut the Salfit half of
"The weekend moves", then "What didn't work", then the tour. Never cut "Weekday or weekend?",
"Where they stopped", "From the ground to a guess", "Where it gets it wrong", "Its mistakes
find holidays" or "Ask the ground". Every diagram builds one group per press: say one
sentence per press, then move on.
---

# The script

**How to practise with the cues.** Under every beat: 🎬 what is on screen when the slide
opens, ⏵ what each press of Space (or the clicker, Next, or one tap) does, and ⏭ when the
next press moves to the next slide. Clips stop by themselves and wait; pressing while a clip
is still playing jumps it to its stop, so you can't fall behind.

**Talk over the clips, never after them.** Start speaking the moment a clip starts. Each clip's
words are split by its stops (`"say"` in slides.json): part 1 goes with the stretch before the
first stop, part 2 with the next, and so on. The presenter window lights the part for the
stretch playing now. Press as you finish it; if the clip is already waiting at its stop, it
moves on at once, and if you finish early, let it reach the stop first. No silent watching. Each speaker has a colour in the presenter window (Aadit orange, Shraddha blue, Aradhya violet): the bar beside every part and its name tag say whose turn it is, and the last line names who speaks next. The same cues are in the
deck: press **N** for notes (or **P** for a presenter window on a second screen) and the last
line always says what the next press will do. The whole talk is
77 presses.

**Presenting online** (`site/talk/remote.js`). One person shares the deck's tab in the call;
every speaker steers it from their own presenter window.

1. Open `/talk/` on the sharing laptop and press **Present online** on the start screen. The
   address becomes `/talk/?room=CODE` (a random 12-letter code), and the start screen gets a
   **Copy presenter link** button (the link itself is never shown there, because anyone who
   sees it can move the deck; it is printed at the bottom of your presenter window). Send it
   to the speakers privately, not in the call's chat.
2. Each speaker opens the link on a laptop or a phone. A green dot means it can hear the deck,
   amber means it is in the room but the deck is silent, and red means it has no connection.
   The window shows the slide's script, what the next press does, the clock, and Back / Next.
3. The sharer can open a presenter window too (press **P** on the deck, or open the link in
   another window). Share the **deck's tab or window** in the call, never the whole screen.
4. Space, the arrows, a clicker or the buttons in any presenter window move the deck. Each press
   carries the slide it was meant for, so if two speakers press at once the deck moves once.
   The deck still answers its own keys, which is the fallback if the internet drops.

The link is Supabase Realtime Broadcast: a room that passes messages and stores nothing. The
project's address and **publishable** key go in `site/talk/remote-config.json` (a test refuses
anything else). Without them, presenter windows still work on the same computer.


### 1 · YOU SHOOK THE GROUND TODAY — `[VIDEO S00, 3 stops]`
> 🎬 **On screen:** The clip plays by itself: a street at morning rush, “How did you get here today?”. It stops on “Every one of you just shook the ground…” (the city keeps moving).
>
> **[Aadit]** Think about how you got to our University today. A car, a bus, the metro, or your own two feet. Every one of those pushed on the ground. A few billionths of a metre, far too small to feel, but real.
>
> ⏵ **Space 1:** Plays on, stops on “What day is it?” and “How do you know?”
>
> So here's a question. What day is it today? Easy: you'd check your phone, or remember what you did yesterday. But how do you actually know? Mostly from what everyone around you is doing.
>
> ⏵ **Space 2:** Plays on, stops on “Can a seismometer tell what day of the week it is?” over the whole city
>
> Now imagine you had no phone and no calendar, only an instrument buried under the city, writing down every shake. Could it tell you what day of the week it is? That's our question. Here's one day of that writing.
>
> ⏭ **Then Space:** next slide, *Weekday or weekend?*

### 2 · WEEKDAY OR WEEKEND? — `[VIDEO S01]`
> 🎬 **On screen:** The clip plays by itself: “Weekday or weekend?” while one real day of shaking draws itself along the bottom. It stops there.
>
> **[Aadit]** One whole day under Brussels, midnight to midnight, drawing itself along the bottom. Look at the morning: it stays quiet much longer than you'd expect. So, weekday or weekend? Take a second.
>
> ⏵ **Space 1:** Reveal: “Wednesday, 25 December 2019”, a Christmas tree appears, “Our model said: Sunday”
>
> It was a Wednesday: Christmas Day, 2019. Our model said Sunday. In a few minutes you'll see why it was right to be wrong.
>
> ⏭ **Then Space:** next slide, *Last time: one question*

### 3 · LAST TIME — `[STATIC]`
> 🎬 **On screen:** A still: last time's question and the five promises.
> ⏭ **Then Space:** next slide, *What a seismometer records*
>
> *The proposal's question in large type; five small promises underneath.*
> **[Aadit]** Two months ago we asked one question: **can a seismometer tell what day it
> is?** We made five promises. Short answer: we kept all five, then kept going. So, what is
> it actually hearing?

### 4 · WHAT A SEISMOMETER RECORDS — `[VIDEO C1, cut]`
> 🎬 **On screen:** The clip plays by itself from street level; the ground opens. It stops on “Each push sends a tiny wave down…” with orange ripples.
>
> **[Aadit]** Every car, bus and footstep pushes on the ground and sends a tiny wave down through the rock.
>
> ⏵ **Space 1:** Sinks to the seismometer, stops on “A seismometer: a heavy weight on a spring…”
>
> Down here is the instrument that catches it. A seismometer is a heavy weight on a spring. When the ground moves, the weight lags behind, and the instrument measures that difference. Seismologists built these for earthquakes, and everything else they call noise.
>
> ⏵ **Space 2:** Pulls out to the city at night with a clock, stops on “Now, one whole day” (the pen barely moves)
>
> Now watch one whole day. At night the city sleeps, and the pen barely moves. Hardly anyone is driving or walking.
>
> ⏵ **Space 3:** The whole day runs fast while the real line draws; ends on “A real recording… an ordinary Wednesday, 15 January 2020”
>
> Then morning arrives. This is a real recording: an ordinary Wednesday, the fifteenth of January 2020, under Brussels. Quiet at night, a jump at around seven when people start moving, and high all day while the city works. In the evening it slowly falls again. That noise is a city waking up, working and going to sleep. Shraddha, who else has listened?
>
> ⏭ **Then Space:** next slide, *Who listened to cities before us*

### 5 · WHO LISTENED TO CITIES BEFORE US — `[DIAGRAM research, 3 presses]` *(docs/02, "Papers")*
> 🎬 **On screen:** Row 1: Díaz 2017, Barcelona.
> ⏵ **Space 1:** Row 2: Nimiya 2021, Tokyo
> ⏵ **Space 2:** Row 3: Liu 2025, San Jose
> ⏭ **Then Space:** next slide, *Where they stopped, and where we start*
>
> **[Shraddha]** We're not the first to study noise in cities. In 2017, a team in Barcelona connected city noise to traffic, the metro and crowds. (Next) During the pandemic, four years of recordings from Tokyo showed that weekday daytime noise returned quickly after the first state of emergency, while Sunday noise took longer to return. (Next) More recently, researchers have mapped city activity street by street using fifty kilometres of fibre-optic cable, as they did in San Jose.
>
> *(Three papers on screen; all seven, and what each gave us, are in
> [`docs/22-research-papers.md`](22-research-papers.md), for questions.)*

### 6 · WHERE THEY STOPPED, AND WHERE WE START — `[DIAGRAM gap, 3 presses]`
> 🎬 **On screen:** Rows 1–2: averages vs one day at a time; one city vs 149 seismometers and 33 cities.
> ⏵ **Space 1:** Rows 3–4: phone data vs no phones; removing people vs keeping them
> ⏵ **Space 2:** Row 5: dense arrays or fibre vs seismometers already in place
> ⏭ **Then Space:** next slide, *Seismometers on six continents*
>
> **[Shraddha]** So where did they stop? They mainly measured average patterns: over an hour, a type of day, or during a lockdown. We look at one day at a time, testing the model only on weeks it hasn't seen before. They focused on one city or one event, while we used 149 seismometers, then expanded to 33 cities over seven years, and tested the model on cities it hadn't seen before. (Next) Some studies needed phone data for comparison. Our model doesn't need that, and its own mistakes can help find holidays without being given holiday labels. Other researchers removed human activity to study earthquakes. We kept it as our main signal and also tested whether removing it could help detect earthquakes. It didn't, and we'll show you why. (Next) Some studies needed large sensor networks or new fibre-optic cables. We use seismometers already installed in the ground, and our system runs a test every night. Aradhya, where do our recordings come from?

### 7 · SEISMOMETERS ON SIX CONTINENTS — `[LIVE research.html]` *(fallback: C3)*
> 🎬 **On screen:** The live research map, 158 dots (if it hasn't loaded in 5 s, the globe clip plays instead). Touch Brussels with one finger: its card shows the network and its DOI.
> ⏭ **Then Space:** next slide, *Where every recording comes from*
>
> **[Aradhya]** Here they are: **158 seismometers** on six continents, one reading every
> fifteen minutes, late 2019 to mid-2020. *(touch Brussels)* Brussels is this one, in
> Uccle. Holidays and lockdown are set aside, which leaves **17,027 ordinary days** to learn
> from. So whose recordings are these?

### 8 · WHERE EVERY RECORDING COMES FROM — `[DIAGRAM sources, 3 presses]` *(site/data/sources.json)*
> 🎬 **On screen:** Box 1: Lecocq et al. (2020) → used for the 2019–20 models.
> ⏵ **Space 1:** Boxes 2–4: EarthScope MUSTANG, USGS ComCat, public calendars
> ⏵ **Space 2:** The 59 network codes; dashed ones have no DOI
> ⏭ **Then Space:** next slide, *Two kinds of shaking*
>
> **[Aradhya]** Every recording has an owner. The 2019 to 2020 recordings are Lecocq and
> colleagues' published data. *(Next)* Everything since, 2019 to today, comes from
> **EarthScope's** public noise spectra; the earthquakes from the **US Geological Survey's**
> catalogue; and holidays and weekends from **public calendars**, never from the shaking
> itself. *(Next)* Behind them are **59 seismic networks**, and 54 have a DOI you can cite.
> On the website, click any station and it shows its network and DOI.

### 9 · TWO KINDS OF SHAKING — `[VIDEO C2, cut]`
> 🎬 **On screen:** The clip plays by itself: “Two kinds of shaking”, the coast. It stops on “Slow: ocean waves…” with big blue rings.
>
> **[Aradhya]** Not all shaking is us. Here's the coast. The slow wobbles, one every few seconds, are the ocean: waves hitting coasts hundreds of kilometres away, day and night, weekday or weekend.
>
> ⏵ **Space 1:** Stops on “Fast: engines, wheels and feet” with small orange rings from the cars
>
> The fast ones, several a second, are engines, wheels and feet. Those small, quick ripples are the ones that carry the week.
>
> ⏭ **Then Space:** next slide, *The sea keeps no office hours*

### 10 · THE SPECTRUM — `[STATIC spectrum]` *(R12 data · Brussels · 2025–26)*
> 🎬 **On screen:** A still: the spectrum, the sea band against the people band.
> ⏭ **Then Space:** next slide, *The sea band can't read the week*
>
> **[Aradhya]** Held still. Left, the ocean: 11 a.m. and 3 a.m. are almost the same line;
> the sea doesn't keep office hours. Right, **4 to 14 hertz**: daytime is about **forty
> times** stronger than night. That gap is us, so that's the band we listen to.

### 11 · THE SEA BAND CAN'T READ THE WEEK — `[STATIC band test]` *(R12 · 2025–26 · 7 cities)*
> 🎬 **On screen:** A still: five bands; the sea band is a coin toss, the people band almost 99%.
> ⏭ **Then Space:** next slide, *From the ground to a guess*
>
> **[Aradhya]** And we tested it. Same model, same days, five bands. The ocean band reads
> weekday vs weekend **51%** of the time: a coin toss. Every band where people are scores
> above 95%, and the people band, 4 to 14 hertz, is best: **almost 99%**.
> Shraddha, how does a model listen?

### 12 · FROM THE GROUND TO A GUESS — `[DIAGRAM docs/03's six steps, 3 presses]` *(docs/03)*
> 🎬 **On screen:** Row 1: Steps 1–3 (one row per day, 25 features, calendar labels).
> ⏵ **Space 1:** Steps 4–5: random forest, honest testing
> ⏵ **Space 2:** Step 6: unusual days
> ⏭ **Then Space:** next slide, *One day becomes 25 numbers*
>
> **[Shraddha]** Before going into the details, here's our entire method in six steps. First, we prepare the data: each day becomes one row, we use the 4 to 14 hertz band, remove faulty readings and convert the times to local time. Then we create 25 features. Next, we add labels using public calendars for weekends and holidays. Only ordinary days are used for training. (Next) The model is a Random Forest with 100 decision trees that vote on the day. We test it using entire weeks it hasn't seen before. (Next) Finally, the model's unusual predictions help us identify days that don't follow normal patterns. The next slides explain these steps in more detail.

### 13 · ONE DAY BECOMES 25 NUMBERS — `[VIDEO S05, cut]`
> 🎬 **On screen:** The clip plays by itself: one real day's readings on a table. It stops on “3. One number per hour”.
>
> **[Shraddha]** Let's look more closely at the first few steps. Here's one real day's readings. The model can't directly understand a graph, so we convert each day into 25 numbers.
>
> ⏵ **Space 1:** Stops on “Then a logarithm…”
>
> Then a logarithm. City shaking spans huge ranges, so the log puts a quiet night and a busy day on one scale.
>
> ⏵ **Space 2:** Stops on “4. Split the day: shape and level”
>
> Twenty-four numbers show how active the city was during each hour. This is called the shape. One more number shows how loud the entire day was compared with that station's usual activity. This is called the level.
>
> ⏵ **Space 3:** Ends on “24 + 1 = 25 numbers per day”
>
> So each day becomes 25 numbers. Every station is different, so looking at the daily shape helps us compare their activity patterns.
>
> ⏭ **Then Space:** next slide, *A hundred trees vote*

### 14 · A HUNDRED TREES VOTE — `[VIDEO C4]`
> 🎬 **On screen:** The clip plays by itself: one real tree and its first question. It stops on “yes: mostly weekends / no: mostly weekdays”.
>
> **[Shraddha]** The next step is the Random Forest. It uses 100 decision trees, and each tree asks a series of simple yes-or-no questions. For example, at six in the morning, was the ground still quiet compared with the rest of the day? If yes, that might point towards a weekend.
>
> ⏵ **Space 1:** The grove grows: “A hundred trees, each from a random slice of days”
>
> One tree can be fooled, so we grow a hundred. Each one learns from a random slice of days, and asks its own few yes-or-no questions.
>
> ⏵ **Space 2:** The trees vote: the tally fills in, “97 of 100 say weekday”
>
> Here's a real Wednesday from Brussels that the model hadn't seen before. 97 out of 100 trees correctly say it's a weekday,
>
> ⏵ **Space 3:** Ends on “But only 5 say Wednesday…”
>
> but they don't all agree on which weekday it is. Only 5 say Wednesday. Weekday or weekend is easy; the exact day is much harder.
>
> ⏭ **Then Space:** next slide, *Graded only on weeks it never saw*

### 15 · TESTED ON WEEKS IT NEVER SAW — `[STATIC CV diagram]`
> 🎬 **On screen:** A still: the calendar of weeks, each shade one round's hidden weeks.
> ⏭ **Then Space:** next slide, *How one guess is made*
>
> **[Shraddha]** The final step is testing the model. We never test it on weeks it has already learned from. Monday and Tuesday can have very similar patterns, so we keep entire weeks together and test using five different splits. We also use balanced accuracy, so a model that always predicts weekday doesn't get an unfair score of around 71%. Instead, it gets 50%. Aadit, how did it do?

### 16 · HOW ONE GUESS IS MADE — `[DIAGRAM guess, 3 presses]` *(forest.json)*
> 🎬 **On screen:** The day's 25 numbers → 100 trees.
> ⏵ **Space 1:** The real votes appear: Mon 23, Tue 25, Wed 5, Thu 13, Fri 31, Sat 3, Sun 0
> ⏵ **Space 2:** The two answers: “Which day? Friday. Wrong” and “Weekday or weekend? Weekday. Right”
> ⏭ **Then Space:** next slide, *What the model looks at*
>
> **[Shraddha]** So how does the model actually make a prediction? Let's take a day it hasn't seen before: Wednesday, 15 January 2020, in Brussels. We give the model its 25 numbers: 24 describing the day's shape and one showing its overall level. (Next) Each of the 100 trees asks its own yes-or-no questions and gives one vote. These are the actual votes: 31 for Friday, 25 for Tuesday, 23 for Monday, only 5 for Wednesday, and 3 for the weekend. (Next) So the model predicts Friday, which is wrong. But 97 out of 100 trees agree that it's a weekday, which is correct. This shows that the model is much better at identifying weekdays and weekends than telling the exact weekday. Aadit, what does the model look at?

### 17 · WHAT THE MODEL LOOKS AT — `[DIAGRAM importance, 2 presses]` *(ml.json)*
> 🎬 **On screen:** 25 grey bars: how much each number helps.
> ⏵ **Space 1:** The top three hours turn black (00:00, 06:00, 13:00), and the line “the level ranks 10 of 25”
> ⏭ **Then Space:** next slide, *Where it gets it wrong*
>
> **[Aadit]** Which of the 25 numbers does the forest lean on? This is Brussels. Each bar is
> how much that number helps the trees split the days. *(Next)* The tallest: **midnight, one
> in the afternoon, and six in the morning**. Our reading: six a.m. asks whether the city has
> woken up yet. And the level, how loud the whole day was, ranks only **tenth**. The shape of
> the day is what carries the week.

### 18 · WHERE IT GETS IT WRONG — `[DIAGRAM confusion matrix, 3 presses]` *(ml.json, day_scores.csv)*
> 🎬 **On screen:** Brussels' 7×7 confusion matrix, in counts.
> ⏵ **Space 1:** The two blocks are outlined (weekdays orange, weekend blue) with three lines underneath
> ⏵ **Space 2:** The second matrix: all 149 seismometers, in %
> ⏭ **Then Space:** next slide, *It reads the day*
>
> **[Aadit]** So where does it go wrong? This is a **confusion matrix**: each row is the real
> day, each column the model's guess, and the diagonal is right. Brussels, 115 ordinary days,
> each guessed by a model that never saw its week. *(Next)* Two blocks. **Weekdays blur into
> each other**: a Tuesday is often called a Monday. But **the weekend stands apart**: right 28
> times out of 32, and a weekday is called a weekend only once in 83 days. *(Next)* And it's
> not just Brussels: across all **149 seismometers, 16,554 days**, the same two blocks. That's
> why weekday-or-weekend is our headline, and the exact day is the hard part.

### 19 · IT READS THE DAY — `[STATIC results]` *(R1, R2, R6 · 2019–20 · 149 seismometers)*
> 🎬 **On screen:** A still: 95% weekday or weekend, 47% exact day; every seismometer as a dot.
> ⏭ **Then Space:** next slide, *Its mistakes find holidays*
>
> **[Aadit]** One forest per seismometer. Weekday or weekend: **95%** in a typical city. The
> exact day: **47%**, where guessing gets 14. In three of the emptiest places in the data,
> a mountain, the Kalahari, the tip of Chile, it's near chance. **No people, no rhythm.**
> And the shape matters: loudness alone names the exact day **30%** of the time; with the
> shape, **47%**.

### 20 · ITS MISTAKES FIND HOLIDAYS — `[VIDEO S08]` *(R7, R8)*
> 🎬 **On screen:** The clip plays by itself: Brussels' calendar, Christmas read as a weekend. It stops on “So did the models in 71% of cities”.
>
> **[Aradhya]** Back to Christmas. Here's Brussels' whole calendar, one square per day. Christmas was a Wednesday the model had never seen, and it said Sunday. And not just in Brussels: the models at 71% of seismometers did the same.
>
> ⏵ **Space 1:** Stops on the two towers: holidays it never saw against ordinary weekdays
>
> Here are two towers. On weekday holidays it never saw, it said weekend 76% of the time. On ordinary weekdays, only 5%. That gap is the whole point: it learned how people behave, not the calendar.
>
> ⏵ **Space 2:** Stops on “Confusion = 1 − P(the real day). Brussels' most surprising days”
>
> **[Aadit]** So we turn that into a score: how surprised was the model? One minus the chance it gave the real day. Rank every day by it, and the holidays float to the top.
>
> ⏵ **Space 3:** Ends on “Better than a standard unusual-day alarm in 110 of 147 cities”
>
> And it holds across the network: this surprise score beats a standard unusual-day alarm in 110 of 147 cities. No holiday labels went into it, and it never trained on these days; the model's own mistakes find them. Here is how that works, step by step.
>
> ⏭ **Then Space:** next slide, *From a mistake to an alarm*

### 21 · FROM A MISTAKE TO AN ALARM — `[DIAGRAM alarm, 3 presses]` *(R7, R8)*
> 🎬 **On screen:** Boxes 1–2: a new day (Christmas 2019) → the forest guesses Sunday.
> ⏵ **Space 1:** Box 3: surprise = 1.00
> ⏵ **Space 2:** Boxes 4–5: above 95% of ordinary days → flag it; then 76% and 110 of 147
> ⏭ **Then Space:** next slide, *It recognises rest, not the name of the day*
>
> **[Aadit]** How does a mistake become an alarm? Follow Christmas through the boxes. A day
> it never saw: a Wednesday. The forest says **Sunday**, and gives Wednesday no chance at
> all. *(Next)* So how surprised is it? One minus the chance it gave the real day: **one**,
> the maximum. *(Next)* Then compare it with ordinary days: ninety-five out of a hundred are
> less surprising than this line. Above the line, flag it. No labels, no list of holidays.
> Across every seismometer, that alarm beat the standard unusual-day alarm at **110 of
> 147**. We never built a holiday detector. We taught it normal.

### 22 · THE WEEKEND MOVES — `[STATIC]` *(R3, R9, R10)*
> 🎬 **On screen:** A still: the weekend moves (Salfit and the UAE).
> ⏭ **Then Space:** next slide, *The dare, done properly*
>
> **[Aradhya]** A model trained on all the *other* cities still reads a new one: **83%**.
> Trained only on Saturday–Sunday countries, it calls Salfit's **Fridays** weekend: it
> recognises rest, not the name of the day. Jeddah, our third Friday city, didn't transfer.
> And when the UAE moved its weekend in 2022, we wrote the prediction down **before**
> downloading anything: Sundays got **20% quieter**, luck would do that about 3 times in
> 1,000. One sensor, 90 km from Sharjah, and Fridays got busier, which we didn't predict.

### 23 · THE DARE, DONE PROPERLY — `[VIDEO C5, cut → STATIC]` *(R19, R22)*
> 🎬 **On screen:** The clip plays by itself: rush hour, every car shaking the ground. It stops there.
>
> **[Aradhya]** Last time we made a dare. Here's rush hour: every car on this street shaking the ground at once.
>
> ⏵ **Space 1:** Stops on “A small earthquake, far away, arrives from below” (blue wave)
>
> Now a small earthquake, far away, arrives from below. In all that traffic, it's easy to miss.
>
> ⏵ **Space 2:** Stops on “The dare: subtract what this hour normally sounds like…”
>
> The dare: if we know what this hour normally sounds like, subtract the people, and find the quake underneath.
>
> ⏵ **Space 3:** Stops on the result card: 998 against 953, “We got 5.3%”
>
> We tried it first on fifteen-minute averages: 998 against 953, p = 0.053. Not supported, and outside one Puerto Rico swarm a simple rolling median did best.
>
> ⏵ **Space 4:** Plays on to “Verdict: not supported…”; the second-by-second chart then appears by itself
>
> A quake lasts seconds; fifteen minutes blurs it away. So we wrote a proper test down in advance: second-by-second recordings, years the first test never touched, at most 100 quakes per station so no swarm decides it. Result: with the people subtracted, 413 found; the raw recording, 501. Not supported: it made things worse. A plain rolling baseline of the last five minutes did best, 524. A city's weekly rhythm is the right model for reading the day, and the wrong one for finding a quake that lasts seconds. Detecting quakes that happened; never predicting them. Shraddha, what else didn't work?
>
> ⏭ **Then Space:** next slide, *What didn't work*

### 24 · WHAT DIDN'T WORK — `[STATIC]` *(R4, R6, R8)*
> 🎬 **On screen:** A still: three things that didn't work.
> ⏭ **Then Space:** next slide, *Now scale it*
>
> **[Shraddha]** There were also a few things that didn't work as expected. During lockdowns, weekdays didn't simply start looking like Sundays. Only about a quarter were classified as weekends; many looked different from any day the model had learned. Our shape-and-level features also didn't perform better than using the raw hourly readings, although they gave us a simpler way to compare stations. And the original dataset covers only one season and uses national holidays. So what happens when we use data from more years?

### 25 · NOW SCALE IT — `[STATIC method card]` *(R15–R17 · 2019–26 · 33 cities)*
> 🎬 **On screen:** A still: 33 cities, 7 years, the ordinary days.
> ⏭ **Then Space:** next slide, *More data helps, then flattens*
>
> *Card: 33 cities · Jan 2019 – Sep 2026 · 72,395 ordinary days · one model per city ·
> 3 frequency bands × 48 half-hours · gradient boosting · whole weeks held out.*
> **[Aadit]** We went back to the source: seven years, every station from the study that is
> still recording and publicly served, plus Sharjah. **33 cities, 72,000 ordinary days.**
> This is a new, bigger model: three frequency bands, every half hour, gradient boosting,
> still tested only on weeks it never saw. A new experiment, so new numbers.

### 26 · DOES MORE DATA MAKE IT SMARTER? — `[STATIC learning curve]` *(R16–R18)*
> 🎬 **On screen:** A still: the learning curve from 100 days to all of them, and 96% for the week.
> ⏭ **Then Space:** next slide, *Everything we built*
>
> **[Shraddha]** We might expect seven years of data to make the model much better. For weekday versus weekend classification, it reaches 97%. But exact-day accuracy only increases from 38% with 100 days of data to 57% with all the data, and then improvement slows down. Training one model on all 33 cities together actually performs worse in every city. This is because a Tuesday can sound different from one city to another. But when we give the model the full week around a day instead of just that day, accuracy reaches 96%.

### 27 · EVERYTHING WE BUILT — `[DIAGRAM sitemap, 3 presses]`
> 🎬 **On screen:** Data (2019–20, every night) → Python and the GitHub Action.
> ⏵ **Space 1:** Pages: Tour, Globe, Ask, Research map
> ⏵ **Space 2:** Pages: City Pulse, Game, About, Demo video
> ⏭ **Then Space:** next slide, *The front page: a two-minute tour*
>
> **[Aradhya]** Everything you've seen runs on **one website**, built from these same files.
> Two sources of data, one set of Python code, and a GitHub Action every morning. *(Next)*
> The pages to explore: a **two-minute tour**; the **globe**, any day since 2019; **Ask**, the
> model's guess for any day; and the **research map**, every seismometer scored. *(Next)* And
> the pages that keep going: **City Pulse**, which scores yesterday every night; a **game**
> where you try to beat the model; and pages that explain how it works and where it stops.
> The front page first.

### 28 · THE FRONT PAGE: A TWO-MINUTE TOUR — `[LIVE index.html]` *(fallback: still)*
> 🎬 **On screen:** The live front page. Scroll down slowly with one finger: the pen draws the day.
> ⏭ **Then Space:** next slide, *Ask the ground*
>
> **[Aradhya]** This is the front page: a two-minute tour of the idea for anyone who lands on
> it. *(scroll with one finger)* The pen draws one real day under Brussels, hour by hour, and
> the page tells the story as it goes. Aadit, ask it something.

### 29 · ASK THE GROUND — `[LIVE globe.html#ask/BE.UCC..HHZ/2019-12-25]` *(fallback: S11)*
> 🎬 **On screen:** Live Ask on Brussels, 25 Dec 2019: “from the day: Sunday”, “from the week: Wednesday”.
> ⏵ **Space 1:** The page reloads by itself to the globe on Mon 23 Mar 2020 (blue = quieter). Don't tap while it loads.
> ⏭ **Then Space:** next slide, *What runs every night*
>
> **[Aadit]** Here it is, live: 33 cities, any day from 2019 to last September.
> *(Brussels, Christmas 2019)* From the day alone: Sunday, sure of it. From the week around
> it: Wednesday, sure of it. **A Wednesday that looked like a day off.**
> *(Next → the globe on Mon 23 Mar 2020)* And this is the week the world stopped. *(let it
> sit two seconds)* Of the 24 cities we measure clearly, **12** were at least 15% quieter
> than their normal that Monday; a week later, **17**. Nobody told the globe there was a
> pandemic. *(R15)* Shraddha, how does it keep up every night?

### 30 · WHAT RUNS EVERY NIGHT — `[DIAGRAM live system, 3 presses]` *(pulse.yml, src/pulse.py, src/ask.py)*
> 🎬 **On screen:** Seismometers → EarthScope → GitHub Action.
> ⏵ **Space 1:** Frozen model and learning model
> ⏵ **Space 2:** Saved in git → the website, and the “built once on a laptop” line
> ⏭ **Then Space:** next slide, *City Pulse: every night*
>
> **[Shraddha]** So how does the website get information about what happened the previous day? Let's follow the steps. Seismometers record vibrations throughout the day. EarthScope makes the data available about two days later. Every morning at six, a GitHub Action automatically downloads the latest available data. (Next) Two models then analyse each day: one is a fixed model trained on one year of data, which stays unchanged. The other is a learning model that makes a prediction first and then learns from that day. (Next) The results are saved in the GitHub repository and published through Vercel, where the globe, Ask and City Pulse pages can use them. The seven-year models in Ask are trained separately on a laptop and saved in the same way. Let's see it running.

### 31 · CITY PULSE: EVERY NIGHT — `[LIVE today.html, 3 steps]` *(fallback: still)*
> 🎬 **On screen:** Live City Pulse: the newest day, city by city.
> ⏵ **Space 1:** The page reloads at the learning card (frozen and learning, side by side)
> ⏵ **Space 2:** The page reloads at the predictions board
> ⏭ **Then Space:** next slide, *Guess the day*
>
> **[Shraddha]** Here it is: City Pulse. Every night, it shows the previous day's results for each city, including what the model predicted and whether it was correct. (Next → the learning card) Further down, we can see the fixed model and the learning model side by side. Does learning from more data actually help? We prepared a test before writing the code. Based on our earlier results, we don't expect a huge improvement because accuracy had already started to level off. The final result will be available in January, so these are still early results. (Next → the predictions board) Finally, the predictions board shows predictions saved in the repository before the actual day, with the real results added afterwards. Aradhya, one more page.

### 32 · GUESS THE DAY — `[LIVE game.html]` *(fallback: still)*
> 🎬 **On screen:** The live game: one real day's line. Tap a day with one finger to guess; the model's answer appears.
> ⏭ **Then Space:** next slide, *Five promises, kept*
>
> **[Aradhya]** And one page for anyone: **Guess the day**. A real day from a real city, hour
> by hour, with the average Wednesday and Sunday for comparison. Which day was it? *(tap a
> day)* The model made its guess without ever training on that week, and the score keeps
> count: you against the model. That's GroundTruth, on one website. Aadit?

### 33 · FIVE PROMISES, KEPT — `[STATIC scorecard]`
> 🎬 **On screen:** A still: the five promises with their numbers. Don't read it out.
> ⏭ **Then Space:** next slide, *Still useless?*
>
> *(no read-out: let it sit while you walk to the centre, then Next)*

### 34 · STILL USELESS? — `[VIDEO S14]`
> 🎬 **On screen:** The clip plays by itself: out of the vault, up over the city at dusk. It stops on “Still useless?” and the captions.
>
> **[Aadit]** So, back to where we started. Seismologists call this shaking noise, and throw it away. Still useless? There's a network already buried under many of the world's cities, recording for decades, free. It hears a neighbourhood, not a person: no phones, no cameras. And ours is running tonight.
>
> ⏵ **Space 1:** Ends on the title: GroundTruth, your names, “Thank you. Questions?” (the city keeps moving)
>
> Everyone measures how loud the ground is. We taught a model what normal sounds like, and its mistakes tell us when something happened. That's GroundTruth. Thank you.
>
> ⏭ Last slide.

### B1 · BACKUP: DOES IT REMEMBER WHAT IT STUDIED? — `[STATIC memorisation]` *(R20, exploratory)*
> 🎬 **On screen:** Backup still for Q&A: 100% on days it studied, 55% on weeks it never saw.
> ⏹ **End of the talk.**
>
> If asked "can it even name the days it trained on?": same 7-year models, days it trained
> on **[R20 seen]**, weeks it never saw **[R20 unseen]**. The gap is memorisation, which is
> why every number in this talk is on unseen weeks. (Exploratory: not pre-registered.)

### B2 · BACKUP: RUNNING LIVE — `[VIDEO S11]`
> 🎬 **On screen:** Backup clip for Q&A: the website running; plays to the end.
> ⏹ **End of the talk.**
>

---

# Rehearsal notes
- **Hand-offs are spoken:** "Aradhya, where does it come from?" · "Shraddha, how does a
  model listen?" · "Aadit, how did it do?" · "Shraddha, what else didn't work?" ·
  "So: what happens with years?"
- **Live slides:** open the deck 10 minutes early on the classroom machine. If a fallback
  appears, keep talking; it says the same thing. `L` forces the fallback.
- **Beat 29 step:** the next click reloads the globe on 23 Mar 2020 by itself; don't tap
  around.
- **Words to avoid:** "predicts earthquakes", "proves", "it learns everything", "went up
  from 95 to 97" (different experiments). Say "in a typical city" before 95%.
- **Q&A:** `docs/18` Q&A still holds. New: "Isn't more data always better?" → beat 26.
  "Does it remember its training days?" → B1. "Is 57% honest?" → it's the best of 8
  configurations on the same data, so slightly optimistic (R17).
