# Launch Day Timeline

Print this. Tape it to your monitor. Run the day like an ops shift.

All times in **PT** and **ET** — convert to IST (+13:30 ET, +12:30 PT) if needed.

---

## The night before (Monday)

| 22:00 PT (Mon) | 01:00 ET (Tue) | Final checks |
|---|---|---|
|  |  | `./scripts/smoke-test.sh` against Railway → 14/14 pass |
|  |  | `byor.app` resolves to landing page |
|  |  | Live demo login works |
|  |  | Demo video uploaded to YouTube unlisted; link in clipboard |
|  |  | Hero screenshot files in `~/byor-launch-assets/` |
|  |  | Phone on charger. Laptop on charger. Coffee setup ready. |
|  |  | Discord / Slack notifications muted except BYOR-related |

**Sleep early.** You will be awake 14+ hours tomorrow.

---

## Tuesday (Launch Day)

### 00:01 PT / 03:01 ET — Auto-launch

Product Hunt scheduled launch fires automatically at midnight PT. **You don't have to be awake for this** — it's the only milestone that does itself.

### 05:30 PT / 08:30 ET — Wake-up

1. Coffee
2. Open laptop
3. Check Product Hunt ranking. Note where you are.
4. **First X tweet of the day** (post manually):

```
We're live on Product Hunt 🎉

BYOR — Open-source autopilot for recurring reports.
Pulls Stripe/GitHub/Notion → drafts your monthly update → cited, branded, delivered on schedule.

[PH link]

🧵 More in the launch thread below ↓
```

5. Quote-tweet your own pre-scheduled launch thread to bump it.

### 05:45 PT / 08:45 ET — LinkedIn

Post the LinkedIn launch post manually (don't schedule — LinkedIn's algorithm penalizes scheduled posts on launch).

### 06:00 PT / 09:00 ET — Show HN

**This is the most important moment of the day.**

1. Submit Show HN at https://news.ycombinator.com/submit
2. Title: `Show HN: BYOR – Open-source autopilot for monthly investor updates`
3. URL: `https://byor.app`
4. Text: from `docs/launch-posts.md` section 1

After submitting, **DO NOT** ask people to upvote — HN auto-detects vote rings and will dead-list you. Trust the title + the work.

Set a 10-minute timer. Refresh /show every minute. If you don't get 5+ upvotes in 10 minutes, the title or URL isn't working — DON'T resubmit on the same day. (Learn from it; relaunch next month.)

### 06:15 PT / 09:15 ET — X launch thread

Your pre-scheduled Typefully thread fires here. Quote-tweet tweet 1 with:

```
Open-sourced today 👇

If BYOR is useful to you, a ⭐ goes a long way. That's the leading signal I use to decide where to push next.
```

### 06:30 PT / 09:30 ET — DEV.to

Hit publish on `launch-dev-to.md` post.

After 10 minutes, drop the DEV.to link as a comment under your X launch thread.

### 07:00 PT / 10:00 ET — Reddit wave 1: r/SideProject

Post the r/SideProject draft. Don't crosspost to multiple subs in the same hour — Reddit detects this and shadow-bans.

### 07:00 PT / 10:00 ET — Atoms & Cells / personal email

Send the email (BCC, ~150 recipients max). Personal-feeling, not a blast.

### 08:00 PT / 11:00 ET — IndieHackers

Post the IndieHackers draft.

### 09:00 PT / 12:00 ET — Reddit wave 2: r/opensource

Post. Reply to any r/SideProject comments first.

### 10:00 PT / 13:00 ET — Mid-morning sweep

- Reply to every HN comment from last 4 hours
- Reply to every PH comment
- Reply to every X reply
- Reply to every DM
- Star your own milestone if it makes sense (e.g. "100 stars in 4 hours")

**Tweet a mid-morning update:**
```
4 hours in:
⭐ [N] GitHub stars
🚀 Top [X] on Product Hunt
📈 [N] sign-ups on the cloud waitlist

Replies coming, comment by comment. Keep them coming.

[PH + GitHub link]
```

### 11:00 PT / 14:00 ET — Reddit wave 3: r/selfhosted

Post.

### 12:00 PT / 15:00 ET — Lunch + slow zone

Eat. Step away from screen for 20 min. The middle of US Tuesday is a low-engagement zone — use it to recharge.

### 13:00 PT / 16:00 ET — Reddit wave 4: r/SaaS

Post.

### 15:00 PT / 18:00 ET — Reddit wave 5: r/indiehackers + r/Entrepreneur

Post both. Different audience overlap.

### 17:00 PT / 20:00 ET — Evening sweep

- Final HN comment-reply pass
- PH comment-reply pass
- Quote-RT anyone with > 1k followers who shared

**Status tweet:**
```
End-of-day update (USA hours):
⭐ [N] GitHub stars
🚀 #[X] on Product Hunt
🎯 [N] cloud signups
💬 [N] HN comments

Thanks to everyone who upvoted, starred, shared, or just clicked through. This was a real launch because of you.

What recipe should ship next? Reply with what you write monthly.
```

### 19:00 PT / 22:00 ET — India hours

Your India network is waking up (~07:30 IST onwards). Personal LinkedIn DM ~5 of your closest Speciale / VC contacts:

> *"Quick share — open-sourced BYOR today (a thing I've been building on the side). If you have 30 seconds, a star on the repo would mean a lot. github.com/ahammadshibil/reportforge — no pressure, just sharing."*

### 21:00 PT / 00:01 ET (Wed) — End-of-day milestone tweet

```
Day 1 closing numbers:
⭐ [N] stars
🚀 #[X] on Product Hunt
🎯 [N] sign-ups
💬 [N] meaningful comments across HN / Reddit / X
📈 [N] cloud waitlist subscribers

Tomorrow: replying to every issue. Wednesday: writing the retrospective.

Thank you. Genuinely.
```

### 22:00 PT — Bed

You earned it. Tomorrow is sustaining the wave — not as intense but still focused work.

---

## Day +1 (Wednesday)

| Time | Action |
|---|---|
| 09:00 ET | Reply to every issue / PR / X reply / DM that came in overnight |
| 11:00 ET | Quote-RT anyone with > 100 followers who shared. Don't engagement-farm — only RT if their context adds something. |
| 14:00 ET | First daily metric tweet: "Day 2: stars at [N], up [X]% from yesterday." |
| 20:00 ET | Sleep on schedule. Don't burn out on day 2. |

## Day +2 (Thursday)

Spend half the day writing the **launch retrospective** post.

Format:
- Numbers (stars, sign-ups, comments, traffic)
- What worked (HN? PH? DEV.to? specific moments?)
- What didn't (be honest)
- One lesson per channel
- What's next

Publish on DEV.to. Cross-post to LinkedIn Wednesday after.

This post compounds — it becomes the artifact people send to their friends ("hey, look how this person launched their thing"). Nevo's "$700/mo" post got more sustained traffic than his actual launch did.

## Day +3 through Day +7

Daily:
- Morning: respond to every issue/PR/comment within 4 hours
- Afternoon: 1 build-in-public tweet, 1 quote-RT
- Evening: review GitHub Insights → who starred → DM the most engaged 2

Weekly metrics tweet on Friday:
```
Week 1 of BYOR being public:
⭐ [N] stars (started day at 0)
👥 [N] sign-ups on cloud waitlist
💬 [N] issues opened, [N] closed
🛠 [N] commits / fixes shipped this week

Next week: [the one thing you're shipping next]

Thank you to everyone reading + watching the build.
```

---

## What you don't do during launch week

- **Don't add features.** Every feature request gets a "noted, will consider after the week stabilizes" reply. Then add to issues with the "post-launch" label.
- **Don't pivot the positioning.** You'll see comments saying "have you considered repositioning as X?" — write them down for later, don't act on them this week.
- **Don't ignore criticism.** Reply, acknowledge, learn. Defensive replies are the fastest way to torch goodwill.
- **Don't book meetings.** Block your calendar. The launch is the meeting.
- **Don't drink.** This is a marathon week.

---

## Mental model

You're not launching a product. You're showing up as the founder of an open-source project for one week of maximum public presence. The product is good or it isn't — what you control today is the energy of the launch.

Be present. Reply fast. Tell the truth. Ship the next thing.

Go.
