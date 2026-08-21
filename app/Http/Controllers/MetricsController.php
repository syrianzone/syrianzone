<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;
use Prometheus\CollectorRegistry;
use Prometheus\RenderTextFormat;
use Prometheus\Storage\PDO as PdoStorage;

class MetricsController extends Controller
{
    public function index()
    {
        // Optional scrape-token guard: when METRICS_TOKEN is set, the scraper
        // must send it as a bearer token. Keeps the endpoint private on hosts
        // where the scraper can't be firewalled at the network level.
        $token = config('services.metrics.token');
        if ($token && !hash_equals($token, (string) request()->bearerAuth())) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        // Shared storage via the app's database connection: an InMemory registry
        // constructed per request would always render empty metrics.
        try {
            $storage = new PdoStorage(DB::connection()->getPdo());
            $registry = new CollectorRegistry($storage);
        } catch (\Throwable $e) {
            report($e);
            return response("metrics storage unavailable\n", 503, ['Content-Type' => 'text/plain']);
        }

        $renderer = new RenderTextFormat();
        $result = $renderer->render($registry->getMetricFamilySamples());

        return response($result, 200, ['Content-Type' => RenderTextFormat::MIME_TYPE]);
    }
}
