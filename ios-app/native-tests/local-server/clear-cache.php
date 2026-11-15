<?php

declare(strict_types=1);

$app = require __DIR__.'/bootstrap.php';
Illuminate\Support\Facades\Artisan::call('cache:clear');
echo "Cleared only the isolated fixture cache before its self-check.\n";
