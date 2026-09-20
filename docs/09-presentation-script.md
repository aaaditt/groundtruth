# GroundTruth — Presentation Script v4

**3 slides · ~6 minutes speaking · 3 speakers**
**Proposal presentation — introducing the idea, not reporting results**

---

## What changed from v3, and why

**Every number from our classifier is gone.** No accuracies, no anomaly rates, no
correlations, no prediction confidences. That model was written to check whether the
project is worth doing — it is not part of the semester project, and presenting its
output would be claiming work we haven't done yet. Everything in this script is either
(a) from the published paper, or (b) something we saw by looking at the published data.

**On the plots — important distinction.** The four figures contain **no machine
learning**. They are medians of the published recordings: we downloaded the data,
converted it to local time, and averaged it. That is data exploration, and it is what
"insights into the chosen dataset" asks for — 3 of the 10 marks. Nothing in them comes
from a model.

**The language is plainer.** Percentages, decimals and statistics are out. If a number
survives, it's because you can say it in a sentence a non-specialist follows.

**If anyone asks whether you've built anything:** you tested feasibility on the
published data, confirmed the signal is there, and that's what the proposal rests on.
That's honest and it's the correct answer for a proposal.

---

# Slides

## SLIDE 1 — The question

> ## GroundTruth
> **Learning Urban Activity Rhythms from Ambient Seismic Noise for Anomaly-Based Disruption Detection**
>
> [Names]

**Centre, large:**
> ### Can a seismometer tell what day of the week it is?

**Bottom, small:** *Real recordings from 158 seismometers. No synthetic data anywhere in this project.*

Background: a plain seismogram trace.

## SLIDE 2 — Where the data comes from, and what's in it

**Left — the paper, named:**
> **Lecocq et al. (2020)**
> *"Global quieting of high-frequency seismic noise due to COVID-19 pandemic lockdown measures"*
> **Science**, volume 369
>
> 76 authors · 268 seismometers worldwide
> Found that ground vibration from human activity fell by **up to half** during lockdowns — the biggest drop ever recorded
>
> **They published their data. We use it.**
> 158 stations · October 2019 – May 2020
> Vibration strength every 15 minutes

**Right — figure: `newyork_weekly_rhythm.png`**
Caption: *One seismometer in New York. Weekdays rise sharply from about 6am. Saturday sits below. Sunday is lowest, and starts latest.*

**Bottom — figure: `newyork_daily_timeline.png`**
Caption: *Every day for seven months. Blue is a weekday, orange a weekend. Christmas Day was a Wednesday — and quieter than every weekend in the whole record.*

## SLIDE 3 — The rhythm is human, and what we'll build

**Top-left — figure: `global_quietest_day.png`**
Caption: *132 of 156 cities are quietest on Sunday.*

**Top-right — figure: `weekend_signature.png`**
Caption: *But five are quietest on Friday. Three of them — Israel, Palestine, Saudi Arabia — rest on Friday and Saturday, and work on Sunday.*

**Bottom — what we will build:**
> 1. A model that reads the day of the week from ground vibration alone
> 2. A comparison against the simple approach — is the *shape* of a day more informative than how loud it was?
> 3. A disruption detector built from where the model gets confused
> 4. A test with every holiday removed from training — does it still notice them?
> 5. A check on whether a model trained on one city works in another

**Tools:** Python · ObsPy · scikit-learn · runs on a laptop
**Applications:** measuring how busy a city is with no phones, cameras or tracking · disaster response · urban planning

---

# The script

Three speakers, **[A] [B] [C]**. Figure cues are marked `[SHOW: …]`.

---

### OPENING — Slide 1 · *(0:00–0:45)*

> **[A]** *(straight in, no greeting)*
> Quick question for the room. Has anyone here ever used a seismometer?
>
> *(one beat — let the silence sit)*
>
> Has anyone ever even *looked* at seismometer data?
>
> *(beat)*
>
> Right. Because they're useless. They sit in the ground doing nothing for years, waiting for an earthquake that mostly never comes. And when scientists finally do study an earthquake, the first thing they do is take all the everyday background shaking and **throw it away.** They literally call it noise.

> **[B]** *(cutting in)*
> Which is strange, when you think about what's being thrown away.
>
> A seismometer detects anything that shakes the ground. And we shake the ground constantly — traffic, trains, footsteps, machinery. Not much. A few tens of nanometres. But continuously, everywhere, all day.
>
> So that discarded data isn't empty. It's full of us.

> **[C]**
> Which gives you an odd question, and it's the one this whole project is built on.
>
> **Can a seismometer tell what day of the week it is?** Not by reading a calendar. Only by listening to the ground.

> *(advance to Slide 2)*

---

### THE DATA — Slide 2 · *(0:45–2:00)*

*From here, deliver it as a presentation. Measured and clear.*

> **[A]**
> The reason we think this is possible comes from a paper published in *Science* in 2020, by Thomas Lecocq and colleagues. The title is "Global quieting of high-frequency seismic noise due to COVID-19 pandemic lockdown measures."
>
> Seventy-six authors, from sixty-six institutions. They gathered recordings from 268 seismometers around the world, and showed that when COVID lockdowns began, the ground got measurably quieter — by up to half in some places. It is the largest drop in human-made ground vibration ever recorded.

> **[B]**
> The important thing for us is that they published their data.
>
> So we're not starting from raw recordings, which would be hundreds of gigabytes. We use what they released: how strongly the ground was shaking, every fifteen minutes, at 158 stations, from October 2019 to May 2020.
>
> That means our starting point is peer-reviewed rather than something we improvised. **All of it is real recordings. There is no synthetic data anywhere in this project.**

> **[C]**
> We focus on one range of vibration — the range the paper identifies as human. It sits above the constant rumble the oceans make, and it's where traffic and machinery show up.
>
> One detail that matters more than it sounds: we convert everything to the *local* time of each seismometer. Rush hour is eight in the morning where the instrument is, not eight in London. Without that, the whole pattern smears out.

> **[A]** `[SHOW: newyork_weekly_rhythm.png]`
> And this is what we found when we looked.
>
> This is a single seismometer in New York, averaged over 133 ordinary days. The blue lines are Monday to Friday. They all share the same shape — quiet overnight, a sharp climb from about six in the morning, a peak mid-morning, then a long decline through the evening.
>
> The red line is Saturday. Lower all day.
>
> The orange line is Sunday. Lowest of all — and look where it starts rising. Much later than the others.
>
> *(beat)*
>
> **The ground doesn't just get louder and quieter. It follows a weekly rhythm.**

---

### THE PART THAT CONVINCED US — Slide 2 · *(2:00–2:45)*

> **[B]** `[SHOW: newyork_daily_timeline.png]`
> Here's every single day in that recording, seven months of it. Blue dots are weekdays, orange are weekends.
>
> You can see the working week as a sawtooth. Up all week, down at the weekend, over and over.

> **[C]**
> And then there's this one.
>
> *(point to the Christmas marker)*
>
> Christmas Day 2019 was a **Wednesday**. A working day. And it was quieter than **every single Saturday and Sunday** in the entire seven months.
>
> Nobody told the instrument it was Christmas. It just recorded a city that had stopped.

> **[A]**
> That's the moment we knew this was worth doing. The signal isn't subtle and it isn't something you need a model to see. It's right there in the data.

---

### THE RHYTHM IS HUMAN — Slide 3 · *(2:45–3:50)*

> *(advance to Slide 3)*

> **[B]**
> But we wanted to check something before committing. A seven-day pattern could just be *a* pattern. How do we know it's specifically about people?

> **[C]** `[SHOW: global_quietest_day.png]`
> So we did the same thing for every city with enough recording before lockdown — 156 of them — and asked a simple question. Which day is each city quietest?
>
> The answer is overwhelmingly Sunday. 132 out of 156.
>
> But five cities came back quietest on **Friday.** Which at first looked like a mistake.

> **[A]** `[SHOW: weekend_signature.png]`
> It isn't.
>
> Three of those five are in Israel, Palestine and Saudi Arabia. And in those countries the weekend **is** Friday and Saturday. Sunday is a normal working day.
>
> Look at the red line — that's Salfit, in Palestine. It falls off a cliff on Friday, stays low on Saturday, and by Sunday it's right back up with the rest of the week. The blue and purple lines, India and Belgium, do exactly the opposite.

> **[B]**
> We didn't tell anything that different countries rest on different days. We pointed the same code at a different part of the world, and **the weekend moved.**
>
> That's what convinced us the ground is recording human behaviour, and not just some seven-day cycle that happens to be there.

---

### WHAT WE'LL BUILD — Slide 3 · *(3:50–5:10)*

> **[C]**
> So that's where we are. We have the data, we've looked at it, and the signal is real. What we haven't done yet is the project.
>
> Five things we want to build.

> **[A]**
> **First**, a model that reads ground vibration and tells you what day of the week it is. That's the core task, and it's how we'll prove the model learned something real.
>
> **Second**, a comparison. The existing research measures one thing — how loud the ground was. We want to know whether the *shape* of a day tells you more than the volume of it. And if it turns out it doesn't, that's still a real answer and we'll report it.

> **[B]**
> **Third**, and this is the part we find most interesting — once the model knows what a normal Tuesday sounds like, we let it run and watch for the days it gets **wrong**.
>
> Because a mistake means something. If the model looks at a Tuesday and insists it's a Sunday, the model isn't broken. It's telling you that on that particular Tuesday, the city didn't behave like a Tuesday. A holiday, a strike, a storm, a shutdown.
>
> We're not building an event detector. We only teach it what normal looks like, and let its confusion do the finding.

> **[C]**
> **Fourth**, a test we're looking forward to. We take every public holiday out of the training data — the model never sees one. Then we show it a holiday and see what it says. If it comes back saying "this looks like a Sunday," then it learned how people behave, not how a calendar works.
>
> **Fifth**, does a model trained on one city work in another one? We already know the rhythm changes between countries. We want to know whether a model can carry across, and how it fails when it can't.

> **[A]**
> All in Python. It runs on a laptop — no special hardware.

---

### THE CLOSE — Slide 3 · *(5:10–6:00)*

> **[A]**
> So — seismometers. Still useless?
>
> *(beat)*
>
> There is a sensor network already buried under most of the cities on earth. It has been recording continuously for decades. The data is free and public. And it cannot identify a single individual, even in principle — no phones, no cameras, nobody tracked.
>
> **Everyone measures how loud the ground is. We want to teach a model what the ground normally sounds like — and then let its mistakes tell us when something happened.**
>
> That's GroundTruth. Happy to take questions.

---

# Q&A

Assign leads in advance. One person answers.

| Topic | Lead |
|---|---|
| The idea, novelty, prior work | **[A]** |
| Data, where it comes from, what's in it | **[B]** |
| Method, plans, what happens next | **[C]** |

**"Have you built the model yet?"**
Not yet — this is a proposal. What we've done is check the data to make sure the project is possible. We downloaded the published recordings, plotted them, and confirmed the weekly rhythm is there and is strong. That's what the plots show. The models are the semester's work.

**"Isn't this just the Lecocq paper?"**
They measured how loud the ground was and compared it against lockdown dates they already knew. We want to go the other way — predict the day from the shape of the vibration, and then use the model's mistakes to find disruptions nobody told it about. Their paper actually says that features beyond loudness should be usable, and that's the step we're taking.

**"How do you know it's people and not weather?"**
That's the main reason we did the cross-country check. Weather doesn't know that Israel rests on Friday and India rests on Sunday. The weekend moving with the country is very hard to explain any other way. We'll also use remote, low-population stations as a control — if there's no one around, there should be no weekly pattern to find.

**"Where does the data come from?"**
The companion release of the Lecocq 2020 *Science* paper: 158 seismometers, vibration strength every fifteen minutes, October 2019 to May 2020. It's public, it's peer-reviewed, and anyone can reproduce what we did. There is no synthetic data in the project.

**"What if the model doesn't work?"**
Then we report that honestly, and it's still a result — it would mean the loudness-based approach the field currently uses captures everything, and the daily shape adds nothing. We'd rather find that out and say so.

**"What about the UAE weekend change in 2022?"**
We looked into it, because it would be an ideal test. It isn't possible with this dataset — there's no UAE station in it, and the recordings stop in May 2020, well before the change. It's something we could do later with live data feeds, but we wouldn't present it as something we have.

**"You said 158 stations, then 156. Which is it?"**
Both, and they count different things. The dataset has 158 stations we can model. The weekend analysis uses only recording from *before* each city's lockdown and needs at least 40 such days per station, which 156 of them have. The per-station models use a third number, 149, because those need at least 70 normal days. Same data, three filters.

**"Could this become a research paper?"**
The cross-country weekend result is the closest. As far as we can tell nobody has used seismic rhythm as a way to measure cultural differences in working patterns. It would need more stations in the relevant countries to be solid.

---

# Rehearsal notes

**Run it three times.** The shift at 0:45 from hook to substance is the hard part — it should feel like moving into the real material, not like two different presentations.

- **The opening must be delivered with conviction.** If [A] hedges "seismometers are useless," nothing after it lands.
- **Three real pauses:** after "Right. Because they're useless," after "the ground follows a weekly rhythm," and after "still useless?" Two full seconds each. Silence feels much longer on stage than in the room.
- **Point at the figures.** Physically. Four plots from real data is your strongest asset in a proposal presentation.
- **The Christmas line is your best moment.** Deliver it slowly. "Christmas Day 2019 was a Wednesday — and it was quieter than every single Saturday and Sunday in seven months."
- **Everything about the project is in future tense.** "We want to build," "we'll test." Never imply results you don't have.
- **Don't explain the name.** If someone gets "GroundTruth," good.
- **If you run over,** cut the fifth item from the build list. Never cut the opening, the Christmas moment, or the weekend-moves section.

**Before presenting:**
- [ ] Regenerate all four figures yourselves: `python src/weekend_signature.py`, then `python src/make_presentation_plots.py`
- [ ] Read every slide once more and delete any leftover accuracy figure or model number
- [ ] Have a source ready for the Israel / Palestine / Saudi weekend conventions
- [ ] Agree who answers "have you built it yet?" and make sure the answer is the same from all three of you
