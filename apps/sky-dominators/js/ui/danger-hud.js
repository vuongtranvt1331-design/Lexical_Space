/* js/ui/danger-hud.js — ordered classic script; entrypoints declare dependency order. */
let lastDangerTargetWord = "";

function updateDangerHUDDisplay() {
    if (bossEncounter?.blocksRegular) return;
    const dangerTargetElem = document.getElementById('dangerTargetWordText');
    const dangerDisplayElem = document.getElementById('dangerTargetDisplay');
    const dangerMeaningElem = document.getElementById('dangerMeaningText');
    if (!dangerTargetElem || !missionManager.currentWord) return;

    const wordUpper = missionManager.currentWord.toUpperCase();
    dangerTargetElem.textContent = wordUpper;
    if (dangerMeaningElem) {
        dangerMeaningElem.textContent = ""; // User: only target word needed, no meaning
    }

    // Subtle flash exactly twice only when a genuinely new target word arrives
    if (wordUpper !== lastDangerTargetWord) {
        lastDangerTargetWord = wordUpper;
        if (dangerDisplayElem) {
            dangerDisplayElem.classList.remove('danger-double-flash');
            void dangerDisplayElem.offsetWidth;
            dangerDisplayElem.classList.add('danger-double-flash');
            dangerDisplayElem.addEventListener('animationend', () => {
                dangerDisplayElem.classList.remove('danger-double-flash');
            }, { once: true });
        }
    }

    // Stable font fitting inside the dedicated display area of panel_danger frame
    const container = dangerTargetElem.parentElement;
    const maxW = container ? Math.max(container.clientWidth - 8, 160) : 190;
    let currentSize = 13;
    dangerTargetElem.style.fontSize = `${currentSize}px`;

    while (dangerTargetElem.scrollWidth > maxW && currentSize > 7) {
        currentSize -= 0.5;
        dangerTargetElem.style.fontSize = `${currentSize}px`;
    }
}
