# Wild West Poker — 4-Card Synonym Poker

A retro Western casino vocabulary card game designed for **Lexical Space (LS)** and **Arcadehub**, operating entirely **local-first using browser IndexedDB**.

## 🎮 Production URL
👉 **Play Online:** [https://vuongtranvt1331-design.github.io/Poker/](https://vuongtranvt1331-design.github.io/Poker/)

## 🃏 Features
- **Local-First IndexedDB Retrieval:** Reads student vocabulary directly from browser `LexicalSpaceDB` (`words` store). Zero external API/Firebase calls at runtime.
- **4-Card Synonym Poker:** The dealer chooses a random unmatched word. Pick its synonym from your hand. A correct pair turns face down after its meaning is shown.
- **Saloon Casino Gameplay:** Choose **Enter the Casino** to deal the first hand. Start with 5 chips and reach 12 to win. Each wrong match costs 2 chips and ends the game if the balance reaches zero. Hint and Reshuffle also cost 2 chips. Spending the final 2 chips on either assist keeps the hand in play.
- **Arcadehub Integration:** Supports URL query parameters (`user`, `mode`, `topic`, `returnUrl`) and seamless return navigation.

## 🛠️ Tech Stack
- Vanilla HTML5 / JavaScript
- Tailwind CSS CDN
- Web Audio API (Synthesized saloon sound effects)
- Native Browser IndexedDB API
