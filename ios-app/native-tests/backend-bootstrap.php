<?php

// Only for focused backend transport tests in a checkout without web assets.
// The full website gate builds assets and does not use this bootstrap.
$repository = dirname(__DIR__, 2);
require_once $repository.'/vendor/autoload.php';

pest()->beforeEach(function () {
    $this->withoutVite();
})->in($repository.'/tests/Feature');
