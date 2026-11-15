<?php

declare(strict_types=1);

$app = require __DIR__.'/bootstrap.php';
exit($app->handleCommand(new Symfony\Component\Console\Input\ArgvInput([
    'native-fixture', 'reverb:start', '--host=127.0.0.1', '--port=9018',
])));
