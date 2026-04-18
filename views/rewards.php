<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LuxeStay | Reward Redemption</title>
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
                    <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.35em] text-gray-400">Loyalty Circle</p>
                    <a href="/" class="font-display text-3xl font-bold leading-none text-[#171717]">LUXESTAY <span class="gold-text">REWARDS</span></a>
                </div>
                <div class="flex flex-wrap items-center justify-end gap-3">
                    <div class="rounded-full border border-[rgba(212,175,55,0.24)] bg-[#faf7ef] px-5 py-3 text-right">
                        <p class="text-[0.62rem] font-extrabold uppercase tracking-[0.28em] text-gray-400">Current Points</p>
                        <p class="text-sm font-semibold text-[#171717]"><?= h((string) ($loyaltyAccount['current_points'] ?? 0)) ?> pts · <span class="gold-text"><?= h((string) ($loyaltyAccount['tier'] ?? 'Classic')) ?></span></p>
                    </div>
                    <a href="/" class="btn-secondary min-w-[210px]">Back to Front Desk</a>
                </div>
            </div>
        </nav>

        <main class="site-container flex flex-col gap-8 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
            <section class="section-shell px-6 py-8 sm:px-8 sm:py-10">
                <span class="eyebrow">Reward Redemption</span>
                <h1 class="mt-4 font-display text-5xl font-semibold leading-[0.95] text-[#171717] sm:text-6xl">Earn loyalty points from every stay and exchange them for <span class="gold-text">guest-first rewards</span>.</h1>
                <?php if (!empty($message)): ?><div class="mt-6 rounded-[24px] border border-[#227a52]/20 bg-[#eef7f2] px-5 py-4 text-sm font-semibold text-[#227a52]"><?= h((string) $message) ?></div><?php endif; ?>
                <?php if (!empty($error)): ?><div class="mt-6 rounded-[24px] border border-[#b4534c]/20 bg-[#fdf1ef] px-5 py-4 text-sm font-semibold text-[#b4534c]"><?= h((string) $error) ?></div><?php endif; ?>
            </section>

            <section class="section-shell px-6 py-8 sm:px-8">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <span class="eyebrow">Redeem Items</span>
                        <h2 class="mt-4 font-display text-4xl font-semibold text-[#171717]">Choose a redemption that fits your stay style.</h2>
                    </div>
                    <div class="rounded-[24px] border border-black/5 bg-white/80 px-5 py-4 text-right">
                        <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Available Balance</p>
                        <p class="mt-2 text-3xl font-extrabold text-[#171717]"><?= h((string) ($loyaltyAccount['current_points'] ?? 0)) ?> pts</p>
                    </div>
                </div>

                <div class="mt-8 grid gap-5 xl:grid-cols-3">
                    <?php foreach ($rewardCatalog as $reward): ?>
                        <article class="luxury-card flex h-full flex-col rounded-[30px] p-6">
                            <div class="flex items-start justify-between gap-4">
                                <div>
                                    <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Reward Item</p>
                                    <h3 class="mt-3 font-display text-3xl font-semibold text-[#171717]"><?= h((string) $reward['name']) ?></h3>
                                </div>
                                <span class="status-pill peak"><?= h((string) $reward['points_cost']) ?> pts</span>
                            </div>
                            <p class="mt-4 text-sm leading-7 text-gray-600"><?= h((string) $reward['description']) ?></p>
                            <form method="POST" action="/rewards/redeem/<?= rawurlencode((string) $reward['id']) ?>" class="mt-6 flex flex-1 items-end">
                                <button type="submit" class="btn-gold w-full min-h-[3.35rem]" <?= (($loyaltyAccount['current_points'] ?? 0) < $reward['points_cost']) ? 'disabled' : '' ?>>
                                    <?= (($loyaltyAccount['current_points'] ?? 0) < $reward['points_cost']) ? 'Need More Points' : 'Redeem Now' ?>
                                </button>
                            </form>
                        </article>
                    <?php endforeach; ?>
                </div>
            </section>

            <section class="grid gap-6 xl:grid-cols-2">
                <div class="section-shell px-6 py-8 sm:px-8">
                    <span class="eyebrow">Points History</span>
                    <h2 class="mt-4 font-display text-4xl font-semibold text-[#171717]">Where your points came from.</h2>
                    <div class="mt-6 space-y-4">
                        <?php if (!empty($pointsHistory)): ?>
                            <?php foreach (array_slice($pointsHistory, 0, 8) as $item): ?>
                                <div class="option-tile p-5">
                                    <div class="flex items-start justify-between gap-4">
                                        <div>
                                            <p class="text-sm font-semibold text-[#171717]"><?= h((string) $item['description']) ?></p>
                                            <p class="mt-1 text-sm text-gray-500"><?= h((string) $item['timestamp']) ?></p>
                                        </div>
                                        <div class="text-right">
                                            <p class="text-sm font-extrabold text-[#227a52]">+<?= h((string) $item['points']) ?> pts</p>
                                            <p class="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Balance <?= h((string) $item['balance_after']) ?></p>
                                        </div>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        <?php else: ?>
                            <div class="option-tile p-5 text-sm leading-7 text-gray-600">No loyalty activity yet. Complete a booking to start earning points.</div>
                        <?php endif; ?>
                    </div>
                </div>

                <div class="section-shell px-6 py-8 sm:px-8">
                    <span class="eyebrow">Reward History</span>
                    <h2 class="mt-4 font-display text-4xl font-semibold text-[#171717]">Your redeemed LuxeStay privileges.</h2>
                    <div class="mt-6 space-y-4">
                        <?php if (!empty($rewardHistory)): ?>
                            <?php foreach (array_slice($rewardHistory, 0, 8) as $item): ?>
                                <div class="option-tile p-5">
                                    <div class="flex items-start justify-between gap-4">
                                        <div>
                                            <p class="text-sm font-semibold text-[#171717]"><?= h((string) $item['reward_name']) ?></p>
                                            <p class="mt-1 text-sm text-gray-500"><?= h((string) $item['timestamp']) ?></p>
                                        </div>
                                        <p class="text-sm font-extrabold text-[#b4534c]">-<?= h((string) $item['points_cost']) ?> pts</p>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        <?php else: ?>
                            <div class="option-tile p-5 text-sm leading-7 text-gray-600">No reward redemptions yet. Once you reach at least 5,000 points, you can redeem your first LuxeStay perk here.</div>
                        <?php endif; ?>
                    </div>
                </div>
            </section>
        </main>
    </div>
</body>
</html>
