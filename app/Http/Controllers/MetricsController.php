<?php

namespace App\Http\Controllers;

use Prometheus\CollectorRegistry;
use Prometheus\RenderTextFormat;
use Prometheus\Storage\InMemory;

class MetricsController extends Controller
{
    public function index()
    {
        $registry = new CollectorRegistry(new InMemory());

        $renderer = new RenderTextFormat();
        $result = $renderer->render($registry->getMetricFamilySamples());

        return response($result, 200, ['Content-Type' => RenderTextFormat::MIME_TYPE]);
    }
}
