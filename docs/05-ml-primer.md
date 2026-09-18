# 5. Machine learning primer (start here if this is your first ML project)

Every concept explained with this project as the example. No prior ML knowledge assumed.

## The basic shape of a supervised ML problem

You have many **examples**. Each example has **features** (what the model sees) and a
**label** (what it should predict). The model looks at many examples and learns a rule
mapping features to labels. Then you test it on examples it has never seen.

In this project:

| Term | In this project |
|---|---|
| **Example** | One day at one seismometer (e.g. New York, 12 Feb 2020) |
| **Features** | 25 numbers: how much the ground shook in each of the 24 local hours (relative to that day's mean), plus how loud the day was overall |
| **Label** | The day of the week (Monday…Sunday), or just weekend yes/no |
| **Model** | A random forest |
| **Prediction** | "This looks like a Tuesday" |

We have ~17,400 labelled examples from 158 cities.

## Features: the most important part

Raw data is almost never fed to a model directly. **Feature engineering** is deciding
what to measure. Here, going from "3,000 raw vibration readings per day" to "24 hourly
medians" is the step that makes the problem learnable.

Two features deserve special mention:

- **Shape** (24 numbers) — the silhouette of the day, after subtracting the day's own
  average. Answers *when* the city was busy.
- **Level** (1 number) — how loud the whole day was, compared to normal days at the
  same station. Answers *how* busy it was.

Why subtract the mean? Because otherwise the model could win by learning "this sensor
is loud" instead of "this day is busy". Removing information the model shouldn't use
is a real and common part of the job.

## Labels for free

Most ML projects are bottlenecked by labelling — someone has to sit down and tag
thousands of examples. This project has **perfect labels at zero cost**, because the
calendar already knows what day it was. That's a big part of why the idea works as a
student project.

## Training vs testing: the one rule you can't break

If you test a model on data it trained on, you learn nothing — a model that simply
memorised every day would score 100% and be useless on tomorrow. So you **hold data
back**.

We go further, because of a subtle trap called **leakage**: two days in the same week
are correlated (same weather, same roadworks, same sensor problems). If Tuesday is in
training and Wednesday of the same week is in the test set, the model can score well
for the wrong reason. So we hold out **entire weeks** (`GroupKFold` by week number).

**Cross-validation** means doing this five times with different fifths held out, so
every day gets to be test data exactly once and no single lucky split can flatter us.

For the global model we hold out **entire cities**, which answers a harder question:
does this work somewhere the model has never been?

## Accuracy, and why we mostly don't use it

Weekends are only 2 days in 7. A model that always answers "weekday" gets **71%
accuracy** while being completely useless. So for that task we report **balanced
accuracy**: the average of "how often did it catch weekdays" and "how often did it
catch weekends". The lazy model scores exactly 50% there — the same as guessing.

Always compare against the **chance baseline**:
- Weekday vs weekend (balanced): chance = 50%
- Day of week (7 classes): chance = 14.3% (1 in 7)

46% on a 7-class problem sounds mediocre until you notice it is **more than 3× chance**.

## The confusion matrix

A table of "actual day" against "predicted day". Far more informative than one number,
because it shows *which* mistakes happen. Ours shows the model almost never confuses
weekdays with weekends, but frequently mixes up Tuesday, Wednesday and Thursday —
which is a fact about cities, not a flaw in the model.

## Why a random forest

A **decision tree** asks yes/no questions ("was hour 8 louder than average?") until it
reaches a guess. A single tree overfits badly. A **random forest** grows 100 trees, each
on a random subset of the data and features, and lets them vote.

Good for this project because it needs no feature scaling, handles non-linear patterns,
resists overfitting, gives **feature importance** (which hours it relies on), and
trains in a fraction of a second on ~115 examples. A neural network on 115 examples
would just memorise them.

## Supervised vs unsupervised: the two halves of this project

- **Supervised** (day-of-week classification): we have labels and the model learns to
  reproduce them.
- **Unsupervised** (anomaly detection): no labels at all. We describe what "normal"
  looks like — median and spread of each feature — and flag days that sit far outside
  it.

The second one is why the project can detect disruptions **nobody labelled**, including
Thanksgiving, which our code had no way of knowing about.

## Robust statistics (a lesson learned the hard way)

Mean and standard deviation are wrecked by a single crazy value. A handful of sensor
glitches in this dataset produced anomaly scores over 1,000 and made whole days
meaningless. The fix is **robust statistics**: use the **median** instead of the mean,
and the **MAD** (median absolute deviation) instead of the standard deviation. Both
ignore extreme values instead of being dragged around by them. Combined with clipping
z-scores at ±10, this made the anomaly detector behave.

## Vocabulary quick reference

| Term | Meaning |
|---|---|
| Feature | An input number the model sees |
| Label | The correct answer we want predicted |
| Training set | Examples the model learns from |
| Test set / held-out set | Examples used only for scoring |
| Cross-validation | Repeating the train/test split several ways |
| Leakage | Test information sneaking into training; inflates scores |
| Overfitting | Memorising training data instead of learning the pattern |
| Balanced accuracy | Accuracy that accounts for unequal class sizes |
| Chance baseline | Score from guessing; the bar any result must clear |
| Confusion matrix | Table of actual vs predicted classes |
| Feature importance | How much the model relies on each feature |
| Anomaly detection | Flagging examples unlike "normal", without labels |
