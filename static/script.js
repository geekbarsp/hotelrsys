let currentRooms = [];
let selectedRoom = null;
let currentTransactions = [];
let currentEmployees = [];
let superadminEnabled = false;
let adminOverlayResolver = null;
let guestOverlayResolver = null;
let pendingReceiptData = null;
let editingEmployeeId = null;
let currentCheckoutMode = "book";
const USD_TO_PHP_RATE = 59.58;

function formatCurrency(amount) {
    return `PHP ${Number(amount || 0).toFixed(2)}`;
}

function convertUsdToPhp(amount) {
    return Number(amount || 0) * USD_TO_PHP_RATE;
}

function getBookingTotals(room) {
    const breakfast = document.getElementById("addon-breakfast")?.checked ? convertUsdToPhp(25) : 0;
    const airport = document.getElementById("addon-airport")?.checked ? convertUsdToPhp(50) : 0;
    const spa = document.getElementById("addon-spa")?.checked ? convertUsdToPhp(40) : 0;
    const unitPrice = Number(room?.display_price || 0);
    const extrasTotal = breakfast + airport + spa;

    let discountLabel = "None";
    let discountAmount = 0;
    if (document.getElementById("discount-pwd")?.checked) {
        discountLabel = "PWD Discount";
        discountAmount = 2000;
    } else if (document.getElementById("discount-senior")?.checked) {
        discountLabel = "Senior Citizen Discount";
        discountAmount = 3000;
    }

    const isReservationMode = currentCheckoutMode === "reserve";
    const isPayAtHotel = document.querySelector('input[name="mop"]:checked')?.value === "Pay at Hotel";
    const subtotal = isReservationMode
        ? unitPrice * 0.3
        : isPayAtHotel
            ? unitPrice * 0.5
            : unitPrice + extrasTotal;
    const finalTotal = Math.max(subtotal - discountAmount, 0);
    const dueNow = finalTotal;

    return {
        unitPrice,
        extrasTotal,
        subtotal,
        discountLabel,
        discountAmount,
        finalTotal,
        dueNow,
        isPayAtHotel,
        isReservationMode,
    };
}

function updateBookingSummary() {
    if (!selectedRoom) {
        return;
    }

    const totals = getBookingTotals(selectedRoom);
    const subtotalNode = document.getElementById("summary-subtotal");
    const discountTypeNode = document.getElementById("summary-discount-type");
    const discountValueNode = document.getElementById("summary-discount-value");
    const totalLabelNode = document.getElementById("summary-total-label");
    const totalValueNode = document.getElementById("summary-total");
    const partialMethodWrap = document.getElementById("partial-method-wrap");

    if (subtotalNode) {
        subtotalNode.textContent = formatCurrency(totals.subtotal);
    }

    if (discountTypeNode) {
        discountTypeNode.textContent = totals.discountLabel;
    }

    if (discountValueNode) {
        discountValueNode.textContent = totals.discountAmount > 0 ? `- ${formatCurrency(totals.discountAmount)}` : formatCurrency(0);
    }

    if (totalLabelNode) {
        totalLabelNode.textContent = totals.isReservationMode ? "30% Reservation Payment" : totals.isPayAtHotel ? "50% Partial Due Now" : "Total";
    }

    if (totalValueNode) {
        totalValueNode.textContent = formatCurrency(totals.dueNow);
    }

    if (partialMethodWrap) {
        partialMethodWrap.classList.toggle("hidden", totals.isReservationMode || !totals.isPayAtHotel);
    }

    toggleDiscountProofRequirement();
}

function toggleDiscountProofRequirement() {
    const wrap = document.getElementById("discount-proof-wrap");
    const helper = document.getElementById("discount-proof-helper");
    const fileInput = document.getElementById("discount-proof-file");

    if (!wrap || !helper || !fileInput) {
        return;
    }

    const totals = selectedRoom ? getBookingTotals(selectedRoom) : { discountLabel: "None" };
    const requiresProof = ["PWD Discount", "Senior Citizen Discount"].includes(totals.discountLabel);
    const label = totals.discountLabel === "PWD Discount" ? "PWD ID" : "Senior Citizen ID";

    wrap.classList.toggle("hidden", !requiresProof);
    helper.textContent = requiresProof
        ? `Upload a clear photo or PDF of the guest's ${label} to apply this discount.`
        : "Choose PWD or Senior Citizen to require an ID upload.";

    if (!requiresProof) {
        fileInput.value = "";
        updateDiscountProofName();
    }
}

function updateDiscountProofName() {
    const fileInput = document.getElementById("discount-proof-file");
    const fileName = document.getElementById("discount-proof-name");

    if (!fileName) {
        return;
    }

    const file = fileInput?.files?.[0];
    fileName.textContent = file ? `${file.name} selected` : "No discount ID uploaded yet.";
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Unable to read the uploaded discount ID."));
        reader.readAsDataURL(file);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    initializeDates();
    initializePageData();

    const roomFilter = document.getElementById("calendar-room-filter");
    const arrivalInput = document.getElementById("arrival-date");
    const departureInput = document.getElementById("departure-date");
    const suiteSearch = document.getElementById("suite-search");
    const suiteHotelFilter = document.getElementById("suite-hotel-filter");
    const suiteStatusFilter = document.getElementById("suite-status-filter");
    const adminSearch = document.getElementById("admin-room-search");
    const adminHotelFilter = document.getElementById("admin-hotel-filter");
    const adminStatusFilter = document.getElementById("admin-status-filter");
    const watchlistSearch = document.getElementById("watchlist-search");
    const watchlistStatusFilter = document.getElementById("watchlist-status-filter");
    const transactionSearch = document.getElementById("transaction-search");
    const transactionReceiptFilter = document.getElementById("transaction-receipt-filter");
    const transactionHotelFilter = document.getElementById("transaction-hotel-filter");
    const transactionStatusFilter = document.getElementById("transaction-status-filter");
    const transactionSourceFilter = document.getElementById("transaction-source-filter");
    const memberMenuToggle = document.getElementById("member-menu-toggle");
    const memberMenu = document.getElementById("member-menu");

    if (roomFilter) {
        roomFilter.addEventListener("change", renderCalendar);
    }

    if (arrivalInput) {
        arrivalInput.addEventListener("change", renderCalendar);
    }

    if (departureInput) {
        departureInput.addEventListener("change", renderCalendar);
    }

    if (memberMenuToggle && memberMenu) {
        memberMenuToggle.addEventListener("click", (event) => {
            event.stopPropagation();
            memberMenu.classList.toggle("hidden");
        });

        memberMenu.addEventListener("click", (event) => {
            event.stopPropagation();
        });

        document.addEventListener("click", () => {
            memberMenu.classList.add("hidden");
        });
    }

    if (suiteSearch) {
        suiteSearch.addEventListener("input", renderRooms);
    }

    if (suiteHotelFilter) {
        suiteHotelFilter.addEventListener("change", renderRooms);
    }

    if (suiteStatusFilter) {
        suiteStatusFilter.addEventListener("change", renderRooms);
    }

    if (adminSearch) {
        adminSearch.addEventListener("input", renderAdminRooms);
    }

    if (adminHotelFilter) {
        adminHotelFilter.addEventListener("change", renderAdminRooms);
    }

    if (adminStatusFilter) {
        adminStatusFilter.addEventListener("change", renderAdminRooms);
    }

    if (watchlistSearch) {
        watchlistSearch.addEventListener("input", renderServiceWatchlist);
    }

    if (watchlistStatusFilter) {
        watchlistStatusFilter.addEventListener("change", renderServiceWatchlist);
    }

    if (transactionSearch) {
        transactionSearch.addEventListener("input", renderTransactions);
    }

    if (transactionReceiptFilter) {
        transactionReceiptFilter.addEventListener("input", renderTransactions);
    }

    if (transactionHotelFilter) {
        transactionHotelFilter.addEventListener("change", renderTransactions);
    }

    if (transactionStatusFilter) {
        transactionStatusFilter.addEventListener("change", renderTransactions);
    }

    if (transactionSourceFilter) {
        transactionSourceFilter.addEventListener("change", renderTransactions);
    }
});

function initializePageData() {
    if (document.getElementById("employee-table-body")) {
        fetchEmployees();
        return;
    }

    if (document.getElementById("transaction-table-body")) {
        fetchTransactions();
        return;
    }

    if (document.getElementById("admin-room-table-body")) {
        fetchAdminRooms();
        return;
    }

    fetchRooms();
}

function initializeDates() {
    const arrivalInput = document.getElementById("arrival-date");
    const departureInput = document.getElementById("departure-date");

    if (!arrivalInput || !departureInput) {
        return;
    }

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(today.getDate() + 3);

    const minDate = formatDateValue(tomorrow);
    arrivalInput.min = minDate;
    departureInput.min = minDate;
    arrivalInput.value = formatDateValue(tomorrow);
    departureInput.value = formatDateValue(dayAfter);
}

async function fetchRooms() {
    try {
        const response = await fetch("/api/rooms");
        currentRooms = await response.json();
        populateRoomFilter();
        populateHotelFilters();
        renderRooms();
        renderCalendar();
    } catch (error) {
        console.error("Error loading rooms:", error);
    }
}

async function fetchAdminRooms() {
    try {
        const [roomsResponse, employeesResponse] = await Promise.all([
            fetch("/api/admin/rooms"),
            fetch("/api/admin/employees"),
        ]);
        currentRooms = await roomsResponse.json();
        currentEmployees = employeesResponse.ok ? await employeesResponse.json() : [];
        populateHotelFilters();
        renderAdminMetrics();
        renderAdminRooms();
        renderServiceWatchlist();
    } catch (error) {
        console.error("Error loading admin rooms:", error);
        showAdminFeedback("Unable to load rooms right now.", false);
    }
}

async function fetchTransactions() {
    try {
        const [transactionsResponse, roomsResponse, superadminResponse] = await Promise.all([
            fetch("/api/admin/transactions"),
            fetch("/api/admin/rooms"),
            fetch("/api/admin/superadmin"),
        ]);
        currentTransactions = await transactionsResponse.json();
        currentRooms = await roomsResponse.json();
        const superadminData = await superadminResponse.json();
        superadminEnabled = Boolean(superadminData.enabled);
        populateHotelFilters();
        renderTransactions();
    } catch (error) {
        console.error("Error loading transactions:", error);
    }
}

async function fetchEmployees() {
    try {
        const [employeesResponse, superadminResponse] = await Promise.all([
            fetch("/api/admin/employees"),
            fetch("/api/admin/superadmin"),
        ]);

        currentEmployees = await employeesResponse.json();
        const superadminData = await superadminResponse.json();
        superadminEnabled = Boolean(superadminData.enabled);
        renderEmployees();
        renderAdminMetrics();
    } catch (error) {
        console.error("Error loading employees:", error);
        showEmployeeFeedback("Unable to load employees right now.", false);
    }
}

function populateRoomFilter() {
    const roomFilter = document.getElementById("calendar-room-filter");

    if (!roomFilter) {
        return;
    }

    const options = ['<option value="all">All Suites</option>']
        .concat(
            currentRooms.map((room) => `<option value="${room.id}">${escapeHtml(room.hotel_name)} • ${escapeHtml(room.name)}</option>`)
        )
        .join("");

    roomFilter.innerHTML = options;
}

function populateHotelFilters() {
    const hotelOptions = [...new Set(currentRooms.map((room) => room.hotel_name))].sort();
    const selectMarkup = ['<option value="all">All Hotels</option>']
        .concat(hotelOptions.map((hotel) => `<option value="${escapeHtml(hotel)}">${escapeHtml(hotel)}</option>`))
        .join("");

    const suiteHotelFilter = document.getElementById("suite-hotel-filter");
    const adminHotelFilter = document.getElementById("admin-hotel-filter");
    const transactionHotelFilter = document.getElementById("transaction-hotel-filter");

    if (suiteHotelFilter) {
        suiteHotelFilter.innerHTML = selectMarkup;
    }

    if (adminHotelFilter) {
        adminHotelFilter.innerHTML = selectMarkup;
    }

    if (transactionHotelFilter) {
        transactionHotelFilter.innerHTML = selectMarkup;
    }
}

function renderRooms() {
    const grid = document.getElementById("room-grid");

    if (!grid) {
        return;
    }

    const filteredRooms = getFilteredGuestRooms();

    grid.innerHTML = filteredRooms
        .map((room, index) => {
            const profile = buildRoomProfile(room);
            const roomStatus = getStatusClass(room.status);
            const demandCopy = room.is_peak ? "Peak demand recommendation" : "Low pressure booking window";
            const actionLabel = room.status === "Available" ? "BOOK NOW!" : "RESERVE NOW!";
            const moodTags = (profile.moodTags || []).map((tag) => `<span class="feature-chip">${escapeHtml(tag)}</span>`).join("");
            const locationHighlights = (profile.attractions || [room.location]).slice(0, 2).map((item) => `
                <div class="flex items-center justify-between text-sm text-gray-600">
                    <span>${escapeHtml(item)}</span>
                </div>
            `).join("");

            return `
                <article class="luxury-card room-card fade-in-up" style="animation-delay:${index * 0.08}s;">
                    <div class="room-media">
                        <img src="${room.img}" alt="${escapeHtml(room.name)}">
                        <div class="absolute left-4 top-4 z-[1] flex flex-wrap gap-2">
                            <span class="status-pill ${roomStatus}">${escapeHtml(room.status)}</span>
                            ${room.status === "Reserved"
                                ? '<span class="status-pill reserved">Reserved Hold</span>'
                                : room.is_peak
                                    ? '<span class="status-pill peak">Peak Day Pricing</span>'
                                    : '<span class="status-pill available">Value Day</span>'}
                        </div>
                        <div class="room-overlay">
                            <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.24em] text-white/70">${escapeHtml(profile.videoLabel || "Preview available")}</p>
                            <h3 class="mt-2 font-display text-4xl font-semibold">${escapeHtml(room.name)}</h3>
                            <p class="mt-2 text-[0.72rem] font-extrabold uppercase tracking-[0.22em] text-white/70">${escapeHtml(room.hotel_name)}</p>
                            <p class="mt-2 max-w-lg text-sm leading-6 text-white/80">${escapeHtml(room.location)}</p>
                        </div>
                    </div>
                    <div class="space-y-6 p-6">
                        <div class="flex flex-wrap gap-2">${moodTags}</div>

                        <div class="grid gap-4 sm:grid-cols-2">
                            <div class="rounded-[20px] border border-black/5 bg-white/80 p-4">
                                <p class="text-[0.64rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Room Details</p>
                                <p class="mt-3 text-sm text-gray-600">${escapeHtml(room.type)} with ${escapeHtml(room.capacity)}</p>
                                <p class="mt-2 text-sm text-gray-600">Flexible pillow options and extra bed request ready.</p>
                            </div>
                            <div class="rounded-[20px] border border-black/5 bg-white/80 p-4">
                                <p class="text-[0.64rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Guest Rating</p>
                                <p class="mt-3 text-sm text-gray-600">${room.rating} stars from ${room.reviews} verified stays</p>
                                <p class="mt-2 text-sm text-gray-600">${demandCopy}</p>
                            </div>
                        </div>

                        <div class="rounded-[22px] border border-black/5 bg-[#faf7ef] p-4">
                            <div class="flex items-end justify-between gap-4">
                                <div>
                                    <p class="text-[0.64rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Dynamic Rate</p>
                                    <p class="mt-2 text-3xl font-extrabold text-[#171717]">${formatCurrency(room.display_price)}</p>
                                </div>
                                <div class="w-1/2">
                                    <p class="mb-2 text-[0.64rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Demand Signal</p>
                                    <div class="demand-bar"><span style="width:${Math.min(Math.round((room.display_price / room.base_price) * 60), 100)}%"></span></div>
                                </div>
                            </div>
                        </div>

                        <div class="grid gap-2">${locationHighlights}</div>

                        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <button onclick="handleBookingAction(${room.id}, '${escapeHtml(room.status)}')" class="${room.status === "Available" ? "btn-gold" : "btn-secondary"} suite-action-btn">${actionLabel}</button>
                            <button onclick="showRoomSuggestion(${room.id})" class="btn-secondary suite-action-btn">Smart Suggestions</button>
                        </div>
                    </div>
                </article>
            `;
        })
        .join("");

    if (!filteredRooms.length) {
        grid.innerHTML = `
            <div class="luxury-card rounded-[28px] p-8 xl:col-span-3">
                <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">No matches found</p>
                <p class="mt-3 text-base text-gray-600">Try a different hotel, unit name, or availability filter.</p>
            </div>
        `;
    }
}

function renderAdminRooms() {
    const tableBody = document.getElementById("admin-room-table-body");

    if (!tableBody) {
        return;
    }

    const filteredRooms = getFilteredAdminRooms();

    tableBody.innerHTML = filteredRooms.map((room) => `
        <tr>
            <td>
                <div>
                    <p class="font-semibold text-[#171717]">${escapeHtml(room.name)}</p>
                    <p class="mt-1 text-sm text-gray-500">${escapeHtml(room.hotel_name)} • ${escapeHtml(room.type)} • ${escapeHtml(room.capacity)}</p>
                </div>
            </td>
            <td><span class="status-pill ${getStatusClass(room.status)}">${escapeHtml(room.status)}</span></td>
            <td>${escapeHtml(room.capacity)}</td>
            <td>${room.status === "Available" ? "Open for booking" : room.status === "Reserved" ? "Awaiting confirmation" : "Deposit secured"}</td>
            <td>${room.is_peak ? "Peak +15%" : "Stable / value day"}</td>
            <td>
                <div class="flex flex-wrap gap-2">
                    <button type="button" onclick="updateAdminRoomStatus(${room.id}, 'Available')" class="${getAdminStatusButtonClass(room.status, 'Available')}">Available</button>
                    <button type="button" onclick="updateAdminRoomStatus(${room.id}, 'Reserved')" class="${getAdminStatusButtonClass(room.status, 'Reserved')}">Reserved</button>
                    <button type="button" onclick="updateAdminRoomStatus(${room.id}, 'Booked')" class="${getAdminStatusButtonClass(room.status, 'Booked')}">Booked</button>
                </div>
            </td>
        </tr>
    `).join("");

    if (!filteredRooms.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-gray-500">No rooms matched the selected hotel, unit name, or status.</td>
            </tr>
        `;
    }
}

async function updateAdminRoomStatus(roomId, status) {
    try {
        const response = await fetch(`/api/admin/rooms/${roomId}/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to update room status.");
        }

        const roomIndex = currentRooms.findIndex((room) => room.id === roomId);
        if (roomIndex !== -1) {
            currentRooms[roomIndex] = data.room;
        }

        renderAdminRooms();
        renderAdminMetrics();
        renderServiceWatchlist();
        showAdminFeedback(data.message, true);
    } catch (error) {
        console.error("Error updating room status:", error);
        showAdminFeedback(error.message, false);
    }
}

function showAdminFeedback(message, isSuccess) {
    const feedback = document.getElementById("admin-status-feedback");

    if (!feedback) {
        return;
    }

    feedback.classList.remove("hidden", "border-[#227a52]/20", "bg-[#eef8f2]", "text-[#1f6a47]", "border-[#b4534c]/20", "bg-[#fff3f1]", "text-[#8d4038]");
    feedback.classList.add(
        isSuccess ? "border-[#227a52]/20" : "border-[#b4534c]/20",
        isSuccess ? "bg-[#eef8f2]" : "bg-[#fff3f1]",
        isSuccess ? "text-[#1f6a47]" : "text-[#8d4038]"
    );
    feedback.textContent = message;
}

function renderAdminMetrics() {
    const pendingCount = document.getElementById("pending-checkins-count");
    const pendingCopy = document.getElementById("pending-checkins-copy");
    const ondutyCount = document.getElementById("onduty-staff-count");

    if (pendingCount && pendingCopy) {
        const totalPending = currentRooms.filter((room) => ["Booked", "Reserved"].includes(room.status)).length;
        const reservedCount = currentRooms.filter((room) => room.status === "Reserved").length;
        const bookedCount = currentRooms.filter((room) => room.status === "Booked").length;

        pendingCount.textContent = String(totalPending);
        pendingCopy.textContent = `Total of ${bookedCount} booked and ${reservedCount} reserved guests.`;
    }

    if (ondutyCount) {
        ondutyCount.textContent = String(currentEmployees.filter((employee) => employee.duty_status === "ONDUTY").length);
    }
}

function getAdminStatusButtonClass(currentStatus, buttonStatus) {
    const isActive = currentStatus === buttonStatus;
    const baseClass = "!min-h-[2.5rem] !px-4";

    if (!isActive) {
        return `btn-secondary ${baseClass}`;
    }

    if (buttonStatus === "Booked") {
        return `btn-gold ${baseClass}`;
    }

    if (buttonStatus === "Reserved") {
        return `status-action status-action-reserved ${baseClass}`;
    }

    return `status-action status-action-available ${baseClass}`;
}

function renderServiceWatchlist() {
    const container = document.getElementById("service-watchlist");

    if (!container) {
        return;
    }

    const watchlistRooms = getFilteredWatchlistRooms();

    if (!watchlistRooms.length) {
        container.innerHTML = `
            <div class="luxury-card rounded-[24px] p-5">
                <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">No Matching Units</p>
                <p class="mt-3 text-sm leading-6 text-gray-600">No booked or reserved units matched the current watchlist filter.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = watchlistRooms.map((room) => `
        <div class="luxury-card rounded-[24px] p-5">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">${escapeHtml(room.hotel_name)}</p>
                    <h3 class="mt-2 text-lg font-semibold text-[#171717]">${escapeHtml(room.name)}</h3>
                    <p class="mt-2 text-sm leading-6 text-gray-600">${escapeHtml(room.type)} • ${escapeHtml(room.capacity)} • ${escapeHtml(room.location)}</p>
                </div>
                <span class="status-pill ${getStatusClass(room.status)}">${escapeHtml(room.status)}</span>
            </div>
            <div class="mt-4 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
                <div class="option-tile p-4">
                    <p class="font-semibold text-[#171717]">Reservation State</p>
                    <p class="mt-1">${room.status === "Booked" ? "Fully blocked on guest booking views." : "Held for confirmation and visible as reserved."}</p>
                </div>
                <div class="option-tile p-4">
                    <p class="font-semibold text-[#171717]">Nightly Rate</p>
                    <p class="mt-1">${formatCurrency(room.display_price)} with ${room.is_peak ? "peak pricing active" : "standard demand pricing"}.</p>
                </div>
            </div>
        </div>
    `).join("");
}

function renderTransactions() {
    const tableBody = document.getElementById("transaction-table-body");

    if (!tableBody) {
        return;
    }

    const filteredTransactions = getFilteredTransactions();

    if (!filteredTransactions.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center text-gray-500">No booked or reserved transactions matched the current filters.</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = filteredTransactions.map((transaction) => `
        <tr>
            <td>${escapeHtml(transaction.timestamp)}</td>
            <td>
                <div>
                    <p class="font-semibold text-[#171717]">${escapeHtml(transaction.hotel_name)}</p>
                    <p class="mt-1 text-sm text-gray-500">${escapeHtml(transaction.unit_name)}</p>
                </div>
            </td>
            <td>${escapeHtml(transaction.guest_name || "Guest not set")}</td>
            <td><span class="status-pill ${getStatusClass(transaction.status)}">${escapeHtml(transaction.status)}</span></td>
            <td>${escapeHtml(transaction.source)}</td>
            <td>${escapeHtml(transaction.payment_type)}</td>
            <td>${escapeHtml(formatCurrency(transaction.amount || 0))}</td>
            <td>
                <div>
                    <p class="font-semibold text-[#171717]">${escapeHtml(transaction.receipt)}</p>
                    <p class="mt-1 text-sm text-gray-500">${escapeHtml(transaction.notes || "")}</p>
                </div>
            </td>
            <td>
                <div class="flex flex-col gap-2">
                    <select id="transaction-status-${transaction.id}" class="luxury-select !py-2 !text-sm">
                        ${["Booked", "Reserved", "Completed", "Cancelled"].map((status) => `
                            <option value="${status}" ${transaction.status === status ? "selected" : ""}>${status}</option>
                        `).join("")}
                    </select>
                    <div class="flex flex-wrap gap-2">
                        <button type="button" onclick="updateTransactionStatus(${transaction.id})" class="btn-secondary !min-h-[2.4rem] !px-4">Update</button>
                        <button type="button" onclick="contactGuest(${transaction.id})" class="btn-secondary !min-h-[2.4rem] !px-4">Message</button>
                        ${superadminEnabled ? `<button type="button" onclick="deleteTransaction(${transaction.id})" class="btn-gold !min-h-[2.4rem] !px-4">Delete</button>` : ""}
                    </div>
                </div>
            </td>
        </tr>
    `).join("");
}

function renderEmployees() {
    const tableBody = document.getElementById("employee-table-body");
    if (!tableBody) {
        return;
    }

    if (!currentEmployees.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center text-gray-500">No employee records available.</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = currentEmployees.map((employee) => `
        <tr>
            <td>${escapeHtml(employee.id_number)}</td>
            <td>
                <div>
                    <p class="font-semibold text-[#171717]">${escapeHtml(employee.name)}</p>
                    <p class="mt-1 text-sm text-gray-500">${employee.last_notice ? escapeHtml(employee.last_notice) : "No active strike notice."}</p>
                </div>
            </td>
            <td>${escapeHtml(employee.contact_number)}</td>
            <td>${escapeHtml(String(employee.age))}</td>
            <td>${escapeHtml(employee.gender)}</td>
            <td>${escapeHtml(employee.role)}</td>
            <td>
                <div class="flex flex-col gap-2">
                    <span class="status-pill ${employee.duty_status === "ONDUTY" ? "available" : employee.duty_status === "OFFDUTY" ? "reserved" : "booked"}">${escapeHtml(employee.duty_status)}</span>
                    ${employee.employee_of_month ? '<span class="status-pill peak">Employee of the Month</span>' : ''}
                </div>
            </td>
            <td>${escapeHtml(String(employee.strikes || 0))}</td>
            <td>${escapeHtml(formatCurrency(employee.bonus || 0))}</td>
            <td>
                <div class="flex flex-wrap gap-2">
                    <button type="button" onclick="viewEmployeeInfo(${employee.id})" class="btn-secondary !min-h-[2.4rem] !px-4">View</button>
                    ${superadminEnabled ? `<button type="button" onclick="openEmployeeEdit(${employee.id})" class="btn-secondary !min-h-[2.4rem] !px-4">Edit</button>` : ""}
                    ${superadminEnabled ? `<button type="button" onclick="setEmployeeOfMonth(${employee.id})" class="btn-secondary !min-h-[2.4rem] !px-4">EOTM</button>` : ""}
                    ${superadminEnabled ? `<button type="button" onclick="grantEmployeeBonus(${employee.id})" class="btn-secondary !min-h-[2.4rem] !px-4">Bonus</button>` : ""}
                    ${superadminEnabled ? `<button type="button" onclick="issueEmployeeStrike(${employee.id})" class="btn-secondary !min-h-[2.4rem] !px-4">Strike</button>` : ""}
                    ${superadminEnabled ? `<button type="button" onclick="deleteEmployee(${employee.id})" class="btn-gold !min-h-[2.4rem] !px-4">Delete</button>` : ""}
                </div>
            </td>
        </tr>
    `).join("");
}

function showEmployeeFeedback(message, isSuccess) {
    const feedback = document.getElementById("employee-feedback");
    if (!feedback) {
        return;
    }

    feedback.classList.remove("hidden", "border-[#227a52]/20", "bg-[#eef8f2]", "text-[#1f6a47]", "border-[#b4534c]/20", "bg-[#fff3f1]", "text-[#8d4038]");
    feedback.classList.add(
        isSuccess ? "border-[#227a52]/20" : "border-[#b4534c]/20",
        isSuccess ? "bg-[#eef8f2]" : "bg-[#fff3f1]",
        isSuccess ? "text-[#1f6a47]" : "text-[#8d4038]"
    );
    feedback.textContent = message;
}

async function viewEmployeeInfo(employeeId) {
    const employee = currentEmployees.find((item) => item.id === employeeId);
    if (!employee) {
        return;
    }

    const history = [
        ...(employee.bonus_history || []).map((entry) => ({
            category: "Bonus",
            title: `Received ${formatCurrency(entry.amount || 0)}`,
            details: entry.details || "Bonus granted.",
            date: entry.awarded_at || "",
        })),
        ...(employee.strike_history || []).map((entry) => ({
            category: "Strike",
            title: "Received a strike notice",
            details: entry.details || "Policy notice issued.",
            date: entry.awarded_at || "",
        })),
        ...(employee.recognition_history || []).map((entry) => ({
            category: "EOMT",
            title: entry.type || "Employee of the Month",
            details: entry.details || "Recognition granted.",
            date: entry.awarded_at || "",
        })),
    ].sort((a, b) => String(b.date).localeCompare(String(a.date)));

    const historyMarkup = history.length
        ? history.map((entry) => `
            <div class="rounded-[20px] border border-black/5 bg-white/80 p-4">
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <p class="text-sm font-semibold text-[#171717]">${escapeHtml(entry.title)}</p>
                    <span class="status-pill ${entry.category === "Strike" ? "booked" : entry.category === "Bonus" ? "available" : "peak"}">${escapeHtml(entry.category)}</span>
                </div>
                <p class="mt-2 text-sm text-gray-600">${escapeHtml(entry.details)}</p>
                <p class="mt-3 text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-gray-400">Date Received: ${escapeHtml(entry.date || "No exact date recorded")}</p>
            </div>
        `).join("")
        : `
            <div class="rounded-[20px] border border-dashed border-black/10 bg-white/70 p-5 text-sm text-gray-600">
                No bonus, strike, or Employee of the Month history has been recorded for this employee yet.
            </div>
        `;

    await showAdminOverlay({
        title: employee.name,
        message: `
            <div class="space-y-4">
                <div class="rounded-[20px] border border-black/5 bg-white/80 p-4">
                    <p class="text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-gray-400">Job History Summary</p>
                    <p class="mt-3 text-sm text-gray-600">${escapeHtml(employee.role)} • ${escapeHtml(employee.id_number)} • Current Duty: ${escapeHtml(employee.duty_status)}</p>
                </div>
                <div class="grid gap-4">
                    ${historyMarkup}
                </div>
            </div>
        `,
        mode: "alert",
        confirmLabel: "Close",
        allowHtml: true,
    });
}

function openNewEmployeeOverlay() {
    if (!superadminEnabled) {
        showAdminOverlay({
            title: "Create Locked",
            message: "Superadmin access is required to add a new employee.",
            mode: "alert",
            confirmLabel: "Close",
        });
        return;
    }

    const overlay = document.getElementById("employee-create-overlay");
    if (!overlay) {
        return;
    }

    ["new-id-number", "new-name", "new-contact-number", "new-age", "new-gender", "new-role"].forEach((id) => {
        const node = document.getElementById(id);
        if (node) node.value = "";
    });
    document.getElementById("new-duty-status").value = "ONDUTY";
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
}

function closeNewEmployeeOverlay() {
    const overlay = document.getElementById("employee-create-overlay");
    if (!overlay) {
        return;
    }
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
}

async function createEmployee() {
    try {
        const response = await fetch("/api/admin/employees", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id_number: document.getElementById("new-id-number").value,
                name: document.getElementById("new-name").value,
                contact_number: document.getElementById("new-contact-number").value,
                age: document.getElementById("new-age").value,
                gender: document.getElementById("new-gender").value,
                role: document.getElementById("new-role").value,
                duty_status: document.getElementById("new-duty-status").value,
            })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Unable to create employee.");
        }

        currentEmployees.push(data.employee);
        closeNewEmployeeOverlay();
        renderEmployees();
        renderAdminMetrics();
        showEmployeeFeedback(data.message, true);
    } catch (error) {
        showEmployeeFeedback(error.message, false);
    }
}

async function setEmployeeOfMonth(employeeId) {
    if (!superadminEnabled) {
        await showAdminOverlay({
            title: "Employee of the Month Locked",
            message: "Superadmin access is required to assign Employee of the Month.",
            mode: "alert",
            confirmLabel: "Close",
        });
        return;
    }

    try {
        const response = await fetch(`/api/admin/employees/${employeeId}/employee-of-month`, {
            method: "POST"
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Unable to set Employee of the Month.");
        }

        currentEmployees = data.employees;
        renderEmployees();
        showEmployeeFeedback(data.message, true);
    } catch (error) {
        showEmployeeFeedback(error.message, false);
    }
}

async function grantEmployeeBonus(employeeId) {
    if (!superadminEnabled) {
        await showAdminOverlay({
            title: "Bonus Locked",
            message: "Superadmin access is required to grant bonuses.",
            mode: "alert",
            confirmLabel: "Close",
        });
        return;
    }

    const employee = currentEmployees.find((item) => item.id === employeeId);
    if (!employee) {
        return;
    }

    const bonus = await showAdminOverlay({
        title: "Grant Bonus",
        message: `Enter the bonus amount for ${employee.name}.`,
        mode: "prompt",
        confirmLabel: "Grant Bonus",
        cancelLabel: "Cancel",
        inputLabel: "Bonus Amount",
        inputPlaceholder: "Enter bonus amount in PHP",
    });

    if (!bonus) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/employees/${employeeId}/bonus`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bonus })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Unable to grant bonus.");
        }

        const employeeIndex = currentEmployees.findIndex((item) => item.id === employeeId);
        if (employeeIndex !== -1) {
            currentEmployees[employeeIndex] = data.employee;
        }
        renderEmployees();
        showEmployeeFeedback(data.message, true);
    } catch (error) {
        showEmployeeFeedback(error.message, false);
    }
}

function openEmployeeEdit(employeeId) {
    if (!superadminEnabled) {
        showAdminOverlay({
            title: "Edit Locked",
            message: "Superadmin access is required to update employee information.",
            mode: "alert",
            confirmLabel: "Close",
        });
        return;
    }

    const employee = currentEmployees.find((item) => item.id === employeeId);
    const overlay = document.getElementById("employee-edit-overlay");
    if (!employee || !overlay) {
        return;
    }

    editingEmployeeId = employeeId;
    document.getElementById("edit-id-number").value = employee.id_number;
    document.getElementById("edit-name").value = employee.name;
    document.getElementById("edit-contact-number").value = employee.contact_number;
    document.getElementById("edit-age").value = employee.age;
    document.getElementById("edit-gender").value = employee.gender;
    document.getElementById("edit-role").value = employee.role;
    document.getElementById("edit-duty-status").value = employee.duty_status;
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
}

function closeEmployeeEditOverlay() {
    const overlay = document.getElementById("employee-edit-overlay");
    editingEmployeeId = null;
    if (!overlay) {
        return;
    }
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
}

async function saveEmployeeEdit() {
    if (!editingEmployeeId) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/employees/${editingEmployeeId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id_number: document.getElementById("edit-id-number").value,
                name: document.getElementById("edit-name").value,
                contact_number: document.getElementById("edit-contact-number").value,
                age: document.getElementById("edit-age").value,
                gender: document.getElementById("edit-gender").value,
                role: document.getElementById("edit-role").value,
                duty_status: document.getElementById("edit-duty-status").value,
            })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Unable to update employee.");
        }

        const employeeIndex = currentEmployees.findIndex((item) => item.id === editingEmployeeId);
        if (employeeIndex !== -1) {
            currentEmployees[employeeIndex] = data.employee;
        }
        closeEmployeeEditOverlay();
        renderEmployees();
        renderAdminMetrics();
        showEmployeeFeedback(data.message, true);
    } catch (error) {
        showEmployeeFeedback(error.message, false);
    }
}

async function issueEmployeeStrike(employeeId) {
    if (!superadminEnabled) {
        await showAdminOverlay({
            title: "Strike Locked",
            message: "Superadmin access is required to issue strike notices.",
            mode: "alert",
            confirmLabel: "Close",
        });
        return;
    }

    const employee = currentEmployees.find((item) => item.id === employeeId);
    if (!employee) {
        return;
    }

    const notice = await showAdminOverlay({
        title: "Strike Notice",
        message: `Notify ${employee.name} about a strike for violating hotel rules.`,
        mode: "prompt",
        confirmLabel: "Send Notice",
        cancelLabel: "Cancel",
        inputLabel: "Strike Notice",
        inputPlaceholder: "State the rule violation and notice details.",
    });

    if (!notice) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/employees/${employeeId}/strike`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notice })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Unable to send strike notice.");
        }

        const employeeIndex = currentEmployees.findIndex((item) => item.id === employeeId);
        if (employeeIndex !== -1) {
            currentEmployees[employeeIndex] = data.employee;
        }
        renderEmployees();
        showEmployeeFeedback(data.message, true);
    } catch (error) {
        showEmployeeFeedback(error.message, false);
    }
}

async function deleteEmployee(employeeId) {
    if (!superadminEnabled) {
        await showAdminOverlay({
            title: "Delete Locked",
            message: "Superadmin access is required to delete employee records.",
            mode: "alert",
            confirmLabel: "Close",
        });
        return;
    }

    const confirmed = await showAdminOverlay({
        title: "Delete Employee",
        message: "Delete this employee record permanently?",
        mode: "confirm",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
    });
    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/employees/${employeeId}`, {
            method: "DELETE"
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Unable to delete employee.");
        }

        currentEmployees = currentEmployees.filter((item) => item.id !== employeeId);
        renderEmployees();
        renderAdminMetrics();
        showEmployeeFeedback(data.message, true);
    } catch (error) {
        showEmployeeFeedback(error.message, false);
    }
}

async function promptSuperadminAccess() {
    let showCodeError = false;

    while (true) {
        const code = await showAdminOverlay({
            title: "Superadmin Access",
            message: "Enter the 4-digit superadmin code to unlock delete controls for transactions.",
            mode: "code",
            confirmLabel: "Unlock",
            cancelLabel: "Cancel",
            showCodeError,
        });

        if (!code) {
            return;
        }

        try {
            const response = await fetch("/api/admin/superadmin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code })
            });
            const data = await response.json();

            if (!response.ok) {
                showCodeError = true;
                continue;
            }

            superadminEnabled = true;
            renderTransactions();
            renderEmployees();
            await showAdminOverlay({
                title: "Access Granted",
                message: "Superadmin access granted.",
                mode: "alert",
                confirmLabel: "Continue",
            });
            return;
        } catch (error) {
            await showAdminOverlay({
                title: "Access Denied",
                message: error.message,
                mode: "alert",
                confirmLabel: "Close",
            });
            return;
        }
    }
}

async function switchToAdminMode() {
    try {
        const response = await fetch("/api/admin/superadmin/logout", {
            method: "POST"
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to switch back to admin mode.");
        }

        superadminEnabled = false;
        renderTransactions();
        renderEmployees();
        await showAdminOverlay({
            title: "Admin Mode",
            message: "Delete locked. You are now using regular admin mode.",
            mode: "alert",
            confirmLabel: "Okay",
        });
    } catch (error) {
        await showAdminOverlay({
            title: "Unable to Switch",
            message: error.message,
            mode: "alert",
            confirmLabel: "Close",
        });
    }
}

async function updateTransactionStatus(transactionId) {
    const select = document.getElementById(`transaction-status-${transactionId}`);
    if (!select) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/transactions/${transactionId}/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: select.value })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to update transaction.");
        }

        const transactionIndex = currentTransactions.findIndex((transaction) => transaction.id === transactionId);
        if (transactionIndex !== -1) {
            currentTransactions[transactionIndex] = data.transaction;
        }

        const roomIndex = currentRooms.findIndex((room) => room.id === data.transaction.room_id);
        if (roomIndex !== -1 && data.room) {
            currentRooms[roomIndex] = data.room;
        }

        renderTransactions();
        await showAdminOverlay({
            title: "Transaction Updated",
            message: data.message,
            mode: "alert",
            confirmLabel: "Close",
        });
    } catch (error) {
        await showAdminOverlay({
            title: "Update Failed",
            message: error.message,
            mode: "alert",
            confirmLabel: "Close",
        });
    }
}

async function contactGuest(transactionId) {
    const transaction = currentTransactions.find((item) => item.id === transactionId);
    if (!transaction) {
        return;
    }

    const message = await showAdminOverlay({
        title: "Guest Communication",
        message: `Send a message to ${transaction.guest_name || "the guest"} for ${transaction.unit_name}.`,
        mode: "prompt",
        confirmLabel: "Queue Message",
        cancelLabel: "Cancel",
        inputLabel: "Message",
        inputPlaceholder: `Hello ${transaction.guest_name || "Guest"}, this is LuxeStay support regarding your ${transaction.status.toLowerCase()} reservation for ${transaction.unit_name}.`,
        defaultValue: `Hello ${transaction.guest_name || "Guest"}, this is LuxeStay support regarding your ${transaction.status.toLowerCase()} reservation for ${transaction.unit_name}.`,
    });

    if (!message) {
        return;
    }

    await showAdminOverlay({
        title: "Message Queued",
        message: `Message queued for ${transaction.guest_name || "the guest"}:\n\n${message}`,
        mode: "alert",
        confirmLabel: "Close",
    });
}

async function deleteTransaction(transactionId) {
    if (!superadminEnabled) {
        await showAdminOverlay({
            title: "Delete Locked",
            message: "Superadmin access is required to delete transactions.",
            mode: "alert",
            confirmLabel: "Close",
        });
        return;
    }

    const confirmed = await showAdminOverlay({
        title: "Delete Transaction",
        message: "Delete this transaction permanently?",
        mode: "confirm",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
    });
    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/transactions/${transactionId}`, {
            method: "DELETE"
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to delete transaction.");
        }

        currentTransactions = currentTransactions.filter((transaction) => transaction.id !== transactionId);
        renderTransactions();
        await showAdminOverlay({
            title: "Transaction Deleted",
            message: data.message,
            mode: "alert",
            confirmLabel: "Close",
        });
    } catch (error) {
        await showAdminOverlay({
            title: "Delete Failed",
            message: error.message,
            mode: "alert",
            confirmLabel: "Close",
        });
    }
}

function showAdminOverlay({
    title = "Notice",
    message = "",
    mode = "alert",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    inputLabel = "Input",
    inputPlaceholder = "",
    defaultValue = "",
    showCodeError = false,
    allowHtml = false,
}) {
    const overlay = document.getElementById("admin-overlay");
    if (!overlay) {
        return Promise.resolve(mode === "prompt" ? "" : true);
    }

    const titleNode = document.getElementById("admin-overlay-title");
    const messageNode = document.getElementById("admin-overlay-message");
    const inputWrap = document.getElementById("admin-overlay-input-wrap");
    const inputLabelNode = document.getElementById("admin-overlay-label");
    const inputNode = document.getElementById("admin-overlay-input");
    const codeWrap = document.getElementById("admin-overlay-code-wrap");
    const codeError = document.getElementById("admin-code-error");
    const cancelButton = document.getElementById("admin-overlay-cancel");
    const confirmButton = document.getElementById("admin-overlay-confirm");
    const codeInputs = [0, 1, 2, 3].map((index) => document.getElementById(`admin-code-${index}`));

    titleNode.textContent = title;
    if (allowHtml) {
        messageNode.innerHTML = message;
    } else {
        messageNode.textContent = message;
    }
    confirmButton.textContent = confirmLabel;
    cancelButton.textContent = cancelLabel;

    const needsInput = mode === "prompt";
    const needsCode = mode === "code";
    inputWrap.classList.toggle("hidden", !needsInput);
    codeWrap.classList.toggle("hidden", !needsCode);
    inputLabelNode.textContent = inputLabel;
    inputNode.placeholder = inputPlaceholder;
    inputNode.value = defaultValue;
    cancelButton.classList.toggle("hidden", mode === "alert");
    codeError.classList.toggle("hidden", !showCodeError);

    codeInputs.forEach((input, index) => {
        if (!input) {
            return;
        }

        input.value = "";
        input.oninput = (event) => {
            input.value = event.target.value.replace(/\D/g, "").slice(0, 1);
            if (input.value && index < codeInputs.length - 1) {
                codeInputs[index + 1]?.focus();
            }
        };
        input.onkeydown = (event) => {
            if (event.key === "Backspace" && !input.value && index > 0) {
                codeInputs[index - 1]?.focus();
            }
        };
    });

    overlay.classList.remove("hidden");
    overlay.classList.add("flex");

    if (needsInput) {
        window.setTimeout(() => inputNode.focus(), 60);
    } else if (needsCode) {
        window.setTimeout(() => codeInputs[0]?.focus(), 60);
    }

    return new Promise((resolve) => {
        adminOverlayResolver = { resolve, mode };
    });
}

function closeAdminOverlay(confirmed) {
    const overlay = document.getElementById("admin-overlay");
    const inputNode = document.getElementById("admin-overlay-input");
    const codeInputs = [0, 1, 2, 3].map((index) => document.getElementById(`admin-code-${index}`));

    if (!overlay || !adminOverlayResolver) {
        return;
    }

    overlay.classList.add("hidden");
    overlay.classList.remove("flex");

    const { resolve, mode } = adminOverlayResolver;
    adminOverlayResolver = null;

    if (mode === "prompt") {
        resolve(confirmed ? inputNode.value.trim() : "");
        return;
    }

    if (mode === "code") {
        resolve(confirmed ? codeInputs.map((input) => input?.value || "").join("") : "");
        return;
    }

    if (mode === "confirm") {
        resolve(Boolean(confirmed));
        return;
    }

    resolve(true);
}

function renderCalendar() {
    const calendarGrid = document.getElementById("calendar-grid");
    const roomFilter = document.getElementById("calendar-room-filter");
    const arrivalInput = document.getElementById("arrival-date");
    const departureInput = document.getElementById("departure-date");

    if (!calendarGrid || !roomFilter || !arrivalInput || !departureInput) {
        return;
    }

    const selectedId = roomFilter.value;
    const availableRooms = getFilteredGuestRooms();
    const baseRoom = selectedId === "all" ? availableRooms[0] || currentRooms[0] : currentRooms.find((room) => String(room.id) === selectedId);
    const profile = baseRoom ? buildRoomProfile(baseRoom) : null;
    const startDate = new Date(arrivalInput.value);
    const days = 14;

    if (!baseRoom || !profile || Number.isNaN(startDate.getTime())) {
        calendarGrid.innerHTML = "";
        return;
    }

    calendarGrid.innerHTML = Array.from({ length: days }, (_, index) => {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + index);
        const state = getCalendarState(baseRoom, profile, index);
        const demand = profile.demand[index % profile.demand.length];
        const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
        const suggestion = state === "booked"
            ? "Booked"
            : state === "reserved"
                ? "Reserved"
            : state === "peak"
                ? "Peak"
                : "Saver";

        return `
            <div class="calendar-cell ${state}">
                <div class="calendar-top">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">${weekday}</p>
                        <p class="mt-2 text-lg font-extrabold text-[#171717]">${label}</p>
                    </div>
                    <span class="calendar-badge ${getStatusClass(state)}">${suggestion}</span>
                </div>
                <div class="mt-4">
                    <p class="mb-2 text-[0.64rem] font-extrabold uppercase tracking-[0.18em] text-gray-400">Demand</p>
                    <div class="demand-bar"><span style="width:${demand}%"></span></div>
                </div>
            </div>
        `;
    }).join("");

    updateSuggestionBox(baseRoom.id);
}

function showRoomSuggestion(roomId) {
    updateSuggestionBox(roomId, true);
    document.getElementById("availability")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateSuggestionBox(roomId, forceRecommendation = false) {
    const suggestionBox = document.getElementById("suggestion-box");
    const room = currentRooms.find((item) => item.id === roomId);
    const profile = room ? buildRoomProfile(room) : null;

    if (!suggestionBox || !room || !profile) {
        return;
    }

    const alternatives = (profile.suggestions || [])
        .map((id) => currentRooms.find((item) => item.id === id))
        .filter(Boolean)
        .slice(0, 2);

    if (room.status === "Available" && !forceRecommendation) {
        suggestionBox.innerHTML = `
            <p class="font-semibold text-[#171717]">${escapeHtml(room.name)} is currently open.</p>
            <p class="mt-2 text-gray-600">Recommended booking window: ${room.is_peak ? "reserve early because demand is elevated." : "today is a softer pricing day for this suite."}</p>
        `;
        return;
    }

    const alternativeMarkup = alternatives
        .map((alternative) => `
            <button type="button" onclick="handleBookingAction(${alternative.id}, '${escapeHtml(alternative.status)}')" class="option-tile mt-3 flex w-full items-center justify-between gap-4 p-4 text-left">
                <div>
                    <p class="text-sm font-semibold text-[#171717]">${escapeHtml(alternative.name)}</p>
                    <p class="mt-1 text-sm text-gray-500">${escapeHtml(alternative.type)} with ${escapeHtml(alternative.capacity)}</p>
                </div>
                <span class="text-sm font-semibold text-[#171717]">${formatCurrency(alternative.display_price)}</span>
            </button>
        `)
        .join("");

    suggestionBox.innerHTML = `
        <p class="font-semibold text-[#171717]">${escapeHtml(room.name)} is full on the selected date window.</p>
        <p class="mt-2 text-gray-600">Similar rooms are still available and matched by ambience, capacity, and pricing profile.</p>
        ${alternativeMarkup}
    `;
}

function getFilteredGuestRooms() {
    const searchValue = document.getElementById("suite-search")?.value.trim().toLowerCase() || "";
    const hotelValue = document.getElementById("suite-hotel-filter")?.value || "all";
    const statusValue = document.getElementById("suite-status-filter")?.value || "all";

    return currentRooms.filter((room) => {
        const matchesSearch = !searchValue
            || room.name.toLowerCase().includes(searchValue)
            || room.hotel_name.toLowerCase().includes(searchValue);
        const matchesHotel = hotelValue === "all" || room.hotel_name === hotelValue;
        const matchesStatus = statusValue === "all" || room.status === statusValue;

        return matchesSearch && matchesHotel && matchesStatus;
    });
}

function getFilteredAdminRooms() {
    const searchValue = document.getElementById("admin-room-search")?.value.trim().toLowerCase() || "";
    const hotelValue = document.getElementById("admin-hotel-filter")?.value || "all";
    const statusValue = document.getElementById("admin-status-filter")?.value || "all";

    return currentRooms.filter((room) => {
        const matchesSearch = !searchValue
            || room.name.toLowerCase().includes(searchValue)
            || room.hotel_name.toLowerCase().includes(searchValue);
        const matchesHotel = hotelValue === "all" || room.hotel_name === hotelValue;
        const matchesStatus = statusValue === "all" || room.status === statusValue;

        return matchesSearch && matchesHotel && matchesStatus;
    });
}

function getFilteredWatchlistRooms() {
    const searchValue = document.getElementById("watchlist-search")?.value.trim().toLowerCase() || "";
    const statusValue = document.getElementById("watchlist-status-filter")?.value || "all";

    return currentRooms.filter((room) => {
        if (!["Booked", "Reserved"].includes(room.status)) {
            return false;
        }

        const matchesSearch = !searchValue
            || room.name.toLowerCase().includes(searchValue)
            || room.hotel_name.toLowerCase().includes(searchValue);
        const matchesStatus = statusValue === "all" || room.status === statusValue;

        return matchesSearch && matchesStatus;
    });
}

function getFilteredTransactions() {
    const searchValue = document.getElementById("transaction-search")?.value.trim().toLowerCase() || "";
    const receiptValue = document.getElementById("transaction-receipt-filter")?.value.trim().toLowerCase() || "";
    const hotelValue = document.getElementById("transaction-hotel-filter")?.value || "all";
    const statusValue = document.getElementById("transaction-status-filter")?.value || "all";
    const sourceValue = document.getElementById("transaction-source-filter")?.value || "all";

    return currentTransactions.filter((transaction) => {
        const matchesSearch = !searchValue
            || transaction.unit_name.toLowerCase().includes(searchValue)
            || transaction.hotel_name.toLowerCase().includes(searchValue);
        const matchesReceipt = !receiptValue
            || String(transaction.receipt || "").toLowerCase().includes(receiptValue);
        const matchesHotel = hotelValue === "all" || transaction.hotel_name === hotelValue;
        const matchesStatus = statusValue === "all" || transaction.status === statusValue;
        const matchesSource = sourceValue === "all" || transaction.source === sourceValue;

        return matchesSearch && matchesReceipt && matchesHotel && matchesStatus && matchesSource;
    });
}

function buildRoomProfile(room) {
    const moodLabel = room.mood || "Leisure";
    const normalizedMood = moodLabel.toLowerCase();
    let moodTags = [moodLabel, room.city, room.district];
    let videoLabel = "Signature room preview";

    if (normalizedMood.includes("romantic")) {
        moodTags = [moodLabel, "Oceanfront", "Premium View"];
        videoLabel = "2 minute cinematic preview";
    } else if (normalizedMood.includes("work")) {
        moodTags = [moodLabel, "Skyline", "Executive"];
        videoLabel = "Executive desk setup walkthrough";
    } else if (normalizedMood.includes("family")) {
        moodTags = [moodLabel, "Garden Wing", "Flexible Layout"];
        videoLabel = "Family loft highlight reel";
    }

    const profileSeed = room.id % 6;
    const suggestions = currentRooms
        .filter((item) => item.id !== room.id && item.hotel_name !== room.hotel_name)
        .slice(0, 3)
        .map((item) => item.id);

    return {
        moodTags,
        videoLabel,
        calendarStatus: [
            "available",
            profileSeed % 2 === 0 ? "peak" : "low",
            "available",
            profileSeed % 3 === 0 ? "booked" : "peak",
            "available",
            "low",
            "available",
            "peak",
            "available",
            profileSeed % 2 === 0 ? "booked" : "available",
            "low",
            "available",
            "peak",
            "available",
        ],
        demand: Array.from({ length: 14 }, (_, index) => 32 + ((room.id * 9 + index * 11) % 69)),
        attractions: [
            `${room.city} landmark in ${2 + (room.id % 6)} min`,
            `${room.district} access in ${4 + (room.id % 5)} min`,
            `Airport route in ${20 + (room.id % 12)} min`,
        ],
        suggestions,
    };
}

function getCalendarState(room, profile, index) {
    if (room.status === "Booked") {
        return "booked";
    }

    if (room.status === "Reserved") {
        return index < 7 ? "reserved" : "available";
    }

    return profile.calendarStatus[index % profile.calendarStatus.length];
}

function getStatusClass(status) {
    const normalized = String(status).toLowerCase();

    if (normalized === "available" || normalized === "low") {
        return "available";
    }

    if (normalized === "reserved") {
        return "reserved";
    }

    if (normalized === "booked") {
        return "booked";
    }

    if (normalized === "peak") {
        return "peak";
    }

    return "available";
}

async function handleBookingAction(id, status) {
    const room = currentRooms.find((item) => item.id === id);
    if (room) {
        openCheckoutModal(room, status === "Available" ? "book" : "reserve");
    }
}

function buildReservationCalendarMarkup(room) {
    const today = new Date();
    const cells = [];

    for (let offset = 1; offset <= 14; offset += 1) {
        const date = new Date(today);
        date.setDate(today.getDate() + offset);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const isBlocked = room.status === "Booked" ? offset <= 5 : offset <= 2;

        cells.push(`
            <div class="calendar-cell ${isBlocked ? "booked" : isWeekend ? "peak" : "low"}">
                <div class="calendar-top">
                    <span class="calendar-day">${date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</span>
                    <span class="calendar-badge ${isBlocked ? "booked" : "available"}">${isBlocked ? "Blocked" : "Open"}</span>
                </div>
                <div class="calendar-date-wrap">
                    <span class="calendar-month">${date.toLocaleDateString("en-US", { month: "short" })}</span>
                    <span class="calendar-number">${date.getDate()}</span>
                </div>
                <p class="mt-3 text-[0.72rem] font-semibold ${isBlocked ? "text-[#8d4038]" : "text-[#227a52]"}">${isBlocked ? "Unavailable" : "Available for reserve"}</p>
            </div>
        `);
    }

    return `
        <div class="luxury-card rounded-[28px] p-5">
            <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Unit Availability Calendar</p>
            <p class="mt-2 text-sm text-gray-600">Open dates are ready for reservation. Reserve this unit with a 30% payment today.</p>
            <div class="calendar-grid mt-5">
                ${cells.join("")}
            </div>
        </div>
    `;
}

function openCheckoutModal(room, mode = "book") {
    selectedRoom = room;
    currentCheckoutMode = mode;

    const modal = document.getElementById("checkout-modal");
    const content = document.getElementById("modal-content");

    if (!modal || !content) {
        return;
    }

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const checkoutDate = new Date(today);
    checkoutDate.setDate(today.getDate() + 3);
    const profile = buildRoomProfile(room);
    const isReservationMode = mode === "reserve";
    const paymentSectionMarkup = isReservationMode
        ? `
                    <div class="mt-4 space-y-3">
                        <label class="option-tile active flex cursor-pointer items-center justify-between gap-4 p-4">
                            <div>
                                <p class="text-sm font-semibold text-[#171717]">GCash / PayMaya</p>
                                <p class="mt-1 text-sm text-gray-500">Fast online reservation confirmation.</p>
                            </div>
                            <input type="radio" name="mop" value="GCash / PayMaya" checked class="h-5 w-5 accent-[#d4af37]">
                        </label>
                        <label class="option-tile flex cursor-pointer items-center justify-between gap-4 p-4">
                            <div>
                                <p class="text-sm font-semibold text-[#171717]">Credit / Debit</p>
                                <p class="mt-1 text-sm text-gray-500">Secure digital reservation checkout.</p>
                            </div>
                            <input type="radio" name="mop" value="Credit / Debit" class="h-5 w-5 accent-[#d4af37]">
                        </label>
                        <label class="option-tile flex cursor-pointer items-center justify-between gap-4 p-4">
                            <div>
                                <p class="text-sm font-semibold text-[#171717]">QRPH</p>
                                <p class="mt-1 text-sm text-gray-500">Scan-and-pay reservation support.</p>
                            </div>
                            <input type="radio" name="mop" value="QRPH" class="h-5 w-5 accent-[#d4af37]">
                        </label>
                        <label class="option-tile flex cursor-pointer items-center justify-between gap-4 p-4">
                            <div>
                                <p class="text-sm font-semibold text-[#171717]">Online Banking</p>
                                <p class="mt-1 text-sm text-gray-500">Direct transfer for reservation confirmation.</p>
                            </div>
                            <input type="radio" name="mop" value="Online Banking" class="h-5 w-5 accent-[#d4af37]">
                        </label>
                    </div>
                    <div id="partial-method-wrap" class="hidden"></div>
        `
        : `
                    <div class="mt-4 space-y-3">
                        <label class="option-tile active flex cursor-pointer items-center justify-between gap-4 p-4">
                            <div>
                                <p class="text-sm font-semibold text-[#171717]">GCash / PayMaya</p>
                                <p class="mt-1 text-sm text-gray-500">Fast online confirmation.</p>
                            </div>
                            <input type="radio" name="mop" value="GCash / PayMaya" checked class="h-5 w-5 accent-[#d4af37]">
                        </label>
                        <label class="option-tile flex cursor-pointer items-center justify-between gap-4 p-4">
                            <div>
                                <p class="text-sm font-semibold text-[#171717]">Credit / Debit</p>
                                <p class="mt-1 text-sm text-gray-500">Secure digital checkout.</p>
                            </div>
                            <input type="radio" name="mop" value="Credit / Debit" class="h-5 w-5 accent-[#d4af37]">
                        </label>
                        <label class="option-tile flex cursor-pointer items-center justify-between gap-4 p-4">
                            <div>
                                <p class="text-sm font-semibold text-[#171717]">QRPH</p>
                                <p class="mt-1 text-sm text-gray-500">Scan-and-pay checkout with QRPH support.</p>
                            </div>
                            <input type="radio" name="mop" value="QRPH" class="h-5 w-5 accent-[#d4af37]">
                        </label>
                        <label class="option-tile flex cursor-pointer items-center justify-between gap-4 p-4">
                            <div>
                                <p class="text-sm font-semibold text-[#171717]">Online Banking</p>
                                <p class="mt-1 text-sm text-gray-500">Direct bank transfer for online payment.</p>
                            </div>
                            <input type="radio" name="mop" value="Online Banking" class="h-5 w-5 accent-[#d4af37]">
                        </label>
                        <label class="option-tile flex cursor-pointer items-center justify-between gap-4 p-4">
                            <div>
                                <p class="text-sm font-semibold text-[#171717]">Pay at Hotel</p>
                                <p class="mt-1 text-sm text-gray-500">Hold with a verified partial payment.</p>
                            </div>
                            <input type="radio" name="mop" value="Pay at Hotel" class="h-5 w-5 accent-[#d4af37]">
                        </label>
                    </div>
                    <div id="partial-method-wrap" class="mt-4 hidden rounded-[24px] border border-dashed border-[#d4af37]/35 bg-[#faf7ef] p-4">
                        <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">50% Partial Payment Method</p>
                        <p class="mt-2 text-sm text-gray-600">For Pay at Hotel, choose how the 50% partial payment will be settled now.</p>
                        <div class="mt-4 space-y-3">
                            <label class="option-tile flex cursor-pointer items-center justify-between gap-4 p-4">
                                <div>
                                    <p class="text-sm font-semibold text-[#171717]">GCash</p>
                                    <p class="mt-1 text-sm text-gray-500">Instant partial payment confirmation.</p>
                                </div>
                                <input type="radio" name="partial-mop" value="GCash" class="h-5 w-5 accent-[#d4af37]">
                            </label>
                            <label class="option-tile flex cursor-pointer items-center justify-between gap-4 p-4">
                                <div>
                                    <p class="text-sm font-semibold text-[#171717]">Card / Debit</p>
                                    <p class="mt-1 text-sm text-gray-500">Secure card partial payment.</p>
                                </div>
                                <input type="radio" name="partial-mop" value="Card / Debit" class="h-5 w-5 accent-[#d4af37]">
                            </label>
                            <label class="option-tile flex cursor-pointer items-center justify-between gap-4 p-4">
                                <div>
                                    <p class="text-sm font-semibold text-[#171717]">PayMaya</p>
                                    <p class="mt-1 text-sm text-gray-500">Digital wallet partial payment.</p>
                                </div>
                                <input type="radio" name="partial-mop" value="PayMaya" class="h-5 w-5 accent-[#d4af37]">
                            </label>
                        </div>
                    </div>
        `;

    content.innerHTML = `
        <div class="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
            <div class="space-y-6">
                <div class="luxury-card rounded-[28px] p-5">
                    <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <img src="${room.img}" alt="${escapeHtml(room.name)}" class="h-28 w-full rounded-[22px] object-cover sm:w-40">
                        <div>
                            <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Selected Suite</p>
                            <h3 class="mt-2 font-display text-3xl font-semibold text-[#171717]">${escapeHtml(room.name)}</h3>
                            <p class="mt-2 text-sm text-gray-600">${escapeHtml(room.hotel_name)} • ${escapeHtml(room.type)} • ${escapeHtml(room.capacity)}</p>
                            <p class="mt-1 text-sm text-gray-500">${escapeHtml(room.location)}</p>
                            <p class="mt-2 text-sm font-semibold ${isReservationMode ? "text-[#305f85]" : "text-[#227a52]"}">${isReservationMode ? "Reservation flow with 30% payment" : "Instant booking confirmation flow"}</p>
                        </div>
                    </div>
                </div>

                ${isReservationMode ? buildReservationCalendarMarkup(room) : ""}

                <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label class="input-label" for="modal-checkin">Check-in</label>
                        <input id="modal-checkin" type="date" min="${formatDateValue(tomorrow)}" value="${formatDateValue(tomorrow)}" class="luxury-input">
                    </div>
                    <div>
                        <label class="input-label" for="modal-checkout">Check-out</label>
                        <input id="modal-checkout" type="date" min="${formatDateValue(checkoutDate)}" value="${formatDateValue(checkoutDate)}" class="luxury-input">
                    </div>
                </div>

                <div class="luxury-card rounded-[28px] p-5">
                    <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Guest Identity</p>
                    <div class="mt-4 space-y-4">
                        <div>
                            <label class="input-label" for="guest-fullname">Recipient Full Name</label>
                            <input id="guest-fullname" type="text" class="luxury-input" placeholder="Enter the guest's full name as shown on valid ID">
                        </div>
                        <div>
                            <label class="input-label" for="guest-contact-number">Contact Number</label>
                            <input id="guest-contact-number" type="tel" class="luxury-input" placeholder="Enter the guest's contact number">
                        </div>
                        <div class="rounded-[20px] border border-dashed border-[#305f85]/20 bg-[#f3f8fc] p-4 text-sm leading-6 text-[#305f85]">
                            Use the exact name that appears on the recipient's valid ID. The hotel may ask for this same name during verification and check-in.
                        </div>
                    </div>
                </div>

                <div class="luxury-card rounded-[28px] p-5">
                    <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Ambience and Bed Preferences</p>
                    <div class="mt-4 grid gap-3 sm:grid-cols-2">
                        <label class="option-tile p-4">
                            <span class="block text-sm font-semibold text-[#171717]">Pillow Type</span>
                            <select id="modal-pillow" class="luxury-select mt-3">
                                <option>Soft Feather</option>
                                <option>Firm Support</option>
                                <option>Hypoallergenic Silk</option>
                            </select>
                        </label>
                        <label class="option-tile p-4">
                            <span class="block text-sm font-semibold text-[#171717]">Room Setup</span>
                            <select id="modal-layout" class="luxury-select mt-3">
                                <option>Relaxation Retreat</option>
                                <option>Workspace Layout</option>
                                <option>Celebration Decor</option>
                            </select>
                        </label>
                        <label class="option-tile flex items-center justify-between gap-4 p-4">
                            <div>
                                <p class="text-sm font-semibold text-[#171717]">Extra Bed Request</p>
                                <p class="mt-1 text-sm text-gray-500">Add overflow comfort when needed.</p>
                            </div>
                            <input id="modal-extra-bed" type="checkbox" class="h-5 w-5 accent-[#d4af37]">
                        </label>
                        <div class="option-tile p-4">
                            <span class="block text-sm font-semibold text-[#171717]">Mood Tags</span>
                            <div class="mt-3 flex flex-wrap gap-2">
                                ${(profile.moodTags || []).map((tag) => `<span class="feature-chip">${escapeHtml(tag)}</span>`).join("")}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="luxury-card rounded-[28px] p-5">
                    <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Add-ons and Upsells</p>
                    <div class="mt-4 space-y-3">
                        <label class="option-tile flex cursor-pointer items-center justify-between gap-4 p-4">
                            <div>
                                <p class="text-sm font-semibold text-[#171717]">Breakfast Package</p>
                                <p class="mt-1 text-sm text-gray-500">Curated breakfast for all guests.</p>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="text-sm font-semibold text-[#171717]">+ ${formatCurrency(convertUsdToPhp(25))}</span>
                                <input id="addon-breakfast" type="checkbox" class="h-5 w-5 accent-[#d4af37]">
                            </div>
                        </label>
                        <label class="option-tile flex cursor-pointer items-center justify-between gap-4 p-4">
                            <div>
                                <p class="text-sm font-semibold text-[#171717]">Airport Pickup</p>
                                <p class="mt-1 text-sm text-gray-500">Private ride from the airport to LuxeStay.</p>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="text-sm font-semibold text-[#171717]">+ ${formatCurrency(convertUsdToPhp(50))}</span>
                                <input id="addon-airport" type="checkbox" class="h-5 w-5 accent-[#d4af37]">
                            </div>
                        </label>
                        <label class="option-tile flex cursor-pointer items-center justify-between gap-4 p-4">
                            <div>
                                <p class="text-sm font-semibold text-[#171717]">Spa Service</p>
                                <p class="mt-1 text-sm text-gray-500">Premium wellness upgrade for the stay.</p>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="text-sm font-semibold text-[#171717]">+ ${formatCurrency(convertUsdToPhp(40))}</span>
                                <input id="addon-spa" type="checkbox" class="h-5 w-5 accent-[#d4af37]">
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            <div class="space-y-6">
                <div class="luxury-card rounded-[28px] p-5">
                    <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Mode of Payment</p>
                    ${paymentSectionMarkup}
                </div>

                <div class="luxury-card rounded-[28px] p-5">
                    <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Automation Controls</p>
                    <div class="mt-4 space-y-3">
                        <label class="option-tile flex cursor-pointer items-center justify-between gap-4 p-4">
                            <div>
                                <p class="text-sm font-semibold text-[#171717]">Refund Automation</p>
                                <p class="mt-1 text-sm text-gray-500">Apply the 48-hour policy automatically.</p>
                            </div>
                            <input id="refund-automation" type="checkbox" checked class="h-5 w-5 accent-[#d4af37]">
                        </label>
                        <label class="option-tile flex cursor-pointer items-center justify-between gap-4 p-4">
                            <div>
                                <p class="text-sm font-semibold text-[#171717]">QR Check-in Dispatch</p>
                                <p class="mt-1 text-sm text-gray-500">Send kiosk access details right after confirmation.</p>
                            </div>
                            <input id="qr-checkin" type="checkbox" checked class="h-5 w-5 accent-[#d4af37]">
                        </label>
                    </div>
                </div>

                <div class="luxury-card rounded-[28px] p-5">
                    <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Eligible Discounts</p>
                    <div class="mt-4 space-y-3">
                        <label class="option-tile flex cursor-pointer items-center justify-between gap-4 p-4">
                            <div>
                                <p class="text-sm font-semibold text-[#171717]">PWD Discount</p>
                                <p class="mt-1 text-sm text-gray-500">Deduct PHP 2,000 from the subtotal.</p>
                            </div>
                            <input id="discount-pwd" type="radio" name="booking-discount" value="PWD Discount" class="h-5 w-5 accent-[#d4af37]">
                        </label>
                        <label class="option-tile flex cursor-pointer items-center justify-between gap-4 p-4">
                            <div>
                                <p class="text-sm font-semibold text-[#171717]">Senior Citizen Discount</p>
                                <p class="mt-1 text-sm text-gray-500">Deduct PHP 3,000 from the subtotal.</p>
                            </div>
                            <input id="discount-senior" type="radio" name="booking-discount" value="Senior Citizen Discount" class="h-5 w-5 accent-[#d4af37]">
                        </label>
                        <label class="option-tile flex cursor-pointer items-center justify-between gap-4 p-4">
                            <div>
                                <p class="text-sm font-semibold text-[#171717]">No Discount</p>
                                <p class="mt-1 text-sm text-gray-500">Continue with the regular subtotal.</p>
                            </div>
                            <input id="discount-none" type="radio" name="booking-discount" value="None" checked class="h-5 w-5 accent-[#d4af37]">
                        </label>
                    </div>
                    <div id="discount-proof-wrap" class="mt-4 hidden rounded-[24px] border border-dashed border-[#d4af37]/35 bg-[#faf7ef] p-4">
                        <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Discount ID Requirement</p>
                        <p id="discount-proof-helper" class="mt-2 text-sm text-gray-600">Choose PWD or Senior Citizen to require an ID upload.</p>
                        <input id="discount-proof-file" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/*,application/pdf" class="luxury-input mt-4">
                        <p id="discount-proof-name" class="mt-3 text-sm text-gray-600">No discount ID uploaded yet.</p>
                    </div>
                </div>

                <div class="receipt-box p-5">
                    <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Reservation Summary</p>
                    <div class="mt-4 grid gap-3 text-sm text-gray-600">
                        <div class="flex items-center justify-between"><span>Subtotal</span><span id="summary-subtotal" class="font-semibold text-[#171717]">${formatCurrency(room.display_price)}</span></div>
                        <div class="flex items-center justify-between"><span id="summary-discount-type">None</span><span id="summary-discount-value" class="font-semibold text-[#171717]">${formatCurrency(0)}</span></div>
                        <div class="flex items-center justify-between"><span id="summary-total-label">${isReservationMode ? "30% Reservation Payment" : "Total"}</span><span id="summary-total" class="font-semibold text-[#171717]">${formatCurrency(isReservationMode ? room.display_price * 0.3 : room.display_price)}</span></div>
                        <div class="flex items-center justify-between"><span>Smart Suggestion Fallback</span><span class="font-semibold text-[#171717]">Enabled</span></div>
                        <div class="flex items-center justify-between"><span>Receipt</span><span class="font-semibold text-[#171717]">Auto-generated</span></div>
                        <div class="flex items-center justify-between"><span>${isReservationMode ? "Reservation Policy" : "Cancellation Policy"}</span><span class="font-semibold text-[#171717]">${isReservationMode ? "30% payment secures the unit" : "48-hour automation"}</span></div>
                    </div>
                    <div class="mt-4 rounded-[20px] border border-dashed border-[#b4534c]/18 bg-[#fff7f4] p-4 text-sm leading-6 text-[#8d4038]">
                        Note: Cancellation will deduct PHP 1,000 as a processing fee.
                    </div>
                    <button onclick="processPayment()" class="btn-gold mt-6 w-full">${isReservationMode ? "Confirm Reservation and Generate Receipt" : "Confirm and Generate Receipt"}</button>
                </div>
            </div>
        </div>
    `;

    modal.classList.remove("hidden");
    modal.classList.add("flex");
    updateBookingSummary();

    content.querySelectorAll('input[name="mop"], input[name="partial-mop"], input[name="booking-discount"], #addon-breakfast, #addon-airport, #addon-spa')
        .forEach((input) => input.addEventListener("change", updateBookingSummary));
    document.getElementById("discount-proof-file")?.addEventListener("change", updateDiscountProofName);
    toggleDiscountProofRequirement();
}

function closeModal() {
    const modal = document.getElementById("checkout-modal");
    if (!modal) {
        return;
    }

    modal.classList.add("hidden");
    modal.classList.remove("flex");
}

async function processPayment() {
    if (!selectedRoom) {
        return;
    }

    const selectedMop = document.querySelector('input[name="mop"]:checked');
    const partialPaymentMethod = document.querySelector('input[name="partial-mop"]:checked')?.value || "";
    const guestName = document.getElementById("guest-fullname")?.value.trim() || "";
    const contactNumber = document.getElementById("guest-contact-number")?.value.trim() || "";
    const selectedMopLabel = selectedMop ? selectedMop.value : "GCash / PayMaya";
    const isReservationMode = currentCheckoutMode === "reserve";
    const isPartial = isReservationMode;
    const totals = getBookingTotals(selectedRoom);
    const discountProofFile = document.getElementById("discount-proof-file")?.files?.[0] || null;
    const requiresDiscountProof = ["PWD Discount", "Senior Citizen Discount"].includes(totals.discountLabel);

    if (!isReservationMode && selectedMopLabel === "Pay at Hotel" && !partialPaymentMethod) {
        await showGuestOverlay({
            title: "Partial Payment Method Required",
            message: "Please choose GCash, Card / Debit, or PayMaya for the required 50% partial payment.",
            mode: "alert",
            confirmLabel: "Close",
        });
        return;
    }

    if (!guestName) {
        await showGuestOverlay({
            title: "Recipient Required",
            message: "Please enter the recipient's full name exactly as it appears on their valid ID.",
            mode: "alert",
            confirmLabel: "Close",
        });
        document.getElementById("guest-fullname")?.focus();
        return;
    }

    if (!contactNumber) {
        await showGuestOverlay({
            title: "Contact Number Required",
            message: "Please enter the guest's contact number before continuing with the booking.",
            mode: "alert",
            confirmLabel: "Close",
        });
        document.getElementById("guest-contact-number")?.focus();
        return;
    }

    if (requiresDiscountProof && !discountProofFile) {
        await showGuestOverlay({
            title: "Discount ID Required",
            message: `Please upload the guest's ${totals.discountLabel === "PWD Discount" ? "PWD ID" : "Senior Citizen ID"} before applying this discount.`,
            mode: "alert",
            confirmLabel: "Close",
        });
        document.getElementById("discount-proof-file")?.focus();
        return;
    }

    if (discountProofFile && discountProofFile.size > 5 * 1024 * 1024) {
        await showGuestOverlay({
            title: "Discount ID Too Large",
            message: "Please upload a discount ID file smaller than 5 MB.",
            mode: "alert",
            confirmLabel: "Close",
        });
        return;
    }

    let discountProofData = "";
    let discountProofName = "";
    let discountProofType = "";

    if (requiresDiscountProof && discountProofFile) {
        try {
            discountProofData = await readFileAsDataUrl(discountProofFile);
            discountProofName = discountProofFile.name || "";
            discountProofType = discountProofFile.type || "";
        } catch (error) {
            await showGuestOverlay({
                title: "Discount ID Upload Failed",
                message: error.message || "Unable to read the uploaded discount ID.",
                mode: "alert",
                confirmLabel: "Close",
            });
            return;
        }
    }

    const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            room_id: selectedRoom.id,
            guest_name: guestName,
            contact_number: contactNumber,
            checkin_date: document.getElementById("modal-checkin")?.value || "",
            checkout_date: document.getElementById("modal-checkout")?.value || "",
            payment_type: selectedMopLabel,
            partial_payment_method: partialPaymentMethod,
            is_partial: isPartial,
            reservation_mode: isReservationMode,
            subtotal_amount: totals.subtotal,
            discount_label: totals.discountLabel,
            discount_amount: totals.discountAmount,
            final_amount: totals.finalTotal,
            discount_proof_name: discountProofName,
            discount_proof_type: discountProofType,
            discount_proof_data: discountProofData
        })
    });

    const data = await response.json();
    if (!response.ok) {
        await showGuestOverlay({
            title: "Booking Unavailable",
            message: data.error || "Unable to complete the booking right now.",
            mode: "alert",
            confirmLabel: "Close",
        });
        return;
    }
    const checkinEnabled = document.getElementById("qr-checkin")?.checked;
    const refundEnabled = document.getElementById("refund-automation")?.checked;
    const checkinDate = document.getElementById("modal-checkin")?.value || "";
    const checkoutDate = document.getElementById("modal-checkout")?.value || "";
    const extras = [
        document.getElementById("addon-breakfast")?.checked ? "Breakfast Package" : null,
        document.getElementById("addon-airport")?.checked ? "Airport Pickup" : null,
        document.getElementById("addon-spa")?.checked ? "Spa Service" : null,
        document.getElementById("modal-extra-bed")?.checked ? "Extra Bed Request" : null,
    ].filter(Boolean);

    pendingReceiptData = {
        room: selectedRoom,
        isReservationMode,
        guestName,
        contactNumber,
        receipt: data.receipt,
        paymentMessage: data.message,
        paymentType: data.payment_type || selectedMopLabel,
        roomStatus: data.room_status || (isReservationMode ? "Reserved" : "Booked"),
        qrCheckin: checkinEnabled ? "Scheduled" : "Manual Dispatch",
        refundAutomation: refundEnabled ? "Enabled" : "Manual Review",
        checkinDate,
        checkoutDate,
        extras,
        subtotalAmount: data.subtotal_amount || totals.subtotal,
        discountLabel: data.discount_label || totals.discountLabel,
        discountAmount: data.discount_amount || totals.discountAmount,
        discountProofName: data.discount_proof_name || discountProofName,
        discountVerification: data.discount_verification || (requiresDiscountProof ? "ID Submitted and Logged" : "Not Required"),
        amount: data.final_amount || totals.finalTotal,
        dueNowAmount: totals.dueNow,
    };

    await requestLocationAndShowReceipt();

    await fetchRooms();
}

async function requestLocationAndShowReceipt() {
    if (!pendingReceiptData) {
        return;
    }

    if (pendingReceiptData.isReservationMode) {
        showReceiptView();
        return;
    }

    const shouldTrack = await showGuestOverlay({
        title: "Location Permission",
        message: "Please turn on your location so we can track your arrival, welcome you safely, and allow our staff to support and assist you during your trip.",
        mode: "confirm",
        confirmLabel: "Allow Location",
        cancelLabel: "Not Now",
    });

    if (!shouldTrack) {
        await showGuestOverlay({
            title: "Location Needed",
            message: "Location access is required before we can sync your arrival support and show the final receipt.",
            mode: "alert",
            confirmLabel: "Close",
        });
        return;
    }

    if (!navigator.geolocation) {
        await showGuestOverlay({
            title: "Location Unsupported",
            message: "Location services are not available on this device. Please enable location support to continue.",
            mode: "alert",
            confirmLabel: "Close",
        });
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async () => {
            await showGuestOverlay({
                title: "Location Synced",
                message: "LOCATION CONFIRMED AND SYNCED HAVE A NICE AND SAFE TRIP!",
                mode: "alert",
                confirmLabel: "Continue",
            });
            showReceiptView();
        },
        async () => {
            await showGuestOverlay({
                title: "Location Not Confirmed",
                message: "We couldn't confirm your location. Please allow location access so we can continue.",
                mode: "alert",
                confirmLabel: "Close",
            });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

function showReceiptView() {
    const content = document.getElementById("modal-content");

    if (!content || !pendingReceiptData) {
        return;
    }

    const {
        room,
        guestName,
        contactNumber,
        receipt,
        paymentMessage,
        paymentType,
        roomStatus,
        qrCheckin,
        refundAutomation,
        checkinDate,
        checkoutDate,
        extras,
        subtotalAmount,
        discountLabel,
        discountAmount,
        discountProofName,
        discountVerification,
        amount,
        dueNowAmount,
        isReservationMode,
    } = pendingReceiptData;

    content.innerHTML = `
        <div class="space-y-6">
            <div class="receipt-box p-6">
                <div class="flex flex-col gap-4 border-b border-black/5 pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Receipt Confirmed</p>
                        <h3 class="mt-2 font-display text-4xl font-semibold text-[#171717]">LuxeStay Booking Receipt</h3>
                        <p class="mt-2 text-sm text-gray-600">${escapeHtml(paymentMessage)}</p>
                    </div>
                    <span class="status-pill ${getStatusClass(roomStatus)}">${escapeHtml(roomStatus)}</span>
                </div>

                <div class="mt-6 grid gap-4 md:grid-cols-2">
                    <div class="option-tile p-4">
                        <p class="text-[0.64rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Guest Details</p>
                        <p class="mt-3 text-sm font-semibold text-[#171717]">${escapeHtml(guestName)}</p>
                        <p class="mt-2 text-sm text-gray-600">${escapeHtml(contactNumber)}</p>
                        <p class="mt-2 text-sm text-gray-600">Please present the same name shown on your valid ID upon arrival.</p>
                    </div>
                    <div class="option-tile p-4">
                        <p class="text-[0.64rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Receipt Reference</p>
                        <p class="mt-3 text-sm font-semibold text-[#171717]">${escapeHtml(receipt)}</p>
                        <p class="mt-2 text-sm text-gray-600">QR Check-in: ${escapeHtml(qrCheckin)} • Refund: ${escapeHtml(refundAutomation)}</p>
                    </div>
                </div>

                <div class="mt-6 grid gap-4 md:grid-cols-2">
                    <div class="option-tile p-4">
                        <p class="text-[0.64rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Stay Details</p>
                        <p class="mt-3 text-sm font-semibold text-[#171717]">${escapeHtml(room.hotel_name)}</p>
                        <p class="mt-2 text-sm text-gray-600">${escapeHtml(room.name)} • ${escapeHtml(room.type)} • ${escapeHtml(room.capacity)}</p>
                        <p class="mt-2 text-sm text-gray-600">${escapeHtml(room.location)}</p>
                    </div>
                    <div class="option-tile p-4">
                        <p class="text-[0.64rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Travel Support</p>
                        <p class="mt-3 text-sm text-gray-600">${escapeHtml(isReservationMode ? "Reservation confirmed. Present your receipt reference at the front desk on arrival for support and check-in." : "Location confirmed and synced. Our staff can now welcome, support, and help you on arrival.")}</p>
                        <p class="mt-2 text-sm text-gray-600">Check-in: ${escapeHtml(checkinDate || "Not set")} • Check-out: ${escapeHtml(checkoutDate || "Not set")}</p>
                    </div>
                </div>

                <div class="mt-6 option-tile p-4">
                    <p class="text-[0.64rem] font-extrabold uppercase tracking-[0.22em] text-gray-400">Payment Summary</p>
                    <div class="mt-3 grid gap-3 text-sm text-gray-600">
                        <div class="flex items-center justify-between"><span>Mode of Payment</span><span class="font-semibold text-[#171717]">${escapeHtml(paymentType)}</span></div>
                        <div class="flex items-center justify-between"><span>Subtotal</span><span class="font-semibold text-[#171717]">${escapeHtml(formatCurrency(subtotalAmount || amount || 0))}</span></div>
                        <div class="flex items-center justify-between"><span>${escapeHtml(discountLabel || "Discount")}</span><span class="font-semibold text-[#171717]">${escapeHtml(discountAmount ? `- ${formatCurrency(discountAmount)}` : formatCurrency(0))}</span></div>
                        <div class="flex items-center justify-between"><span>Discount Verification</span><span class="font-semibold text-[#171717]">${escapeHtml(discountLabel && discountLabel !== "None" ? `${discountVerification}${discountProofName ? ` · ${discountProofName}` : ""}` : "Not Required")}</span></div>
                        <div class="flex items-center justify-between"><span>Total</span><span class="font-semibold text-[#171717]">${escapeHtml(formatCurrency(amount || 0))}</span></div>
                        <div class="flex items-center justify-between"><span>Due Now</span><span class="font-semibold text-[#171717]">${escapeHtml(formatCurrency(dueNowAmount || amount || 0))}</span></div>
                        <div class="flex items-center justify-between"><span>Add-ons</span><span class="font-semibold text-[#171717]">${escapeHtml(extras.length ? extras.join(", ") : "None")}</span></div>
                    </div>
                </div>
            </div>

            <div class="flex flex-col gap-3 sm:flex-row">
                <button type="button" onclick="downloadReceipt()" class="btn-secondary w-full sm:w-auto">Save Receipt</button>
                <button type="button" onclick="printReceipt()" class="btn-gold w-full sm:w-auto">Print Receipt</button>
                <button type="button" onclick="closeReceiptAndShowTracker()" class="btn-secondary w-full sm:w-auto">Close</button>
            </div>
        </div>
    `;
}

function launchArrivalSupportChat() {
    if (!pendingReceiptData?.room) {
        return;
    }

    const content = document.getElementById("chat-content");
    if (!content) {
        return;
    }

    const assignedRoom = 100 + Math.floor(Math.random() * 101);
    const firstMessage = `Welcome to ${pendingReceiptData.room.hotel_name}. Your assigned room is ${assignedRoom}. Please proceed to the front desk to claim your key and present your valid ID for verification.`;
    const secondMessage = "After you arrive at the hotel, let us know what you need so we can settle your requests right away. We can help with check-in support, luggage assistance, room preferences, add-ons, and other arrival needs.";

    content.innerHTML += `<div class="chat-message bot">${escapeHtml(firstMessage)}</div>`;
    content.innerHTML += `<div class="chat-message bot">${escapeHtml(secondMessage)}</div>`;
    content.scrollTop = content.scrollHeight;
    toggleChatWidget(true);
}

async function closeReceiptAndShowTracker() {
    if (!pendingReceiptData?.room) {
        closeModal();
        return;
    }

    if (pendingReceiptData.isReservationMode) {
        closeModal();
        return;
    }

    await showGuestOverlay({
        title: "Trip Tracker Preview",
        panelClass: "guest-overlay-wide",
        message: `
            <div class="tracker-map">
                <img src="/assets/MAP.png" alt="Trip tracker map preview" class="tracker-image">
            </div>
        `,
        mode: "alert",
        confirmLabel: "Close",
    });
    closeModal();
    launchArrivalSupportChat();
    return;

    await showGuestOverlay({
        title: "Trip Tracker Preview",
        panelClass: "guest-overlay-wide",
        message: `
            <div class="tracker-map">
                <img src="/assets/MAP.png" alt="Trip tracker map preview" class="tracker-image">
                <div class="tracker-label-card">
                    <p class="text-[0.74rem] font-extrabold uppercase tracking-[0.2em] text-gray-500">Client Location To</p>
                    <p class="mt-3 text-3xl font-semibold text-[#2f67d8]">${escapeHtml(tracker.destinationLabel)}</p>
                    <p class="mt-2 text-sm text-gray-600">ETA: ${escapeHtml(tracker.eta)} • Distance: ${escapeHtml(tracker.distance)}</p>
                </div>
            </div>
        `,
        mode: "alert",
        confirmLabel: "Close",
    });
}

function buildFakeTravelTracker() {
    if (!pendingReceiptData?.room) {
        return null;
    }

    const room = pendingReceiptData.room;
    const seed = room.id;
    const lat = (14.45 + (seed % 9) * 0.037).toFixed(4);
    const lng = (120.85 + (seed % 11) * 0.041).toFixed(4);
    const distance = `${8 + (seed % 14)}.${seed % 9} km`;
    const eta = `${18 + (seed % 17)} mins`;

    return {
        originLabel: `${pendingReceiptData.guestName}'s synced route`,
        originCoords: `Simulated client location: ${lat}, ${lng}`,
        destinationLabel: `${room.hotel_name} • ${room.name}`,
        destinationDetail: `${room.city} • ${room.location}`,
        distance,
        eta,
    };
}

function downloadReceipt() {
    if (!pendingReceiptData) {
        return;
    }

    const {
        room,
        guestName,
        contactNumber,
        receipt,
        paymentType,
        roomStatus,
        checkinDate,
        checkoutDate,
        extras,
        subtotalAmount,
        discountLabel,
        discountAmount,
        discountProofName,
        discountVerification,
        amount,
        dueNowAmount,
    } = pendingReceiptData;

    const content = [
        "LuxeStay Booking Receipt",
        `Receipt No: ${receipt}`,
        `Guest Name: ${guestName}`,
        `Contact Number: ${contactNumber}`,
        `Hotel: ${room.hotel_name}`,
        `Unit: ${room.name}`,
        `Status: ${roomStatus}`,
        `Payment: ${paymentType}`,
        `Check-in: ${checkinDate || "Not set"}`,
        `Check-out: ${checkoutDate || "Not set"}`,
        `Subtotal: ${formatCurrency(subtotalAmount || amount || 0)}`,
        `Discount: ${discountLabel || "None"} (${discountAmount ? `- ${formatCurrency(discountAmount)}` : formatCurrency(0)})`,
        `Discount Verification: ${discountLabel && discountLabel !== "None" ? `${discountVerification}${discountProofName ? ` (${discountProofName})` : ""}` : "Not Required"}`,
        `Total: ${formatCurrency(amount || 0)}`,
        `Due Now: ${formatCurrency(dueNowAmount || amount || 0)}`,
        `Add-ons: ${extras.length ? extras.join(", ") : "None"}`,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${receipt}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function printReceipt() {
    window.print();
}

function showGuestOverlay({
    title = "Notice",
    message = "",
    mode = "alert",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    panelClass = "",
}) {
    const overlay = document.getElementById("guest-overlay");
    if (!overlay) {
        return Promise.resolve(mode === "confirm" ? false : true);
    }

    const panel = document.getElementById("guest-overlay-panel");
    const titleNode = document.getElementById("guest-overlay-title");
    const messageNode = document.getElementById("guest-overlay-message");
    const cancelButton = document.getElementById("guest-overlay-cancel");
    const confirmButton = document.getElementById("guest-overlay-confirm");

    if (panel) {
        panel.classList.remove("guest-overlay-wide");
        if (panelClass) {
            panel.classList.add(panelClass);
        }
    }

    titleNode.textContent = title;
    messageNode.innerHTML = message;
    confirmButton.textContent = confirmLabel;
    cancelButton.textContent = cancelLabel;
    cancelButton.classList.toggle("hidden", mode === "alert");

    overlay.classList.remove("hidden");
    overlay.classList.add("flex");

    return new Promise((resolve) => {
        guestOverlayResolver = { resolve, mode };
    });
}

function closeGuestOverlay(confirmed) {
    const overlay = document.getElementById("guest-overlay");

    if (!overlay || !guestOverlayResolver) {
        return;
    }

    overlay.classList.add("hidden");
    overlay.classList.remove("flex");

    const { resolve, mode } = guestOverlayResolver;
    guestOverlayResolver = null;

    if (mode === "confirm") {
        resolve(Boolean(confirmed));
        return;
    }

    resolve(true);
}

function applyMood(mood) {
    const preview = document.getElementById("preview-container");
    const customizationStage = document.getElementById("customization-stage");
    const targets = [preview, customizationStage].filter(Boolean);

    targets.forEach((target) => {
        target.classList.remove("mood-neutral", "mood-warm", "mood-cool");
        target.classList.add(`mood-${mood}`);
    });
}

async function handleChat(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        await sendChatMessage();
    }
}

function toggleChatWidget(forceOpen) {
    const widget = document.getElementById("floating-chat");
    const input = document.getElementById("chat-input");

    if (!widget) {
        return;
    }

    const shouldOpen = typeof forceOpen === "boolean"
        ? forceOpen
        : widget.classList.contains("is-minimized");

    widget.classList.toggle("is-minimized", !shouldOpen);

    if (shouldOpen && input) {
        window.setTimeout(() => input.focus(), 120);
    }
}

async function sendChatMessage() {
    const input = document.getElementById("chat-input");
    const content = document.getElementById("chat-content");

    if (!input || !content) {
        return;
    }

    toggleChatWidget(true);

    const userText = input.value.trim();
    if (!userText) {
        return;
    }

    content.innerHTML += `<div class="chat-message user">${escapeHtml(userText)}</div>`;
    input.value = "";
    content.scrollTop = content.scrollHeight;

    const response = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText })
    });

    const data = await response.json();

    setTimeout(() => {
        const replyText = data.reply || "I'm here to help with your stay. Please tell me what you need.";
        content.innerHTML += `<div class="chat-message bot">${escapeHtml(replyText)}</div>`;
        content.scrollTop = content.scrollHeight;
    }, 360);
}

function formatDateValue(date) {
    return date.toISOString().split("T")[0];
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
