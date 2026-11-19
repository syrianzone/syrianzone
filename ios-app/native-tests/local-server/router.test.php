<?php

declare(strict_types=1);

// Execute the actual router body with only its HTTP runtime and Laravel fallback isolated.
$source = file_get_contents(__DIR__.'/router.php');
$namespaced = str_replace('declare(strict_types=1);', "declare(strict_types=1);\nnamespace NativeRouterRegression;", $source, $replacements);
if ($replacements !== 1) throw new RuntimeException('The actual router declaration is required.');
$root = sys_get_temp_dir().'/sz-public-router-'.bin2hex(random_bytes(8));
$project = $root.'/project';
$router = $project.'/ios-app/native-tests/local-server/router.php';
$runtime = $project.'/ios-app/.expo/local-fixture';
$public = $runtime.'/storage/app/public';
foreach ([dirname($router), $public.'/avatars/105', $runtime.'/storage/app/private', $project.'/public/images'] as $directory) {
    if (! mkdir($directory, 0700, true)) throw new RuntimeException('The isolated test directory could not be created.');
}
file_put_contents($router, $namespaced);
file_put_contents(dirname($router).'/bootstrap.php', <<<'PHP'
<?php
return new class {
    public function handleRequest(object $request): void
    {
        \NativeRouterRegression\http_response_code(418);
        echo 'LARAVEL_FALLBACK';
    }
};
PHP);
file_put_contents($root.'/worker.php', <<<'PHP'
<?php
namespace NativeRouterRegression\Illuminate\Http {
    final class Request { public static function capture(): object { return new \stdClass; } }
}
namespace NativeRouterRegression {
    const PHP_SAPI = 'cli-server';
    $status = 200; $headers = [];
    function http_response_code(?int $value = null): int
    {
        global $status;
        if ($value !== null) $status = $value;
        return $status;
    }
    function header(string $value): void { global $headers; $headers[] = $value; }
    register_shutdown_function(function () use ($argv): void {
        global $status, $headers;
        file_put_contents($argv[3], json_encode(['status' => $status, 'headers' => $headers], JSON_THROW_ON_ERROR));
    });
    $_SERVER['REMOTE_ADDR'] = '127.0.0.1'; $_SERVER['REQUEST_URI'] = $argv[2];
    require $argv[1];
}
PHP);

$checks = 0;
function route(string $uri): array
{
    global $root, $router;
    $metadata = $root.'/response-'.bin2hex(random_bytes(4)).'.json';
    $process = proc_open([PHP_BINARY, $root.'/worker.php', $router, $uri, $metadata], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (! is_resource($process)) throw new RuntimeException('The isolated actual router could not run.');
    $body = stream_get_contents($pipes[1]); fclose($pipes[1]);
    $error = stream_get_contents($pipes[2]); fclose($pipes[2]);
    if (proc_close($process) !== 0 || $error !== '') throw new RuntimeException('The isolated actual router failed.');
    return [...json_decode(file_get_contents($metadata), true, flags: JSON_THROW_ON_ERROR), 'body' => $body];
}
function checkRoute(bool $condition, string $message): void
{
    global $checks;
    if (! $condition) throw new RuntimeException($message);
    $checks++;
}
function removeTestTree(string $path): void
{
    if (is_dir($path) && ! is_link($path)) {
        foreach (array_diff(scandir($path), ['.', '..']) as $name) removeTestTree($path.'/'.$name);
        rmdir($path);
    } else unlink($path);
}

try {
    $missing = '/storage/avatars/105/50000000-0000-4000-8000-000000000001.webp';
    checkRoute(route($missing)['status'] === 404, 'Missing public media must return 404 before the private Laravel route.');
    $bytes = "owned-avatar-test\x00\xff";
    file_put_contents($public.'/avatars/105/50000000-0000-4000-8000-000000000001.webp', $bytes);
    $response = route($missing);
    checkRoute($response['status'] === 200 && $response['body'] === $bytes && $response['headers'] === ['Content-Type: image/webp'], 'Existing owned media must retain its exact bytes and public image header.');
    file_put_contents($project.'/public/images/existing.png', 'static-public-image');
    $response = route('/images/existing.png');
    checkRoute($response['status'] === 200 && $response['body'] === 'static-public-image' && $response['headers'] === ['Content-Type: image/png'], 'Existing non-storage static files must remain unchanged.');
    file_put_contents($public.'/unchanged.txt', 'unsupported-public-extension');
    $response = route('/storage/unchanged.txt');
    checkRoute($response['status'] === 418 && $response['body'] === 'LARAVEL_FALLBACK', 'Existing unsupported public extensions must keep the original fallback.');
    file_put_contents($runtime.'/storage/app/private/secret.png', 'PRIVATE_BYTES_MUST_NOT_LEAVE');
    foreach (['/api/v1/user', '/private/secret.png', '/images/missing.png'] as $uri) {
        $response = route($uri);
        checkRoute($response['status'] === 418 && $response['body'] === 'LARAVEL_FALLBACK', 'Non-public-media routes must retain their Laravel fallback.');
    }
    foreach (['/storage/../private/secret.png', '/storage/%2e%2e/private/secret.png', '/storage/private/secret.png'] as $uri) {
        $response = route($uri);
        checkRoute($response['status'] === 404 && $response['body'] === '', 'Missing or escaping public paths must not reach a private file or fallback.');
    }
    if (! symlink($runtime.'/storage/app/private/secret.png', $public.'/escape.png')) throw new RuntimeException('The isolated symlink case is required.');
    $response = route('/storage/escape.png');
    checkRoute($response['status'] === 404 && $response['body'] === '', 'A symlink outside the public root must never be served.');
    echo "Actual local router: {$checks} checks passed.\n";
} finally { removeTestTree($root); }
