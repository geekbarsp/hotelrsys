<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LuxeStay | My Unit</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="/static/style.css">
</head>
<body class="page-shell">
    <div class="app-layer">
        <nav class="site-container px-4 pt-5 sm:px-6 lg:px-8">
            <div class="section-shell flex flex-col gap-5 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.35em] text-gray-400">Guest Unit Portal</p>
                    <a href="/" class="font-display text-3xl font-bold leading-none text-[#171717]">LUXESTAY <span class="gold-text">MY UNIT</span></a>
                </div>
                <div class="flex flex-wrap items-center justify-end gap-3">
                    <div class="rounded-full border border-[rgba(212,175,55,0.24)] bg-[#faf7ef] px-5 py-3 text-right">
                        <p class="text-[0.62rem] font-extrabold uppercase tracking-[0.28em] text-gray-400">Member Active</p>
                        <p class="text-sm font-semibold text-[#171717]"><?= h(strtoupper((string) ($sessionUser ?? ''))) ?></p>
                    </div>
                    <a href="/" class="btn-secondary min-w-[210px]">Back to Front Desk</a>
                </div>
            </div>
        </nav>

        <main class="site-container flex flex-col gap-8 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
            <?php if (!empty($message)): ?><div class="rounded-[22px] border border-[#227a52]/20 bg-[#eef8f2] px-5 py-4 text-sm text-[#1f6a47]"><?= h((string) $message) ?></div><?php endif; ?>
            <?php if (!empty($error)): ?><div class="rounded-[22px] border border-[#b4534c]/20 bg-[#fff3f1] px-5 py-4 text-sm text-[#8d4038]"><?= h((string) $error) ?></div><?php endif; ?>

            <?php if (!empty($transaction) && !empty($unitState)): ?>
                <section class="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
                    <div class="section-shell px-6 py-8 sm:px-8 sm:py-10">
                        <span class="eyebrow">Current Stay Progress</span>
                        <h1 class="mt-4 font-display text-5xl font-semibold leading-[0.95] text-[#171717] sm:text-6xl"><?= h((string) $transaction['unit_name']) ?> at <span class="gold-text"><?= h((string) $transaction['hotel_name']) ?></span></h1>
                        <div class="mt-8 grid gap-4 sm:grid-cols-3">
                            <div class="hero-stat">
                                <p class="text-[0.65rem] font-extrabold uppercase tracking-[0.24em] text-gray-400">Unit Status</p>
                                <p class="mt-3 text-3xl font-extrabold text-[#171717]"><?= h((string) $unitState['status_label']) ?></p>
                                <p class="mt-2 text-sm text-gray-500"><?= h((string) $unitState['status_copy']) ?></p>
                            </div>
                            <div class="hero-stat">
                                <p class="text-[0.65rem] font-extrabold uppercase tracking-[0.24em] text-gray-400">Receipt Reference</p>
                                <p class="mt-3 text-3xl font-extrabold text-[#171717]"><?= h((string) $transaction['receipt']) ?></p>
                            </div>
                            <div class="hero-stat">
                                <p class="text-[0.65rem] font-extrabold uppercase tracking-[0.24em] text-gray-400">Current Charge</p>
                                <p class="mt-3 text-3xl font-extrabold text-[#171717]">PHP <?= number_format((float) ($transaction['amount'] ?? 0), 2) ?></p>
                                <p class="mt-2 text-sm text-gray-500"><?= h((string) $transaction['payment_type']) ?></p>
                            </div>
                        </div>
                    </div>

                    <div class="section-shell px-6 py-8 sm:px-8">
                        <span class="eyebrow">Unit Status Tracker</span>
                        <div class="mt-5 rounded-[28px] border border-[rgba(212,175,55,0.18)] bg-[#fcfbf8] p-5">
                            <div class="flex flex-wrap items-center justify-between gap-3">
                                <p class="text-sm font-semibold text-[#171717]">Progress of Active Rent</p>
                                <span class="status-pill <?= h((string) $unitState['status_class']) ?>"><?= h((string) $unitState['status_label']) ?></span>
                            </div>
                            <div class="mt-5 h-3 overflow-hidden rounded-full bg-black/5">
                                <div class="h-full rounded-full bg-gradient-to-r from-[#d4af37] via-[#e2c869] to-[#171717]" style="width: <?= (int) $unitState['progress_percent'] ?>%;"></div>
                            </div>
                            <div class="mt-3 flex items-center justify-between text-sm text-gray-500">
                                <span>Check-in: <?= h((string) ($transaction['checkin_date'] ?: 'Pending')) ?></span>
                                <span><?= (int) $unitState['progress_percent'] ?>%</span>
                                <span>Check-out: <?= h((string) ($transaction['checkout_date'] ?: 'Pending')) ?></span>
                            </div>
                        </div>

                        <?php if (($transaction['status'] ?? '') !== 'Completed'): ?>
                            <form method="post" action="/my-unit/early-checkout/<?= (int) $transaction['id'] ?>" class="mt-6">
                                <button type="submit" class="btn-gold w-full">Early Check Out</button>
                            </form>
                        <?php else: ?>
                            <div class="mt-6 rounded-[22px] border border-[#227a52]/18 bg-[#eef8f2] px-5 py-4 text-sm text-[#1f6a47]"><?= h((string) ($transaction['compensation_note'] ?? 'This unit is already checked out.')) ?></div>
                        <?php endif; ?>
                    </div>
                </section>

                <section class="grid gap-6 lg:grid-cols-3">
                    <div class="section-shell px-6 py-8 sm:px-8">
                        <span class="eyebrow">Rental Snapshot</span>
                        <div class="mt-5 space-y-4">
                            <div class="option-tile p-5">
                                <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Unit</p>
                                <p class="mt-3 text-sm font-semibold text-[#171717]"><?= h((string) $transaction['unit_name']) ?></p>
                                <p class="mt-2 text-sm text-gray-500"><?= h((string) $transaction['hotel_name']) ?></p>
                            </div>
                            <div class="option-tile p-5">
                                <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Payment</p>
                                <p class="mt-3 text-sm font-semibold text-[#171717]"><?= h((string) $transaction['payment_type']) ?></p>
                                <p class="mt-2 text-sm text-gray-500">Amount settled: PHP <?= number_format((float) ($transaction['amount'] ?? 0), 2) ?></p>
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
                                    <button type="button" onclick="openFrontdeskChat()" class="btn-gold flex-1">Chat Frontdesk</button>
                                    <button type="button" onclick="openFrontdeskCall()" class="btn-secondary flex-1">Call Frontdesk</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            <?php else: ?>
                <section class="section-shell px-6 py-8 sm:px-8 sm:py-10">
                    <span class="eyebrow">My Unit</span>
                    <h1 class="mt-4 font-display text-5xl font-semibold text-[#171717]">No active unit linked yet.</h1>
                    <p class="mt-5 max-w-2xl text-base leading-7 text-gray-600">Once you complete a booking or reservation while signed in, your active rent progress and unit controls will appear here.</p>
                    <div class="mt-8"><a href="/#suites" class="btn-gold">Browse Suites</a></div>
                </section>
            <?php endif; ?>
        </main>
    </div>

    <div id="frontdesk-chat-overlay" class="fixed inset-0 z-[120] hidden items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm">
        <div class="w-full max-w-2xl rounded-[32px] border border-[rgba(212,175,55,0.18)] bg-[#fcfbf8] p-6 shadow-2xl sm:p-8">
            <div class="flex items-start justify-between gap-4 border-b border-black/5 pb-4">
                <div>
                    <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Frontdesk Live Chat</p>
                    <h3 class="mt-2 font-display text-4xl font-semibold text-[#171717]">Frontdesk Staff Alya</h3>
                </div>
            </div>
            <div id="frontdesk-chat-thread" class="mt-5 space-y-3 rounded-[24px] border border-black/5 bg-white/80 p-4">
                <div class="chat-message bot">Hello, this is Frontdesk Staff Alya. If you need anything about the hotel or your room, just tell me here.</div>
            </div>
            <div class="mt-5 flex flex-col gap-3 sm:flex-row">
                <input id="frontdesk-chat-input" type="text" class="luxury-input flex-1" placeholder="Type your request for the front desk">
                <button type="button" onclick="sendFrontdeskMessage()" class="btn-gold">Send</button>
                <button type="button" onclick="closeFrontdeskChat()" class="btn-secondary">Close</button>
            </div>
        </div>
    </div>

    <div id="frontdesk-call-overlay" class="fixed inset-0 z-[121] hidden items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm">
        <div class="w-full max-w-md rounded-[32px] border border-[rgba(212,175,55,0.18)] bg-[#fcfbf8] p-6 text-center shadow-2xl sm:p-8">
            <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Frontdesk Call</p>
            <h3 class="mt-3 font-display text-4xl font-semibold text-[#171717]">Frontdesk Staff Marco</h3>
            <div class="mx-auto mt-6 flex h-28 w-28 items-center justify-center rounded-full border border-[rgba(212,175,55,0.28)] bg-[#faf7ef] text-2xl font-extrabold text-[#171717]">Ringing...</div>
            <button type="button" onclick="closeFrontdeskCall()" class="btn-gold mt-6 w-full">Hang Up</button>
        </div>
    </div>

    <script>
        function openFrontdeskChat() {
            const overlay = document.getElementById("frontdesk-chat-overlay");
            const input = document.getElementById("frontdesk-chat-input");
            if (!overlay) return;
            overlay.classList.remove("hidden");
            overlay.classList.add("flex");
            setTimeout(() => input?.focus(), 120);
        }

        function closeFrontdeskChat() {
            const overlay = document.getElementById("frontdesk-chat-overlay");
            if (!overlay) return;
            overlay.classList.add("hidden");
            overlay.classList.remove("flex");
        }

        function sendFrontdeskMessage() {
            const input = document.getElementById("frontdesk-chat-input");
            const thread = document.getElementById("frontdesk-chat-thread");
            if (!input || !thread) return;
            const text = input.value.trim();
            if (!text) return;
            thread.innerHTML += `<div class="chat-message user">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
            input.value = "";
            const replies = [
                "Frontdesk Staff Alya here. We can help with that right away.",
                "Thank you for letting us know. I will forward your request to the proper hotel staff.",
                "We can assist you with that request. Keep messaging me here if you need anything else."
            ];
            thread.innerHTML += `<div class="chat-message bot">${replies[Math.floor(Math.random() * replies.length)]}</div>`;
            thread.scrollTop = thread.scrollHeight;
        }

        function openFrontdeskCall() {
            const overlay = document.getElementById("frontdesk-call-overlay");
            if (!overlay) return;
            overlay.classList.remove("hidden");
            overlay.classList.add("flex");
        }

        function closeFrontdeskCall() {
            const overlay = document.getElementById("frontdesk-call-overlay");
            if (!overlay) return;
            overlay.classList.add("hidden");
            overlay.classList.remove("flex");
        }
    </script>
</body>
</html>
