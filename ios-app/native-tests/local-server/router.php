<?php

declare(strict_types=1);

// PHP listens on loopback. HTTPS and the original Host arrive from the test proxy.
if (PHP_SAPI !== 'cli-server' || ($_SERVER['REMOTE_ADDR'] ?? '') !== '127.0.0.1') {
    http_response_code(403);
    exit;
}

$project = dirname(__DIR__, 3);
$runtime = $project.'/ios-app/.expo/local-fixture';
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$path = is_string($uri) ? rawurldecode($uri) : '/';
// Only the real native broker may reach the explicitly simulated local provider.
$nativeGoogle = ['/auth/google/native', '/auth/google/callback', '/api/v1/auth/google/native/token'];
if ((str_starts_with($path, '/auth/google') || str_starts_with($path, '/api/v1/auth/google')) && ! in_array($path, $nativeGoogle, true)) {
    http_response_code(503);
    header('Content-Type: application/json');
    echo json_encode(['message' => 'تسجيل Google غير متاح في خادم الاختبار المحلي.']);
    exit;
}
$media = str_starts_with($path, '/storage/');
$base = $media ? $runtime.'/storage/app/public' : $project.'/public';
$file = realpath($base.'/'.($media ? substr($path, 9) : ltrim($path, '/')));
if ($file && str_starts_with($file, realpath($base).DIRECTORY_SEPARATOR) && is_file($file)) {
    $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $types = ['png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'webp' => 'image/webp', 'svg' => 'image/svg+xml', 'woff2' => 'font/woff2', 'ttf' => 'font/ttf', 'json' => 'application/json'];
    if (isset($types[$extension])) {
        header('Content-Type: '.$types[$extension]);
        readfile($file);
        exit;
    }
}

if ($media && ! ($file && str_starts_with($file, realpath($base).DIRECTORY_SEPARATOR) && is_file($file))) {
    http_response_code(404);
    exit;
}

$app = require __DIR__.'/bootstrap.php';
$app->handleRequest(Illuminate\Http\Request::capture());
