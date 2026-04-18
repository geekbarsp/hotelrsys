<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LuxeStay | Transactions</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="/static/style.css">
</head>
<body class="page-shell">
    <div class="app-layer admin-shell">
        <div class="site-container flex flex-col gap-6">
            <header class="section-shell px-6 py-6 sm:px-8">
                <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p class="text-[0.7rem] font-extrabold uppercase tracking-[0.32em] text-gray-400">Transaction Control</p>
                        <h1 class="mt-3 font-display text-5xl font-semibold text-[#171717]">LuxeStay <span class="gold-text">Transactions</span></h1>
                    </div>
                    <div class="flex flex-wrap gap-3">
                        <a href="/admin" class="btn-secondary">Back to Dashboard</a>
                        <a href="/" class="btn-secondary">Exit to Front Desk</a>
                        <a href="/logout" class="btn-gold">Sign Out</a>
                    </div>
                </div>
            </header>

            <section class="section-shell px-6 py-8 sm:px-8">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <span class="eyebrow">Ledger</span>
                        <h2 class="mt-4 font-display text-4xl font-semibold text-[#171717]">Booked and reserved transaction history</h2>
                    </div>
                    <div class="flex flex-wrap items-center gap-3">
                        <span class="status-pill peak">Live sync from booking and admin actions</span>
                        <button type="button" onclick="switchToAdminMode()" class="btn-secondary">Admin</button>
                        <button type="button" onclick="promptSuperadminAccess()" class="btn-secondary">Superadmin</button>
                    </div>
                </div>

                <div class="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(220px,0.65fr)_minmax(220px,0.65fr)_minmax(220px,0.65fr)]">
                    <div>
                        <label class="input-label" for="transaction-search">Hotel or Unit Name</label>
                        <input id="transaction-search" type="text" class="luxury-input" placeholder="Search hotel or unit">
                    </div>
                    <div>
                        <label class="input-label" for="transaction-receipt-filter">Receipt Reference</label>
                        <input id="transaction-receipt-filter" type="text" class="luxury-input" placeholder="Search receipt reference">
                    </div>
                    <div>
                        <label class="input-label" for="transaction-hotel-filter">Hotel</label>
                        <select id="transaction-hotel-filter" class="luxury-select"><option value="all">All Hotels</option></select>
                    </div>
                    <div>
                        <label class="input-label" for="transaction-status-filter">Status</label>
                        <select id="transaction-status-filter" class="luxury-select">
                            <option value="all">Booked and Reserved</option>
                            <option value="Booked">Booked</option>
                            <option value="Reserved">Reserved</option>
                        </select>
                    </div>
                    <div>
                        <label class="input-label" for="transaction-source-filter">Source</label>
                        <select id="transaction-source-filter" class="luxury-select">
                            <option value="all">All Sources</option>
                            <option value="Guest Booking">Guest Booking</option>
                            <option value="Admin Control">Admin Control</option>
                        </select>
                    </div>
                </div>

                <div class="table-shell mt-8">
                    <table class="luxury-table">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>Hotel / Unit</th>
                                <th>Guest Name</th>
                                <th>Status</th>
                                <th>Source</th>
                                <th>Payment</th>
                                <th>Amount</th>
                                <th>Receipt</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="transaction-table-body">
                            <tr><td colspan="9" class="text-center text-gray-500">Loading transactions...</td></tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    </div>

    <div id="admin-overlay" class="fixed inset-0 z-[120] hidden items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm">
        <div class="w-full max-w-xl rounded-[32px] border border-[rgba(212,175,55,0.18)] bg-[#fcfbf8] p-6 shadow-2xl sm:p-8">
            <div class="flex items-start justify-between gap-4 border-b border-black/5 pb-4">
                <div>
                    <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">LuxeStay Control</p>
                    <h3 id="admin-overlay-title" class="mt-2 font-display text-4xl font-semibold text-[#171717]">Notice</h3>
                </div>
            </div>
            <div class="mt-5 space-y-4">
                <p id="admin-overlay-message" class="text-sm leading-7 text-gray-600"></p>
                <div id="admin-overlay-input-wrap" class="hidden">
                    <label id="admin-overlay-label" class="input-label" for="admin-overlay-input">Input</label>
                    <input id="admin-overlay-input" type="text" class="luxury-input">
                </div>
                <div id="admin-overlay-code-wrap" class="hidden">
                    <label class="input-label">4-Digit Code</label>
                    <div class="flex justify-center gap-4">
                        <input id="admin-code-0" type="text" inputmode="numeric" maxlength="1" class="luxury-input admin-code-box text-center !px-0 !text-2xl font-extrabold" aria-label="Code digit 1">
                        <input id="admin-code-1" type="text" inputmode="numeric" maxlength="1" class="luxury-input admin-code-box text-center !px-0 !text-2xl font-extrabold" aria-label="Code digit 2">
                        <input id="admin-code-2" type="text" inputmode="numeric" maxlength="1" class="luxury-input admin-code-box text-center !px-0 !text-2xl font-extrabold" aria-label="Code digit 3">
                        <input id="admin-code-3" type="text" inputmode="numeric" maxlength="1" class="luxury-input admin-code-box text-center !px-0 !text-2xl font-extrabold" aria-label="Code digit 4">
                    </div>
                    <p id="admin-code-error" class="mt-3 hidden text-sm text-[#8d4038]">Invalid code. Enter the correct 4-digit code to unlock superadmin access.</p>
                </div>
            </div>
            <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button id="admin-overlay-cancel" type="button" onclick="closeAdminOverlay(false)" class="btn-secondary">Cancel</button>
                <button id="admin-overlay-confirm" type="button" onclick="closeAdminOverlay(true)" class="btn-gold">Confirm</button>
            </div>
        </div>
    </div>
    <script src="/static/script.js"></script>
</body>
</html>
