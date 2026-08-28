# Script Prompt

Copy everything in the block below, replace the bracketed fields, and send it to
Claude. Only `[Topic]` is required — the rest sharpen the output.

---

```
Write a 1,500 word YouTube script about [Topic].

Avoid corporate jargon and generic introductions. Start immediately with a
pattern interrupt. Introduce a story-driven curiosity loop every 45 seconds to
maintain viewer retention. Keep the pacing conversational and make every section
naturally lead into the next.

Audience: [who is watching, and what they already believe about this]
Angle: [the specific claim or question this video is built around]
Tone: [e.g. dry and factual / urgent / wry]
Open on: [the conflict, statistic, unexpected result, or question to lead with]
Close on: [the thought you want left in their head]

Write it as spoken narration only — no shot lists, no scene headers, no
bracketed stage directions.
```

---

## Filling it in

**Topic** — specific beats broad. "Why the Concorde was retired" outperforms
"the history of aviation."

**Angle** — this is the one field people skip and shouldn't. Without it the model
picks the most obvious framing, which is also the framing every other video on
the topic already used.

**Open on** — if you can't name the opening beat, the script probably doesn't
have a hook yet. Work that out before you generate.

## Follow-up prompts that usually earn their keep

- `The 45-second mark through the 90-second mark is flat. Rewrite that stretch with a real open loop.`
- `Give me 10 title options ranked by curiosity gap, no clickbait that the script doesn't pay off.`
- `Where does this script lose someone who arrived from the thumbnail and knows nothing about [Topic]?`
- `Tighten to 1,200 words without losing the story beats.`

## Batching

To generate a day's worth at once, send the filled template once per topic in
separate messages rather than asking for ten scripts in one reply — quality
degrades fast when the model is splitting a single response ten ways.
