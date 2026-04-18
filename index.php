<?php

declare(strict_types=1);

require __DIR__ . DIRECTORY_SEPARATOR . 'php' . DIRECTORY_SEPARATOR . 'bootstrap.php';

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if (PHP_SAPI === 'cli-server') {
    $file = __DIR__ . $path;
    if ($path !== '/' && is_file($file)) {
        return false;
    }
}

$state = load_state();

$redirect_with_query = static function (string $route, array $params = []): never {
    $query = $params ? ('?' . http_build_query($params)) : '';
    redirect_to($route . $query);
};

if ($path === '/' && $method === 'GET') {
    $username = current_user_name();
    $currentPoints = $username ? get_user_points($state, $username) : 0;
    $currentTier = $username ? (($state['loyalty_accounts'][$username]['tier'] ?? 'Classic')) : 'Guest';
    if ($username) {
        save_state($state);
    }

    render_view('home.php', [
        'sessionUser' => $username,
        'sessionRole' => $_SESSION['role'] ?? '',
        'currentPoints' => $currentPoints,
        'currentTier' => $currentTier,
    ]);
}

if ($path === '/login' && $method === 'GET') {
    render_view('login.php', ['error' => '']);
}

if ($path === '/login' && $method === 'POST') {
    $username = trim((string) ($_POST['username'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');

    if (isset($state['users'][$username]) && ($state['users'][$username]['password'] ?? '') === $password) {
        ensure_loyalty_account($state, $username);
        save_state($state);
        $_SESSION['user'] = $username;
        $_SESSION['role'] = $state['users'][$username]['role'] ?? 'user';
        $_SESSION['superadmin'] = false;
        redirect_to('/');
    }

    render_view('login.php', ['error' => 'Invalid Executive Credentials']);
}

if ($path === '/logout' && $method === 'GET') {
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
    redirect_to('/');
}

if ($path === '/signup' && $method === 'GET') {
    render_view('signup.php', ['error' => '']);
}

if ($path === '/signup' && $method === 'POST') {
    $fullname = trim((string) ($_POST['fullname'] ?? ''));
    $username = trim((string) ($_POST['username'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');

    if (isset($state['users'][$username])) {
        render_view('signup.php', ['error' => 'This username is already part of the elite.']);
    }

    $state['users'][$username] = [
        'password' => $password,
        'role' => 'user',
        'points' => 0,
        'fullname' => $fullname,
    ];
    ensure_loyalty_account($state, $username);
    save_state($state);

    $_SESSION['user'] = $username;
    $_SESSION['role'] = 'user';
    $_SESSION['superadmin'] = false;
    redirect_to('/');
}

if ($path === '/admin' && $method === 'GET') {
    require_admin_html();
    render_view('admin.php');
}

if ($path === '/transactions' && $method === 'GET') {
    require_admin_html();
    render_view('transactions.php');
}

if ($path === '/employees' && $method === 'GET') {
    require_admin_html();
    render_view('employees.php');
}

if ($path === '/rewards' && $method === 'GET') {
    require_login_html();
    $username = current_user_name();
    $account = ensure_loyalty_account($state, $username);
    save_state($state);

    render_view('rewards.php', [
        'loyaltyAccount' => $account,
        'rewardCatalog' => $state['reward_catalog'],
        'pointsHistory' => $username ? get_user_points_history($state, $username) : [],
        'rewardHistory' => $username ? get_user_reward_history($state, $username) : [],
        'message' => (string) ($_GET['message'] ?? ''),
        'error' => (string) ($_GET['error'] ?? ''),
    ]);
}

if ($path === '/my-unit' && $method === 'GET') {
    require_login_html();
    $username = current_user_name();
    $transaction = get_latest_user_transaction($state, $username);
    $unitState = $transaction ? build_my_unit_state($transaction) : null;

    render_view('my_unit.php', [
        'transaction' => $transaction,
        'unitState' => $unitState,
        'message' => (string) ($_GET['message'] ?? ''),
        'error' => (string) ($_GET['error'] ?? ''),
        'sessionUser' => $username,
    ]);
}

if ($method === 'POST' && preg_match('#^/my-unit/early-checkout/(\d+)$#', $path, $matches)) {
    require_login_html();
    $transactionId = (int) $matches[1];
    $username = current_user_name();
    $transactionIndex = find_item_index($state['transactions'], static fn(array $item): bool => (int) $item['id'] === $transactionId);

    if ($transactionIndex === null) {
        $redirect_with_query('/my-unit', ['error' => 'Unit transaction not found.']);
    }

    $transaction = $state['transactions'][$transactionIndex];
    if (($transaction['username'] ?? '') !== $username) {
        $redirect_with_query('/my-unit', ['error' => 'You can only manage your own active unit.']);
    }

    if (($transaction['status'] ?? '') === 'Completed') {
        $redirect_with_query('/my-unit', ['error' => 'This unit has already been checked out.']);
    }

    $state['transactions'][$transactionIndex]['status'] = 'Completed';
    $state['transactions'][$transactionIndex]['early_checkout'] = true;
    $state['transactions'][$transactionIndex]['compensation_note'] = 'Early check-out compensation is ready for front desk redemption.';
    $state['transactions'][$transactionIndex]['notes'] = 'Guest requested early check-out. Compensation can be redeemed via front desk.';
    $state['transactions'][$transactionIndex]['timestamp'] = current_timestamp();

    $roomIndex = find_item_index($state['rooms'], static fn(array $item): bool => (int) $item['id'] === (int) $transaction['room_id']);
    if ($roomIndex !== null) {
        $state['rooms'][$roomIndex]['status'] = 'Available';
        $state['rooms'][$roomIndex]['updated_at'] = date(DATE_ATOM);
    }

    save_state($state);
    $redirect_with_query('/my-unit', ['message' => 'Early check-out recorded. Compensation can be redeemed via front desk.']);
}

if ($method === 'POST' && preg_match('#^/rewards/redeem/([^/]+)$#', $path, $matches)) {
    require_login_html();
    $rewardId = $matches[1];
    $username = current_user_name();
    $reward = null;
    foreach ($state['reward_catalog'] as $item) {
        if (($item['id'] ?? '') === $rewardId) {
            $reward = $item;
            break;
        }
    }

    $account = ensure_loyalty_account($state, $username);

    if ($reward === null) {
        $redirect_with_query('/rewards', ['error' => 'Reward item not found.']);
    }

    if (($account['current_points'] ?? 0) < ($reward['points_cost'] ?? 0)) {
        $redirect_with_query('/rewards', ['error' => 'Not enough loyalty points to redeem this item.']);
    }

    record_points_transaction(
        $state,
        $username,
        -((int) $reward['points_cost']),
        'Reward Redemption',
        'Redeemed ' . $reward['name'],
        (string) $reward['id']
    );

    array_unshift($state['reward_redemptions'], [
        'id' => count($state['reward_redemptions']) + 1,
        'username' => $username,
        'reward_id' => $reward['id'],
        'reward_name' => $reward['name'],
        'points_cost' => $reward['points_cost'],
        'timestamp' => current_timestamp(),
    ]);

    save_state($state);
    $redirect_with_query('/rewards', ['message' => $reward['name'] . ' redeemed successfully.']);
}

if ($path === '/api/rooms' && $method === 'GET') {
    json_response(get_processed_rooms($state));
}

if ($path === '/api/admin/rooms' && $method === 'GET') {
    require_admin_api();
    json_response(get_processed_rooms($state));
}

if ($path === '/api/admin/transactions' && $method === 'GET') {
    require_admin_api();
    json_response($state['transactions']);
}

if ($path === '/api/admin/employees' && $method === 'GET') {
    require_admin_api();
    json_response($state['employees']);
}

if ($path === '/api/admin/employees' && $method === 'POST') {
    require_superadmin_api();
    $data = request_json();
    $dutyStatus = (string) ($data['duty_status'] ?? '');
    if (!in_array($dutyStatus, ['ONDUTY', 'OFFDUTY', 'ON LEAVE'], true)) {
        json_response(['error' => 'Invalid duty status.'], 400);
    }

    $employee = [
        'id' => max(array_map(static fn(array $item): int => (int) $item['id'], $state['employees'])) + 1,
        'id_number' => trim((string) ($data['id_number'] ?? '')),
        'name' => trim((string) ($data['name'] ?? '')),
        'contact_number' => trim((string) ($data['contact_number'] ?? '')),
        'age' => (int) ($data['age'] ?? 0),
        'gender' => trim((string) ($data['gender'] ?? '')),
        'role' => trim((string) ($data['role'] ?? '')),
        'duty_status' => $dutyStatus,
        'strikes' => 0,
        'last_notice' => '',
        'bonus' => 0,
        'employee_of_month' => false,
        'bonus_history' => [],
        'strike_history' => [],
        'recognition_history' => [],
    ];

    if ($employee['id_number'] === '' || $employee['name'] === '' || $employee['contact_number'] === '' || $employee['age'] === 0 || $employee['gender'] === '' || $employee['role'] === '') {
        json_response(['error' => 'All employee fields are required.'], 400);
    }

    $state['employees'][] = $employee;
    save_state($state);
    json_response([
        'status' => 'success',
        'message' => $employee['name'] . ' was added to the employee list.',
        'employee' => $employee,
    ]);
}

if ($path === '/api/admin/superadmin' && $method === 'GET') {
    require_admin_api();
    json_response(['enabled' => !empty($_SESSION['superadmin'])]);
}

if ($path === '/api/admin/superadmin/login' && $method === 'POST') {
    require_admin_api();
    $data = request_json();
    $code = trim((string) ($data['code'] ?? ''));
    if ($code !== SUPERADMIN_CODE) {
        json_response(['error' => 'Invalid superadmin code.'], 400);
    }

    $_SESSION['superadmin'] = true;
    json_response(['status' => 'success', 'message' => 'Superadmin access granted.']);
}

if ($path === '/api/admin/superadmin/logout' && $method === 'POST') {
    require_admin_api();
    $_SESSION['superadmin'] = false;
    json_response(['status' => 'success', 'message' => 'Returned to regular admin mode.']);
}

if ($method === 'POST' && preg_match('#^/api/admin/transactions/(\d+)/status$#', $path, $matches)) {
    require_admin_api();
    $transactionId = (int) $matches[1];
    $data = request_json();
    $newStatus = (string) ($data['status'] ?? '');

    if (!in_array($newStatus, TRANSACTION_STATUSES, true)) {
        json_response(['error' => 'Invalid transaction status.'], 400);
    }

    $transactionIndex = find_item_index($state['transactions'], static fn(array $item): bool => (int) $item['id'] === $transactionId);
    if ($transactionIndex === null) {
        json_response(['error' => 'Transaction not found.'], 404);
    }

    $state['transactions'][$transactionIndex]['status'] = $newStatus;
    $state['transactions'][$transactionIndex]['notes'] = 'Transaction updated to ' . $newStatus . ' by admin.';
    $state['transactions'][$transactionIndex]['timestamp'] = current_timestamp();

    $roomId = (int) $state['transactions'][$transactionIndex]['room_id'];
    $roomIndex = find_item_index($state['rooms'], static fn(array $item): bool => (int) $item['id'] === $roomId);
    if ($roomIndex !== null) {
        $state['rooms'][$roomIndex]['status'] = in_array($newStatus, ['Booked', 'Reserved'], true) ? $newStatus : 'Available';
        $state['rooms'][$roomIndex]['updated_at'] = date(DATE_ATOM);
    }

    save_state($state);
    json_response([
        'status' => 'success',
        'message' => 'Transaction marked as ' . $newStatus . '.',
        'transaction' => $state['transactions'][$transactionIndex],
        'room' => get_processed_room_by_id($state, $roomId),
    ]);
}

if ($method === 'DELETE' && preg_match('#^/api/admin/transactions/(\d+)$#', $path, $matches)) {
    require_superadmin_api();
    $transactionId = (int) $matches[1];
    $transactionIndex = find_item_index($state['transactions'], static fn(array $item): bool => (int) $item['id'] === $transactionId);
    if ($transactionIndex === null) {
        json_response(['error' => 'Transaction not found.'], 404);
    }

    $deleted = $state['transactions'][$transactionIndex];
    array_splice($state['transactions'], $transactionIndex, 1);
    save_state($state);
    json_response([
        'status' => 'success',
        'message' => 'Transaction for ' . $deleted['unit_name'] . ' deleted.',
    ]);
}

if (($method === 'PUT' || $method === 'DELETE' || $method === 'POST') && preg_match('#^/api/admin/employees/(\d+)(?:/(strike|employee-of-month|bonus))?$#', $path, $matches)) {
    $employeeId = (int) $matches[1];
    $action = $matches[2] ?? '';
    $employeeIndex = find_item_index($state['employees'], static fn(array $item): bool => (int) $item['id'] === $employeeId);

    if ($employeeIndex === null) {
        json_response(['error' => 'Employee not found.'], 404);
    }

    if ($action === '' && $method === 'PUT') {
        require_superadmin_api();
        $data = request_json();
        $dutyStatus = (string) ($data['duty_status'] ?? '');
        if (!in_array($dutyStatus, ['ONDUTY', 'OFFDUTY', 'ON LEAVE'], true)) {
            json_response(['error' => 'Invalid duty status.'], 400);
        }

        $state['employees'][$employeeIndex]['id_number'] = trim((string) ($data['id_number'] ?? $state['employees'][$employeeIndex]['id_number']));
        $state['employees'][$employeeIndex]['name'] = trim((string) ($data['name'] ?? $state['employees'][$employeeIndex]['name']));
        $state['employees'][$employeeIndex]['contact_number'] = trim((string) ($data['contact_number'] ?? $state['employees'][$employeeIndex]['contact_number']));
        $state['employees'][$employeeIndex]['age'] = (int) ($data['age'] ?? $state['employees'][$employeeIndex]['age']);
        $state['employees'][$employeeIndex]['gender'] = trim((string) ($data['gender'] ?? $state['employees'][$employeeIndex]['gender']));
        $state['employees'][$employeeIndex]['role'] = trim((string) ($data['role'] ?? $state['employees'][$employeeIndex]['role']));
        $state['employees'][$employeeIndex]['duty_status'] = $dutyStatus;

        save_state($state);
        json_response([
            'status' => 'success',
            'message' => $state['employees'][$employeeIndex]['name'] . '\'s record was updated.',
            'employee' => $state['employees'][$employeeIndex],
        ]);
    }

    if ($action === '' && $method === 'DELETE') {
        require_superadmin_api();
        $deleted = $state['employees'][$employeeIndex];
        array_splice($state['employees'], $employeeIndex, 1);
        save_state($state);
        json_response([
            'status' => 'success',
            'message' => $deleted['name'] . ' was removed from the employee list.',
        ]);
    }

    if ($action === 'strike' && $method === 'POST') {
        require_superadmin_api();
        $data = request_json();
        $notice = trim((string) ($data['notice'] ?? ''));
        if ($notice === '') {
            json_response(['error' => 'Strike notice is required.'], 400);
        }

        $state['employees'][$employeeIndex]['strikes'] = (int) ($state['employees'][$employeeIndex]['strikes'] ?? 0) + 1;
        $state['employees'][$employeeIndex]['last_notice'] = $notice;
        array_unshift($state['employees'][$employeeIndex]['strike_history'], [
            'type' => 'Strike Notice',
            'details' => $notice,
            'awarded_at' => current_timestamp(),
        ]);

        save_state($state);
        json_response([
            'status' => 'success',
            'message' => 'Strike notice sent to ' . $state['employees'][$employeeIndex]['name'] . '.',
            'employee' => $state['employees'][$employeeIndex],
        ]);
    }

    if ($action === 'employee-of-month' && $method === 'POST') {
        require_superadmin_api();
        foreach ($state['employees'] as $index => $employee) {
            $state['employees'][$index]['employee_of_month'] = ((int) $employee['id'] === $employeeId);
        }

        array_unshift($state['employees'][$employeeIndex]['recognition_history'], [
            'type' => 'Employee of the Month',
            'details' => 'Recognized by superadmin for outstanding performance.',
            'awarded_at' => current_timestamp(),
        ]);

        save_state($state);
        json_response([
            'status' => 'success',
            'message' => $state['employees'][$employeeIndex]['name'] . ' is now Employee of the Month.',
            'employee' => $state['employees'][$employeeIndex],
            'employees' => $state['employees'],
        ]);
    }

    if ($action === 'bonus' && $method === 'POST') {
        require_superadmin_api();
        $data = request_json();
        $bonus = (float) ($data['bonus'] ?? 0);
        if ($bonus <= 0) {
            json_response(['error' => 'Bonus amount must be greater than zero.'], 400);
        }

        $state['employees'][$employeeIndex]['bonus'] = round(((float) ($state['employees'][$employeeIndex]['bonus'] ?? 0)) + $bonus, 2);
        array_unshift($state['employees'][$employeeIndex]['bonus_history'], [
            'type' => 'Bonus',
            'amount' => round($bonus, 2),
            'details' => 'Bonus granted by superadmin.',
            'awarded_at' => current_timestamp(),
        ]);

        save_state($state);
        json_response([
            'status' => 'success',
            'message' => 'Bonus granted to ' . $state['employees'][$employeeIndex]['name'] . '.',
            'employee' => $state['employees'][$employeeIndex],
        ]);
    }
}

if ($method === 'POST' && preg_match('#^/api/admin/rooms/(\d+)/status$#', $path, $matches)) {
    require_admin_api();
    $roomId = (int) $matches[1];
    $data = request_json();
    $newStatus = (string) ($data['status'] ?? '');

    if (!in_array($newStatus, VALID_ROOM_STATUSES, true)) {
        json_response(['error' => 'Invalid room status'], 400);
    }

    $roomIndex = find_item_index($state['rooms'], static fn(array $item): bool => (int) $item['id'] === $roomId);
    if ($roomIndex === null) {
        json_response(['error' => 'Room not found'], 404);
    }

    $state['rooms'][$roomIndex]['status'] = $newStatus;
    $state['rooms'][$roomIndex]['updated_at'] = date(DATE_ATOM);
    $processedRoom = get_processed_room_by_id($state, $roomId);

    if (in_array($newStatus, ['Booked', 'Reserved'], true) && $processedRoom !== null) {
        add_transaction(
            $state,
            $processedRoom,
            $newStatus,
            'Admin Control',
            'Manual Update',
            null,
            'Room status changed to ' . $newStatus . ' from dashboard.'
        );
    }

    save_state($state);
    json_response([
        'status' => 'success',
        'message' => $state['rooms'][$roomIndex]['name'] . ' is now marked as ' . $newStatus . '.',
        'room' => get_processed_room_by_id($state, $roomId),
    ]);
}

if ($path === '/api/suggest' && $method === 'POST') {
    $data = request_json();
    $roomId = (int) ($data['id'] ?? 0);
    foreach ($state['rooms'] as $room) {
        if (($room['status'] ?? '') === 'Available' && (int) $room['id'] !== $roomId) {
            json_response([
                'found' => true,
                'message' => "Selection Unavailable. However, our AI suggests the '{$room['name']}' which fits your needs.",
                'suggestion' => $room,
            ]);
        }
    }

    json_response(['found' => false, 'message' => 'No similar suites available at this moment.']);
}

if ($path === '/api/checkout' && $method === 'POST') {
    $data = request_json();
    $mop = (string) ($data['payment_type'] ?? '');
    $reservationMode = !empty($data['reservation_mode']);
    $partialPaymentMethod = (string) ($data['partial_payment_method'] ?? '');
    $roomId = (int) ($data['room_id'] ?? 0);
    $guestName = trim((string) ($data['guest_name'] ?? ''));
    $contactNumber = trim((string) ($data['contact_number'] ?? ''));
    $checkinDate = trim((string) ($data['checkin_date'] ?? ''));
    $checkoutDate = trim((string) ($data['checkout_date'] ?? ''));
    $discountLabel = trim((string) ($data['discount_label'] ?? ''));
    $discountAmount = (float) ($data['discount_amount'] ?? 0);
    $discountProofName = trim((string) ($data['discount_proof_name'] ?? ''));
    $discountProofType = trim((string) ($data['discount_proof_type'] ?? ''));
    $discountProofData = (string) ($data['discount_proof_data'] ?? '');
    $subtotalAmount = (float) ($data['subtotal_amount'] ?? 0);
    $finalAmount = (float) ($data['final_amount'] ?? 0);
    $discountRequiresProof = in_array($discountLabel, ['PWD Discount', 'Senior Citizen Discount'], true) && $discountAmount > 0;

    if ($roomId <= 0) {
        json_response(['error' => 'Room selection is required.'], 400);
    }
    if ($guestName === '') {
        json_response(['error' => 'Guest name is required.'], 400);
    }
    if ($contactNumber === '') {
        json_response(['error' => 'Contact number is required.'], 400);
    }
    if ($reservationMode && $mop === 'Pay at Hotel' && $partialPaymentMethod === '') {
        json_response(['error' => 'Partial payment method is required for Pay at Hotel.'], 400);
    }
    if ($discountRequiresProof && ($discountProofName === '' || $discountProofData === '')) {
        json_response(['error' => 'Please upload the required discount ID before applying this discount.'], 400);
    }

    $receiptId = 'LUXE-' . random_int(10000, 99999);
    $paymentLabel = $mop;
    if ($reservationMode && $mop === 'Pay at Hotel' && $partialPaymentMethod !== '') {
        $paymentLabel = $mop . ' - 30% reservation via ' . $partialPaymentMethod;
    }

    $message = 'Confirmed via ' . $paymentLabel . '.';
    if ($reservationMode) {
        $message .= ' 30% Reservation Payment Received. Balance due at Check-in.';
    }
    if ($discountLabel !== '' && $discountAmount > 0) {
        $message .= ' ' . $discountLabel . ' applied.';
    }

    $discountProof = null;
    if ($discountRequiresProof) {
        try {
            $discountProof = store_discount_proof($receiptId, $discountLabel, $discountProofName, $discountProofType, $discountProofData);
        } catch (RuntimeException $exception) {
            json_response(['error' => $exception->getMessage()], 400);
        }
    }

    $processedRoom = $roomId ? get_processed_room_by_id($state, $roomId) : null;
    $roomIndex = $roomId ? find_item_index($state['rooms'], static fn(array $item): bool => (int) $item['id'] === $roomId) : null;

    if ($roomIndex === null || $processedRoom === null) {
        json_response(['error' => 'Selected room was not found.'], 404);
    }

    if (($processedRoom['status'] ?? '') !== 'Available') {
        json_response(['error' => 'Selected room is no longer available.'], 409);
    }

    $state['rooms'][$roomIndex]['status'] = $reservationMode ? 'Reserved' : 'Booked';
    $bookingNotes = sprintf('Created from booking checkout flow. Subtotal: %.2f. Discount: %s (%.2f).', $subtotalAmount, $discountLabel ?: 'None', $discountAmount);
    if ($discountProof !== null) {
        $bookingNotes .= ' Discount ID submitted: ' . $discountProof['original_name'] . '.';
    }
    add_transaction(
        $state,
        $processedRoom,
        $state['rooms'][$roomIndex]['status'],
        'Guest Booking',
        $paymentLabel,
        $receiptId,
        $bookingNotes,
        $guestName,
        $contactNumber,
        $finalAmount ?: (float) ($processedRoom['display_price'] ?? $processedRoom['base_price'] ?? 0),
        (string) (current_user_name() ?? ''),
        $checkinDate,
        $checkoutDate,
        false,
        '',
        [
            'discount_label' => $discountLabel,
            'discount_amount' => $discountAmount,
            'discount_proof_name' => $discountProof['original_name'] ?? '',
            'discount_proof_path' => $discountProof['path'] ?? '',
            'discount_proof_type' => $discountProof['mime_type'] ?? '',
            'discount_verified' => $discountProof !== null,
        ]
    );

    $username = current_user_name();
    if ($username) {
        $earnedPoints = (int) floor(($finalAmount ?: (float) ($processedRoom['display_price'] ?? $processedRoom['base_price'] ?? 0)) / 10);
        record_points_transaction(
            $state,
            $username,
            $earnedPoints,
            'Stay Earned Points',
            'Earned from booking ' . $processedRoom['name'] . ' at ' . $processedRoom['hotel_name'],
            $receiptId
        );
        $message .= ' ' . $earnedPoints . ' loyalty points added to your account.';
    }

    $state['rooms'][$roomIndex]['updated_at'] = date(DATE_ATOM);
    save_state($state);

    json_response([
        'status' => 'success',
        'message' => $message,
        'receipt' => $receiptId,
        'qr_code' => 'ACTIVE_RESERVATION_TOKEN_XYZ',
        'room_status' => $state['rooms'][$roomIndex]['status'],
        'payment_type' => $paymentLabel,
        'subtotal_amount' => $subtotalAmount,
        'discount_label' => $discountLabel,
        'discount_amount' => $discountAmount,
        'final_amount' => $finalAmount ?: (float) ($processedRoom['display_price'] ?? $processedRoom['base_price'] ?? 0),
        'discount_proof_name' => $discountProof['original_name'] ?? '',
        'discount_verification' => $discountProof !== null ? 'ID Submitted and Logged' : 'Not Required',
    ]);
}

if ($path === '/api/bot' && $method === 'POST') {
    $payload = request_json();
    json_response(['reply' => generate_concierge_reply($state, $payload['message'] ?? '')]);
}

http_response_code(404);
echo 'Not Found';
