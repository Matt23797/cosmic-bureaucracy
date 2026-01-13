/**
 * Shared utility functions for the Cosmic Bureaucracy engine and UI.
 */
export const Utils = {
    /**
     * Formats numbers for UI display.
     * Uses locale strings for small numbers, 'k' for thousands, and scientific notation for millions+.
     * @param {number} num - The number to format
     * @returns {string} Formatted string
     */
    formatNumber(num) {
        if (num === undefined || num === null || isNaN(num)) return '0';
        if (num === 0) return '0';

        if (num < 0) return '-' + this.formatNumber(Math.abs(num));
        if (num < 1 && num > 0) return num.toFixed(2);
        if (num < 1000) return Math.floor(num).toString();

        const suffixes = [
            '', 'k', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
            'Ud', 'Dd', 'Td', 'Qad', 'Qid', 'Sxd', 'Spd', 'Ocd', 'Nod', 'Vg'
        ];

        const suffixNum = Math.floor(Math.log10(num) / 3);

        if (suffixNum < suffixes.length) {
            const shortValue = num / Math.pow(10, suffixNum * 3);
            return shortValue.toFixed(suffixNum === 0 ? 0 : 2).replace(/\.00$/, '') + suffixes[suffixNum];
        }

        return num.toExponential(2).replace('+', '');
    }
};
