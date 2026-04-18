(function () {
    const app = window.LuxeStayApp;

    if (!app) {
        return;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(Number(amount || 0));
    }

    function formatCompactCurrency(amount) {
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            maximumFractionDigits: 0,
        }).format(Number(amount || 0));
    }

    function parseTransactionDate(value) {
        const normalized = String(value || "").trim().replace(" ", "T");
        const date = normalized ? new Date(normalized) : new Date(NaN);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function getQuarter(date) {
        return Math.floor(date.getMonth() / 3) + 1;
    }

    function formatPeriodLabel(filter, date) {
        if (filter === "daily") {
            return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        }
        if (filter === "monthly") {
            return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
        }
        if (filter === "quarterly") {
            return `Q${getQuarter(date)} ${date.getFullYear()}`;
        }
        return String(date.getFullYear());
    }

    function getPeriodKey(filter, date) {
        if (filter === "daily") {
            return date.toISOString().slice(0, 10);
        }
        if (filter === "monthly") {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        }
        if (filter === "quarterly") {
            return `${date.getFullYear()}-Q${getQuarter(date)}`;
        }
        return String(date.getFullYear());
    }

    function collectRevenueMetrics(transactions, filter = "monthly") {
        const parsedTransactions = transactions
            .map((transaction) => {
                const date = parseTransactionDate(transaction.timestamp);
                return date ? {
                    ...transaction,
                    __date: date,
                    __amount: Number(transaction.amount || 0),
                } : null;
            })
            .filter(Boolean)
            .sort((a, b) => b.__date - a.__date);

        const now = parsedTransactions[0]?.__date || new Date();
        const filtered = parsedTransactions.filter((transaction) => {
            const date = transaction.__date;
            if (filter === "__all__") {
                return true;
            }
            if (filter === "daily") {
                return date.getFullYear() === now.getFullYear()
                    && date.getMonth() === now.getMonth()
                    && date.getDate() === now.getDate();
            }
            if (filter === "monthly") {
                return date.getFullYear() === now.getFullYear()
                    && date.getMonth() === now.getMonth();
            }
            if (filter === "quarterly") {
                return date.getFullYear() === now.getFullYear()
                    && getQuarter(date) === getQuarter(now);
            }
            return date.getFullYear() === now.getFullYear();
        });

        const trendMap = new Map();
        parsedTransactions.forEach((transaction) => {
            const key = getPeriodKey(filter, transaction.__date);
            const current = trendMap.get(key) || {
                label: formatPeriodLabel(filter, transaction.__date),
                total: 0,
                count: 0,
            };
            current.total += transaction.__amount;
            current.count += 1;
            trendMap.set(key, current);
        });

        const trend = Array.from(trendMap.values())
            .sort((a, b) => a.label.localeCompare(b.label))
            .slice(-8);

        const byStatus = parsedTransactions.reduce((acc, transaction) => {
            const key = transaction.status || "Unknown";
            acc[key] = (acc[key] || 0) + transaction.__amount;
            return acc;
        }, {});

        const byHotel = parsedTransactions.reduce((acc, transaction) => {
            const key = transaction.hotel_name || "Unknown Hotel";
            acc[key] = (acc[key] || 0) + transaction.__amount;
            return acc;
        }, {});

        const byPayment = parsedTransactions.reduce((acc, transaction) => {
            const raw = transaction.payment_type || "Unspecified";
            const key = raw.split(" - ")[0];
            acc[key] = (acc[key] || 0) + transaction.__amount;
            return acc;
        }, {});

        const bySource = parsedTransactions.reduce((acc, transaction) => {
            const key = transaction.source || "Unknown";
            acc[key] = (acc[key] || 0) + transaction.__amount;
            return acc;
        }, {});

        const byDay = parsedTransactions.reduce((acc, transaction) => {
            const key = getPeriodKey("daily", transaction.__date);
            acc[key] = (acc[key] || 0) + transaction.__amount;
            return acc;
        }, {});

        const bestDayEntry = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0] || null;
        const bestDayDate = bestDayEntry ? new Date(`${bestDayEntry[0]}T00:00:00`) : null;

        return {
            now,
            filtered,
            total: filtered.reduce((sum, transaction) => sum + transaction.__amount, 0),
            count: filtered.length,
            average: filtered.length ? filtered.reduce((sum, transaction) => sum + transaction.__amount, 0) / filtered.length : 0,
            trend,
            byStatus,
            byHotel,
            byPayment,
            bySource,
            bestDayLabel: bestDayDate ? bestDayDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A",
            bestDayValue: bestDayEntry ? bestDayEntry[1] : 0,
            completedTotal: parsedTransactions.filter((item) => item.status === "Completed").reduce((sum, item) => sum + item.__amount, 0),
            reservedTotal: parsedTransactions.filter((item) => item.status === "Reserved").reduce((sum, item) => sum + item.__amount, 0),
            cancelledTotal: parsedTransactions.filter((item) => item.status === "Cancelled").reduce((sum, item) => sum + item.__amount, 0),
            adminTotal: parsedTransactions.filter((item) => item.source === "Admin Control").reduce((sum, item) => sum + item.__amount, 0),
            topTransactions: parsedTransactions.slice().sort((a, b) => b.__amount - a.__amount).slice(0, 8),
        };
    }

    function collectPortfolioMetrics(transactions) {
        return collectRevenueMetrics(transactions, "__all__");
    }

    function getPage() {
        return document.body?.dataset.page || "";
    }

    function renderFlash(container, flash) {
        if (!container) {
            return;
        }

        if (!flash?.text) {
            container.innerHTML = "";
            return;
        }

        const isError = flash.type === "error";
        container.innerHTML = `
            <div class="${isError
                ? "rounded-[22px] border border-[#b4534c]/20 bg-[#fff3f1] px-5 py-4 text-sm text-[#8d4038]"
                : "rounded-[22px] border border-[#227a52]/20 bg-[#eef8f2] px-5 py-4 text-sm text-[#1f6a47]"}">
                ${escapeHtml(flash.text)}
            </div>
        `;
    }

    function logoutUser(event = null) {
        if (event) {
            event.preventDefault();
        }
        app.logout("index.html");
        return false;
    }

    function guardProtectedPage() {
        const page = getPage();

        if (["admin", "employees", "transactions", "revenue"].includes(page)) {
            app.requireAdmin();
        }

        if (["rewards", "my-unit"].includes(page)) {
            app.requireLogin();
        }
    }

    function renderHomeShell() {
        const sessionControls = document.getElementById("home-session-controls");
        const dashboardLink = document.getElementById("home-admin-link");
        const loyaltyStat = document.getElementById("home-loyalty-stat");
        const statePromise = app.loadState();

        if (!sessionControls) {
            return;
        }

        statePromise.then((state) => {
            const session = app.getSession();
            const username = session.user || "";
            const points = username ? app.getUserPoints(state, username) : 0;
            const tier = username ? (state.loyalty_accounts[username]?.tier || "Classic") : "Guest";

            if (dashboardLink) {
                dashboardLink.classList.toggle("hidden", session.role !== "admin");
            }

            if (loyaltyStat) {
                loyaltyStat.textContent = String(points);
            }

            if (!username) {
                sessionControls.innerHTML = `
                    <a href="login.html" class="btn-secondary">Sign In</a>
                    <a href="signup.html" class="btn-gold">Join LuxeStay</a>
                `;
                return;
            }

            sessionControls.innerHTML = `
                <div class="relative z-[70]">
                    <button id="member-menu-toggle" type="button" class="rounded-full border border-black/5 bg-white/80 px-4 py-2 text-right">
                        <p class="text-[0.62rem] font-extrabold uppercase tracking-[0.28em] text-gray-400">Member Active</p>
                        <p class="text-sm font-semibold text-[#171717]">Welcome back, <span class="gold-text">${escapeHtml(username.toUpperCase())}</span></p>
                    </button>
                    <div id="member-menu" class="absolute right-0 top-[calc(100%+0.65rem)] z-[60] hidden min-w-[220px] rounded-[24px] border border-[rgba(212,175,55,0.18)] bg-[#fcfbf8] p-3 shadow-2xl">
                        <a href="my-unit.html" class="block rounded-[18px] px-4 py-3 text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-gray-500 transition hover:bg-[#faf7ef] hover:text-[#171717]">My Unit</a>
                        <a href="rewards.html" class="block rounded-[18px] px-4 py-3 text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-gray-500 transition hover:bg-[#faf7ef] hover:text-[#171717]">Reward Redemption</a>
                        <a href="login.html" class="mt-1 block rounded-[18px] px-4 py-3 text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-gray-500 transition hover:bg-[#faf7ef] hover:text-[#171717]">Switch Account</a>
                        <a href="#" data-logout="true" onclick="return logoutUser(event)" class="mt-1 block rounded-[18px] px-4 py-3 text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-gray-500 transition hover:bg-[#faf7ef] hover:text-[#171717]">Logout</a>
                    </div>
                </div>
                <div class="rounded-full border border-[rgba(212,175,55,0.24)] bg-[#faf7ef] px-4 py-2 text-right">
                    <p class="text-[0.62rem] font-extrabold uppercase tracking-[0.28em] text-gray-400">Loyalty Points</p>
                    <p class="text-sm font-semibold text-[#171717]">${escapeHtml(String(points))} pts · <span class="gold-text">${escapeHtml(tier)}</span></p>
                </div>
            `;
        });
    }

    async function renderAdminRevenueTeaser() {
        const page = getPage();
        if (page !== "admin") {
            return;
        }

        const revenueNode = document.getElementById("admin-live-revenue");
        if (!revenueNode) {
            return;
        }

        const state = await app.loadState();
        const metrics = collectRevenueMetrics(state.transactions, "yearly");
        revenueNode.textContent = formatCompactCurrency(metrics.total);
    }

    function renderMetricBlock(node, totalId, metaId, total, count, label) {
        const totalNode = document.getElementById(totalId);
        const metaNode = document.getElementById(metaId);

        if (totalNode) {
            totalNode.textContent = formatCurrency(total);
        }
        if (metaNode) {
            metaNode.textContent = `${count} transactions ${label}.`;
        }
    }

    async function renderRevenuePage() {
        const page = getPage();
        if (page !== "revenue") {
            return;
        }

        const state = await app.loadState();
        const metrics = collectPortfolioMetrics(state.transactions);
        const dailyMetrics = collectRevenueMetrics(state.transactions, "daily");
        const monthlyMetrics = collectRevenueMetrics(state.transactions, "monthly");
        const quarterlyMetrics = collectRevenueMetrics(state.transactions, "quarterly");
        const yearlyMetrics = collectRevenueMetrics(state.transactions, "yearly");
        const trendMetrics = monthlyMetrics;
        const maxTrend = Math.max(...trendMetrics.trend.map((item) => item.total), 1);

        const selectedTotal = document.getElementById("revenue-selected-total");
        const selectedCopy = document.getElementById("revenue-selected-copy");
        const selectedBookings = document.getElementById("revenue-selected-bookings");
        const selectedAverage = document.getElementById("revenue-selected-average");
        const bestDay = document.getElementById("revenue-best-day");
        const bestDayCopy = document.getElementById("revenue-best-day-copy");
        const trendTitle = document.getElementById("revenue-trend-title");
        const trendCaption = document.getElementById("revenue-trend-caption");
        const trendBars = document.getElementById("revenue-trend-bars");
        const hotelsNode = document.getElementById("revenue-hotels");
        const paymentNode = document.getElementById("revenue-payment-mix");
        const sourceNode = document.getElementById("revenue-source-mix");
        const topTransactionsNode = document.getElementById("revenue-top-transactions");
        const statusBreakdownNode = document.getElementById("revenue-status-breakdown");

        if (selectedTotal) {
            selectedTotal.textContent = formatCurrency(metrics.total);
        }
        if (selectedCopy) {
            selectedCopy.textContent = "Portfolio-wide lifetime revenue snapshot across all recorded transactions.";
        }
        if (selectedBookings) {
            selectedBookings.textContent = String(metrics.count);
        }
        if (selectedAverage) {
            selectedAverage.textContent = formatCurrency(metrics.average);
        }
        if (bestDay) {
            bestDay.textContent = metrics.bestDayLabel === "N/A" ? "N/A" : metrics.bestDayLabel.replace(",", "");
        }
        if (bestDayCopy) {
            bestDayCopy.textContent = metrics.bestDayValue ? `${formatCurrency(metrics.bestDayValue)} generated on the strongest day.` : "No transaction activity yet.";
        }
        if (trendTitle) {
            trendTitle.textContent = "Monthly revenue trend";
        }
        if (trendCaption) {
            trendCaption.textContent = "Reading the latest monthly revenue rhythm";
        }

        renderMetricBlock(document, "revenue-daily-total", "revenue-daily-meta", dailyMetrics.total, dailyMetrics.count, "today");
        renderMetricBlock(document, "revenue-monthly-total", "revenue-monthly-meta", monthlyMetrics.total, monthlyMetrics.count, "this month");
        renderMetricBlock(document, "revenue-quarterly-total", "revenue-quarterly-meta", quarterlyMetrics.total, quarterlyMetrics.count, "this quarter");
        renderMetricBlock(document, "revenue-yearly-total", "revenue-yearly-meta", yearlyMetrics.total, yearlyMetrics.count, "this year");

        const completedNode = document.getElementById("revenue-completed-total");
        const reservedNode = document.getElementById("revenue-reserved-total");
        const cancelledNode = document.getElementById("revenue-cancelled-total");
        const adminNode = document.getElementById("revenue-admin-total");

        if (completedNode) {
            completedNode.textContent = formatCurrency(metrics.completedTotal);
        }
        if (reservedNode) {
            reservedNode.textContent = formatCurrency(metrics.reservedTotal);
        }
        if (cancelledNode) {
            cancelledNode.textContent = formatCurrency(metrics.cancelledTotal);
        }
        if (adminNode) {
            adminNode.textContent = formatCurrency(metrics.adminTotal);
        }

        if (trendBars) {
            trendBars.innerHTML = trendMetrics.trend.length ? trendMetrics.trend.map((item) => `
                <div class="option-tile p-5">
                    <div class="flex items-center justify-between gap-4">
                        <div>
                            <p class="text-sm font-semibold text-[#171717]">${escapeHtml(item.label)}</p>
                            <p class="mt-1 text-sm text-gray-500">${item.count} transactions</p>
                        </div>
                        <p class="text-sm font-extrabold text-[#171717]">${formatCurrency(item.total)}</p>
                    </div>
                    <div class="mt-4 h-3 overflow-hidden rounded-full bg-black/5">
                        <div class="h-full rounded-full bg-gradient-to-r from-[#d4af37] via-[#e2c869] to-[#171717]" style="width: ${(item.total / maxTrend) * 100}%;"></div>
                    </div>
                </div>
            `).join("") : `<div class="option-tile p-5 text-sm leading-7 text-gray-600">No revenue trend data is available yet.</div>`;
        }

        const buildListMarkup = (entries, formatter) => entries.length
            ? entries.map(([label, value]) => `
                <div class="option-tile p-5">
                    <div class="flex items-center justify-between gap-4">
                        <div>
                            <p class="text-sm font-semibold text-[#171717]">${escapeHtml(label)}</p>
                        </div>
                        <p class="text-sm font-extrabold text-[#171717]">${formatter(value)}</p>
                    </div>
                </div>
            `).join("")
            : `<div class="option-tile p-5 text-sm leading-7 text-gray-600">No revenue data available yet.</div>`;

        if (hotelsNode) {
            hotelsNode.innerHTML = buildListMarkup(
                Object.entries(metrics.byHotel).sort((a, b) => b[1] - a[1]).slice(0, 6),
                (value) => formatCurrency(value)
            );
        }
        if (paymentNode) {
            paymentNode.innerHTML = buildListMarkup(
                Object.entries(metrics.byPayment).sort((a, b) => b[1] - a[1]).slice(0, 6),
                (value) => formatCurrency(value)
            );
        }
        if (sourceNode) {
            sourceNode.innerHTML = buildListMarkup(
                Object.entries(metrics.bySource).sort((a, b) => b[1] - a[1]).slice(0, 6),
                (value) => formatCurrency(value)
            );
        }

        if (topTransactionsNode) {
            topTransactionsNode.innerHTML = metrics.topTransactions.length ? metrics.topTransactions.map((transaction) => `
                <tr>
                    <td>${escapeHtml(transaction.receipt || "Pending")}</td>
                    <td>
                        <div>
                            <p class="font-semibold text-[#171717]">${escapeHtml(transaction.unit_name)}</p>
                            <p class="mt-1 text-sm text-gray-500">${escapeHtml(transaction.hotel_name)}</p>
                        </div>
                    </td>
                    <td><span class="status-pill ${escapeHtml((window.getStatusClass?.(transaction.status) || "available"))}">${escapeHtml(transaction.status)}</span></td>
                    <td>${escapeHtml(transaction.source || "Unknown")}</td>
                    <td>${escapeHtml(transaction.payment_type || "Unknown")}</td>
                    <td>${formatCurrency(transaction.amount)}</td>
                </tr>
            `).join("") : `<tr><td colspan="6" class="text-center text-gray-500">No high value transactions available yet.</td></tr>`;
        }

        if (statusBreakdownNode) {
            statusBreakdownNode.innerHTML = buildListMarkup(
                Object.entries(metrics.byStatus).sort((a, b) => b[1] - a[1]),
                (value) => formatCurrency(value)
            );
        }
    }

    function setupLoginPage() {
        const form = document.getElementById("login-form");
        const errorNode = document.getElementById("auth-error");

        renderFlash(errorNode, app.consumeFlash());

        if (!form) {
            return;
        }

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const formData = new FormData(form);
            const result = await app.login(
                String(formData.get("username") || "").trim(),
                String(formData.get("password") || "")
            );

            if (!result.ok) {
                renderFlash(errorNode, { type: "error", text: result.error });
                return;
            }

            app.navigate("index.html");
        });
    }

    function setupSignupPage() {
        const form = document.getElementById("signup-form");
        const errorNode = document.getElementById("auth-error");

        renderFlash(errorNode, app.consumeFlash());

        if (!form) {
            return;
        }

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const formData = new FormData(form);
            const result = await app.signup(
                String(formData.get("fullname") || "").trim(),
                String(formData.get("username") || "").trim(),
                String(formData.get("password") || "")
            );

            if (!result.ok) {
                renderFlash(errorNode, { type: "error", text: result.error });
                return;
            }

            app.navigate("index.html");
        });
    }

    async function renderRewardsPage(flashOverride = null) {
        const state = await app.loadState();
        const session = app.getSession();
        const username = session.user;
        const loyaltyAccount = app.ensureLoyaltyAccount(state, username);
        app.persistState();

        const pointsPill = document.getElementById("rewards-points-pill");
        const balanceNode = document.getElementById("rewards-balance");
        const flashNode = document.getElementById("rewards-flash");
        const rewardsGrid = document.getElementById("rewards-grid");
        const pointsHistoryNode = document.getElementById("rewards-points-history");
        const rewardHistoryNode = document.getElementById("rewards-redemption-history");
        const pointsHistory = app.getUserPointsHistory(state, username).slice(0, 8);
        const rewardHistory = app.getUserRewardHistory(state, username).slice(0, 8);

        if (pointsPill) {
            pointsPill.innerHTML = `${escapeHtml(String(loyaltyAccount.current_points || 0))} pts · <span class="gold-text">${escapeHtml(loyaltyAccount.tier || "Classic")}</span>`;
        }

        if (balanceNode) {
            balanceNode.textContent = `${escapeHtml(String(loyaltyAccount.current_points || 0))} pts`;
        }

        renderFlash(flashNode, flashOverride || app.consumeFlash());

        if (rewardsGrid) {
            rewardsGrid.innerHTML = state.reward_catalog.map((reward) => {
                const canRedeem = Number(loyaltyAccount.current_points || 0) >= Number(reward.points_cost || 0);
                return `
                    <article class="luxury-card flex h-full flex-col rounded-[30px] p-6">
                        <div class="flex items-start justify-between gap-4">
                            <div>
                                <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Reward Item</p>
                                <h3 class="mt-3 font-display text-3xl font-semibold text-[#171717]">${escapeHtml(reward.name)}</h3>
                            </div>
                            <span class="status-pill peak">${escapeHtml(String(reward.points_cost))} pts</span>
                        </div>
                        <p class="mt-4 text-sm leading-7 text-gray-600">${escapeHtml(reward.description)}</p>
                        <div class="mt-6 flex flex-1 items-end">
                            <button type="button" class="btn-gold w-full min-h-[3.35rem]" data-redeem-reward="${escapeHtml(String(reward.id))}" ${canRedeem ? "" : "disabled"}>
                                ${canRedeem ? "Redeem Now" : "Need More Points"}
                            </button>
                        </div>
                    </article>
                `;
            }).join("");
        }

        if (pointsHistoryNode) {
            pointsHistoryNode.innerHTML = pointsHistory.length
                ? pointsHistory.map((item) => `
                    <div class="option-tile p-5">
                        <div class="flex items-start justify-between gap-4">
                            <div>
                                <p class="text-sm font-semibold text-[#171717]">${escapeHtml(item.description)}</p>
                                <p class="mt-1 text-sm text-gray-500">${escapeHtml(item.timestamp)}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-sm font-extrabold text-[#227a52]">+${escapeHtml(String(item.points))} pts</p>
                                <p class="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Balance ${escapeHtml(String(item.balance_after))}</p>
                            </div>
                        </div>
                    </div>
                `).join("")
                : `<div class="option-tile p-5 text-sm leading-7 text-gray-600">No loyalty activity yet. Complete a booking to start earning points.</div>`;
        }

        if (rewardHistoryNode) {
            rewardHistoryNode.innerHTML = rewardHistory.length
                ? rewardHistory.map((item) => `
                    <div class="option-tile p-5">
                        <div class="flex items-start justify-between gap-4">
                            <div>
                                <p class="text-sm font-semibold text-[#171717]">${escapeHtml(item.reward_name)}</p>
                                <p class="mt-1 text-sm text-gray-500">${escapeHtml(item.timestamp)}</p>
                            </div>
                            <p class="text-sm font-extrabold text-[#b4534c]">-${escapeHtml(String(item.points_cost))} pts</p>
                        </div>
                    </div>
                `).join("")
                : `<div class="option-tile p-5 text-sm leading-7 text-gray-600">No reward redemptions yet. Once you reach at least 5,000 points, you can redeem your first LuxeStay perk here.</div>`;
        }

        rewardsGrid?.querySelectorAll("[data-redeem-reward]").forEach((button) => {
            button.addEventListener("click", async () => {
                const result = await app.redeemReward(button.getAttribute("data-redeem-reward"));
                await renderRewardsPage({
                    type: result.ok ? "success" : "error",
                    text: result.ok ? result.message : result.error,
                });
            });
        });
    }

    async function renderMyUnitPage(flashOverride = null) {
        const state = await app.loadState();
        const session = app.getSession();
        const transaction = app.getLatestUserTransaction(state, session.user);
        const unitState = transaction ? app.buildMyUnitState(transaction) : null;
        const memberNameNode = document.getElementById("my-unit-member-name");
        const flashNode = document.getElementById("my-unit-flash");
        const contentNode = document.getElementById("my-unit-content");

        if (memberNameNode) {
            memberNameNode.textContent = session.user ? session.user.toUpperCase() : "GUEST";
        }

        renderFlash(flashNode, flashOverride || app.consumeFlash());

        if (!contentNode) {
            return;
        }

        if (!transaction || !unitState) {
            contentNode.innerHTML = `
                <section class="section-shell px-6 py-8 sm:px-8 sm:py-10">
                    <span class="eyebrow">My Unit</span>
                    <h1 class="mt-4 font-display text-5xl font-semibold text-[#171717]">No active unit linked yet.</h1>
                    <p class="mt-5 max-w-2xl text-base leading-7 text-gray-600">Once you complete a booking or reservation while signed in, your active rent progress and unit controls will appear here.</p>
                    <div class="mt-8"><a href="index.html#suites" class="btn-gold">Browse Suites</a></div>
                </section>
            `;
            return;
        }

        contentNode.innerHTML = `
            <section class="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
                <div class="section-shell px-6 py-8 sm:px-8 sm:py-10">
                    <span class="eyebrow">Current Stay Progress</span>
                    <h1 class="mt-4 font-display text-5xl font-semibold leading-[0.95] text-[#171717] sm:text-6xl">${escapeHtml(transaction.unit_name)} at <span class="gold-text">${escapeHtml(transaction.hotel_name)}</span></h1>
                    <div class="mt-8 grid gap-4 sm:grid-cols-3">
                        <div class="hero-stat">
                            <p class="text-[0.65rem] font-extrabold uppercase tracking-[0.24em] text-gray-400">Unit Status</p>
                            <p class="mt-3 text-3xl font-extrabold text-[#171717]">${escapeHtml(unitState.status_label)}</p>
                            <p class="mt-2 text-sm text-gray-500">${escapeHtml(unitState.status_copy)}</p>
                        </div>
                        <div class="hero-stat">
                            <p class="text-[0.65rem] font-extrabold uppercase tracking-[0.24em] text-gray-400">Receipt Reference</p>
                            <p class="mt-3 text-3xl font-extrabold text-[#171717]">${escapeHtml(transaction.receipt)}</p>
                        </div>
                        <div class="hero-stat">
                            <p class="text-[0.65rem] font-extrabold uppercase tracking-[0.24em] text-gray-400">Current Charge</p>
                            <p class="mt-3 text-3xl font-extrabold text-[#171717]">${formatCurrency(transaction.amount)}</p>
                            <p class="mt-2 text-sm text-gray-500">${escapeHtml(transaction.payment_type)}</p>
                        </div>
                    </div>
                </div>

                <div class="section-shell px-6 py-8 sm:px-8">
                    <span class="eyebrow">Unit Status Tracker</span>
                    <div class="mt-5 rounded-[28px] border border-[rgba(212,175,55,0.18)] bg-[#fcfbf8] p-5">
                        <div class="flex flex-wrap items-center justify-between gap-3">
                            <p class="text-sm font-semibold text-[#171717]">Progress of Active Rent</p>
                            <span class="status-pill ${escapeHtml(unitState.status_class)}">${escapeHtml(unitState.status_label)}</span>
                        </div>
                        <div class="mt-5 h-3 overflow-hidden rounded-full bg-black/5">
                            <div class="h-full rounded-full bg-gradient-to-r from-[#d4af37] via-[#e2c869] to-[#171717]" style="width: ${Number(unitState.progress_percent)}%;"></div>
                        </div>
                        <div class="mt-3 flex items-center justify-between text-sm text-gray-500">
                            <span>Check-in: ${escapeHtml(transaction.checkin_date || "Pending")}</span>
                            <span>${Number(unitState.progress_percent)}%</span>
                            <span>Check-out: ${escapeHtml(transaction.checkout_date || "Pending")}</span>
                        </div>
                    </div>
                    ${transaction.status !== "Completed"
                        ? `<button type="button" id="early-checkout-button" class="btn-gold mt-6 w-full">Early Check Out</button>`
                        : `<div class="mt-6 rounded-[22px] border border-[#227a52]/18 bg-[#eef8f2] px-5 py-4 text-sm text-[#1f6a47]">${escapeHtml(transaction.compensation_note || "This unit is already checked out.")}</div>`}
                </div>
            </section>

            <section class="grid gap-6 lg:grid-cols-3">
                <div class="section-shell px-6 py-8 sm:px-8">
                    <span class="eyebrow">Rental Snapshot</span>
                    <div class="mt-5 space-y-4">
                        <div class="option-tile p-5">
                            <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Unit</p>
                            <p class="mt-3 text-sm font-semibold text-[#171717]">${escapeHtml(transaction.unit_name)}</p>
                            <p class="mt-2 text-sm text-gray-500">${escapeHtml(transaction.hotel_name)}</p>
                        </div>
                        <div class="option-tile p-5">
                            <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Payment</p>
                            <p class="mt-3 text-sm font-semibold text-[#171717]">${escapeHtml(transaction.payment_type)}</p>
                            <p class="mt-2 text-sm text-gray-500">Amount settled: ${formatCurrency(transaction.amount)}</p>
                        </div>
                    </div>
                </div>

                <div class="section-shell px-6 py-8 sm:px-8">
                    <span class="eyebrow">Support Note</span>
                    <div class="mt-5 rounded-[24px] border border-[rgba(212,175,55,0.18)] bg-[#fcfbf8] p-5">
                        <p class="text-sm leading-7 text-gray-600">If your unit is about to expire and you need more time, please coordinate with the front desk before your scheduled check-out.</p>
                    </div>
                </div>

                <div class="section-shell px-6 py-8 sm:px-8">
                    <span class="eyebrow">Contact Frontdesk</span>
                    <div class="mt-5 space-y-4">
                        <div class="option-tile p-5">
                            <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Front Desk Support</p>
                            <p class="mt-3 text-sm font-semibold text-[#171717]">Direct support is ready for room service requests, amenities, transport help, and hotel questions.</p>
                            <div class="mt-4 flex flex-col gap-3 sm:flex-row">
                                <button type="button" id="open-frontdesk-chat" class="btn-gold flex-1">Chat Frontdesk</button>
                                <button type="button" id="open-frontdesk-call" class="btn-secondary flex-1">Call Frontdesk</button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        `;

        document.getElementById("early-checkout-button")?.addEventListener("click", async () => {
            const result = await app.earlyCheckout(transaction.id);
            await renderMyUnitPage({
                type: result.ok ? "success" : "error",
                text: result.ok ? result.message : result.error,
            });
        });

        document.getElementById("open-frontdesk-chat")?.addEventListener("click", openFrontdeskChat);
        document.getElementById("open-frontdesk-call")?.addEventListener("click", openFrontdeskCall);
    }

    function openFrontdeskChat() {
        const overlay = document.getElementById("frontdesk-chat-overlay");
        const input = document.getElementById("frontdesk-chat-input");
        overlay?.classList.remove("hidden");
        overlay?.classList.add("flex");
        window.setTimeout(() => input?.focus(), 120);
    }

    function closeFrontdeskChat() {
        const overlay = document.getElementById("frontdesk-chat-overlay");
        overlay?.classList.add("hidden");
        overlay?.classList.remove("flex");
    }

    function sendFrontdeskMessage() {
        const input = document.getElementById("frontdesk-chat-input");
        const thread = document.getElementById("frontdesk-chat-thread");
        const text = String(input?.value || "").trim();

        if (!thread || !input || !text) {
            return;
        }

        const replies = [
            "Frontdesk Staff Alya here. We can help with that right away.",
            "Thank you for letting us know. I will forward your request to the proper hotel staff.",
            "We can assist you with that request. Keep messaging me here if you need anything else.",
        ];

        thread.insertAdjacentHTML("beforeend", `<div class="chat-message user">${escapeHtml(text)}</div>`);
        thread.insertAdjacentHTML("beforeend", `<div class="chat-message bot">${escapeHtml(replies[Math.floor(Math.random() * replies.length)])}</div>`);
        input.value = "";
        thread.scrollTop = thread.scrollHeight;
    }

    function openFrontdeskCall() {
        const overlay = document.getElementById("frontdesk-call-overlay");
        overlay?.classList.remove("hidden");
        overlay?.classList.add("flex");
    }

    function closeFrontdeskCall() {
        const overlay = document.getElementById("frontdesk-call-overlay");
        overlay?.classList.add("hidden");
        overlay?.classList.remove("flex");
    }

    function primePageShell() {
        if (getPage() === "home") {
            renderHomeShell();
        }
        if (getPage() === "admin") {
            renderAdminRevenueTeaser();
        }
    }

    guardProtectedPage();
    primePageShell();

    document.addEventListener("DOMContentLoaded", () => {
        const page = getPage();

        if (page === "login") {
            setupLoginPage();
        }

        if (page === "signup") {
            setupSignupPage();
        }

        if (page === "rewards") {
            renderRewardsPage();
        }

        if (page === "my-unit") {
            renderMyUnitPage();
            document.getElementById("frontdesk-chat-send")?.addEventListener("click", sendFrontdeskMessage);
            document.getElementById("frontdesk-chat-close")?.addEventListener("click", closeFrontdeskChat);
            document.getElementById("frontdesk-call-close")?.addEventListener("click", closeFrontdeskCall);
        }

        if (page === "revenue") {
            renderRevenuePage();
        }
    });

    window.openFrontdeskChat = openFrontdeskChat;
    window.closeFrontdeskChat = closeFrontdeskChat;
    window.sendFrontdeskMessage = sendFrontdeskMessage;
    window.openFrontdeskCall = openFrontdeskCall;
    window.closeFrontdeskCall = closeFrontdeskCall;
    window.logoutUser = logoutUser;
})();
