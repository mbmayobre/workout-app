# How shuffle picks exercises

The plain-English version of [`src/lib/shuffle.ts`](../src/lib/shuffle.ts).
If you change the code, update this document, and the other way round. The
rules here are checked by [`src/lib/shuffle.test.ts`](../src/lib/shuffle.test.ts).

## The three shuffle buttons

| Button | Where | What it re-rolls |
|---|---|---|
| Shuffle the whole week | Plan | Every unpinned exercise on every day |
| Shuffle all / Shuffle unpinned | Today, day editor | Every unpinned exercise on that day |
| The swap icon on a row | Today, day editor | That one exercise |

**Pinned exercises are never replaced.** Pin the staples you always want
(squats on leg day) and let the rest rotate.

**Pinned exercises keep their position.** You can drag exercises into any
order (on Today or in the day editor). When you shuffle, a pinned exercise
stays where it is, and the new exercises fill the other positions from the
top down. So pin your first lift in first place and it stays first. Unpinned
exercises are replaced, so their order is not kept.

## Step 1: which exercises are allowed

A day's workout types decide the pool:

| Day type | Exercises allowed |
|---|---|
| A muscle group (Chest, Legs…) | Those with that group as a **primary** muscle |
| Several muscle groups | Those with any of them as a primary muscle |
| Full body | Every strength and bodyweight exercise |
| Kettlebell | Kettlebell exercises only |
| Cardio | Cardio exercises |

Combining types:

- **Kettlebell + something else** acts as a filter. "Legs + Kettlebell" is
  kettlebell exercises that primarily train legs. Kettlebell alone means any
  kettlebell exercise, spread across all muscle groups.
- **Cardio alone** makes every slot cardio. **Cardio + something else**
  gives exactly one cardio exercise, placed last, and the remaining slots go
  to the other types.

Only primary muscles count for matching a muscle-group day. A bench press
has arms as a secondary muscle, but it will not be offered on arms day.

## Step 2: filling the slots by coverage

Slots are filled one at a time. Each time, the app looks at which target
muscle groups are not yet covered and prefers an exercise that helps.

The **target groups** are the day's muscle groups, or all six for full-body
and kettlebell-only days.

How much an exercise covers a group:

| The group is… | Coverage |
|---|---|
| A primary muscle | 1 (fully covered) |
| A secondary muscle | ½ (full-body days only) |
| Any group, for a "whole-body move" | at least ½ (full-body days only) |

A group is covered when its total reaches 1: one exercise that hits it as a
primary, or two that hit it as a secondary. On muscle-group days only
primary muscles count, so on a "shoulders and arms" day an overhead press
(arms secondary) cannot stand in for a real arms exercise.

Once every target group is covered and slots remain, the count starts again
from zero, so extra slots are spread evenly instead of piling onto one
group.

### Why the number of exercises changes the result

This is what makes full-body days adapt to the count without a setting:

- **2 or 3 exercises:** the only way to reach six groups is with big
  compound moves (Turkish get-up, clean and press, thrusters), so those are
  what get picked.
- **5 to 7 exercises:** there is room to give each group its own exercise,
  so there are many good answers, and the shuffle style decides between
  them.

## Step 3: shuffle style (full-body and kettlebell days)

Coverage always comes first. The style only matters when there are more
slots than groups still needing cover.

| Style | Effect |
|---|---|
| **Balanced** (default) | Any exercise that finishes off at least one uncovered group is equally likely. A varied mix of compound and single-muscle exercises. |
| **More compound** | Adds a bonus for each muscle group an exercise works, and for whole-body moves. Groups get hit more than once. |
| **More focused** | Subtracts for extra muscle groups, so single-muscle exercises win. With 6 slots you get roughly one exercise per group. |

When slots are tight (as many uncovered groups as slots left, or more), the
style is ignored and the exercise adding the most coverage wins. That is why
"More focused" with 2 exercises still gives compound moves rather than
leaving four groups untouched.

## Step 4: keeping it fresh

- Exercises currently on the day, and those replaced by the previous
  shuffle, are penalised, so a shuffle changes as much as the library
  allows. If the pool is too small to avoid repeats, repeats are allowed.
- Among candidates that score about the same, the choice is random.
- The same exercise never appears twice on one day.

## The coverage line

Full-body and kettlebell-only days show a line such as:

> Covers 6 of 6 muscle groups

or, when the count or the library cannot reach everything:

> Covers 5 of 6 muscle groups · no arms

## Swapping one exercise

The swap icon runs the same rules for a single slot, treating every other
exercise on the day as fixed. The replacement is the same kind as the one
removed (cardio for cardio, strength for strength), is not already on the
day, and is not the one you just swapped out.

## Changing the number of exercises

In the day editor, raising the count keeps the current exercises in their
current order and adds the new ones at the end. Lowering it removes
unpinned exercises from the end. Pinned exercises are never removed this
way.

## Changing the order

Drag an exercise by its grip (⋮⋮ on the left of the row), on Today or in
the day editor. The order is saved to the plan day straight away, and it is
the order the active workout steps through. Swapping one exercise keeps the
replacement in the same position. The code is `movePick` in
[`src/db/actions.ts`](../src/db/actions.ts) and the list itself is
[`src/components/SortableList.tsx`](../src/components/SortableList.tsx).

## Tuning

The numbers behind the behaviour are named constants at the top of
`shuffle.ts`:

| Constant | Meaning | Value |
|---|---|---|
| `SECONDARY_WEIGHT` | Coverage from a secondary muscle | 0.5 |
| `FULL_BODY_WEIGHT` | Minimum coverage a whole-body move gives every group | 0.5 |
| `REPEAT_PENALTY` | Score removed from recently used exercises | 0.75 |
| `TIE_TOLERANCE` | How close two scores must be to count as a tie | 0.3 |

After changing any of them, run `npm test`. The tests check each rule
across 50 random seeds, so a change that breaks coverage shows up at once.

## Good results depend on good tags

Shuffle only knows what an exercise's tags tell it. When adding your own
exercises, set the primary and secondary muscle groups carefully, and turn on
"Whole-body move" only for exercises that really do work nearly everything.
