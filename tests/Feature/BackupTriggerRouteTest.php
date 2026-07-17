<?php

use Illuminate\Support\Facades\Artisan;

test('run-backup 404s when no token is configured', function () {
    config(['services.backup_trigger.token' => null]);
    $this->post('/ops/run-backup', [], ['X-Backup-Token' => ''])->assertNotFound();
});

test('run-backup 404s on a wrong token', function () {
    config(['services.backup_trigger.token' => 'right-token']);
    $this->post('/ops/run-backup', [], ['X-Backup-Token' => 'wrong-token'])->assertNotFound();
});

test('run-backup runs a db-only backup on the right token', function () {
    config(['services.backup_trigger.token' => 'right-token']);
    Artisan::shouldReceive('call')->once()->with('backup:run', ['--only-db' => true, '--disable-notifications' => true]);
    Artisan::shouldReceive('output')->once()->andReturn('backup done');
    $this->post('/ops/run-backup', [], ['X-Backup-Token' => 'right-token'])->assertOk()->assertJson(['ok' => true]);
});
