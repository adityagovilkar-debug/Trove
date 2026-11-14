# Trove — rework plan

Written 2026-11-14. Nothing in the app has been changed. This is a critical
review plus a proposed plan; the decisions in section 6 are yours to make
before any work starts.

## 1. What Trove is for

One sentence: **"Do I have it, and where is it?" — for everything in the
house.** Food and groceries, but equally wires and chargers, old blankets, the
jacket kept for special occasions.

Everything in the app should be judged against that sentence. Money belongs to
Kosha, books to Stacks, errands to Nudge.

## 2. What your own data says

Looked at (read-only) on 2026-11-13:

| Area | What is in it | Reading |
|---|---|---|
| Pantry | 9 products, last purchase logged 27 Jun, two items expired 86 and 129 days ago | Abandoned around July |
| Things | 3 items — and two of them are a mouthwash and a Red Bull | The durable side was never really used, and the sorting is confused |
| Recipes | 4 recipes, 0 cookable | Cannot work unless the pantry is kept exact |
| Subscriptions | 6, all 41–109 days "overdue" | Nobody is marking them paid; Kosha has them |
| Plans | 0 | Never used |
| Fix-it | 1 | Barely used |
| Books | 0 | Never used |
| Shopping | 3 to buy, 5 stale ticked items | The one loop that saw some use |

The pattern: the app asks for the most work on the things that matter least.
Groceries change every week and need constant logging. Durables are entered
once and stay useful for years — and that half got almost no attention.

## 3. Why it stopped being maintained

1. **Adding something is a form, not a moment.** The Add screen has about a
   dozen fields (brand, category, quantity, unit, price, store, pack size,
   purchase date, expiry, place, notes, plus ten nutrition fields). That is
   built for a grocery receipt. A blanket needs a name and a place.
2. **Features depend on perfect data.** "Running low" predictions, recipe
   matching, spend trends and waste figures are all only right if every
   purchase and every use is logged. Miss a few weeks and they are all wrong,
   which removes the reason to come back.
3. **It is two apps with a switch.** Kitchen and Home each have their own
   dashboard and menu: 13 screens in total. The split also forces a decision
   on every item (is mouthwash "kitchen" or "home"?), and the data shows that
   decision going wrong.
4. **It duplicates your other apps.** Spending, price inflation and
   subscriptions are Kosha. Books are Stacks.

## 4. Verdict on every section

| Section | Verdict | Why |
|---|---|---|
| "Do I have it?" search | **Keep, make it the home screen** | This is the whole point of the app |
| Nested places (Room › Cupboard › Drawer) | **Keep, promote** | "Where is it" is half the purpose; it deserves its own tab |
| Pantry + Things | **Merge into one list** | One inventory with filters, not two apps |
| Kitchen/Home switch | **Remove** | Consumable vs kept is a property of an item, not a mode of the app |
| Two dashboards | **Replace with one home screen** | Search, then a short "needs attention" list. No gauges |
| Shopping list | **Keep, simplify** | Ran out → list → bought is the useful loop. "Bought" should be one tap, not a form |
| Upcoming | **Fold into home** | Without subscriptions and meals it is just expiries and warranties: a short list |
| Subscriptions | **Remove** | Kosha |
| Books (type, shelf classification) | **Remove** | Stacks. No books were ever added |
| Plans | **Remove** | Never used; big purchases are Kosha goals |
| Recipes, meal plans, cook-and-deduct, recipe import, built-in Indian recipes | **Remove** (decision A) | A second app inside this one, and it only works with an exact pantry |
| Trends (spend, price tracker, inflation, waste in ₹) | **Remove** | Kosha's job, and unreliable on sparse data |
| Fix-it | **Remove or shrink** (decision B) | It is an errand list; one entry in five months |
| Nutrition facts + label scanning | **Remove** | Ten fields nobody fills in; not an inventory concern |
| Receipt scanning | **Decide** (decision C) | Useful only if you really bulk-add from receipts |
| "Running low" predictions | **Replace** | Swap guessed predictions for a manual "running low" tap, plus the existing auto-add when something is finished |
| Use by amount, pack sizes | **Remove** | Only existed to serve recipes |
| Price, store, purchase date on every item | **Demote** | Optional, tucked away; never required |
| Barcode scan | **Keep** | Fast way to add packaged food |
| Household sharing, offline mode | **Keep** | Both still fit |
| Email digest + push notifications | **Keep one** (decision D) | Two channels for the same message |
| ⌘K palette | **Keep** | Cheap, and it is search |

Being straight about it: several screens polished in the Instrument rework
(both dashboards, Trends, Subscriptions, Plans) would be removed by this plan.
The design language and the building blocks stay; those screens go.

## 5. The proposed app

### Four screens

1. **Home** — a big search box. Under it, only what needs attention: expired
   or expiring food, warranties ending, things lent out. Empty when all is
   well. Below that, the Fix-it list: a few lines, add and tick in place.
2. **Stuff** — everything in one list. Filter chips: All · Food · Supplies ·
   Things. Sort by name, place, or recently added.
3. **Places** — the house as a tree. Tap a room, cupboard or box to see what
   is in it. This is the "what's in that trunk?" view.
4. **Shopping** — the list. Tick = bought, and it goes back into stock with
   last time's details in one tap.

Plus an **Add** button everywhere, and Settings behind a small icon.
That is 4 screens instead of 13.

### Adding something in ten seconds

Step one is always the same two things: **name and place**.
Save is available immediately. Everything else is optional and collapsed, and
depends on the kind of thing.

### What is recorded

| Kind | Examples | Extra details offered |
|---|---|---|
| Food & drink | rice, spices, frozen, tins | quantity, expiry |
| Supplies | cleaning, toiletries, medicines, batteries | quantity, expiry |
| Electronics & cables | chargers, wires, gadgets | model, warranty until, what it belongs to |
| Clothing & linen | blankets, the special jacket | season or occasion, condition |
| Tools & hardware | drill, screws, paint | — |
| Other | everything else | — |

New details worth adding, mostly for kept things:
- **Tags.** Free labels such as "winter", "wedding", "USB-C", "spare".
- **Where it went.** Besides "finished", a kept thing can be lent (to whom),
  given away, sold or lost. Lent items show on Home until returned.
- **Last seen.** A date you confirm when you actually see the thing, so a
  five-year-old entry can be trusted or doubted.
- **Value and purchase date.** Optional, for the expensive items only.

Removed from the form: nutrition, pack size, store, category, and price as a
routine field.

### Food, kept light

Track food where forgetting costs something: the freezer, spices, tins, backup
stock, anything with a long shelf life. Daily milk and vegetables are not worth
logging and the app should not make you feel behind for skipping them.
Quantities stay coarse (2 packs, 1 jar). Expiry is optional.

### How it looks

Keep Instrument: paper/backlit, hairlines, mono figures, colour only for
urgency. Change the emphasis: this is a finder, not a control panel. The home
screen is a search box, not a dial and four readouts. Mockups come first,
before any build.

## 6. Decisions (made 2026-11-14)

| | Question | Decision |
|---|---|---|
| A | Recipes and meal plans | **Remove** |
| B | Fix-it | **Keep as a small list** — a section on Home, not its own screen |
| C | Receipt scanning | **Remove** (takes the on-device AI model with it) |
| D | Reminders | **Push only.** The daily email digest goes |
| E | Photos | **Not needed** — kept things rely on name, tags and place |
| F | Plants and Luggage | **No own kinds** — "Other" plus tags |
| G | Other users | **Nobody else uses Trove.** Sharing stays in the data model but the household switcher and invite UI leave the main screens (moved into Settings) |

## 7. Safety

- **No data is deleted.** Removed features lose their screens; their tables
  stay in the database untouched. Any feature can be brought back.
- Before anything is removed, the subscriptions and recipes are exported to a
  file, and you confirm the six subscriptions are in Kosha.
- Database changes are additive only (new optional columns), in the same
  run-it-yourself migration style as before.
- Existing items keep working. The mouthwash and the Red Bull get re-sorted
  into the right kind.

## 8. Phases

| Phase | What | Result |
|---|---|---|
| 0 | Your decisions (section 6); export subscriptions and recipes; mockups of Home, Stuff, Places and Add | Agreed design, nothing built |
| 1 | Remove: subscriptions, books, plans, trends, nutrition, and whatever A–C decide. Remove the Kitchen/Home switch | A much smaller app that still works |
| 2 | New structure: Home, Stuff, Places, Shopping | Four screens |
| 3 | New Add flow; one-tap "bought" on Shopping; manual "running low" | Adding takes seconds |
| 4 | Kept-thing details: tags, lent/given/sold, last seen, kinds | The durable half becomes the strong half |
| 5 | Reminders trimmed to one channel; final look pass; tidy unused code | Finished |

Each phase leaves the app usable and is pushed on its own. Phase 1 alone
removes most of the clutter.

## 9. Progress

- **Phase 0 — done 2026-11-14.** Decisions recorded; subscriptions and
  recipes exported to `exports/` (gitignored); mockups in
  `docs/mockups/rework.html`. You confirmed the subscriptions are in Kosha.
- **Phase 1 — done 2026-11-14.** Removed: Subscriptions, Recipes and meal
  plans, Plans, Trends, receipt scanning, label scanning and the on-device AI
  model, nutrition fields, books (fields, ISBN lookup, shelf classification),
  use-by-amount, the pack-size inputs (stored values are kept), the
  Kitchen/Home switch and the second dashboard, the email digest and payment
  reminders. Book, Plants and Luggage are hidden from pickers. One menu;
  the household switcher lives in Settings. Push reminders now cover food
  expiring and warranties ending. No database rows or tables were removed.

- **Mobile fix — 2026-11-14.** The dashboard was 432px wide on a 375px
  phone (a grid column could not shrink below a long item name), which pushed
  the bottom bar's last icon off-screen and let the browser pan the bar away
  while scrolling. Fixed at the source; long names wrap to two lines; the
  page can no longer scroll sideways; the bar pads for the gesture area.
- **Phase 2 — done 2026-11-14.** Four screens: **Home** (big search, "Needs
  a look" for food expiring ≤7 days and warranties ≤30 days, Fix-it as a
  small in-place list), **Stuff** (Pantry + Things merged; Food / Supplies /
  Things / Unsorted filters; grouped by place; In stock / History), **Places**
  (house tree with counts, open a place to see what is in it, place editing
  moved here from Settings), **Shopping** (unchanged until phase 3). Phone bar:
  Home · Stuff · Add · Places · Shop. Old addresses redirect (/inventory,
  /things, /fixit and the phase 1 removals). Item cards rebuilt for phone
  width. Upcoming stays reachable as the "Timeline" link on Home.

**Correction (2026-11-14):** the "duplicate places" noted during phase 0 were
not duplicates. They belong to a second, empty household that Neha's account
created on 8 July; the read-only check had looked across all households.
Aditya's household ("My Home", 19 places) has none. Neha is also a member of
Aditya's household.
