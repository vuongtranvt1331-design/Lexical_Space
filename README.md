# Lexical Space (LS)

Interactive Vocabulary Learning Space featuring IndexedDB local-first storage, Firebase real-time sync, and seamless two-way integration with the ArcadeCenter arcade game hub.

## 🚀 Live Production URL
- **Production URL:** [https://vuongtranvt1331-design.github.io/Lexical_Space/](https://vuongtranvt1331-design.github.io/Lexical_Space/)

## 🎮 ArcadeCenter Ecosystem
- **Arcadehub / GameHub:** [https://vuongtranvt1331-design.github.io/Arcadehub/](https://vuongtranvt1331-design.github.io/Arcadehub/)
- **Quick Drawn:** [https://vuongtranvt1331-design.github.io/QuickDrawn/](https://vuongtranvt1331-design.github.io/QuickDrawn/)
- **Poker:** [https://vuongtranvt1331-design.github.io/Poker/](https://vuongtranvt1331-design.github.io/Poker/)

## 🔗 Architecture & Navigation
- **Local-First Storage:** IndexedDB `LexicalSpaceDB` (object store `words`) is shared directly across all applications within the single browser origin `https://vuongtranvt1331-design.github.io`.
- **Two-Way Navigation:** Seamlessly navigate to ArcadeSpace from the navigation drawer, and return with a single click via `← Back to Lexical Space`.
- **Single-Origin Cross-App Synergy:** Mini-games instantly read personal vocabulary cards without querying Firebase or requiring extra network requests.
