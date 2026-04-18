<?php

declare(strict_types=1);

function app_root_path(): string
{
    return dirname(__DIR__);
}

function ensure_directory(string $path): void
{
    if (!is_dir($path)) {
        mkdir($path, 0777, true);
    }
}

function load_env_file(string $path): void
{
    static $loaded = false;

    if ($loaded || !is_file($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) {
        return;
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#')) {
            continue;
        }

        $separator = strpos($trimmed, '=');
        if ($separator === false) {
            continue;
        }

        $key = trim(substr($trimmed, 0, $separator));
        $value = trim(substr($trimmed, $separator + 1));

        if ($key === '') {
            continue;
        }

        if (
            (str_starts_with($value, '"') && str_ends_with($value, '"')) ||
            (str_starts_with($value, "'") && str_ends_with($value, "'"))
        ) {
            $value = substr($value, 1, -1);
        }

        if (getenv($key) === false) {
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }
    }

    $loaded = true;
}

function env_value(string $key, string $default = ''): string
{
    $value = getenv($key);
    if ($value === false) {
        return $default;
    }

    $value = trim((string) $value);
    return $value === '' ? $default : $value;
}

load_env_file(app_root_path() . DIRECTORY_SEPARATOR . '.env');

date_default_timezone_set(env_value('APP_TIMEZONE', 'Asia/Singapore'));

$sessionStorageDir = app_root_path() . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'sessions';
ensure_directory($sessionStorageDir);
session_save_path($sessionStorageDir);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

const VALID_ROOM_STATUSES = ['Available', 'Booked', 'Reserved'];
const TRANSACTION_STATUSES = ['Booked', 'Reserved', 'Completed', 'Cancelled'];
const MIN_ROOM_PRICE_PHP = 5000;
const MAX_ROOM_PRICE_PHP = 8000;
const MIN_SOURCE_PRICE_USD = 120;
const MAX_SOURCE_PRICE_USD = 220;

define('SUPERADMIN_CODE', env_value('SUPERADMIN_CODE', '0000'));
define('DB_HOST', env_value('DB_HOST', '127.0.0.1'));
define('DB_PORT', (int) env_value('DB_PORT', '3306'));
define('DB_NAME', env_value('DB_NAME', 'hotelv2'));
define('DB_USER', env_value('DB_USER', 'root'));
define('DB_PASSWORD', env_value('DB_PASSWORD', ''));

function legacy_state_path(): string
{
    return app_root_path() . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'state.json';
}

function h(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function current_timestamp(): string
{
    return date('Y-m-d H:i:s');
}

function redirect_to(string $path): never
{
    header('Location: ' . $path);
    exit;
}

function json_response($data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

function request_json(): array
{
    $body = file_get_contents('php://input');
    if ($body === false || trim($body) === '') {
        return [];
    }

    $data = json_decode($body, true);
    return is_array($data) ? $data : [];
}

function render_view(string $view, array $vars = []): never
{
    extract($vars, EXTR_SKIP);
    require app_root_path() . DIRECTORY_SEPARATOR . 'views' . DIRECTORY_SEPARATOR . $view;
    exit;
}

function require_login_html(): void
{
    if (empty($_SESSION['user'])) {
        redirect_to('/login');
    }
}

function require_admin_html(): void
{
    if (($_SESSION['role'] ?? '') !== 'admin') {
        redirect_to('/login');
    }
}

function require_admin_api(): void
{
    if (($_SESSION['role'] ?? '') !== 'admin') {
        json_response(['error' => 'Unauthorized'], 403);
    }
}

function require_superadmin_api(): void
{
    require_admin_api();
    if (empty($_SESSION['superadmin'])) {
        json_response(['error' => 'Superadmin access required.'], 403);
    }
}

function map_room_price_to_php(float $sourcePrice): float
{
    $normalized = ($sourcePrice - MIN_SOURCE_PRICE_USD) / (MAX_SOURCE_PRICE_USD - MIN_SOURCE_PRICE_USD);
    return round(MIN_ROOM_PRICE_PHP + ($normalized * (MAX_ROOM_PRICE_PHP - MIN_ROOM_PRICE_PHP)), 2);
}

function ensure_employee_history(array $employee): array
{
    $employee['bonus_history'] = $employee['bonus_history'] ?? [];
    $employee['strike_history'] = $employee['strike_history'] ?? [];
    $employee['recognition_history'] = $employee['recognition_history'] ?? [];
    return $employee;
}

function extend_employee_roster(array $baseEmployees, int $targetTotal = 53): array
{
    $firstNames = [
        'Carlos', 'Angela', 'Patrick', 'Bianca', 'Ramon', 'Liza', 'Jerome', 'Nina',
        'Paolo', 'Katrina', 'Miguel', 'Denise', 'Harold', 'Camille', 'Vincent', 'Rica',
        'Adrian', 'Therese', 'Louis', 'Trisha', 'Noel', 'Mika', 'Ethan', 'Carla',
        'Joshua', 'Elaine', 'Bryan', 'Kim', 'Nathan', 'Chloe', 'Gabriel', 'Faye',
        'Jasper', 'Sofia', 'Darren', 'Bea', 'Enzo', 'Mae', 'Lance', 'Ivy',
        'Sean', 'Nicole', 'Ivan', 'April', 'Mark', 'Faith', 'Ryan',
    ];

    $lastNames = [
        'Garcia', 'Mendoza', 'Torres', 'Navarro', 'Castillo', 'Romero', 'Gonzales', 'Aquino',
        'Lim', 'Bautista', 'Padilla', 'Velasco', 'Soriano', 'Delos Reyes', 'Mercado', 'Tan',
        'Alvarez', 'Domingo', 'Serrano', 'Chavez', 'Salazar', 'Pineda', 'Ramos', 'Dizon',
        'Santos', 'Villafuerte', 'Lopez', 'Benedicto', 'Marquez', 'Suarez', 'Ocampo', 'Yap',
        'Cabral', 'Evangelista', 'Malik', 'Rivera', 'Asuncion', 'Pascual', 'Aurelio', 'Tiu',
        'Antonio', 'Lorenzo', 'Espiritu', 'De Leon', 'Montes', 'Quinto', 'Rosales',
    ];

    $roles = [
        'Front Desk Officer', 'Concierge', 'Reservation Agent', 'Bell Staff', 'Duty Manager',
        'Housekeeping Attendant', 'Guest Relations Officer', 'Security Officer', 'Cashier', 'Valet Staff',
    ];

    $dutyCycle = ['ONDUTY', 'OFFDUTY', 'ONDUTY', 'ONDUTY', 'ON LEAVE'];
    $generated = array_values($baseEmployees);
    $nextId = 1;

    foreach ($generated as $employee) {
        $nextId = max($nextId, (int) $employee['id'] + 1);
    }

    while (count($generated) < $targetTotal) {
        $idx = count($generated) - count($baseEmployees);
        $fullName = $firstNames[$idx % count($firstNames)] . ' ' . $lastNames[$idx % count($lastNames)];
        $generated[] = ensure_employee_history([
            'id' => $nextId,
            'id_number' => 'EMP-' . (1000 + $nextId),
            'name' => $fullName,
            'contact_number' => '09' . (17 + ($idx % 7)) . (12340000 + $nextId),
            'age' => 22 + ($idx % 19),
            'gender' => $idx % 2 ? 'Female' : 'Male',
            'role' => $roles[$idx % count($roles)],
            'duty_status' => $dutyCycle[$idx % count($dutyCycle)],
            'strikes' => 0,
            'last_notice' => '',
            'bonus' => 0,
            'employee_of_month' => false,
            'bonus_history' => [],
            'strike_history' => [],
            'recognition_history' => [],
        ]);
        $nextId++;
    }

    return $generated;
}

function build_room_inventory(): array
{
    $hotelCatalog = [
        [
            'hotel_name' => 'LuxeStay Premium',
            'city' => 'Manila Bay',
            'district' => 'Beachfront Promenade',
            'units' => [
                ['name' => 'Ocean Whisper Suite', 'type' => 'King Bed', 'capacity' => '2 Pax', 'price' => 150, 'mood' => 'Romantic', 'location' => 'Beachfront - 50m to sea', 'img' => 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=900'],
                ['name' => 'Skyline Executive', 'type' => 'Queen Bed', 'capacity' => '2 Pax', 'price' => 200, 'mood' => 'Work-friendly', 'location' => 'City Center - Penthouse', 'img' => 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=900'],
                ['name' => 'Garden Family Loft', 'type' => 'Twin + Sofa', 'capacity' => '4 Pax', 'price' => 120, 'mood' => 'Family', 'location' => 'East Wing - Near Pool', 'img' => 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=900'],
                ['name' => 'Harbor Club Room', 'type' => 'Queen Bed', 'capacity' => '2 Pax', 'price' => 165, 'mood' => 'Romantic', 'location' => 'Club Floor - Marina View', 'img' => 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=900'],
                ['name' => 'Sunset Veranda', 'type' => 'King Bed', 'capacity' => '3 Pax', 'price' => 182, 'mood' => 'Leisure', 'location' => 'West Deck - Sunset Terrace', 'img' => 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=900'],
                ['name' => 'Premier Twin Escape', 'type' => 'Twin Bed', 'capacity' => '2 Pax', 'price' => 138, 'mood' => 'Family', 'location' => 'North Tower - Quiet Side', 'img' => 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900'],
            ],
        ],
        [
            'hotel_name' => 'Azure Crown Hotel',
            'city' => 'Cebu City',
            'district' => 'Fuente Business District',
            'units' => [
                ['name' => 'Crown Horizon Suite', 'type' => 'King Bed', 'capacity' => '2 Pax', 'price' => 172, 'mood' => 'Work-friendly', 'location' => 'Tower One - Skyline View', 'img' => 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=900'],
                ['name' => 'Lagoon Deluxe Room', 'type' => 'Queen Bed', 'capacity' => '2 Pax', 'price' => 145, 'mood' => 'Relaxing', 'location' => 'Pool Wing - Lagoon Access', 'img' => 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=900'],
                ['name' => 'Family Harbor Residence', 'type' => 'Twin + Sofa', 'capacity' => '5 Pax', 'price' => 196, 'mood' => 'Family', 'location' => 'Family Deck - Harbor Glimpse', 'img' => 'https://images.unsplash.com/photo-1571508601891-ca5e7a713859?w=900'],
                ['name' => 'Executive Harbor King', 'type' => 'King Bed', 'capacity' => '2 Pax', 'price' => 210, 'mood' => 'Work-friendly', 'location' => 'Executive Floor - Lounge Access', 'img' => 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=900'],
                ['name' => 'Veranda Twin Select', 'type' => 'Twin Bed', 'capacity' => '2 Pax', 'price' => 152, 'mood' => 'Leisure', 'location' => 'Garden Lane - Balcony Deck', 'img' => 'https://images.unsplash.com/photo-1566195992011-5f6b21e539aa?w=900'],
                ['name' => 'Premier Bay Corner', 'type' => 'Queen Bed', 'capacity' => '3 Pax', 'price' => 188, 'mood' => 'Romantic', 'location' => 'Corner Wing - Bay Lights', 'img' => 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=900'],
            ],
        ],
        [
            'hotel_name' => 'Grand Solstice Suites',
            'city' => 'Baguio',
            'district' => 'Pine Crest Hills',
            'units' => [
                ['name' => 'Pine Crest Suite', 'type' => 'King Bed', 'capacity' => '2 Pax', 'price' => 158, 'mood' => 'Romantic', 'location' => 'Forest Wing - Pine View', 'img' => 'https://images.unsplash.com/photo-1496417263034-38ec4f0b665a?w=900'],
                ['name' => 'Fireside Family Loft', 'type' => 'Twin + Sofa', 'capacity' => '4 Pax', 'price' => 176, 'mood' => 'Family', 'location' => 'Cabin Wing - Fireplace Lounge', 'img' => 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=900'],
                ['name' => 'Summit Executive Room', 'type' => 'Queen Bed', 'capacity' => '2 Pax', 'price' => 166, 'mood' => 'Work-friendly', 'location' => 'Summit Deck - Work Nook', 'img' => 'https://images.unsplash.com/photo-1455587734955-081b22074882?w=900'],
                ['name' => 'Fogline Veranda', 'type' => 'King Bed', 'capacity' => '3 Pax', 'price' => 184, 'mood' => 'Relaxing', 'location' => 'Veranda Walk - Valley Fog', 'img' => 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=900'],
                ['name' => 'Cedar Twin Escape', 'type' => 'Twin Bed', 'capacity' => '2 Pax', 'price' => 140, 'mood' => 'Family', 'location' => 'Cedar Wing - Quiet Floors', 'img' => 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=900'],
                ['name' => 'Solstice Premier Corner', 'type' => 'Queen Bed', 'capacity' => '2 Pax', 'price' => 190, 'mood' => 'Romantic', 'location' => 'South Ridge - Panorama Deck', 'img' => 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=900'],
            ],
        ],
        [
            'hotel_name' => 'Marina Pearl Residences',
            'city' => 'Davao',
            'district' => 'Seafront Walk',
            'units' => [
                ['name' => 'Pearl Ocean King', 'type' => 'King Bed', 'capacity' => '2 Pax', 'price' => 168, 'mood' => 'Romantic', 'location' => 'Marina Front - Pearl Deck', 'img' => 'https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?w=900'],
                ['name' => 'Dockside Executive', 'type' => 'Queen Bed', 'capacity' => '2 Pax', 'price' => 178, 'mood' => 'Work-friendly', 'location' => 'Business Wing - Dockside', 'img' => 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=900'],
                ['name' => 'Coral Family Studio', 'type' => 'Twin + Sofa', 'capacity' => '4 Pax', 'price' => 162, 'mood' => 'Family', 'location' => 'Coral Court - Kid Zone', 'img' => 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=900'],
                ['name' => 'Harbor Lantern Suite', 'type' => 'King Bed', 'capacity' => '2 Pax', 'price' => 214, 'mood' => 'Leisure', 'location' => 'Lantern Wing - Night Harbor', 'img' => 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=900'],
                ['name' => 'Seabreeze Twin Room', 'type' => 'Twin Bed', 'capacity' => '2 Pax', 'price' => 148, 'mood' => 'Relaxing', 'location' => 'East Jetty - Breeze Deck', 'img' => 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900'],
                ['name' => 'Pearl Corner Loft', 'type' => 'Queen Bed', 'capacity' => '3 Pax', 'price' => 186, 'mood' => 'Romantic', 'location' => 'Corner Tower - Sea Lights', 'img' => 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=900'],
            ],
        ],
        [
            'hotel_name' => 'North Haven Hotel',
            'city' => 'Clark',
            'district' => 'Aviation Park',
            'units' => [
                ['name' => 'Runway Executive', 'type' => 'Queen Bed', 'capacity' => '2 Pax', 'price' => 174, 'mood' => 'Work-friendly', 'location' => 'Executive Wing - Airport View', 'img' => 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=900'],
                ['name' => 'Haven Family Quad', 'type' => 'Twin + Sofa', 'capacity' => '4 Pax', 'price' => 170, 'mood' => 'Family', 'location' => 'Family Court - Lounge Access', 'img' => 'https://images.unsplash.com/photo-1571508601891-ca5e7a713859?w=900'],
                ['name' => 'Garden Transit King', 'type' => 'King Bed', 'capacity' => '2 Pax', 'price' => 160, 'mood' => 'Relaxing', 'location' => 'Garden Lane - Transit Ease', 'img' => 'https://images.unsplash.com/photo-1496417263034-38ec4f0b665a?w=900'],
                ['name' => 'Premier Lounge Corner', 'type' => 'Queen Bed', 'capacity' => '3 Pax', 'price' => 192, 'mood' => 'Leisure', 'location' => 'Lounge Deck - Corner Suite', 'img' => 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=900'],
                ['name' => 'Skybridge Twin', 'type' => 'Twin Bed', 'capacity' => '2 Pax', 'price' => 146, 'mood' => 'Work-friendly', 'location' => 'Skybridge Hall - Quick Access', 'img' => 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=900'],
                ['name' => 'Aero Club Suite', 'type' => 'King Bed', 'capacity' => '2 Pax', 'price' => 220, 'mood' => 'Romantic', 'location' => 'Club Floor - Private Check-in', 'img' => 'https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?w=900'],
            ],
        ],
        [
            'hotel_name' => 'Verde Vista Inn',
            'city' => 'Tagaytay',
            'district' => 'Ridge View',
            'units' => [
                ['name' => 'Vista Ridge Suite', 'type' => 'King Bed', 'capacity' => '2 Pax', 'price' => 180, 'mood' => 'Romantic', 'location' => 'Ridge Deck - Lake View', 'img' => 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=900'],
                ['name' => 'Lake Breeze Room', 'type' => 'Queen Bed', 'capacity' => '2 Pax', 'price' => 154, 'mood' => 'Relaxing', 'location' => 'Lake Wing - Breeze Balcony', 'img' => 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=900'],
                ['name' => 'Garden Court Family', 'type' => 'Twin + Sofa', 'capacity' => '4 Pax', 'price' => 168, 'mood' => 'Family', 'location' => 'Garden Court - Courtyard Access', 'img' => 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=900'],
                ['name' => 'Summit Work Loft', 'type' => 'Queen Bed', 'capacity' => '2 Pax', 'price' => 176, 'mood' => 'Work-friendly', 'location' => 'Summit Hall - Quiet Workspace', 'img' => 'https://images.unsplash.com/photo-1566195992011-5f6b21e539aa?w=900'],
                ['name' => 'Panorama Twin Select', 'type' => 'Twin Bed', 'capacity' => '2 Pax', 'price' => 149, 'mood' => 'Leisure', 'location' => 'Panorama Row - Taal View', 'img' => 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900'],
                ['name' => 'Verde Crown Corner', 'type' => 'King Bed', 'capacity' => '3 Pax', 'price' => 198, 'mood' => 'Romantic', 'location' => 'Crown Floor - Sunset Angle', 'img' => 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=900'],
            ],
        ],
    ];

    $statuses = ['Available', 'Booked', 'Reserved', 'Available', 'Available', 'Reserved'];
    $inventory = [];
    $roomId = 1;

    foreach ($hotelCatalog as $hotelIndex => $hotel) {
        foreach ($hotel['units'] as $unitIndex => $unit) {
            $inventory[] = [
                'id' => $roomId,
                'hotel_name' => $hotel['hotel_name'],
                'city' => $hotel['city'],
                'district' => $hotel['district'],
                'name' => $unit['name'],
                'type' => $unit['type'],
                'capacity' => $unit['capacity'],
                'status' => $statuses[($hotelIndex + $unitIndex) % count($statuses)],
                'base_price' => map_room_price_to_php((float) $unit['price']),
                'mood' => $unit['mood'],
                'img' => $unit['img'],
                'rating' => round(4.5 + ((($hotelIndex + $unitIndex) % 5) * 0.1), 1),
                'reviews' => 84 + ($hotelIndex * 31) + ($unitIndex * 17),
                'demand_multiplier' => round(1.0 + ((($hotelIndex + $unitIndex) % 4) * 0.15), 2),
                'location' => $unit['location'],
            ];
            $roomId++;
        }
    }

    return $inventory;
}

function seed_state(): array
{
    $employees = [
        ['id' => 1, 'id_number' => 'EMP-1001', 'name' => 'Maria Santos', 'contact_number' => '09171234567', 'age' => 29, 'gender' => 'Female', 'role' => 'Front Desk Officer', 'duty_status' => 'ONDUTY', 'strikes' => 0, 'last_notice' => '', 'bonus' => 0, 'employee_of_month' => true, 'bonus_history' => [], 'strike_history' => [], 'recognition_history' => [['type' => 'Employee of the Month', 'details' => 'Awarded for guest satisfaction and front desk consistency.', 'awarded_at' => '2026-03-01 09:00:00']]],
        ['id' => 2, 'id_number' => 'EMP-1002', 'name' => 'John Cruz', 'contact_number' => '09181234567', 'age' => 34, 'gender' => 'Male', 'role' => 'Concierge', 'duty_status' => 'OFFDUTY', 'strikes' => 0, 'last_notice' => '', 'bonus' => 0, 'employee_of_month' => false, 'bonus_history' => [], 'strike_history' => [], 'recognition_history' => []],
        ['id' => 3, 'id_number' => 'EMP-1003', 'name' => 'Alyssa Reyes', 'contact_number' => '09191234567', 'age' => 27, 'gender' => 'Female', 'role' => 'Reservation Agent', 'duty_status' => 'ONDUTY', 'strikes' => 1, 'last_notice' => 'Late endorsement reminder issued.', 'bonus' => 0, 'employee_of_month' => false, 'bonus_history' => [], 'strike_history' => [['type' => 'Strike Notice', 'details' => 'Late endorsement reminder issued.', 'awarded_at' => '2026-02-14 16:20:00']], 'recognition_history' => []],
        ['id' => 4, 'id_number' => 'EMP-1004', 'name' => 'Marco Villanueva', 'contact_number' => '09201234567', 'age' => 31, 'gender' => 'Male', 'role' => 'Bell Staff', 'duty_status' => 'ONDUTY', 'strikes' => 0, 'last_notice' => '', 'bonus' => 1500, 'employee_of_month' => false, 'bonus_history' => [['type' => 'Bonus', 'amount' => 1500, 'details' => 'Service recovery appreciation bonus.', 'awarded_at' => '2026-03-10 14:00:00']], 'strike_history' => [], 'recognition_history' => []],
        ['id' => 5, 'id_number' => 'EMP-1005', 'name' => 'Samantha Lee', 'contact_number' => '09211234567', 'age' => 30, 'gender' => 'Female', 'role' => 'Housekeeping Supervisor', 'duty_status' => 'ON LEAVE', 'strikes' => 0, 'last_notice' => '', 'bonus' => 0, 'employee_of_month' => false, 'bonus_history' => [], 'strike_history' => [], 'recognition_history' => []],
        ['id' => 6, 'id_number' => 'EMP-1006', 'name' => 'Daniel Flores', 'contact_number' => '09221234567', 'age' => 38, 'gender' => 'Male', 'role' => 'Duty Manager', 'duty_status' => 'ONDUTY', 'strikes' => 0, 'last_notice' => '', 'bonus' => 3000, 'employee_of_month' => false, 'bonus_history' => [['type' => 'Bonus', 'amount' => 3000, 'details' => 'Leadership performance bonus.', 'awarded_at' => '2026-03-05 11:30:00']], 'strike_history' => [], 'recognition_history' => []],
    ];

    $users = [
        'jayrpf' => ['password' => 'admin', 'role' => 'admin', 'points' => 5000, 'fullname' => 'Jayrpf Admin'],
        'guest' => ['password' => 'guest', 'role' => 'user', 'points' => 100, 'fullname' => 'Guest User'],
    ];

    $rewardCatalog = [
        ['id' => 'late-checkout', 'name' => 'Late Check-out', 'points_cost' => 5000, 'description' => 'Extend your departure window with a priority late check-out request.'],
        ['id' => 'breakfast-upgrade', 'name' => 'Breakfast Upgrade', 'points_cost' => 8000, 'description' => 'Redeem a curated breakfast package for your next stay.'],
        ['id' => 'spa-credit', 'name' => 'Spa Credit', 'points_cost' => 12000, 'description' => 'Apply a wellness credit toward an in-stay spa service.'],
        ['id' => 'suite-upgrade', 'name' => 'Suite Upgrade Request', 'points_cost' => 15000, 'description' => 'Request a premium room or suite upgrade, subject to availability.'],
        ['id' => 'vip-arrival', 'name' => 'VIP Arrival Package', 'points_cost' => 20000, 'description' => 'Front desk priority support with a premium arrival and welcome package.'],
    ];

    $loyaltyAccounts = [];
    foreach ($users as $username => $data) {
        $points = (int) ($data['points'] ?? 0);
        $loyaltyAccounts[$username] = [
            'username' => $username,
            'current_points' => $points,
            'tier' => get_loyalty_tier($points),
        ];
    }

    return [
        'rooms' => build_room_inventory(),
        'transactions' => [],
        'points_transactions' => [],
        'reward_redemptions' => [],
        'employees' => extend_employee_roster(array_map('ensure_employee_history', $employees), 53),
        'users' => $users,
        'reward_catalog' => $rewardCatalog,
        'loyalty_accounts' => $loyaltyAccounts,
    ];
}

function load_legacy_state(): array
{
    $path = legacy_state_path();
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }

    if (!file_exists($path)) {
        $state = seed_state();
        file_put_contents($path, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
        return $state;
    }

    $raw = file_get_contents($path);
    $decoded = is_string($raw) ? json_decode($raw, true) : null;

    if (!is_array($decoded)) {
        $decoded = seed_state();
        file_put_contents($path, json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
    }

    return $decoded;
}

function db_connection(): mysqli
{
    static $connection = null;

    if ($connection instanceof mysqli) {
        return $connection;
    }

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $connection = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, '', DB_PORT);
    $connection->set_charset('utf8mb4');
    $connection->query(
        "CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    );
    $connection->select_db(DB_NAME);

    db_ensure_schema($connection);
    db_seed_if_empty($connection);

    return $connection;
}

function db_ensure_schema(mysqli $connection): void
{
    $statements = [
        <<<SQL
        CREATE TABLE IF NOT EXISTS rooms (
            id INT NOT NULL PRIMARY KEY,
            hotel_name VARCHAR(255) NOT NULL,
            city VARCHAR(255) NOT NULL,
            district VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            type VARCHAR(255) NOT NULL,
            capacity VARCHAR(50) NOT NULL,
            status VARCHAR(50) NOT NULL,
            base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
            mood VARCHAR(100) NOT NULL,
            img TEXT NOT NULL,
            rating DECIMAL(3,1) NOT NULL DEFAULT 0,
            reviews INT NOT NULL DEFAULT 0,
            demand_multiplier DECIMAL(5,2) NOT NULL DEFAULT 1.00,
            location VARCHAR(255) NOT NULL,
            updated_at DATETIME NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        SQL,
        <<<SQL
        CREATE TABLE IF NOT EXISTS transactions (
            id INT NOT NULL PRIMARY KEY,
            room_id INT NOT NULL,
            hotel_name VARCHAR(255) NOT NULL,
            unit_name VARCHAR(255) NOT NULL,
            username VARCHAR(191) NOT NULL DEFAULT '',
            guest_name VARCHAR(255) NOT NULL DEFAULT '',
            contact_number VARCHAR(100) NOT NULL DEFAULT '',
            status VARCHAR(50) NOT NULL,
            source VARCHAR(100) NOT NULL,
            payment_type VARCHAR(100) NOT NULL,
            amount DECIMAL(12,2) NOT NULL DEFAULT 0,
            receipt VARCHAR(100) NOT NULL DEFAULT '',
            notes TEXT NOT NULL,
            checkin_date DATE NULL,
            checkout_date DATE NULL,
            early_checkout TINYINT(1) NOT NULL DEFAULT 0,
            compensation_note TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            discount_label VARCHAR(255) NOT NULL DEFAULT '',
            discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
            discount_proof_name VARCHAR(255) NOT NULL DEFAULT '',
            discount_proof_path VARCHAR(255) NOT NULL DEFAULT '',
            discount_proof_type VARCHAR(100) NOT NULL DEFAULT '',
            discount_verified TINYINT(1) NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        SQL,
        <<<SQL
        CREATE TABLE IF NOT EXISTS points_transactions (
            id INT NOT NULL PRIMARY KEY,
            username VARCHAR(191) NOT NULL,
            points INT NOT NULL,
            type VARCHAR(100) NOT NULL,
            description TEXT NOT NULL,
            reference VARCHAR(191) NOT NULL DEFAULT '',
            balance_after INT NOT NULL DEFAULT 0,
            timestamp DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        SQL,
        <<<SQL
        CREATE TABLE IF NOT EXISTS reward_redemptions (
            id INT NOT NULL PRIMARY KEY,
            username VARCHAR(191) NOT NULL,
            reward_id VARCHAR(191) NOT NULL,
            reward_name VARCHAR(255) NOT NULL,
            points_cost INT NOT NULL DEFAULT 0,
            timestamp DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        SQL,
        <<<SQL
        CREATE TABLE IF NOT EXISTS employees (
            id INT NOT NULL PRIMARY KEY,
            id_number VARCHAR(100) NOT NULL,
            name VARCHAR(255) NOT NULL,
            contact_number VARCHAR(100) NOT NULL,
            age INT NOT NULL DEFAULT 0,
            gender VARCHAR(50) NOT NULL,
            role VARCHAR(100) NOT NULL,
            duty_status VARCHAR(50) NOT NULL,
            strikes INT NOT NULL DEFAULT 0,
            last_notice TEXT NOT NULL,
            bonus DECIMAL(12,2) NOT NULL DEFAULT 0,
            employee_of_month TINYINT(1) NOT NULL DEFAULT 0,
            bonus_history_json LONGTEXT NOT NULL,
            strike_history_json LONGTEXT NOT NULL,
            recognition_history_json LONGTEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        SQL,
        <<<SQL
        CREATE TABLE IF NOT EXISTS users (
            username VARCHAR(191) NOT NULL PRIMARY KEY,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL,
            points INT NOT NULL DEFAULT 0,
            fullname VARCHAR(255) NOT NULL DEFAULT ''
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        SQL,
        <<<SQL
        CREATE TABLE IF NOT EXISTS reward_catalog (
            id VARCHAR(191) NOT NULL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            points_cost INT NOT NULL DEFAULT 0,
            description TEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        SQL,
        <<<SQL
        CREATE TABLE IF NOT EXISTS loyalty_accounts (
            username VARCHAR(191) NOT NULL PRIMARY KEY,
            current_points INT NOT NULL DEFAULT 0,
            tier VARCHAR(50) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        SQL,
    ];

    foreach ($statements as $statement) {
        $connection->query($statement);
    }
}

function db_seed_if_empty(mysqli $connection): void
{
    $result = $connection->query('SELECT COUNT(*) AS total FROM rooms');
    $row = $result->fetch_assoc();
    $hasRows = (int) ($row['total'] ?? 0) > 0;
    $result->free();

    if ($hasRows) {
        return;
    }

    db_write_state($connection, load_legacy_state());
}

function db_escape(mysqli $connection, $value): string
{
    if ($value === null) {
        return 'NULL';
    }

    if (is_bool($value)) {
        return $value ? '1' : '0';
    }

    if (is_int($value) || is_float($value)) {
        return (string) $value;
    }

    return "'" . $connection->real_escape_string((string) $value) . "'";
}

function db_json_encode(array $value): string
{
    $json = json_encode($value, JSON_UNESCAPED_SLASHES);
    return is_string($json) ? $json : '[]';
}

function db_json_decode(?string $value): array
{
    if (!is_string($value) || trim($value) === '') {
        return [];
    }

    $decoded = json_decode($value, true);
    return is_array($decoded) ? $decoded : [];
}

function db_execute_insert(mysqli $connection, string $table, array $row): void
{
    $columns = array_map(static fn(string $column): string => '`' . $column . '`', array_keys($row));
    $values = array_map(static fn($value): string => db_escape($connection, $value), array_values($row));
    $sql = sprintf(
        'INSERT INTO `%s` (%s) VALUES (%s)',
        $table,
        implode(', ', $columns),
        implode(', ', $values)
    );
    $connection->query($sql);
}

function db_write_state(mysqli $connection, array $state): void
{
    $connection->begin_transaction();

    try {
        foreach ([
            'reward_redemptions',
            'points_transactions',
            'transactions',
            'employees',
            'loyalty_accounts',
            'reward_catalog',
            'users',
            'rooms',
        ] as $table) {
            $connection->query('DELETE FROM `' . $table . '`');
        }

        foreach ($state['rooms'] as $room) {
            db_execute_insert($connection, 'rooms', [
                'id' => (int) $room['id'],
                'hotel_name' => $room['hotel_name'] ?? '',
                'city' => $room['city'] ?? '',
                'district' => $room['district'] ?? '',
                'name' => $room['name'] ?? '',
                'type' => $room['type'] ?? '',
                'capacity' => $room['capacity'] ?? '',
                'status' => $room['status'] ?? 'Available',
                'base_price' => round((float) ($room['base_price'] ?? 0), 2),
                'mood' => $room['mood'] ?? '',
                'img' => $room['img'] ?? '',
                'rating' => round((float) ($room['rating'] ?? 0), 1),
                'reviews' => (int) ($room['reviews'] ?? 0),
                'demand_multiplier' => round((float) ($room['demand_multiplier'] ?? 1), 2),
                'location' => $room['location'] ?? '',
                'updated_at' => $room['updated_at'] ?? null,
            ]);
        }

        foreach ($state['users'] as $username => $user) {
            db_execute_insert($connection, 'users', [
                'username' => $username,
                'password' => $user['password'] ?? '',
                'role' => $user['role'] ?? 'user',
                'points' => (int) ($user['points'] ?? 0),
                'fullname' => $user['fullname'] ?? '',
            ]);
        }

        foreach ($state['reward_catalog'] as $reward) {
            db_execute_insert($connection, 'reward_catalog', [
                'id' => $reward['id'] ?? '',
                'name' => $reward['name'] ?? '',
                'points_cost' => (int) ($reward['points_cost'] ?? 0),
                'description' => $reward['description'] ?? '',
            ]);
        }

        foreach ($state['loyalty_accounts'] as $username => $account) {
            db_execute_insert($connection, 'loyalty_accounts', [
                'username' => $username,
                'current_points' => (int) ($account['current_points'] ?? 0),
                'tier' => $account['tier'] ?? 'Classic',
            ]);
        }

        foreach ($state['employees'] as $employee) {
            db_execute_insert($connection, 'employees', [
                'id' => (int) $employee['id'],
                'id_number' => $employee['id_number'] ?? '',
                'name' => $employee['name'] ?? '',
                'contact_number' => $employee['contact_number'] ?? '',
                'age' => (int) ($employee['age'] ?? 0),
                'gender' => $employee['gender'] ?? '',
                'role' => $employee['role'] ?? '',
                'duty_status' => $employee['duty_status'] ?? '',
                'strikes' => (int) ($employee['strikes'] ?? 0),
                'last_notice' => $employee['last_notice'] ?? '',
                'bonus' => round((float) ($employee['bonus'] ?? 0), 2),
                'employee_of_month' => !empty($employee['employee_of_month']),
                'bonus_history_json' => db_json_encode($employee['bonus_history'] ?? []),
                'strike_history_json' => db_json_encode($employee['strike_history'] ?? []),
                'recognition_history_json' => db_json_encode($employee['recognition_history'] ?? []),
            ]);
        }

        foreach ($state['transactions'] as $transaction) {
            db_execute_insert($connection, 'transactions', [
                'id' => (int) $transaction['id'],
                'room_id' => (int) ($transaction['room_id'] ?? 0),
                'hotel_name' => $transaction['hotel_name'] ?? '',
                'unit_name' => $transaction['unit_name'] ?? '',
                'username' => $transaction['username'] ?? '',
                'guest_name' => $transaction['guest_name'] ?? '',
                'contact_number' => $transaction['contact_number'] ?? '',
                'status' => $transaction['status'] ?? '',
                'source' => $transaction['source'] ?? '',
                'payment_type' => $transaction['payment_type'] ?? '',
                'amount' => round((float) ($transaction['amount'] ?? 0), 2),
                'receipt' => $transaction['receipt'] ?? '',
                'notes' => $transaction['notes'] ?? '',
                'checkin_date' => $transaction['checkin_date'] ?: null,
                'checkout_date' => $transaction['checkout_date'] ?: null,
                'early_checkout' => !empty($transaction['early_checkout']),
                'compensation_note' => $transaction['compensation_note'] ?? '',
                'timestamp' => $transaction['timestamp'] ?? current_timestamp(),
                'discount_label' => $transaction['discount_label'] ?? '',
                'discount_amount' => round((float) ($transaction['discount_amount'] ?? 0), 2),
                'discount_proof_name' => $transaction['discount_proof_name'] ?? '',
                'discount_proof_path' => $transaction['discount_proof_path'] ?? '',
                'discount_proof_type' => $transaction['discount_proof_type'] ?? '',
                'discount_verified' => !empty($transaction['discount_verified']),
            ]);
        }

        foreach ($state['points_transactions'] as $entry) {
            db_execute_insert($connection, 'points_transactions', [
                'id' => (int) $entry['id'],
                'username' => $entry['username'] ?? '',
                'points' => (int) ($entry['points'] ?? 0),
                'type' => $entry['type'] ?? '',
                'description' => $entry['description'] ?? '',
                'reference' => $entry['reference'] ?? '',
                'balance_after' => (int) ($entry['balance_after'] ?? 0),
                'timestamp' => $entry['timestamp'] ?? current_timestamp(),
            ]);
        }

        foreach ($state['reward_redemptions'] as $entry) {
            db_execute_insert($connection, 'reward_redemptions', [
                'id' => (int) $entry['id'],
                'username' => $entry['username'] ?? '',
                'reward_id' => $entry['reward_id'] ?? '',
                'reward_name' => $entry['reward_name'] ?? '',
                'points_cost' => (int) ($entry['points_cost'] ?? 0),
                'timestamp' => $entry['timestamp'] ?? current_timestamp(),
            ]);
        }

        $connection->commit();
    } catch (Throwable $exception) {
        $connection->rollback();
        throw $exception;
    }
}

function load_state(): array
{
    $connection = db_connection();
    $state = [
        'rooms' => [],
        'transactions' => [],
        'points_transactions' => [],
        'reward_redemptions' => [],
        'employees' => [],
        'users' => [],
        'reward_catalog' => [],
        'loyalty_accounts' => [],
    ];

    $roomsResult = $connection->query('SELECT * FROM rooms ORDER BY id ASC');
    while ($room = $roomsResult->fetch_assoc()) {
        $state['rooms'][] = [
            'id' => (int) $room['id'],
            'hotel_name' => $room['hotel_name'],
            'city' => $room['city'],
            'district' => $room['district'],
            'name' => $room['name'],
            'type' => $room['type'],
            'capacity' => $room['capacity'],
            'status' => $room['status'],
            'base_price' => (float) $room['base_price'],
            'mood' => $room['mood'],
            'img' => $room['img'],
            'rating' => (float) $room['rating'],
            'reviews' => (int) $room['reviews'],
            'demand_multiplier' => (float) $room['demand_multiplier'],
            'location' => $room['location'],
            'updated_at' => $room['updated_at'] ?: null,
        ];
    }
    $roomsResult->free();

    $transactionsResult = $connection->query('SELECT * FROM transactions ORDER BY id DESC');
    while ($transaction = $transactionsResult->fetch_assoc()) {
        $state['transactions'][] = [
            'id' => (int) $transaction['id'],
            'room_id' => (int) $transaction['room_id'],
            'hotel_name' => $transaction['hotel_name'],
            'unit_name' => $transaction['unit_name'],
            'username' => $transaction['username'],
            'guest_name' => $transaction['guest_name'],
            'contact_number' => $transaction['contact_number'],
            'status' => $transaction['status'],
            'source' => $transaction['source'],
            'payment_type' => $transaction['payment_type'],
            'amount' => (float) $transaction['amount'],
            'receipt' => $transaction['receipt'],
            'notes' => $transaction['notes'],
            'checkin_date' => $transaction['checkin_date'] ?: '',
            'checkout_date' => $transaction['checkout_date'] ?: '',
            'early_checkout' => (bool) $transaction['early_checkout'],
            'compensation_note' => $transaction['compensation_note'],
            'timestamp' => $transaction['timestamp'],
            'discount_label' => $transaction['discount_label'],
            'discount_amount' => (float) $transaction['discount_amount'],
            'discount_proof_name' => $transaction['discount_proof_name'],
            'discount_proof_path' => $transaction['discount_proof_path'],
            'discount_proof_type' => $transaction['discount_proof_type'],
            'discount_verified' => (bool) $transaction['discount_verified'],
        ];
    }
    $transactionsResult->free();

    $pointsResult = $connection->query('SELECT * FROM points_transactions ORDER BY id DESC');
    while ($entry = $pointsResult->fetch_assoc()) {
        $state['points_transactions'][] = [
            'id' => (int) $entry['id'],
            'username' => $entry['username'],
            'points' => (int) $entry['points'],
            'type' => $entry['type'],
            'description' => $entry['description'],
            'reference' => $entry['reference'],
            'balance_after' => (int) $entry['balance_after'],
            'timestamp' => $entry['timestamp'],
        ];
    }
    $pointsResult->free();

    $redemptionsResult = $connection->query('SELECT * FROM reward_redemptions ORDER BY id DESC');
    while ($entry = $redemptionsResult->fetch_assoc()) {
        $state['reward_redemptions'][] = [
            'id' => (int) $entry['id'],
            'username' => $entry['username'],
            'reward_id' => $entry['reward_id'],
            'reward_name' => $entry['reward_name'],
            'points_cost' => (int) $entry['points_cost'],
            'timestamp' => $entry['timestamp'],
        ];
    }
    $redemptionsResult->free();

    $employeesResult = $connection->query('SELECT * FROM employees ORDER BY id ASC');
    while ($employee = $employeesResult->fetch_assoc()) {
        $state['employees'][] = [
            'id' => (int) $employee['id'],
            'id_number' => $employee['id_number'],
            'name' => $employee['name'],
            'contact_number' => $employee['contact_number'],
            'age' => (int) $employee['age'],
            'gender' => $employee['gender'],
            'role' => $employee['role'],
            'duty_status' => $employee['duty_status'],
            'strikes' => (int) $employee['strikes'],
            'last_notice' => $employee['last_notice'],
            'bonus' => (float) $employee['bonus'],
            'employee_of_month' => (bool) $employee['employee_of_month'],
            'bonus_history' => db_json_decode($employee['bonus_history_json']),
            'strike_history' => db_json_decode($employee['strike_history_json']),
            'recognition_history' => db_json_decode($employee['recognition_history_json']),
        ];
    }
    $employeesResult->free();

    $usersResult = $connection->query('SELECT * FROM users ORDER BY username ASC');
    while ($user = $usersResult->fetch_assoc()) {
        $state['users'][$user['username']] = [
            'password' => $user['password'],
            'role' => $user['role'],
            'points' => (int) $user['points'],
            'fullname' => $user['fullname'],
        ];
    }
    $usersResult->free();

    $rewardCatalogResult = $connection->query('SELECT * FROM reward_catalog ORDER BY points_cost ASC, id ASC');
    while ($reward = $rewardCatalogResult->fetch_assoc()) {
        $state['reward_catalog'][] = [
            'id' => $reward['id'],
            'name' => $reward['name'],
            'points_cost' => (int) $reward['points_cost'],
            'description' => $reward['description'],
        ];
    }
    $rewardCatalogResult->free();

    $accountsResult = $connection->query('SELECT * FROM loyalty_accounts ORDER BY username ASC');
    while ($account = $accountsResult->fetch_assoc()) {
        $state['loyalty_accounts'][$account['username']] = [
            'username' => $account['username'],
            'current_points' => (int) $account['current_points'],
            'tier' => $account['tier'],
        ];
    }
    $accountsResult->free();

    return $state;
}

function save_state(array $state): void
{
    db_write_state(db_connection(), $state);
}

function storage_path(): string
{
    return legacy_state_path();
}

function get_loyalty_tier(int $points): string
{
    if ($points >= 20000) {
        return 'Gold';
    }
    if ($points >= 10000) {
        return 'Silver';
    }
    return 'Classic';
}

function ensure_loyalty_account(array &$state, ?string $username): ?array
{
    if (!$username) {
        return null;
    }

    if (!isset($state['loyalty_accounts'][$username])) {
        $startingPoints = (int) ($state['users'][$username]['points'] ?? 0);
        $state['loyalty_accounts'][$username] = [
            'username' => $username,
            'current_points' => $startingPoints,
            'tier' => get_loyalty_tier($startingPoints),
        ];
    }

    if (!isset($state['users'][$username])) {
        $state['users'][$username] = [
            'password' => '',
            'role' => 'user',
            'points' => $state['loyalty_accounts'][$username]['current_points'],
            'fullname' => '',
        ];
    }

    $state['users'][$username]['points'] = $state['loyalty_accounts'][$username]['current_points'];
    return $state['loyalty_accounts'][$username];
}

function record_points_transaction(array &$state, ?string $username, int $points, string $transactionType, string $description, string $reference = ''): ?array
{
    $account = ensure_loyalty_account($state, $username);
    if ($account === null || $username === null) {
        return null;
    }

    $newBalance = max(((int) $account['current_points']) + $points, 0);
    $state['loyalty_accounts'][$username]['current_points'] = $newBalance;
    $state['loyalty_accounts'][$username]['tier'] = get_loyalty_tier($newBalance);
    $state['users'][$username]['points'] = $newBalance;

    $entry = [
        'id' => count($state['points_transactions']) + 1,
        'username' => $username,
        'points' => $points,
        'type' => $transactionType,
        'description' => $description,
        'reference' => $reference,
        'balance_after' => $newBalance,
        'timestamp' => current_timestamp(),
    ];

    array_unshift($state['points_transactions'], $entry);
    return $entry;
}

function get_user_points(array &$state, ?string $username): int
{
    $account = ensure_loyalty_account($state, $username);
    return $account ? (int) $account['current_points'] : 0;
}

function get_user_reward_history(array $state, string $username): array
{
    return array_values(array_filter($state['reward_redemptions'], static function (array $item) use ($username): bool {
        return ($item['username'] ?? '') === $username;
    }));
}

function get_user_points_history(array $state, string $username): array
{
    return array_values(array_filter($state['points_transactions'], static function (array $item) use ($username): bool {
        return ($item['username'] ?? '') === $username && ((int) ($item['points'] ?? 0)) > 0;
    }));
}

function get_processed_rooms(array $state): array
{
    $now = new DateTimeImmutable('now');
    $weekday = (int) $now->format('N');
    $hour = (int) $now->format('G');
    $isWeekend = $weekday >= 5;
    $hourSurge = ($hour > 18 || $hour < 8) ? 1.1 : 1.0;
    $processed = [];

    foreach ($state['rooms'] as $room) {
        $weekendVal = $isWeekend ? 1.3 : 1.0;
        $demandVal = (float) ($room['multiplier'] ?? $room['demand_multiplier'] ?? 1.0);
        $finalPrice = ((float) $room['base_price']) * $weekendVal * $hourSurge * $demandVal;
        $roomData = $room;
        $roomData['display_price'] = round($finalPrice, 2);
        $roomData['is_peak'] = ($weekendVal * $demandVal) > 1.3;
        $processed[] = $roomData;
    }

    return $processed;
}

function get_processed_room_by_id(array $state, int $roomId): ?array
{
    foreach (get_processed_rooms($state) as $room) {
        if ((int) $room['id'] === $roomId) {
            return $room;
        }
    }
    return null;
}

function add_transaction(
    array &$state,
    array $room,
    string $status,
    string $source,
    string $paymentType = 'Pending',
    ?string $receipt = null,
    string $notes = '',
    string $guestName = '',
    string $contactNumber = '',
    ?float $amount = null,
    string $username = '',
    string $checkinDate = '',
    string $checkoutDate = '',
    bool $earlyCheckout = false,
    string $compensationNote = '',
    array $extra = []
): array {
    $entry = array_merge([
        'id' => count($state['transactions']) + 1,
        'room_id' => (int) $room['id'],
        'hotel_name' => $room['hotel_name'],
        'unit_name' => $room['name'],
        'username' => $username,
        'guest_name' => $guestName,
        'contact_number' => $contactNumber,
        'status' => $status,
        'source' => $source,
        'payment_type' => $paymentType,
        'amount' => $amount ?? (float) ($room['display_price'] ?? $room['base_price'] ?? 0),
        'receipt' => $receipt ?: 'Pending',
        'notes' => $notes,
        'checkin_date' => $checkinDate,
        'checkout_date' => $checkoutDate,
        'early_checkout' => $earlyCheckout,
        'compensation_note' => $compensationNote,
        'timestamp' => current_timestamp(),
    ], $extra);

    array_unshift($state['transactions'], $entry);
    return $entry;
}

function parse_iso_date(?string $value): ?DateTimeImmutable
{
    if (!$value) {
        return null;
    }

    $date = DateTimeImmutable::createFromFormat('Y-m-d', $value);
    return $date ?: null;
}

function build_my_unit_state(array $transaction): array
{
    $today = new DateTimeImmutable('today');
    $checkin = parse_iso_date($transaction['checkin_date'] ?? '');
    $checkout = parse_iso_date($transaction['checkout_date'] ?? '');

    if (!$checkin || !$checkout || $checkout <= $checkin) {
        return [
            'status_label' => 'Active',
            'status_class' => 'available',
            'progress_percent' => 0,
            'status_copy' => 'Dates will update once your final stay schedule is confirmed.',
        ];
    }

    $totalDays = max((int) $checkin->diff($checkout)->days, 1);
    $elapsedDays = min(max((int) $checkin->diff($today)->days * ($today >= $checkin ? 1 : 0), 0), $totalDays);
    $progressPercent = (int) (($elapsedDays / $totalDays) * 100);

    if ($today >= $checkout || (($transaction['status'] ?? '') === 'Completed')) {
        return [
            'status_label' => 'Unit Expired',
            'status_class' => 'booked',
            'progress_percent' => 100,
            'status_copy' => 'This stay window has ended. Visit the front desk if you need post-stay support.',
        ];
    }

    if ((int) $today->diff($checkout)->days <= 1) {
        return [
            'status_label' => 'About to Expire',
            'status_class' => 'peak',
            'progress_percent' => max($progressPercent, 80),
            'status_copy' => 'Your active stay is close to check-out. Coordinate with the front desk for extensions or departure assistance.',
        ];
    }

    return [
        'status_label' => 'Active',
        'status_class' => 'available',
        'progress_percent' => max($progressPercent, 8),
        'status_copy' => 'Your unit is still active. Everything remains ready for your current stay schedule.',
    ];
}

function get_latest_user_transaction(array $state, ?string $username): ?array
{
    if (!$username) {
        return null;
    }

    $fullName = strtolower(trim((string) ($state['users'][$username]['fullname'] ?? '')));
    foreach ($state['transactions'] as $transaction) {
        if (($transaction['username'] ?? '') === $username) {
            return $transaction;
        }
        if (($transaction['username'] ?? '') === '' && $fullName !== '' && strtolower(trim((string) ($transaction['guest_name'] ?? ''))) === $fullName) {
            return $transaction;
        }
    }

    return null;
}

function get_website_context_summary(array $state): array
{
    $processedRooms = get_processed_rooms($state);
    $hotelNames = array_values(array_unique(array_map(static fn(array $room): string => $room['hotel_name'], $state['rooms'])));
    sort($hotelNames);
    $cityNames = array_values(array_unique(array_map(static fn(array $room): string => $room['city'], $state['rooms'])));
    sort($cityNames);
    $availableRooms = array_values(array_filter($processedRooms, static fn(array $room): bool => ($room['status'] ?? '') === 'Available'));
    $bookedCount = count(array_filter($processedRooms, static fn(array $room): bool => ($room['status'] ?? '') === 'Booked'));
    $reservedCount = count(array_filter($processedRooms, static fn(array $room): bool => ($room['status'] ?? '') === 'Reserved'));
    $prices = array_map(static fn(array $room): float => (float) ($room['display_price'] ?? MIN_ROOM_PRICE_PHP), $processedRooms);

    return [
        'processed_rooms' => $processedRooms,
        'hotel_names' => $hotelNames,
        'city_names' => $cityNames,
        'available_rooms' => $availableRooms,
        'booked_count' => $bookedCount,
        'reserved_count' => $reservedCount,
        'min_price' => $prices ? min($prices) : MIN_ROOM_PRICE_PHP,
        'max_price' => $prices ? max($prices) : MAX_ROOM_PRICE_PHP,
    ];
}

function string_contains_any(string $query, array $needles): bool
{
    foreach ($needles as $needle) {
        if ($needle !== '' && str_contains($query, $needle)) {
            return true;
        }
    }
    return false;
}

function generate_concierge_reply(array $state, ?string $message): string
{
    $query = strtolower(trim((string) $message));
    $context = get_website_context_summary($state);
    $availableRooms = $context['available_rooms'];
    $sampleRoom = $availableRooms[0] ?? null;

    if ($query === '') {
        return "Hello, this is LuxeStay support. Let me know what you need and I'll help arrange it for you.";
    }

    if (string_contains_any($query, ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'])) {
        return 'Hello and welcome to LuxeStay. I can help with arrival, room concerns, payments, or hotel requests.';
    }

    if (string_contains_any($query, ['thank you', 'thanks', 'salamat'])) {
        return "You're very welcome. If you need anything else before or after arrival, just message me here.";
    }

    if (string_contains_any($query, ['key', 'front desk', 'id', 'identification', 'valid id'])) {
        return 'Please proceed to the front desk and present your valid ID so our staff can verify your booking and hand over your room key.';
    }

    if (str_contains($query, 'room') && string_contains_any($query, ['number', 'assigned', 'what room', 'which room'])) {
        return 'Your room assignment will be confirmed by the front desk on arrival. We usually finalize it within the 100 to 200 room range prepared for incoming guests.';
    }

    if (string_contains_any($query, ['check in', 'check-in'])) {
        return 'Our standard check-in time is 2:00 PM. If you arrive early, the front desk can assist with holding your luggage while your room is being prepared.';
    }

    if (string_contains_any($query, ['check out', 'check-out', 'checkout'])) {
        return 'Check-out is at 12:00 PM. If you need a late check-out request, I can note that for the front desk team.';
    }

    if (string_contains_any($query, ['hotel', 'branch', 'property', 'properties'])) {
        return 'We currently feature ' . count($context['hotel_names']) . ' hotel properties: ' . implode(', ', $context['hotel_names']) . '. Let me know which one you want details about.';
    }

    if (string_contains_any($query, ['where can i stay', 'available room', 'available hotel', 'availability', 'vacant'])) {
        if ($sampleRoom) {
            return 'We currently have ' . count($availableRooms) . ' available rooms across the website. One available option is ' . $sampleRoom['name'] . ' at ' . $sampleRoom['hotel_name'] . ' in ' . $sampleRoom['city'] . ', currently around PHP ' . number_format((float) $sampleRoom['display_price'], 2) . '.';
        }
        return 'At the moment, availability is limited. Please tell me your preferred hotel or city so I can guide you to the best current option.';
    }

    if (string_contains_any($query, ['price', 'cost', 'rate', 'rates', 'how much'])) {
        return 'Our current displayed room rates are generally around PHP ' . number_format((float) $context['min_price'], 2) . ' to PHP ' . number_format((float) $context['max_price'], 2) . ', depending on the room, demand, and booking timing.';
    }

    if (string_contains_any($query, ['payment method', 'mode of payment', 'mop', 'how can i pay'])) {
        return 'We currently support GCash / PayMaya, Credit / Debit, QRPH, Online Banking, and Pay at Hotel. Pay at Hotel requires a 50% partial payment first using GCash, Card / Debit, or PayMaya.';
    }

    if (string_contains_any($query, ['pwd', 'senior', 'discount'])) {
        return 'We currently support a PWD discount of PHP 2,000 and a Senior Citizen discount of PHP 3,000. The selected discount is deducted from the subtotal during checkout.';
    }

    if (string_contains_any($query, ['receipt', 'reference', 'transaction'])) {
        return 'After a successful booking, the system generates a receipt reference that can be used to find the transaction later. The receipt also shows the payment method, subtotal, discount, total, and due-now amount.';
    }

    if (string_contains_any($query, ['wifi', 'wi-fi', 'internet'])) {
        return 'Complimentary high-speed Wi-Fi is available throughout the property. The access details can also be confirmed for you at the front desk during check-in.';
    }

    if (string_contains_any($query, ['pool', 'swimming', 'gym', 'spa', 'breakfast', 'parking'])) {
        return 'Certainly. Let me know which hotel amenity you need, such as breakfast, spa, pool, gym, or parking, and I will give you the details.';
    }

    if (string_contains_any($query, ['extra bed', 'pillow', 'towel', 'blanket', 'amenities', 'toiletries'])) {
        return 'I can help endorse that request. Please tell me exactly what item or room setup you need so the staff can prepare it for your arrival.';
    }

    if (string_contains_any($query, ['cancel', 'refund', 'rebook', 'reschedule'])) {
        return 'I can help explain the cancellation and refund process. Please share whether you would like to cancel, request a refund, or move the booking to a different date.';
    }

    if (string_contains_any($query, ['payment', 'paid', 'gcash', 'paymaya', 'qrph', 'online banking', 'card', 'debit'])) {
        return 'I can help with payment concerns. Please tell me if you want help confirming a payment, checking the payment method used, or arranging the remaining balance.';
    }

    if (string_contains_any($query, ['location', 'address', 'where', 'direction', 'directions', 'nearby'])) {
        return 'Our listed hotel locations currently cover ' . implode(', ', $context['city_names']) . '. If you tell me the hotel name, I can guide you using its location shown on the website.';
    }

    if (string_contains_any($query, ['arrive', 'arrival', 'late', 'coming now', 'on the way'])) {
        return 'Thank you for the update. Our team can prepare for your arrival. If you have an estimated arrival time or special request, send it here and I will note it.';
    }

    if (string_contains_any($query, ['agent', 'human', 'staff', 'representative'])) {
        return "You're connected to LuxeStay support. I can continue assisting here like a live desk agent, and if needed I can also note your concern for the front desk staff.";
    }

    return 'I can help with that. Please give me a few more details so I can guide you properly.';
}

function find_item_index(array $items, callable $predicate): ?int
{
    foreach ($items as $index => $item) {
        if ($predicate($item)) {
            return $index;
        }
    }
    return null;
}

function current_user_name(): ?string
{
    $user = $_SESSION['user'] ?? null;
    return is_string($user) && $user !== '' ? $user : null;
}

function discount_proof_storage_dir(): string
{
    $path = app_root_path() . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'discount-proofs';
    if (!is_dir($path)) {
        mkdir($path, 0777, true);
    }
    return $path;
}

function store_discount_proof(string $receiptId, string $discountLabel, string $originalName, string $mimeType, string $dataUrl): array
{
    $originalName = trim($originalName);
    if ($originalName === '' || trim($dataUrl) === '') {
        throw new RuntimeException('Please upload a valid discount ID before continuing.');
    }

    if (!preg_match('#^data:([^;]+);base64,(.+)$#', $dataUrl, $matches)) {
        throw new RuntimeException('The uploaded discount ID could not be processed.');
    }

    $detectedMime = strtolower(trim($matches[1]));
    $mimeType = strtolower(trim($mimeType ?: $detectedMime));
    $allowedTypes = [
        'image/jpeg' => 'jpg',
        'image/jpg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'application/pdf' => 'pdf',
    ];

    $selectedType = $allowedTypes[$mimeType] ?? $allowedTypes[$detectedMime] ?? null;
    if ($selectedType === null) {
        throw new RuntimeException('Only JPG, PNG, WEBP, or PDF discount IDs are accepted.');
    }

    $binary = base64_decode($matches[2], true);
    if ($binary === false) {
        throw new RuntimeException('The uploaded discount ID is corrupted. Please upload the file again.');
    }

    if (strlen($binary) > 5 * 1024 * 1024) {
        throw new RuntimeException('The discount ID is too large. Please upload a file smaller than 5 MB.');
    }

    $safeLabel = preg_replace('/[^a-z0-9]+/i', '-', strtolower($discountLabel)) ?: 'discount-id';
    $safeName = preg_replace('/[^a-z0-9._-]+/i', '-', basename($originalName)) ?: 'proof.' . $selectedType;
    $storedName = strtolower($receiptId) . '-' . $safeLabel . '-' . time() . '.' . $selectedType;
    $relativePath = 'storage/discount-proofs/' . $storedName;
    $fullPath = discount_proof_storage_dir() . DIRECTORY_SEPARATOR . $storedName;

    file_put_contents($fullPath, $binary, LOCK_EX);

    return [
        'original_name' => $safeName,
        'stored_name' => $storedName,
        'path' => $relativePath,
        'mime_type' => $mimeType,
        'size_bytes' => strlen($binary),
    ];
}
