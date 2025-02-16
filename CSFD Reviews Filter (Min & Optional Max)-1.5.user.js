// ==UserScript==
// @name         CSFD Reviews Filter (Min & Optional Max)
// @namespace    original
// @version      1.5
// @description  Places a floating button on CSFD Žebříčky to filter by a min and optional max number of reviews in one prompt
// @author       MichelFaraday
// @match        https://www.csfd.cz/zebricky/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function initReviewsButton() {
        // If it already exists, skip
        if (document.getElementById('my-reviews-button')) return;

        // 1. Create the floating button
        const filterButton = document.createElement('button');
        filterButton.id = 'my-reviews-button';
        filterButton.textContent = 'Filter by Reviews';

        // 2. Style it - ensure text fits, slightly smaller
        Object.assign(filterButton.style, {
            position: 'fixed',
            bottom: '60px',
            right: '20px',
            zIndex: '999999',
            background: 'linear-gradient(45deg, #ba0305, #ed5e2e)', // red-to-orange gradient
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '0.7rem 1.4rem',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            lineHeight: '0.0',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
            transition: 'transform 0.2s ease, opacity 0.2s ease',
        });

        // 3. Append to body
        document.body.appendChild(filterButton);

        // 4. Optional hover effect
        filterButton.addEventListener('mouseover', () => {
            filterButton.style.opacity = '0.85';
            filterButton.style.transform = 'scale(1.02)';
        });
        filterButton.addEventListener('mouseout', () => {
            filterButton.style.opacity = '1';
            filterButton.style.transform = 'none';
        });

        // 5. On click, prompt user for min & optional max in one window
        filterButton.addEventListener('click', () => {
            // Provide a default of "2000 " to hint a min with blank max
            const userInput = prompt(
                'Enter minimum and maximum # of reviews in one line.\n' +
                'For example: "2000 5000" or just "2000" if no max.\n' +
                'Use "Infinity" for unlimited max.\n\n' +
                'Example:\n' +
                '  "2000 5000" => min 2000, max 5000\n' +
                '  "2000" => min 2000, no maximum\n' +
                '  "2000 Infinity" => min 2000, unlimited max',
                '2000 '
            );
            if (userInput === null) return; // cancelled

            const parts = userInput
                .split(/\s+/)
                .map(str => str.trim())
                .filter(Boolean);

            if (parts.length < 1) {
                alert('No valid input given. Please try again.');
                return;
            }

            // Parse min
            const minStr = parts[0];
            const thresholdMin = parseInt(minStr, 10);
            if (isNaN(thresholdMin)) {
                alert('Invalid minimum number. Please try again.');
                return;
            }

            // Parse max if provided
            let thresholdMax = Infinity;
            if (parts.length > 1) {
                const maxStr = parts[1];
                if (maxStr.toLowerCase() !== 'infinity') {
                    thresholdMax = parseInt(maxStr, 10);
                    if (isNaN(thresholdMax)) {
                        alert('Invalid maximum number. Please try again.');
                        return;
                    }
                }
            }

            // Filter articles based on min & (optional) max
            const articles = document.querySelectorAll('.article.article-poster-60');
            articles.forEach(article => {
                const ratingTotalEl = article.querySelector('.rating-total');
                if (ratingTotalEl) {
                    // e.g. "10 439 hodnocení" -> match "10 439" -> parse 10439
                    const match = ratingTotalEl.innerText.match(/(\d[\d\s]*)/);
                    if (match) {
                        const numValue = parseInt(match[1].replace(/\s/g, ''), 10);
                        // Hide if below min or above max
                        if (numValue < thresholdMin || numValue > thresholdMax) {
                            article.style.display = 'none';
                        } else {
                            article.style.display = '';
                        }
                    }
                }
            });
        });
    }

    // After DOMContentLoaded, wait a bit, then init
    window.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            initReviewsButton();
        }, 1000);
    });

    // Watch for dynamic DOM changes (e.g., infinite scrolling or lazy loads)
    const observer = new MutationObserver(() => {
        if (!document.getElementById('my-reviews-button')) {
            initReviewsButton();
        }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
})();
