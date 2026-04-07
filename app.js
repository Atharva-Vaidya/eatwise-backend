document.addEventListener('DOMContentLoaded', () => {

    // ─── Application State ─────────────────────────────────────
    const appState = {
        meal_input: '',
        user_id: '',
        api_response: null,
        insights_response: null,
        loading: false,
        error_message: '',
    };

    // ─── User ID: Generate Once, Persist Forever ───────────────
    const initUserId = () => {
        const stored = localStorage.getItem('eatwise_user_id');
        if (stored) {
            appState.user_id = stored;
        } else {
            appState.user_id = crypto.randomUUID();
            localStorage.setItem('eatwise_user_id', appState.user_id);
        }
        console.log('[EatWise] User ID:', appState.user_id);
    };

    initUserId();

    // ─── DOM References ────────────────────────────────────────
    const mealInput = document.getElementById('mealInput');
    const mealQuantity = document.getElementById('mealQuantity');
    const mealTiming = document.getElementById('mealTiming');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const insightsBtn = document.getElementById('insightsBtn');
    const chips = document.querySelectorAll('.chip');

    const emptyState = document.getElementById('emptyState');
    const resultCard = document.getElementById('resultCard');
    const insightsSection = document.getElementById('insightsSection');
    const errorBanner = document.getElementById('errorBanner');
    const errorText = document.getElementById('errorText');

    const healthScoreEl = document.getElementById('healthScore');
    const scoreRingProgress = document.getElementById('scoreRingProgress');
    const scoreLabelEl = document.getElementById('scoreLabel');
    const statusBadge = document.getElementById('statusBadge');
    const mealNameEl = document.getElementById('mealName');
    const caloriesEl = document.getElementById('calories');
    const proteinEl = document.getElementById('protein');
    const carbsEl = document.getElementById('carbs');
    const fatEl = document.getElementById('fat');
    const tipTextEl = document.getElementById('tipText');

    // Insights DOM
    const insightsSummaryEl = document.getElementById('insightsSummary');
    const suggestionsGridEl = document.getElementById('suggestionsGrid');
    const streakDaysEl = document.getElementById('streakDays');
    const insightsMessageEl = document.getElementById('insightsMessage');
    const insightsMessageTextEl = document.getElementById('insightsMessageText');

    // ─── Render: Sync UI to State ──────────────────────────────
    const render = () => {
        // --- Error banner ---
        if (appState.error_message) {
            errorText.innerText = appState.error_message;
            errorBanner.classList.remove('hidden');
        } else {
            errorBanner.classList.add('hidden');
        }

        // --- Loading state ---
        if (appState.loading) {
            analyzeBtn.disabled = true;
            analyzeBtn.innerHTML = `<i class='bx bx-loader-alt spin'></i> Processing...`;
            if (insightsBtn) {
                insightsBtn.disabled = true;
            }
            return;
        }

        // --- Restore buttons ---
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = `Analyze <i class='bx bx-right-arrow-alt'></i>`;
        if (insightsBtn) {
            insightsBtn.disabled = false;
        }

        // --- Result state ---
        if (appState.api_response) {
            const data = appState.api_response;

            mealNameEl.innerText = data.meal || data.meal_name || 'Analyzed Meal';
            caloriesEl.innerText = data.calories ?? '—';
            proteinEl.innerText = (data.protein_g ?? '—') + 'g';
            carbsEl.innerText = (data.carbs_g ?? '—') + 'g';
            fatEl.innerText = (data.fat_g ?? '—') + 'g';
            tipTextEl.innerText = data.tip || 'No additional insights.';

            updateMiniBar('protein', data.protein_g, 50);
            updateMiniBar('carbs', data.carbs_g, 300);
            updateMiniBar('fat', data.fat_g, 65);

            emptyState.classList.add('hidden');
            resultCard.classList.remove('hidden');
            insightsSection.classList.add('hidden');

            const score = data.health_score ?? 0;
            applyScoreVisuals(score);
            animateScoreCounter(score);
        } else if (appState.insights_response) {
            // Show insights, hide result
            emptyState.classList.add('hidden');
            resultCard.classList.add('hidden');
            insightsSection.classList.remove('hidden');
            renderInsights(appState.insights_response);
        } else {
            resultCard.classList.add('hidden');
            insightsSection.classList.add('hidden');
            emptyState.classList.remove('hidden');
        }
    };

    // ─── Helpers ────────────────────────────────────────────────
    const applyScoreVisuals = (score) => {
        healthScoreEl.classList.remove('text-green', 'text-yellow', 'text-red');
        scoreRingProgress.classList.remove('stroke-green', 'stroke-yellow', 'stroke-red');
        statusBadge.className = 'status-badge';
        scoreLabelEl.className = 'score-label';

        let color, statusText, labelText;
        if (score > 70) {
            color = 'green';
            statusText = 'Optimized';
            labelText = 'Healthy';
        } else if (score >= 40) {
            color = 'yellow';
            statusText = 'Moderate';
            labelText = 'Moderate';
        } else {
            color = 'red';
            statusText = 'Needs Improvement';
            labelText = 'Needs Improvement';
        }

        healthScoreEl.classList.add(`text-${color}`);
        scoreRingProgress.classList.add(`stroke-${color}`);
        statusBadge.classList.add(`bg-${color}-light`, `text-${color}`);
        statusBadge.innerText = statusText;
        scoreLabelEl.classList.add(`bg-${color}-light`, `text-${color}`);
        scoreLabelEl.innerText = labelText;

        // circumference = 2 * π * 80 ≈ 502.65
        const circumference = 502.65;
        const offset = circumference - (score / 100) * circumference;
        scoreRingProgress.style.strokeDashoffset = circumference;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                scoreRingProgress.style.strokeDashoffset = offset;
            });
        });
    };

    const animateScoreCounter = (target) => {
        let current = 0;
        healthScoreEl.innerText = current;
        const interval = setInterval(() => {
            if (current >= target) {
                clearInterval(interval);
                healthScoreEl.innerText = target;
            } else {
                current++;
                healthScoreEl.innerText = current;
            }
        }, 10);
    };

    const updateMiniBar = (macroId, value, dailyTarget) => {
        const el = document.getElementById(macroId);
        if (!el) return;
        const card = el.closest('.macro-box');
        if (!card) return;
        const fill = card.querySelector('.mini-fill');
        if (!fill) return;
        const pct = Math.min(100, Math.round(((value || 0) / dailyTarget) * 100));
        fill.style.width = pct + '%';
    };

    const renderInsights = (data) => {
        // If the API returned a message (e.g. "not enough data"), show it
        if (data.message) {
            insightsSummaryEl.classList.add('hidden');
            suggestionsGridEl.classList.add('hidden');
            insightsMessageEl.classList.remove('hidden');
            insightsMessageTextEl.innerText = data.message;
            streakDaysEl.innerText = data.streak_days ?? 0;
            return;
        }

        // Normal insights
        insightsSummaryEl.classList.remove('hidden');
        suggestionsGridEl.classList.remove('hidden');
        insightsMessageEl.classList.add('hidden');

        insightsSummaryEl.innerText = data.summary || 'No summary available.';
        streakDaysEl.innerText = data.streak_days ?? 0;

        // Build suggestion cards
        suggestionsGridEl.innerHTML = '';
        const suggestions = data.suggestions || [];
        suggestions.forEach((s, i) => {
            const icons = ['bx-water', 'bx-moon', 'bx-leaf'];
            const card = document.createElement('div');
            card.className = 'suggestion-card';
            card.innerHTML = `
                <h4><i class='bx ${icons[i % icons.length]} text-primary'></i> ${s.title || 'Suggestion'}</h4>
                <p>${s.body || s}</p>
            `;
            suggestionsGridEl.appendChild(card);
        });
    };

    // ─── Actions ───────────────────────────────────────────────
    const analyzeMeal = async () => {
        appState.meal_input = mealInput.value.trim();

        if (!appState.meal_input) {
            appState.error_message = 'Please enter a meal';
            appState.api_response = null;
            render();
            return;
        }

        appState.error_message = '';
        appState.loading = true;
        appState.api_response = null;
        appState.insights_response = null;
        render();

        try {
            const res = await fetch('https://YOUR_CLOUD_RUN_URL/api/log-meal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: appState.meal_input,
                    quantity: parseFloat(mealQuantity.value) || 1,
                    timing: mealTiming.value,
                    user_id: appState.user_id,
                }),
            });

            if (!res.ok) {
                if (res.status === 429) {
                    throw new Error('Please wait a few seconds before trying again.');
                }
                throw new Error('Something went wrong. Please try again.');
            }

            const data = await res.json();
            appState.api_response = data;
        } catch (err) {
            appState.error_message = err.message || 'Something went wrong';
        } finally {
            appState.loading = false;
            render();
        }
    };

    const fetchInsights = async () => {
        appState.error_message = '';
        appState.loading = true;
        appState.api_response = null;
        appState.insights_response = null;
        render();

        try {
            const res = await fetch(`https://YOUR_CLOUD_RUN_URL/api/insights?user_id=${encodeURIComponent(appState.user_id)}`);

            if (!res.ok) {
                if (res.status === 429) {
                    throw new Error('Please wait a few seconds before trying again.');
                }
                throw new Error('Something went wrong. Please try again.');
            }

            const data = await res.json();
            appState.insights_response = data;
        } catch (err) {
            appState.error_message = err.message || 'Something went wrong';
        } finally {
            appState.loading = false;
            render();
        }
    };

    // ─── Event Listeners ───────────────────────────────────────
    analyzeBtn.addEventListener('click', analyzeMeal);

    if (insightsBtn) {
        insightsBtn.addEventListener('click', fetchInsights);
    }

    mealInput.addEventListener('input', () => {
        appState.meal_input = mealInput.value;
        if (appState.error_message) {
            appState.error_message = '';
            render();
        }
    });

    mealInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            analyzeMeal();
        }
    });

    chips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            const text = e.currentTarget.dataset.meal;
            mealInput.value = text;
            mealQuantity.value = "1"; // Default quick meals to 1 serving
            appState.meal_input = text;
            analyzeMeal();
        });
    });

    // Initial render
    render();
});
