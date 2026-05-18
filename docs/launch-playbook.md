# BYOR Launch Playbook

The non-discrete plan. 4 weeks of setup, one launch day, 30 days of follow-through.

---

## Decision before anything

**Pick the launch date.** A Tuesday, 4–6 weeks from today. Tuesdays land best on HN / Product Hunt (US workday, no Monday catch-up, not yet Friday-tired).

**Recommended:** 4 weeks out gives time without losing momentum. So: Tuesday in roughly 4 weeks. Commit to the date in writing somewhere visible. Everything below works backwards from it.

For this playbook, I'll call the launch day **Tuesday DAY 0**. Counting backwards: DAY −28, −21, −14, −7, −1.

---

## Week −4 (28 days out): foundations + presence

**Goal:** every public surface BYOR's launch will need exists.

| Task | Owner | Done? |
|------|-------|-------|
| Buy `byor.app` ($15/yr at Porkbun) | You | [ ] |
| Cloudflare Email Routing → `hello@byor.app` forwards to your inbox | You | [ ] |
| Point `byor.app` at the Railway deploy via custom domain | You | [ ] |
| Create `@byor_app` (or chosen handle) on X / Twitter | You | [ ] |
| Create BYOR LinkedIn page | You | [ ] |
| Pin the BYOR repo on your personal GitHub profile | You | [ ] |
| Create Product Hunt "upcoming" page → drives pre-launch followers | You | [ ] |
| Set up GitHub Discussions on the repo (or quick Discord server) | You | [ ] |
| Record a 60-second screen-recording demo (Loom or quick screencap) | You | [ ] |
| Create one hero screenshot for the README + social cards | You / $5 Fiverr | [ ] |
| Rotate the leaked admin password + Gemini key | You | [ ] |

**Content cadence starts now.** Every day until launch:
- 1 post on X (build-in-public update — see `docs/launch-prelaunch.md`)
- 1 post on LinkedIn 3×/week (denser, more thoughtful)
- 1 issue / commit on GitHub (visible activity)

Tools to make this easier:
- Schedule posts via Typefully (X) and Buffer (LinkedIn). Both free for low volume.
- Have a notes file `daily-update.md` where you jot what shipped that day → becomes the next day's tweet.

---

## Week −3 (21 days out): build the audience

**Goal:** 200 followers + 100 Product Hunt upcoming-followers + 30 GitHub stars from your existing network.

**X / Twitter** (`@byor_app` and personal `@ahammadshibil`):
- Reply to 3 founder tweets / day with a substantive comment, drop BYOR link if relevant in 1 of every 5
- Quote-tweet open-source / indie-hacker accounts when they post relevant content
- 1 build-in-public tweet/day from `docs/launch-prelaunch.md`

**LinkedIn**:
- 2 long-form posts/week (one about the technical build, one about the founder-update insight)
- Engage genuinely on 5 VC / founder posts/day

**DEV.to**:
- Publish a teaser post: "What I'm building (and why)" — see `docs/launch-posts.md`
- Engage in the comments — this builds DEV.to follower count, which compounds on launch day

**Your existing networks (the unfair advantage):**
- Speciale Invest's portfolio CEOs — they're the literal target customer for the founder-update recipe. Tell them about BYOR.
- Atoms & Cells subscribers — soft tease ("I built a thing on the side, more soon")
- Personal LinkedIn — your VC + founder connections share well

**Anti-pattern:** don't mass-DM begging for upvotes. Build genuine pre-launch interest. The follow-through matters more than the count.

---

## Week −2 (14 days out): warm up the launch surfaces

**Goal:** every launch-day post is drafted, every channel is "ready to push button."

| Task | Owner | Done? |
|------|-------|-------|
| Show HN post — final draft saved to `docs/launch-posts.md` | ✓ pre-drafted | [ ] edit personal voice |
| Product Hunt page — title, tagline, description, gallery uploaded | You | [ ] |
| Reddit posts (×6 subreddits) — final drafts | ✓ pre-drafted | [ ] edit per-subreddit voice |
| X launch thread (10 tweets) — final draft | ✓ pre-drafted | [ ] edit |
| LinkedIn launch post — final draft | ✓ pre-drafted | [ ] edit |
| IndieHackers launch post — final draft | ✓ pre-drafted | [ ] edit |
| DEV.to launch post — already drafted | ✓ in `launch-dev-to.md` | [ ] edit |
| Email to Atoms & Cells subscribers | ✓ pre-drafted | [ ] edit |
| Hero screenshot for ALL platforms (1920×1080 + 1200×630 variant) | You / $5 Fiverr | [ ] |
| 60-second demo video (Loom link) | You | [ ] |
| Test the live demo URL works end-to-end | You | [ ] |
| Run `./scripts/smoke-test.sh` against Railway | You | [ ] |

---

## Week −1 (7 days out): final dry run

**Day −7 (Tuesday):** Pre-launch tweet "Launching next Tuesday." Add countdown post daily.

**Day −5:** Email 10 friends/peers personally: *"I'm launching BYOR next Tuesday. Would mean a lot if you star / upvote / tell one person. Repo: ..."*. Don't ask 100 people; ask 10 well.

**Day −3:** Final smoke test on Railway. Verify:
- `byor.app` resolves and loads landing
- Sign-up via Login form works
- `./scripts/provision.sh` works (test it on a throwaway slug)
- All 8 recipes install cleanly

**Day −2:** Schedule all posts:
- HN: 9:00 AM ET (peak)
- Product Hunt: 00:01 PT (peak)
- DEV.to: 10:00 AM ET
- X: thread at 9:30 AM ET
- LinkedIn: 8:30 AM ET
- Reddit: staggered (see Day 0 timeline)
- IndieHackers: 11:00 AM ET

**Day −1:** No posting. Rest. Check that your laptop is charged. Make sure you're not on a flight.

---

## Day 0 — Launch Tuesday

**Wake up at 5:30 AM PT (8:30 AM ET).** Big cup of coffee. Phone off Do Not Disturb.

| Time (PT) | Time (ET) | Action |
|-----------|-----------|--------|
| 00:01 AM | 03:01 AM | Product Hunt goes live (it auto-launches at midnight PT). Don't fire from anywhere else yet. |
| 05:30 AM | 08:30 AM | Wake up. Check PH ranking. Tweet "We're live on Product Hunt → [link]" |
| 05:45 AM | 08:45 AM | LinkedIn launch post goes live |
| 06:00 AM | 09:00 AM | **Show HN posts.** Title pattern: "Show HN: BYOR – Open-source alternative to Notion/Beehiiv for recurring reports" |
| 06:15 AM | 09:15 AM | X launch thread goes live (auto-posted via Typefully); RT your own first tweet |
| 06:30 AM | 09:30 AM | DEV.to post publishes |
| 07:00 AM | 10:00 AM | Reddit r/SideProject post |
| 07:00 AM | 10:00 AM | Email Atoms & Cells subscribers (BCC personal + business contacts) |
| 08:00 AM | 11:00 AM | IndieHackers post |
| 09:00 AM | 12:00 PM | Reddit r/opensource post |
| 10:00 AM | 13:00 PM | Reply to every HN comment that's appeared so far. Same for PH. |
| 11:00 AM | 14:00 PM | Reddit r/selfhosted post |
| 12:00 PM | 15:00 PM | Status tweet: stars-so-far + thank early supporters |
| 13:00 PM | 16:00 PM | Reddit r/SaaS post |
| 15:00 PM | 18:00 PM | Reddit r/indiehackers + r/Entrepreneur posts |
| 17:00 PM | 20:00 PM | Status tweet #2 + reply to every comment from the last 6 hours |
| 21:00 PM | 00:00 ET | End of day: PH milestone tweet, GitHub stars tweet, thank-everyone tweet |

**The rule for the day:** respond to every single comment / DM / issue within 30 minutes. This is the work. It's not "set it and forget it" — it's 14 hours of presence.

If HN hits front page or PH hits top 5, the second wind is real. Stay online until 1 AM PT.

---

## Days 1–7 — sustain the wave

Every day:
- Star milestone tweet ("100 stars in 24h", "500 stars in week 1") if applicable
- Reply to issues/PRs same-day
- Quote-RT anyone who blogs/tweets about BYOR
- One LinkedIn post mid-week with screenshot of stars/sign-ups

**Day +3:** Write a follow-up "Launch retrospective" DEV.to post — what worked, what didn't, raw numbers. Honesty builds compounding trust.

**Day +7:** First weekly metrics tweet thread. Stars, repo activity, sign-ups, first conversations. This becomes a habit (Nevo does monthly).

---

## Days 8–30 — convert curiosity to revenue

**Week 2:**
- Identify the 10 most engaged stargazers (look at their profiles + recent activity). DM them personally. *"Saw you starred BYOR. What problem were you trying to solve? Would you try the hosted cloud for $0 for a month if I set you up?"*

**Week 3:**
- Convert any verbal-yes to actual customer. Run `./scripts/provision.sh` for them. Get them set up on a 1:1 onboarding call.

**Week 4:**
- Publish the "$X MRR in 30 days with my open-source SaaS" post (mimic Nevo). Whether X is $0 or $400 doesn't matter — the transparency is the trust signal.

---

## Risk: what if it flops?

Define "flop" in advance so you don't move the goalposts. Reasonable thresholds:

- < 100 GitHub stars in week 1 → distribution problem (channel was wrong)
- 100+ stars, 0 cloud signups → pitch problem (positioning is off)
- 100+ stars, 5+ signups, 0 paid → product problem (cloud isn't worth $79)

Each failure mode has a different fix. Don't try to fix the wrong one.

---

## The mindset

This is a launch, not the launch. If it goes poorly, you ship another version 6 months from now with what you learned. If it goes well, you've still got 11 months of solo grind ahead before "open-source SaaS" becomes "real business."

Either way: ship it loud, then ship the next thing.

— Now move to `docs/launch-posts.md` for the actual post drafts.
