# The Faceless YouTube Workflow

A repeatable pipeline for producing faceless YouTube videos where Claude does the
research, structure, and scripting, and you keep the strategy.

The whole thing rests on one idea: AI isn't a magic money button, it's a force
multiplier. Everything below is built to remove repetitive work, not judgment.

---

## 1. Pick the Niche Before You Pick the Tools

Every downstream decision — script tone, voice, visual style, thumbnail language —
is downstream of the niche. Choose one where you can answer:

- Who is the viewer, and what do they already believe?
- What do they want to know badly enough to click?
- Can you publish here 50 times without running dry?

If you can't answer all three, you don't have a niche yet. You have a topic.

## 2. Write the Script With Claude

The prompt lives in [`prompts/script.md`](../prompts/script.md). Copy it, fill in
the topic, and run it.

The core instruction set:

> Write a 1,500 word YouTube script about **[Topic]**. Avoid corporate jargon and
> generic introductions. Start immediately with a pattern interrupt. Introduce a
> story-driven curiosity loop every 45 seconds to maintain viewer retention. Keep
> the pacing conversational and make every section naturally lead into the next.

Claude is especially strong here because the job needs all of these at once:

- Natural conversational writing
- Complex story structures
- Historical and technical context
- Long-form narrative development
- Research and information organization

The better your instructions, the better the output. Vague prompt in, generic
script out — the model can't guess the angle you had in mind.

## 3. Build a Lean Production Stack

Once the script is done, move it through a simple pipeline. One job per tool:

| Stage | Tool |
| --- | --- |
| Research + script | Claude |
| Voiceover | ElevenLabs |
| Images + thumbnails | Midjourney / Flux |
| Video generation | Runway / Pika |
| Editing | CapCut Pro / Premiere Pro |

You don't need dozens of tools. You need a workflow where every tool has one job.
Adding a second tool to a stage is how a pipeline turns back into a project.

## 4. The Three Rules That Make Faceless Channels Scale

### Rule 1 — Win the first 5 seconds

Never open with *"Welcome back to the channel…"*.

Open with the conflict, the shocking statistic, the unexpected result, or the
biggest question. Give people a reason to keep watching immediately. The first
five seconds decide whether the other 1,495 words get heard at all.

### Rule 2 — Batch everything

Instead of taking one video from start to finish every day:

- **Day 1** — generate 10 scripts with Claude
- **Day 2** — produce voiceovers + visuals
- **Days 3–4** — edit and schedule

Batching removes a huge amount of wasted time. Context switching between writing,
rendering, and editing is the hidden cost in most one-video-a-day workflows.

### Rule 3 — Obsess over CTR

A great script means nothing if nobody clicks. Your title and thumbnail are
responsible for getting the viewer through the door.

Spend serious time testing:

- Titles
- Thumbnail concepts
- Hooks
- Visual angles
- Curiosity gaps

A small CTR improvement can completely change the performance of a video. Treat
the thumbnail as a first-class deliverable, not the last thing you do before
uploading.

---

## The Real Lesson

Claude can handle the research, structure, scripting, and ideation. You still
provide the strategy:

- You choose the niche.
- You understand the audience.
- You decide what deserves to be published.
- You improve what works.

That's where the real advantage comes from.

Master the workflow, respect the viewer's attention, and use AI to eliminate the
repetitive work. That's how a faceless YouTube channel goes from a side project
to a scalable content machine.
