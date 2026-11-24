# How Muiso estimates a song's mood

This document explains how Muiso places each song on the mood grid. Sections 1–6 cover how a song's lyrics become two numbers, `lyric_valence` and `lyric_arousal`, and which research each step is based on. Section 7 compares the two mood models that combine lyrics with audio features, and describes the next step: checking them by hand. It traces to FR-3 (score songs on calming lyrics, BPM and genre) and the Data Models section of the spec.

The code lives in [`notebooks/01_build_catalog.ipynb`](notebooks/01_build_catalog.ipynb) (sections 3 and 4) and [`src/tmr/mood.py`](src/tmr/mood.py).

**Valence** is how pleasant a feeling is, and **arousal** is how energetic it is. Both run from -1 to +1, the same scale as the mood grid in the questionnaire.

Each step below is marked as either **based on research** or a **design choice** (a decision we made that the team can change).

---

## 1. Getting the lyrics

1. **Search.** We search Genius through the `lyricsgenius` library using the song's title and artist from MuSe. Genius can't be searched by Spotify ID.
2. **Match.** Of the top 10 results, we keep the one whose title and artist best match MuSe. We accept it only if **both** are at least 80% similar after removing punctuation, "feat." credits and bracketed text like "(Remastered)". *Design choice*: the 80% threshold.
3. **Label the outcome.** Each song gets one status:

   | Status | Meaning | Lyric scores |
   |---|---|---|
   | `matched` | Found on Genius with lyrics | Calculated |
   | `matched_no_lyrics` | Found on Genius, but it has no lyrics | NULL (treated as instrumental) |
   | `rejected_match` | Best result was a different song | NULL |
   | `not_found` | No results | NULL |

**Privacy.** The spec says to never store lyric text. Raw lyrics are cached only in `data/raw/lyrics/`, which is gitignored, so the notebook can resume without re-downloading. Lyric text never goes into `catalog.db`, a Parquet file or notebook output. The notebook stops with an error if any saved column looks like it could hold lyrics. Only the derived scores and theme flags are saved.

## 2. Cleaning

Scraped text includes page clutter. We remove the "N Contributors… Lyrics" header line, the trailing "…Embed" text, inserted ad text such as "You might also like", and section labels such as `[Chorus]`.

After cleaning:
- **Fewer than 20 words** → treated as **instrumental**. Its lyric scores are NULL and the song stays in the catalog. *Design choice*: the 20-word cutoff.
- **Not English**, as detected by `langdetect` → the song is dropped. The spec targets English-language songs, and the emotion classifier only reads English.

## 3. Emotion classification

**Model:** [`j-hartmann/emotion-english-distilroberta-base`](https://huggingface.co/j-hartmann/emotion-english-distilroberta-base), a pretrained model that runs locally through Hugging Face `transformers` with no API call.

- It's a fine-tuned version of DistilRoBERTa (Sanh et al., 2019), a smaller and faster version of RoBERTa (Liu et al., 2019).
- It outputs a probability for each of **7 emotions**: Ekman's six basic emotions (anger, disgust, fear, joy, sadness, surprise; Ekman, 1992) plus neutral.
- It was trained on about 20,000 balanced examples from six English datasets of tweets, Reddit posts, student self-reports and TV dialogue. Its evaluation accuracy is **66%**, against 14% for random guessing.
- **It was not trained on song lyrics.** Lyrics are poetic, repetitive and often ironic, so its accuracy on lyrics is probably lower than 66%. We haven't measured it.

**Long lyrics.** The model reads at most 512 tokens (about 350–400 words), so lyrics are split into chunks of 200 words. The 7 probabilities are averaged across chunks, giving one probability set per song. *Design choice*: the chunk size and simple averaging, which gives every part of the song equal weight. A chorus that repeats counts more because it appears more often.

## 4. From emotions to valence and arousal

The classifier gives emotion categories, but the playlist planner needs points on the mood grid. We place each emotion at a fixed point on **Russell's circumplex model of affect** (Russell, 1980). That's the standard two-dimensional model with valence on one axis and arousal on the other, and it's the same model behind the mood grid and the Routes table.

| Emotion | Valence | Arousal | Quadrant |
|---|---|---|---|
| joy | +0.8 | +0.5 | pleasant, energetic |
| surprise | +0.3 | +0.7 | mildly pleasant, very energetic |
| neutral | 0.0 | 0.0 | centre |
| sadness | -0.7 | -0.4 | unpleasant, low energy |
| fear | -0.6 | +0.6 | unpleasant, energetic |
| anger | -0.6 | +0.8 | unpleasant, very energetic |
| disgust | -0.7 | +0.3 | unpleasant, mildly energetic |

*Based on research*: which quadrant each emotion falls in (Russell, 1980). *Design choice*: the exact coordinates.

A song's lyric scores are the probability-weighted average of these points:

```
lyric_valence = Σ  P(emotion) × valence(emotion)
lyric_arousal = Σ  P(emotion) × arousal(emotion)
```

For example, lyrics scored as 70% sadness, 20% neutral and 10% joy get
valence = 0.7(-0.7) + 0.2(0) + 0.1(0.8) = **-0.41** and arousal = 0.7(-0.4) + 0.2(0) + 0.1(0.5) = **-0.23**.

A poor coordinate choice isn't fatal. The learned model in the notebook also receives the 7 raw probabilities, so it can learn around a bad placement, and its results show whether the mapping helps.

## 5. Theme flags

A short keyword list sets `flags` to `self_harm` and/or `substance` (for example "kill myself" or "overdose"). Only the flag names are stored, never the matched words. *Design choice*: this is deliberately crude and easy to audit. It will miss metaphors and can misfire on songs that discourage these behaviours. It's a candidate for replacement before flags are used to filter playlists.

## 6. How lyric scores are used

Lyric scores are one input among several. They never decide a song's mood on their own.

**In the mood estimate** (`tmr.mood.estimate_mood`, which fills `est_valence` and `est_arousal`):

```
est_valence = 0.70 × (audio-based valence) + 0.30 × lyric_valence
est_arousal = 0.85 × (audio-based arousal) + 0.15 × lyric_arousal
```

Instrumentals use the audio-based part alone.

Why lyrics get **less than half** the weight, and **more for valence than arousal**:
- **Melody dominates, but lyrics matter.** Ali & Peynircioğlu (2006) found that melodies affected perceived emotion more than lyrics in every condition, but lyrics still changed the result. So lyrics get a minority share. *Based on research*: lyrics counting for less than the music. *Design choice*: the exact 30% and 15%.
- **Audio already captures arousal well.** Spotify-style "energy" tracks listener arousal ratings strongly, and audio valence tracks valence only moderately (Validating Spotify's audio features, PsyArXiv preprint). Energy was also the strongest arousal predictor in a study combining audio features and lyrics (arXiv 2302.13321). Valence is where audio falls short, so that's where lyrics get more weight.
- **Lyrics carry mood information that audio misses.** Hu & Downie (2010) found lyric features beat audio features for some mood categories, and combining both worked best, using mood labels from Last.fm tags like MuSe's.

**In the calm score** (`tmr.scoring.calm_score`): `0.3 × lyric_valence` is one of three terms, alongside arousal and tempo. More positive lyrics are treated as more calming. Instrumentals skip this term.

**In the learned comparison model** (notebook section 5): lyric valence, lyric arousal, the 7 emotion probabilities and a "has lyrics" indicator are all inputs.

### Worked example: a fast song with sad lyrics

A fast, loud song (energy 0.85, -5 dB, not acoustic) with fully sad lyrics (valence -0.7, arousal -0.4):

| Version | est_valence | est_arousal |
|---|---|---|
| Sounds upbeat (major key, audio valence 0.8), no lyrics | +0.70 | +0.76 |
| Same, with sad lyrics | **+0.28** | **+0.59** |
| Sounds dark (minor key, audio valence 0.25), sad lyrics | **-0.65** | **+0.59** |

The sad lyrics pull the upbeat-sounding song from clearly happy to mildly positive, but the sound still wins.

## 7. Two contrasting mood models

Muiso has two ways to turn a song's inputs into `est_valence` and `est_arousal`. Both use only inputs that exist for any song: ReccoBeats audio features, Genius lyric scores and genre. Neither uses MuSe at run time, so either can score songs from a user's listening history.

| | **Rules** (`src/tmr/mood.py`) | **Learned** (notebook section 5) |
|---|---|---|
| What it is | A fixed weighted formula (section 6) | A gradient-boosting model (`HistGradientBoostingRegressor`), chosen over ridge regression and a predict-the-average baseline |
| Where its patterns come from | Directions from music-psychology research; weights are our choices | Learned from MuSe's valence and arousal labels |
| Inputs | Energy, loudness, acousticness, audio valence, major/minor mode, lyric valence and arousal | The same, plus danceability, instrumentalness, speechiness, BPM, the 7 lyric emotion probabilities and genre |
| Role of MuSe | Only to *check* agreement | The training target, which the model learns to predict |
| Strengths | Every score can be explained; based on published findings; behaves the same on any song; BPM counted only once | Agrees more closely with MuSe; picks up genre and combinations of features the rules can't |
| Weaknesses | Hand-picked weights; ignores genre | Hard to explain; inherits MuSe's biases (Last.fm tags, popular Western music); relies on genre, which may not transfer from MuSe's genre names to Spotify's; uses BPM, so BPM counts twice once it reaches the calm score |

**How they compare so far.** Agreement with MuSe on held-out songs, from the first full run (3,196 songs, **no lyrics**, because the Genius token wasn't set yet):

| Model | Arousal rank correlation | Valence rank correlation | Arousal R² | Valence R² |
|---|---|---|---|---|
| Predict-the-average baseline | – | – | 0.00 | 0.00 |
| Rules | 0.26 | 0.19 | – | – |
| Learned (gradient boosting) | 0.34 | 0.27 | 0.11 | 0.06 |

The learned model agrees more with MuSe, but both explain only a small share of MuSe's variation. These numbers will be updated with the run that includes lyrics. The rules are the default (`MOOD_METHOD = "rules"` in the notebook). The notebook would only switch to the learned model if it were clearly better: at least 0.10 higher mean rank correlation and a mean R² of at least 0.2.

**Why MuSe can't settle the choice alone.** MuSe records how Last.fm users *tag* songs, not how songs affect listeners, and many songs have only a few tags. A model can match MuSe better and still order a playlist worse. So the next step is a human check.

### Next step: check both models by hand

The web app has a **temporary Rules / Learned toggle** in its top-right corner. Each catalog song carries both estimates (`frontend/public/catalog.json`; the learned estimates are out-of-fold, so no song is scored by a model that saw its own label), and the toggle chooses which one orders the playlist. The playlist screen names the model used, and each saved session records it as `mood_model`.

The manual check:

1. **Same inputs, both models.** For each goal (Calm, Focus, Sleep, Uplift, Release), submit the same questionnaire answers twice, once per model. Use the goal's typical start mood from the Routes table and a 30-minute session.
2. **Listen to the endpoints first.** The first and last 2–3 tracks set where the route starts and ends, so they matter most. Does the first track match the starting mood, and does the last one match the goal?
3. **Judge the path.** Does the playlist move steadily from start to goal (the iso principle), or does it jump around?
4. **Record each judgment** in a simple sheet: goal, model, tracks that felt misplaced, and an overall rating from 1 to 5. Ideally two or more teammates rate on their own, without seeing the other's ratings.
5. **Look at disagreements.** List songs whose two estimates are far apart on the mood grid and listen to a sample. Whichever model places them better is evidence for that model. These songs are also candidates for the planned disagreement flag, which would keep uncertain songs out of the first and last positions.
6. **Optional outside check.** Moodify's 1,200 playlist-labeled songs (sad, happy, energetic, calm) give a second set of labels besides MuSe. Do "calm" songs get lower arousal than "energetic" ones, and "sad" songs lower valence than "happy" ones, under each model?

**Deciding.** Keep the rules unless the learned model is clearly preferred in the listening check, not just closer to MuSe. Then remove the toggle before the pilot (FR-6), so testers can't see or change it. The pilot comparing ordered and shuffled playlists remains the real test of whether the ordering helps.

## 8. Known limitations and open decisions

- **Lyrics may deserve more weight when they're sad.** Ali & Peynircioğlu (2006) also found that lyrics *strengthened* sad and angry emotions but *weakened* happy and calm ones. Muiso currently weights positive and negative lyrics equally. Giving negative lyrics more weight is a one-line change in `src/tmr/mood.py`. A 2024 replication (Ma et al., *Musicae Scientiae*) retested this, and its results are worth checking before deciding.
- **The classifier wasn't trained on lyrics** (section 3), so irony, metaphor and storytelling may be misread. A happy-sounding breakup song can read as "joy".
- **Sadness is mapped to low arousal**, so sad lyrics always pull arousal down slightly. That fits wistful songs but not anguished or furious ones. Lyrics that read as anger push arousal up instead.
- **Genius coverage is uneven.** Niche, older and non-English songs are found less often, and their estimates rely on audio alone.
- **MuSe is the only check.** MuSe labels describe how Last.fm users tag songs, not how songs affect listeners (Akiki & Burghardt, 2021). The pilot comparing ordered and shuffled playlists (FR-6) is the real test.

---

## References

- Akiki, C., & Burghardt, M. (2021). MuSe: The Musical Sentiment Dataset. *Journal of Open Humanities Data, 7.* https://doi.org/10.5334/johd.33
- Ali, S. O., & Peynircioğlu, Z. F. (2006). Songs and emotions: Are lyrics and melodies equal partners? *Psychology of Music, 34*(4), 511–534. https://doi.org/10.1177/0305735606067168
- Ekman, P. (1992). An argument for basic emotions. *Cognition and Emotion, 6*(3–4), 169–200.
- Hartmann, J. (2022). *Emotion English DistilRoBERTa-base* [model]. Hugging Face. https://huggingface.co/j-hartmann/emotion-english-distilroberta-base
- Hu, X., & Downie, J. S. (2010). When lyrics outperform audio for music mood classification: A feature analysis. *Proceedings of the 11th International Society for Music Information Retrieval Conference (ISMIR)*, 619–624. https://dblp.uni-trier.de/rec/conf/ismir/HuD10.html
- Liu, Y., et al. (2019). RoBERTa: A robustly optimized BERT pretraining approach. arXiv:1907.11692.
- Ma, et al. (2024). Lyrics and melodies: Do both affect emotions equally? A replication and extension of Ali and Peynircioğlu (2006). *Musicae Scientiae.* https://repository.lsu.edu/psychology_pubs/2339
- Multi-modality in music: Predicting emotion in music from high-level audio features and lyrics (2023). arXiv:2302.13321. https://arxiv.org/abs/2302.13321
- Russell, J. A. (1980). A circumplex model of affect. *Journal of Personality and Social Psychology, 39*(6), 1161–1178.
- Sanh, V., Debut, L., Chaumond, J., & Wolf, T. (2019). DistilBERT, a distilled version of BERT: smaller, faster, cheaper and lighter. arXiv:1910.01108.
- Validating Spotify's "Valence", "Energy", and "Danceability" audio features for music psychology research (preprint). PsyArXiv. https://doi.org/10.31234/osf.io/8gfzw
