# Wild West Poker — 4-Card Synonym Poker

A retro Western casino vocabulary card game designed for **Lexical Space (LS)** and **Arcadehub**, operating entirely **local-first using browser IndexedDB**.

## 🎮 Production URL
👉 **Play Online:** [https://vuongtranvt1331-design.github.io/Poker/](https://vuongtranvt1331-design.github.io/Poker/)

## 🃏 Features
- **Local-First IndexedDB Retrieval:** Reads student vocabulary directly from browser `LexicalSpaceDB` (`words` store). Zero external API/Firebase calls at runtime.
- **4-Card Synonym Poker:** Match synonym pairs to form winning poker hands.
- **Saloon Casino Gameplay:** Start with 5 chips and aim for 10 chips to break the house.
- **Arcadehub Integration:** Supports URL query parameters (`user`, `mode`, `topic`, `returnUrl`) and seamless return navigation.

## 🛠️ Tech Stack
- Vanilla HTML5 / JavaScript
- Tailwind CSS CDN
- Web Audio API (Synthesized saloon sound effects)
- Native Browser IndexedDB API
