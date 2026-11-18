/**
 * SpaceSuite shared effects volume calibration.
 * Default visible Hub volume 50% (=0.10 actual effects master), slider 100% (=0.20).
 * Preserves speech, pronunciation, and Quick Ears lesson audio untouched.
 */
(function(window) {
    'use strict';

    var _nodes = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
    var MAX_MASTER_GAIN = 0.20;

    function getHubSetting() {
        try {
            var muted = localStorage.getItem('arcade_sound_muted') === 'true';
            var raw = localStorage.getItem('arcade_sound_volume');
            var val = parseInt(raw, 10);
            if (isNaN(val) || val < 0 || val > 100) {
                val = 50;
            }
            return { muted: muted, volume: val };
        } catch (e) {
            return { muted: false, volume: 50 };
        }
    }

    var SpaceEffects = {
        /**
         * Returns calibrated gain multiplier (0..0.20 max).
         * @param {number} [level] Optional level in range 0..1.
         * If omitted, reads localStorage arcade_sound_volume (0..100, default 50) and honors arcade_sound_muted.
         */
        gain: function(level) {
            if (typeof level === 'number' && !isNaN(level)) {
                var clamped = Math.max(0, Math.min(1, level));
                return clamped * MAX_MASTER_GAIN;
            }
            var setting = getHubSetting();
            if (setting.muted) {
                return 0;
            }
            return (setting.volume / 100) * MAX_MASTER_GAIN;
        },

        /**
         * Stable per-AudioContext GainNode routing to ctx.destination.
         * Gain value is refreshed from SpaceEffects.gain() on each call.
         * @param {AudioContext} ctx
         * @returns {GainNode}
         */
        output: function(ctx) {
            if (!ctx) return null;
            var node = _nodes ? _nodes.get(ctx) : ctx.__spaceEffectsNode;
            if (!node) {
                node = ctx.createGain();
                node.connect(ctx.destination);
                if (_nodes) {
                    _nodes.set(ctx, node);
                } else {
                    ctx.__spaceEffectsNode = node;
                }
            }
            var currentGain = SpaceEffects.gain();
            if (node.gain && typeof node.gain.setValueAtTime === 'function') {
                node.gain.setValueAtTime(currentGain, ctx.currentTime || 0);
            } else if (node.gain) {
                node.gain.value = currentGain;
            }
            return node;
        }
    };

    window.SpaceEffects = SpaceEffects;
})(typeof window !== 'undefined' ? window : this);
