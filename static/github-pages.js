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
        return `PHP ${Number(amount || 0).toFixed(2)}`;
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

    function attachGlobalActions() {
        document.addEventListener("click", (event) => {
            const logoutLink = event.target.closest("[data-logout]");
            if (logoutLink) {
                event.preventDefault();
                app.logout("index.html");
            }
        });
    }

    function guardProtectedPage() {
        const page = getPage();

        if (["admin", "employees", "transactions"].includes(page)) {
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
                        <a href="#" data-logout="true" class="mt-1 block rounded-[18px] px-4 py-3 text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-gray-500 transition hover:bg-[#faf7ef] hover:text-[#171717]">Logout</a>
                    </div>
                </div>
                <div class="rounded-full border border-[rgba(212,175,55,0.24)] bg-[#faf7ef] px-4 py-2 text-right">
                    <p class="text-[0.62rem] font-extrabold uppercase tracking-[0.28em] text-gray-400">Loyalty Points</p>
                    <p class="text-sm font-semibold text-[#171717]">${escapeHtml(String(points))} pts · <span class="gold-text">${escapeHtml(tier)}</span></p>
                </div>
            `;
        });
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
    }

    attachGlobalActions();
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
    });

    window.openFrontdeskChat = openFrontdeskChat;
    window.closeFrontdeskChat = closeFrontdeskChat;
    window.sendFrontdeskMessage = sendFrontdeskMessage;
    window.openFrontdeskCall = openFrontdeskCall;
    window.closeFrontdeskCall = closeFrontdeskCall;
})();
