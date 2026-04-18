(function () {
    const APP_STATE_KEY = "luxestay-github-state-v1";
    const SESSION_KEY = "luxestay-github-session-v1";
    const FLASH_KEY = "luxestay-github-flash-v1";
    const SUPERADMIN_CODE = "0000";
    const VALID_ROOM_STATUSES = ["Available", "Booked", "Reserved"];
    const TRANSACTION_STATUSES = ["Booked", "Reserved", "Completed", "Cancelled"];
    const nativeFetch = window.fetch.bind(window);
    const currentScript = document.currentScript;
    const seedUrl = currentScript
        ? new URL("../data/seed-state.json", currentScript.src).href
        : "data/seed-state.json";

    let stateCache = null;
    let statePromise = null;

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function createJsonResponse(data, status = 200) {
        return Promise.resolve(
            new Response(JSON.stringify(data), {
                status,
                headers: {
                    "Content-Type": "application/json; charset=UTF-8",
                },
            })
        );
    }

    function getStoredJson(key, fallback) {
        try {
            const raw = window.localStorage.getItem(key);
            if (!raw) {
                return clone(fallback);
            }
            return JSON.parse(raw);
        } catch (error) {
            console.warn(`Unable to parse ${key}. Resetting it.`, error);
            return clone(fallback);
        }
    }

    function setStoredJson(key, value) {
        window.localStorage.setItem(key, JSON.stringify(value));
    }

    function getSession() {
        const session = getStoredJson(SESSION_KEY, {
            user: "",
            role: "",
            superadmin: false,
        });

        session.user = String(session.user || "");
        session.role = String(session.role || "");
        session.superadmin = Boolean(session.superadmin);
        return session;
    }

    function saveSession(session) {
        setStoredJson(SESSION_KEY, {
            user: String(session.user || ""),
            role: String(session.role || ""),
            superadmin: Boolean(session.superadmin),
        });
    }

    function clearSession() {
        saveSession({ user: "", role: "", superadmin: false });
    }

    function setFlash(type, text) {
        window.sessionStorage.setItem(FLASH_KEY, JSON.stringify({ type, text }));
    }

    function consumeFlash() {
        const raw = window.sessionStorage.getItem(FLASH_KEY);
        if (!raw) {
            return null;
        }

        window.sessionStorage.removeItem(FLASH_KEY);

        try {
            return JSON.parse(raw);
        } catch (error) {
            return null;
        }
    }

    async function loadState() {
        if (stateCache) {
            return stateCache;
        }

        if (!statePromise) {
            statePromise = (async () => {
                const stored = window.localStorage.getItem(APP_STATE_KEY);
                if (stored) {
                    try {
                        stateCache = JSON.parse(stored);
                        return stateCache;
                    } catch (error) {
                        console.warn("Stored app state is invalid. Reloading the seed.", error);
                    }
                }

                const response = await nativeFetch(seedUrl, { cache: "no-store" });
                const seed = await response.json();
                stateCache = seed;
                persistState();
                return stateCache;
            })();
        }

        return statePromise;
    }

    function persistState() {
        if (!stateCache) {
            return;
        }

        setStoredJson(APP_STATE_KEY, stateCache);
    }

    function getLoyaltyTier(points) {
        if (points >= 20000) {
            return "Gold";
        }
        if (points >= 10000) {
            return "Silver";
        }
        return "Classic";
    }

    function currentTimestamp() {
        const date = new Date();
        const formatter = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Singapore",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });

        const map = {};
        for (const part of formatter.formatToParts(date)) {
            if (part.type !== "literal") {
                map[part.type] = part.value;
            }
        }

        return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
    }

    function currentIsoTimestamp() {
        return new Date().toISOString();
    }

    function findItemIndex(items, predicate) {
        for (let index = 0; index < items.length; index += 1) {
            if (predicate(items[index])) {
                return index;
            }
        }

        return null;
    }

    function ensureLoyaltyAccount(state, username) {
        if (!username) {
            return null;
        }

        if (!state.loyalty_accounts[username]) {
            const startingPoints = Number(state.users[username]?.points || 0);
            state.loyalty_accounts[username] = {
                username,
                current_points: startingPoints,
                tier: getLoyaltyTier(startingPoints),
            };
        }

        if (!state.users[username]) {
            state.users[username] = {
                password: "",
                role: "user",
                points: state.loyalty_accounts[username].current_points,
                fullname: "",
            };
        }

        state.users[username].points = state.loyalty_accounts[username].current_points;
        return state.loyalty_accounts[username];
    }

    function getUserPoints(state, username) {
        const account = ensureLoyaltyAccount(state, username);
        return account ? Number(account.current_points || 0) : 0;
    }

    function recordPointsTransaction(state, username, points, transactionType, description, reference = "") {
        const account = ensureLoyaltyAccount(state, username);
        if (!account || !username) {
            return null;
        }

        const newBalance = Math.max(Number(account.current_points || 0) + Number(points || 0), 0);
        state.loyalty_accounts[username].current_points = newBalance;
        state.loyalty_accounts[username].tier = getLoyaltyTier(newBalance);
        state.users[username].points = newBalance;

        const entry = {
            id: state.points_transactions.length + 1,
            username,
            points: Number(points || 0),
            type: transactionType,
            description,
            reference,
            balance_after: newBalance,
            timestamp: currentTimestamp(),
        };

        state.points_transactions.unshift(entry);
        return entry;
    }

    function getUserRewardHistory(state, username) {
        return state.reward_redemptions.filter((item) => item.username === username);
    }

    function getUserPointsHistory(state, username) {
        return state.points_transactions.filter((item) => item.username === username && Number(item.points || 0) > 0);
    }

    function getProcessedRooms(state) {
        const now = new Date();
        const weekday = now.getDay();
        const hour = now.getHours();
        const isWeekend = weekday === 0 || weekday === 5 || weekday === 6;
        const hourSurge = hour > 18 || hour < 8 ? 1.1 : 1.0;

        return state.rooms.map((room) => {
            const weekendVal = isWeekend ? 1.3 : 1.0;
            const demandVal = Number(room.multiplier ?? room.demand_multiplier ?? 1);
            const finalPrice = Number(room.base_price || 0) * weekendVal * hourSurge * demandVal;

            return {
                ...room,
                display_price: Number(finalPrice.toFixed(2)),
                is_peak: weekendVal * demandVal > 1.3,
            };
        });
    }

    function getProcessedRoomById(state, roomId) {
        return getProcessedRooms(state).find((room) => Number(room.id) === Number(roomId)) || null;
    }

    function addTransaction(
        state,
        room,
        status,
        source,
        paymentType = "Pending",
        receipt = null,
        notes = "",
        guestName = "",
        contactNumber = "",
        amount = null,
        username = "",
        checkinDate = "",
        checkoutDate = "",
        earlyCheckout = false,
        compensationNote = "",
        extra = {}
    ) {
        const entry = {
            id: state.transactions.length + 1,
            room_id: Number(room.id),
            hotel_name: room.hotel_name,
            unit_name: room.name,
            username,
            guest_name: guestName,
            contact_number: contactNumber,
            status,
            source,
            payment_type: paymentType,
            amount: amount ?? Number(room.display_price ?? room.base_price ?? 0),
            receipt: receipt || "Pending",
            notes,
            checkin_date: checkinDate,
            checkout_date: checkoutDate,
            early_checkout: earlyCheckout,
            compensation_note: compensationNote,
            timestamp: currentTimestamp(),
            ...extra,
        };

        state.transactions.unshift(entry);
        return entry;
    }

    function parseIsoDate(value) {
        if (!value) {
            return null;
        }

        const date = new Date(`${value}T00:00:00`);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function buildMyUnitState(transaction) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const checkin = parseIsoDate(transaction.checkin_date);
        const checkout = parseIsoDate(transaction.checkout_date);

        if (!checkin || !checkout || checkout <= checkin) {
            return {
                status_label: "Active",
                status_class: "available",
                progress_percent: 0,
                status_copy: "Dates will update once your final stay schedule is confirmed.",
            };
        }

        const totalDays = Math.max(Math.round((checkout - checkin) / 86400000), 1);
        const elapsedDays = Math.min(Math.max(today >= checkin ? Math.round((today - checkin) / 86400000) : 0, 0), totalDays);
        const progressPercent = Math.round((elapsedDays / totalDays) * 100);
        const daysToCheckout = Math.round((checkout - today) / 86400000);

        if (today >= checkout || transaction.status === "Completed") {
            return {
                status_label: "Unit Expired",
                status_class: "booked",
                progress_percent: 100,
                status_copy: "This stay window has ended. Visit the front desk if you need post-stay support.",
            };
        }

        if (daysToCheckout <= 1) {
            return {
                status_label: "About to Expire",
                status_class: "peak",
                progress_percent: Math.max(progressPercent, 80),
                status_copy: "Your active stay is close to check-out. Coordinate with the front desk for extensions or departure assistance.",
            };
        }

        return {
            status_label: "Active",
            status_class: "available",
            progress_percent: Math.max(progressPercent, 8),
            status_copy: "Your unit is still active. Everything remains ready for your current stay schedule.",
        };
    }

    function getLatestUserTransaction(state, username) {
        if (!username) {
            return null;
        }

        const fullName = String(state.users[username]?.fullname || "").trim().toLowerCase();
        for (const transaction of state.transactions) {
            if (transaction.username === username) {
                return transaction;
            }

            if (!transaction.username && fullName && String(transaction.guest_name || "").trim().toLowerCase() === fullName) {
                return transaction;
            }
        }

        return null;
    }

    function getWebsiteContextSummary(state) {
        const processedRooms = getProcessedRooms(state);
        const hotelNames = [...new Set(state.rooms.map((room) => room.hotel_name))].sort();
        const cityNames = [...new Set(state.rooms.map((room) => room.city))].sort();
        const availableRooms = processedRooms.filter((room) => room.status === "Available");
        const bookedCount = processedRooms.filter((room) => room.status === "Booked").length;
        const reservedCount = processedRooms.filter((room) => room.status === "Reserved").length;
        const prices = processedRooms.map((room) => Number(room.display_price || 0));

        return {
            processed_rooms: processedRooms,
            hotel_names: hotelNames,
            city_names: cityNames,
            available_rooms: availableRooms,
            booked_count: bookedCount,
            reserved_count: reservedCount,
            min_price: prices.length ? Math.min(...prices) : 5000,
            max_price: prices.length ? Math.max(...prices) : 8000,
        };
    }

    function stringContainsAny(query, needles) {
        return needles.some((needle) => needle && query.includes(needle));
    }

    function generateConciergeReply(state, message) {
        const query = String(message || "").trim().toLowerCase();
        const context = getWebsiteContextSummary(state);
        const availableRooms = context.available_rooms;
        const sampleRoom = availableRooms[0] || null;

        if (!query) {
            return "Hello, this is LuxeStay support. Let me know what you need and I'll help arrange it for you.";
        }

        if (stringContainsAny(query, ["hello", "hi", "hey", "good morning", "good afternoon", "good evening"])) {
            return "Hello and welcome to LuxeStay. I can help with arrival, room concerns, payments, or hotel requests.";
        }

        if (stringContainsAny(query, ["thank you", "thanks", "salamat"])) {
            return "You're very welcome. If you need anything else before or after arrival, just message me here.";
        }

        if (stringContainsAny(query, ["key", "front desk", "id", "identification", "valid id"])) {
            return "Please proceed to the front desk and present your valid ID so our staff can verify your booking and hand over your room key.";
        }

        if (query.includes("room") && stringContainsAny(query, ["number", "assigned", "what room", "which room"])) {
            return "Your room assignment will be confirmed by the front desk on arrival. We usually finalize it within the 100 to 200 room range prepared for incoming guests.";
        }

        if (stringContainsAny(query, ["check in", "check-in"])) {
            return "Our standard check-in time is 2:00 PM. If you arrive early, the front desk can assist with holding your luggage while your room is being prepared.";
        }

        if (stringContainsAny(query, ["check out", "check-out", "checkout"])) {
            return "Check-out is at 12:00 PM. If you need a late check-out request, I can note that for the front desk team.";
        }

        if (stringContainsAny(query, ["hotel", "branch", "property", "properties"])) {
            return `We currently feature ${context.hotel_names.length} hotel properties: ${context.hotel_names.join(", ")}. Let me know which one you want details about.`;
        }

        if (stringContainsAny(query, ["where can i stay", "available room", "available hotel", "availability", "vacant"])) {
            if (sampleRoom) {
                return `We currently have ${availableRooms.length} available rooms across the website. One available option is ${sampleRoom.name} at ${sampleRoom.hotel_name} in ${sampleRoom.city}, currently around PHP ${Number(sampleRoom.display_price || 0).toFixed(2)}.`;
            }
            return "At the moment, availability is limited. Please tell me your preferred hotel or city so I can guide you to the best current option.";
        }

        if (stringContainsAny(query, ["price", "cost", "rate", "rates", "how much"])) {
            return `Our current displayed room rates are generally around PHP ${Number(context.min_price || 0).toFixed(2)} to PHP ${Number(context.max_price || 0).toFixed(2)}, depending on the room, demand, and booking timing.`;
        }

        if (stringContainsAny(query, ["payment method", "mode of payment", "mop", "how can i pay"])) {
            return "We currently support GCash / PayMaya, Credit / Debit, QRPH, Online Banking, and Pay at Hotel. Pay at Hotel requires a 50% partial payment first using GCash, Card / Debit, or PayMaya.";
        }

        if (stringContainsAny(query, ["pwd", "senior", "discount"])) {
            return "We currently support a PWD discount of PHP 2,000 and a Senior Citizen discount of PHP 3,000. The selected discount is deducted from the subtotal during checkout.";
        }

        if (stringContainsAny(query, ["receipt", "reference", "transaction"])) {
            return "After a successful booking, the system generates a receipt reference that can be used to find the transaction later. The receipt also shows the payment method, subtotal, discount, total, and due-now amount.";
        }

        if (stringContainsAny(query, ["wifi", "wi-fi", "internet"])) {
            return "Complimentary high-speed Wi-Fi is available throughout the property. The access details can also be confirmed for you at the front desk during check-in.";
        }

        if (stringContainsAny(query, ["pool", "swimming", "gym", "spa", "breakfast", "parking"])) {
            return "Certainly. Let me know which hotel amenity you need, such as breakfast, spa, pool, gym, or parking, and I will give you the details.";
        }

        if (stringContainsAny(query, ["extra bed", "pillow", "towel", "blanket", "amenities", "toiletries"])) {
            return "I can help endorse that request. Please tell me exactly what item or room setup you need so the staff can prepare it for your arrival.";
        }

        if (stringContainsAny(query, ["cancel", "refund", "rebook", "reschedule"])) {
            return "I can help explain the cancellation and refund process. Please share whether you would like to cancel, request a refund, or move the booking to a different date.";
        }

        if (stringContainsAny(query, ["payment", "paid", "gcash", "paymaya", "qrph", "online banking", "card", "debit"])) {
            return "I can help with payment concerns. Please tell me if you want help confirming a payment, checking the payment method used, or arranging the remaining balance.";
        }

        if (stringContainsAny(query, ["location", "address", "where", "direction", "directions", "nearby"])) {
            return `Our listed hotel locations currently cover ${context.city_names.join(", ")}. If you tell me the hotel name, I can guide you using its location shown on the website.`;
        }

        if (stringContainsAny(query, ["arrive", "arrival", "late", "coming now", "on the way"])) {
            return "Thank you for the update. Our team can prepare for your arrival. If you have an estimated arrival time or special request, send it here and I will note it.";
        }

        if (stringContainsAny(query, ["agent", "human", "staff", "representative"])) {
            return "You're connected to LuxeStay support. I can continue assisting here like a live desk agent, and if needed I can also note your concern for the front desk staff.";
        }

        return "I can help with that. Please give me a few more details so I can guide you properly.";
    }

    function parseRequestBody(body) {
        if (!body) {
            return {};
        }

        if (typeof body === "string") {
            try {
                return JSON.parse(body);
            } catch (error) {
                return {};
            }
        }

        if (body instanceof URLSearchParams) {
            return Object.fromEntries(body.entries());
        }

        if (body instanceof FormData) {
            return Object.fromEntries(body.entries());
        }

        return body;
    }

    function getUnauthorizedResponse() {
        return createJsonResponse({ error: "Unauthorized" }, 403);
    }

    function getSuperadminResponse() {
        return createJsonResponse({ error: "Superadmin access required." }, 403);
    }

    function getCurrentUserName() {
        const session = getSession();
        return session.user || null;
    }

    async function login(username, password) {
        const state = await loadState();
        const user = state.users[username];

        if (user && String(user.password || "") === String(password || "")) {
            ensureLoyaltyAccount(state, username);
            persistState();
            saveSession({
                user: username,
                role: user.role || "user",
                superadmin: false,
            });
            return { ok: true };
        }

        return {
            ok: false,
            error: "Invalid Executive Credentials",
        };
    }

    async function signup(fullname, username, password) {
        const state = await loadState();

        if (state.users[username]) {
            return {
                ok: false,
                error: "This username is already part of the elite.",
            };
        }

        state.users[username] = {
            password,
            role: "user",
            points: 0,
            fullname,
        };
        ensureLoyaltyAccount(state, username);
        persistState();

        saveSession({
            user: username,
            role: "user",
            superadmin: false,
        });

        return { ok: true };
    }

    async function redeemReward(rewardId) {
        const state = await loadState();
        const username = getCurrentUserName();

        if (!username) {
            return { ok: false, status: 401, error: "Please sign in first." };
        }

        const reward = state.reward_catalog.find((item) => String(item.id) === String(rewardId));
        const account = ensureLoyaltyAccount(state, username);

        if (!reward) {
            return { ok: false, status: 404, error: "Reward item not found." };
        }

        if (Number(account.current_points || 0) < Number(reward.points_cost || 0)) {
            return { ok: false, status: 400, error: "Not enough loyalty points to redeem this item." };
        }

        recordPointsTransaction(
            state,
            username,
            -Number(reward.points_cost || 0),
            "Reward Redemption",
            `Redeemed ${reward.name}`,
            String(reward.id)
        );

        state.reward_redemptions.unshift({
            id: state.reward_redemptions.length + 1,
            username,
            reward_id: reward.id,
            reward_name: reward.name,
            points_cost: reward.points_cost,
            timestamp: currentTimestamp(),
        });

        persistState();

        return {
            ok: true,
            message: `${reward.name} redeemed successfully.`,
        };
    }

    async function earlyCheckout(transactionId) {
        const state = await loadState();
        const username = getCurrentUserName();
        const transactionIndex = findItemIndex(state.transactions, (item) => Number(item.id) === Number(transactionId));

        if (transactionIndex === null) {
            return { ok: false, status: 404, error: "Unit transaction not found." };
        }

        const transaction = state.transactions[transactionIndex];
        if (transaction.username !== username) {
            return { ok: false, status: 403, error: "You can only manage your own active unit." };
        }

        if (transaction.status === "Completed") {
            return { ok: false, status: 400, error: "This unit has already been checked out." };
        }

        state.transactions[transactionIndex].status = "Completed";
        state.transactions[transactionIndex].early_checkout = true;
        state.transactions[transactionIndex].compensation_note = "Early check-out compensation is ready for front desk redemption.";
        state.transactions[transactionIndex].notes = "Guest requested early check-out. Compensation can be redeemed via front desk.";
        state.transactions[transactionIndex].timestamp = currentTimestamp();

        const roomIndex = findItemIndex(state.rooms, (item) => Number(item.id) === Number(transaction.room_id));
        if (roomIndex !== null) {
            state.rooms[roomIndex].status = "Available";
            state.rooms[roomIndex].updated_at = currentIsoTimestamp();
        }

        persistState();

        return {
            ok: true,
            message: "Early check-out recorded. Compensation can be redeemed via front desk.",
        };
    }

    async function handleApi(url, method, body) {
        const state = await loadState();
        const session = getSession();
        const path = url.pathname;
        const data = parseRequestBody(body);

        if (path === "/api/rooms" && method === "GET") {
            return createJsonResponse(getProcessedRooms(state));
        }

        if (path === "/api/admin/rooms" && method === "GET") {
            if (session.role !== "admin") {
                return getUnauthorizedResponse();
            }
            return createJsonResponse(getProcessedRooms(state));
        }

        if (path === "/api/admin/transactions" && method === "GET") {
            if (session.role !== "admin") {
                return getUnauthorizedResponse();
            }
            return createJsonResponse(state.transactions);
        }

        if (path === "/api/admin/employees" && method === "GET") {
            if (session.role !== "admin") {
                return getUnauthorizedResponse();
            }
            return createJsonResponse(state.employees);
        }

        if (path === "/api/admin/employees" && method === "POST") {
            if (session.role !== "admin") {
                return getUnauthorizedResponse();
            }
            if (!session.superadmin) {
                return getSuperadminResponse();
            }

            const dutyStatus = String(data.duty_status || "");
            if (!["ONDUTY", "OFFDUTY", "ON LEAVE"].includes(dutyStatus)) {
                return createJsonResponse({ error: "Invalid duty status." }, 400);
            }

            const nextId = Math.max(...state.employees.map((item) => Number(item.id || 0)), 0) + 1;
            const employee = {
                id: nextId,
                id_number: String(data.id_number || "").trim(),
                name: String(data.name || "").trim(),
                contact_number: String(data.contact_number || "").trim(),
                age: Number(data.age || 0),
                gender: String(data.gender || "").trim(),
                role: String(data.role || "").trim(),
                duty_status: dutyStatus,
                strikes: 0,
                last_notice: "",
                bonus: 0,
                employee_of_month: false,
                bonus_history: [],
                strike_history: [],
                recognition_history: [],
            };

            if (!employee.id_number || !employee.name || !employee.contact_number || !employee.age || !employee.gender || !employee.role) {
                return createJsonResponse({ error: "All employee fields are required." }, 400);
            }

            state.employees.push(employee);
            persistState();

            return createJsonResponse({
                status: "success",
                message: `${employee.name} was added to the employee list.`,
                employee,
            });
        }

        if (path === "/api/admin/superadmin" && method === "GET") {
            if (session.role !== "admin") {
                return getUnauthorizedResponse();
            }
            return createJsonResponse({ enabled: Boolean(session.superadmin) });
        }

        if (path === "/api/admin/superadmin/login" && method === "POST") {
            if (session.role !== "admin") {
                return getUnauthorizedResponse();
            }

            const code = String(data.code || "").trim();
            if (code !== SUPERADMIN_CODE) {
                return createJsonResponse({ error: "Invalid superadmin code." }, 400);
            }

            saveSession({
                ...session,
                superadmin: true,
            });

            return createJsonResponse({ status: "success", message: "Superadmin access granted." });
        }

        if (path === "/api/admin/superadmin/logout" && method === "POST") {
            if (session.role !== "admin") {
                return getUnauthorizedResponse();
            }

            saveSession({
                ...session,
                superadmin: false,
            });

            return createJsonResponse({ status: "success", message: "Returned to regular admin mode." });
        }

        const transactionStatusMatch = path.match(/^\/api\/admin\/transactions\/(\d+)\/status$/);
        if (transactionStatusMatch && method === "POST") {
            if (session.role !== "admin") {
                return getUnauthorizedResponse();
            }

            const transactionId = Number(transactionStatusMatch[1]);
            const newStatus = String(data.status || "");

            if (!TRANSACTION_STATUSES.includes(newStatus)) {
                return createJsonResponse({ error: "Invalid transaction status." }, 400);
            }

            const transactionIndex = findItemIndex(state.transactions, (item) => Number(item.id) === transactionId);
            if (transactionIndex === null) {
                return createJsonResponse({ error: "Transaction not found." }, 404);
            }

            state.transactions[transactionIndex].status = newStatus;
            state.transactions[transactionIndex].notes = `Transaction updated to ${newStatus} by admin.`;
            state.transactions[transactionIndex].timestamp = currentTimestamp();

            const roomId = Number(state.transactions[transactionIndex].room_id);
            const roomIndex = findItemIndex(state.rooms, (item) => Number(item.id) === roomId);
            if (roomIndex !== null) {
                state.rooms[roomIndex].status = ["Booked", "Reserved"].includes(newStatus) ? newStatus : "Available";
                state.rooms[roomIndex].updated_at = currentIsoTimestamp();
            }

            persistState();
            return createJsonResponse({
                status: "success",
                message: `Transaction marked as ${newStatus}.`,
                transaction: state.transactions[transactionIndex],
                room: getProcessedRoomById(state, roomId),
            });
        }

        const deleteTransactionMatch = path.match(/^\/api\/admin\/transactions\/(\d+)$/);
        if (deleteTransactionMatch && method === "DELETE") {
            if (session.role !== "admin") {
                return getUnauthorizedResponse();
            }
            if (!session.superadmin) {
                return getSuperadminResponse();
            }

            const transactionId = Number(deleteTransactionMatch[1]);
            const transactionIndex = findItemIndex(state.transactions, (item) => Number(item.id) === transactionId);
            if (transactionIndex === null) {
                return createJsonResponse({ error: "Transaction not found." }, 404);
            }

            const deleted = state.transactions[transactionIndex];
            state.transactions.splice(transactionIndex, 1);
            persistState();

            return createJsonResponse({
                status: "success",
                message: `Transaction for ${deleted.unit_name} deleted.`,
            });
        }

        const employeeActionMatch = path.match(/^\/api\/admin\/employees\/(\d+)(?:\/(strike|employee-of-month|bonus))?$/);
        if (employeeActionMatch && ["PUT", "DELETE", "POST"].includes(method)) {
            const employeeId = Number(employeeActionMatch[1]);
            const action = employeeActionMatch[2] || "";
            const employeeIndex = findItemIndex(state.employees, (item) => Number(item.id) === employeeId);

            if (employeeIndex === null) {
                return createJsonResponse({ error: "Employee not found." }, 404);
            }

            if (action === "" && method === "PUT") {
                if (session.role !== "admin") {
                    return getUnauthorizedResponse();
                }
                if (!session.superadmin) {
                    return getSuperadminResponse();
                }

                const dutyStatus = String(data.duty_status || "");
                if (!["ONDUTY", "OFFDUTY", "ON LEAVE"].includes(dutyStatus)) {
                    return createJsonResponse({ error: "Invalid duty status." }, 400);
                }

                Object.assign(state.employees[employeeIndex], {
                    id_number: String(data.id_number ?? state.employees[employeeIndex].id_number).trim(),
                    name: String(data.name ?? state.employees[employeeIndex].name).trim(),
                    contact_number: String(data.contact_number ?? state.employees[employeeIndex].contact_number).trim(),
                    age: Number(data.age ?? state.employees[employeeIndex].age),
                    gender: String(data.gender ?? state.employees[employeeIndex].gender).trim(),
                    role: String(data.role ?? state.employees[employeeIndex].role).trim(),
                    duty_status: dutyStatus,
                });

                persistState();
                return createJsonResponse({
                    status: "success",
                    message: `${state.employees[employeeIndex].name}'s record was updated.`,
                    employee: state.employees[employeeIndex],
                });
            }

            if (action === "" && method === "DELETE") {
                if (session.role !== "admin") {
                    return getUnauthorizedResponse();
                }
                if (!session.superadmin) {
                    return getSuperadminResponse();
                }

                const deleted = state.employees[employeeIndex];
                state.employees.splice(employeeIndex, 1);
                persistState();

                return createJsonResponse({
                    status: "success",
                    message: `${deleted.name} was removed from the employee list.`,
                });
            }

            if (action === "strike" && method === "POST") {
                if (session.role !== "admin") {
                    return getUnauthorizedResponse();
                }
                if (!session.superadmin) {
                    return getSuperadminResponse();
                }

                const notice = String(data.notice || "").trim();
                if (!notice) {
                    return createJsonResponse({ error: "Strike notice is required." }, 400);
                }

                state.employees[employeeIndex].strikes = Number(state.employees[employeeIndex].strikes || 0) + 1;
                state.employees[employeeIndex].last_notice = notice;
                state.employees[employeeIndex].strike_history = state.employees[employeeIndex].strike_history || [];
                state.employees[employeeIndex].strike_history.unshift({
                    type: "Strike Notice",
                    details: notice,
                    awarded_at: currentTimestamp(),
                });

                persistState();
                return createJsonResponse({
                    status: "success",
                    message: `Strike notice sent to ${state.employees[employeeIndex].name}.`,
                    employee: state.employees[employeeIndex],
                });
            }

            if (action === "employee-of-month" && method === "POST") {
                if (session.role !== "admin") {
                    return getUnauthorizedResponse();
                }
                if (!session.superadmin) {
                    return getSuperadminResponse();
                }

                state.employees.forEach((employee) => {
                    employee.employee_of_month = Number(employee.id) === employeeId;
                });
                state.employees[employeeIndex].recognition_history = state.employees[employeeIndex].recognition_history || [];
                state.employees[employeeIndex].recognition_history.unshift({
                    type: "Employee of the Month",
                    details: "Recognized by superadmin for outstanding performance.",
                    awarded_at: currentTimestamp(),
                });

                persistState();
                return createJsonResponse({
                    status: "success",
                    message: `${state.employees[employeeIndex].name} is now Employee of the Month.`,
                    employee: state.employees[employeeIndex],
                    employees: state.employees,
                });
            }

            if (action === "bonus" && method === "POST") {
                if (session.role !== "admin") {
                    return getUnauthorizedResponse();
                }
                if (!session.superadmin) {
                    return getSuperadminResponse();
                }

                const bonus = Number(data.bonus || 0);
                if (bonus <= 0) {
                    return createJsonResponse({ error: "Bonus amount must be greater than zero." }, 400);
                }

                state.employees[employeeIndex].bonus = Number((Number(state.employees[employeeIndex].bonus || 0) + bonus).toFixed(2));
                state.employees[employeeIndex].bonus_history = state.employees[employeeIndex].bonus_history || [];
                state.employees[employeeIndex].bonus_history.unshift({
                    type: "Bonus",
                    amount: Number(bonus.toFixed(2)),
                    details: "Bonus granted by superadmin.",
                    awarded_at: currentTimestamp(),
                });

                persistState();
                return createJsonResponse({
                    status: "success",
                    message: `Bonus granted to ${state.employees[employeeIndex].name}.`,
                    employee: state.employees[employeeIndex],
                });
            }
        }

        const roomStatusMatch = path.match(/^\/api\/admin\/rooms\/(\d+)\/status$/);
        if (roomStatusMatch && method === "POST") {
            if (session.role !== "admin") {
                return getUnauthorizedResponse();
            }

            const roomId = Number(roomStatusMatch[1]);
            const newStatus = String(data.status || "");
            if (!VALID_ROOM_STATUSES.includes(newStatus)) {
                return createJsonResponse({ error: "Invalid room status" }, 400);
            }

            const roomIndex = findItemIndex(state.rooms, (item) => Number(item.id) === roomId);
            if (roomIndex === null) {
                return createJsonResponse({ error: "Room not found" }, 404);
            }

            state.rooms[roomIndex].status = newStatus;
            state.rooms[roomIndex].updated_at = currentIsoTimestamp();
            const processedRoom = getProcessedRoomById(state, roomId);

            if (["Booked", "Reserved"].includes(newStatus) && processedRoom) {
                addTransaction(
                    state,
                    processedRoom,
                    newStatus,
                    "Admin Control",
                    "Manual Update",
                    null,
                    `Room status changed to ${newStatus} from dashboard.`
                );
            }

            persistState();
            return createJsonResponse({
                status: "success",
                message: `${state.rooms[roomIndex].name} is now marked as ${newStatus}.`,
                room: getProcessedRoomById(state, roomId),
            });
        }

        if (path === "/api/checkout" && method === "POST") {
            const mop = String(data.payment_type || "");
            const reservationMode = Boolean(data.reservation_mode);
            const partialPaymentMethod = String(data.partial_payment_method || "");
            const roomId = Number(data.room_id || 0);
            const guestName = String(data.guest_name || "").trim();
            const contactNumber = String(data.contact_number || "").trim();
            const checkinDate = String(data.checkin_date || "").trim();
            const checkoutDate = String(data.checkout_date || "").trim();
            const discountLabel = String(data.discount_label || "").trim();
            const discountAmount = Number(data.discount_amount || 0);
            const discountProofName = String(data.discount_proof_name || "").trim();
            const discountProofType = String(data.discount_proof_type || "").trim();
            const discountProofData = String(data.discount_proof_data || "");
            const subtotalAmount = Number(data.subtotal_amount || 0);
            const finalAmount = Number(data.final_amount || 0);
            const discountRequiresProof = ["PWD Discount", "Senior Citizen Discount"].includes(discountLabel) && discountAmount > 0;

            if (!guestName) {
                return createJsonResponse({ error: "Guest name is required." }, 400);
            }
            if (!contactNumber) {
                return createJsonResponse({ error: "Contact number is required." }, 400);
            }
            if (reservationMode && mop === "Pay at Hotel" && !partialPaymentMethod) {
                return createJsonResponse({ error: "Partial payment method is required for Pay at Hotel." }, 400);
            }
            if (discountRequiresProof && (!discountProofName || !discountProofData)) {
                return createJsonResponse({ error: "Please upload the required discount ID before applying this discount." }, 400);
            }

            const receiptId = `LUXE-${Math.floor(10000 + Math.random() * 90000)}`;
            let paymentLabel = mop;
            if (reservationMode && mop === "Pay at Hotel" && partialPaymentMethod) {
                paymentLabel = `${mop} - 30% reservation via ${partialPaymentMethod}`;
            }

            let message = `Confirmed via ${paymentLabel}.`;
            if (reservationMode) {
                message += " 30% Reservation Payment Received. Balance due at Check-in.";
            }
            if (discountLabel && discountAmount > 0) {
                message += ` ${discountLabel} applied.`;
            }

            const processedRoom = roomId ? getProcessedRoomById(state, roomId) : null;
            const roomIndex = roomId ? findItemIndex(state.rooms, (item) => Number(item.id) === roomId) : null;

            if (roomIndex !== null && processedRoom) {
                state.rooms[roomIndex].status = reservationMode ? "Reserved" : "Booked";

                let bookingNotes = `Created from booking checkout flow. Subtotal: ${subtotalAmount.toFixed(2)}. Discount: ${discountLabel || "None"} (${discountAmount.toFixed(2)}).`;
                if (discountRequiresProof) {
                    bookingNotes += ` Discount ID submitted: ${discountProofName}.`;
                }

                addTransaction(
                    state,
                    processedRoom,
                    state.rooms[roomIndex].status,
                    "Guest Booking",
                    paymentLabel,
                    receiptId,
                    bookingNotes,
                    guestName,
                    contactNumber,
                    finalAmount || Number(processedRoom.display_price || processedRoom.base_price || 0),
                    getCurrentUserName() || "",
                    checkinDate,
                    checkoutDate,
                    false,
                    "",
                    {
                        discount_label: discountLabel,
                        discount_amount: discountAmount,
                        discount_proof_name: discountProofName,
                        discount_proof_path: discountRequiresProof ? `local-storage://discount-proofs/${receiptId}` : "",
                        discount_proof_type: discountProofType,
                        discount_verified: discountRequiresProof,
                    }
                );

                const username = getCurrentUserName();
                if (username) {
                    const earnedPoints = Math.floor((finalAmount || Number(processedRoom.display_price || processedRoom.base_price || 0)) / 10);
                    recordPointsTransaction(
                        state,
                        username,
                        earnedPoints,
                        "Stay Earned Points",
                        `Earned from booking ${processedRoom.name} at ${processedRoom.hotel_name}`,
                        receiptId
                    );
                    message += ` ${earnedPoints} loyalty points added to your account.`;
                }

                state.rooms[roomIndex].updated_at = currentIsoTimestamp();
                persistState();

                return createJsonResponse({
                    status: "success",
                    message,
                    receipt: receiptId,
                    qr_code: "ACTIVE_RESERVATION_TOKEN_XYZ",
                    room_status: state.rooms[roomIndex].status,
                    payment_type: paymentLabel,
                    subtotal_amount: subtotalAmount,
                    discount_label: discountLabel,
                    discount_amount: discountAmount,
                    final_amount: finalAmount || Number(processedRoom.display_price || processedRoom.base_price || 0),
                    discount_proof_name: discountProofName,
                    discount_verification: discountRequiresProof ? "ID Submitted and Logged" : "Not Required",
                });
            }

            return createJsonResponse({
                status: "success",
                message,
                receipt: receiptId,
                qr_code: "ACTIVE_RESERVATION_TOKEN_XYZ",
                room_status: null,
                payment_type: paymentLabel,
                subtotal_amount: subtotalAmount,
                discount_label: discountLabel,
                discount_amount: discountAmount,
                final_amount: finalAmount,
            });
        }

        if (path === "/api/bot" && method === "POST") {
            return createJsonResponse({
                reply: generateConciergeReply(state, data.message || ""),
            });
        }

        return createJsonResponse({ error: "Not Found" }, 404);
    }

    window.fetch = async function (input, init = {}) {
        const method = String(
            init.method
            || (input instanceof Request ? input.method : "GET")
            || "GET"
        ).toUpperCase();

        const rawUrl = typeof input === "string" ? input : input.url;
        const url = new URL(rawUrl, window.location.href);

        if (url.pathname.startsWith("/api/")) {
            const body = init.body !== undefined
                ? init.body
                : input instanceof Request
                    ? await input.clone().text()
                    : undefined;
            return handleApi(url, method, body);
        }

        return nativeFetch(input, init);
    };

    window.LuxeStayApp = {
        loadState,
        persistState,
        getSession,
        saveSession,
        clearSession,
        setFlash,
        consumeFlash,
        login,
        signup,
        redeemReward,
        earlyCheckout,
        ensureLoyaltyAccount,
        getUserPoints,
        getUserPointsHistory,
        getUserRewardHistory,
        getLatestUserTransaction,
        buildMyUnitState,
        getProcessedRooms,
        getProcessedRoomById,
        currentTimestamp,
        generateConciergeReply,
        navigate(page) {
            window.location.href = page;
        },
        logout(target = "index.html") {
            clearSession();
            window.location.href = target;
        },
        requireLogin(redirectTo = "login.html", message = "Please sign in first.") {
            if (!getCurrentUserName()) {
                setFlash("error", message);
                window.location.href = redirectTo;
                return false;
            }
            return true;
        },
        requireAdmin(redirectTo = "login.html", message = "Admin access required.") {
            const session = getSession();
            if (session.role !== "admin") {
                setFlash("error", message);
                window.location.href = redirectTo;
                return false;
            }
            return true;
        },
        resetToSeed: async function () {
            window.localStorage.removeItem(APP_STATE_KEY);
            stateCache = null;
            statePromise = null;
            await loadState();
        },
    };
})();
