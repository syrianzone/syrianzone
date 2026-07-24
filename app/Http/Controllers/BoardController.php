<?php

namespace App\Http\Controllers;

use App\Models\Board;
use Illuminate\Http\Request;
use Inertia\Inertia;

class BoardController extends Controller
{
    // The document is opaque storage. The server validates its shape and size so a
    // client cannot use it as free hosting, and never interprets widget config.
    private const MAX_BYTES = 65536;

    public function renderIndex()
    {
        return Inertia::render('Board/Index');
    }

    public function show(Request $request)
    {
        $board = Board::where('user_id', $request->user()->id)->first();

        return response()->json([
            'document' => $board?->document,
            'updated_at' => $board?->updated_at?->toIso8601String(),
        ]);
    }

    public function update(Request $request)
    {
        // Cheap guard before validation: `c` is an open bag holding user text, so
        // cap the payload by bytes rather than trying to bound every field.
        if (strlen($request->getContent()) > self::MAX_BYTES) {
            return response()->json(['message' => 'حجم اللوحة كبير جداً'], 422);
        }

        $request->validate([
            'document' => 'required|array',
            'document.v' => 'required|integer|min:1|max:1',
            'document.activeId' => 'required|string|max:40',
            'document.updatedAt' => 'required|string|max:40',
            'document.dashboards' => 'required|array|min:1|max:10',
            'document.dashboards.*.id' => 'required|string|max:40',
            'document.dashboards.*.name' => 'required|string|max:40',
            'document.dashboards.*.widgets' => 'present|array|max:40',
            'document.dashboards.*.widgets.*.i' => 'required|string|max:40',
            'document.dashboards.*.widgets.*.d' => 'required|string|max:40',
            'document.dashboards.*.widgets.*.w' => 'required|integer|min:1|max:12',
            'document.dashboards.*.widgets.*.h' => 'required|integer|min:1|max:8',
            'document.dashboards.*.widgets.*.c' => 'present|array',
        ], [
            'document.required' => 'اللوحة مطلوبة',
            'document.v.max' => 'إصدار اللوحة غير مدعوم',
            'document.dashboards.max' => 'الحد الأقصى 10 لوحات',
            'document.dashboards.*.widgets.max' => 'الحد الأقصى 40 ويدجت في اللوحة',
            'document.dashboards.*.widgets.*.w.max' => 'عرض الويدجت غير صالح',
            'document.dashboards.*.widgets.*.h.max' => 'ارتفاع الويدجت غير صالح',
        ]);

        $board = Board::updateOrCreate(
            ['user_id' => $request->user()->id],
            ['version' => 1, 'document' => $request->input('document')],
        );

        return response()->json(['updated_at' => $board->updated_at->toIso8601String()]);
    }
}
