<?php

namespace App\Http\Controllers;

use App\Models\Promise;
use App\Models\PromiseReport;
use App\Services\Promises\PromisePresenter;
use App\Services\Promises\PromiseSubmissionService;
use App\Services\Promises\PromiseVoteService;
use App\Services\Promises\SpeakerDirectory;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Response;

/**
 * Public side of the promises tracker (عداد الوعود): the list, the detail
 * page, the suggestion form, and the visitor JSON endpoints (speaker search,
 * suggestions, reports, votes). Domain rules live in App\Services\Promises.
 */
class PromiseController extends Controller
{
    public function __construct(
        private readonly PromisePresenter $presenter,
        private readonly PromiseSubmissionService $submissions,
        private readonly PromiseVoteService $votes,
        private readonly SpeakerDirectory $speakers,
    ) {}

    public function index(): Response
    {
        return inertia('Promises/Index', $this->presenter->index());
    }

    public function show(int $number): Response
    {
        $promise = $this->findPublished($number);
        SeoMeta::remember(request(), 'promise', $promise);

        return inertia('Promises/Show', [
            'promise' => $this->presenter->detail($promise),
        ]);
    }

    public function suggest(): Response
    {
        return inertia('Promises/Suggest', [
            'venues' => Promise::VENUES,
            'earliestDate' => Promise::EARLIEST_STATEMENT_DATE,
            'today' => Promise::today()->format('Y-m-d'),
        ]);
    }

    /** Speaker search for the public suggestion form: approved people only. */
    public function speakers(Request $request): JsonResponse
    {
        $q = mb_substr((string) $request->query('q', ''), 0, 80);

        return response()->json(['speakers' => $this->speakers->search($q)]);
    }

    public function storeSuggestion(Request $request): JsonResponse
    {
        $data = $request->validate([
            'speaker_ref' => ['nullable', 'string', 'max:80', 'required_without:speaker_name'],
            'speaker_name' => ['nullable', 'string', 'max:255', 'required_without:speaker_ref'],
            'speaker_title' => ['nullable', 'string', 'max:255'],
            'title' => ['required', 'string', 'max:200'],
            'quote' => ['required', 'string', 'max:5000'],
            'statement_date' => [
                'required', 'date',
                'after_or_equal:'.Promise::EARLIEST_STATEMENT_DATE,
                'before_or_equal:'.Promise::today()->format('Y-m-d'),
            ],
            'statement_venue' => ['nullable', Rule::in(Promise::VENUES)],
            'deadline_wording' => ['nullable', 'string', 'max:255'],
            'source_urls' => ['required', 'array', 'min:1', 'max:5'],
            'source_urls.*' => ['required', 'url:http,https', 'max:2048'],
            'note' => ['nullable', 'string', 'max:2000'],
        ], [
            'speaker_ref.required_without' => 'اختر المسؤول من القائمة أو اكتب اسمه',
            'speaker_name.required_without' => 'اختر المسؤول من القائمة أو اكتب اسمه',
            'speaker_name.max' => 'الاسم طويل جداً',
            'speaker_title.max' => 'المنصب طويل جداً',
            'title.required' => 'اكتب عنواناً مختصراً للوعد',
            'title.max' => 'العنوان طويل جداً (200 حرف كحد أقصى)',
            'quote.required' => 'اكتب نص الوعد كما قاله المسؤول',
            'quote.max' => 'النص طويل جداً',
            'statement_date.required' => 'حدد تاريخ التصريح',
            'statement_date.date' => 'تاريخ التصريح غير صالح',
            'statement_date.after_or_equal' => 'يغطي العداد الوعود التي أُطلقت منذ 8 كانون الأول 2024',
            'statement_date.before_or_equal' => 'لا يمكن أن يكون تاريخ التصريح في المستقبل',
            'statement_venue.in' => 'اختر مكان التصريح من القائمة',
            'deadline_wording.max' => 'عبارة الموعد طويلة جداً',
            'source_urls.required' => 'أضف رابطاً واحداً على الأقل للمصدر',
            'source_urls.min' => 'أضف رابطاً واحداً على الأقل للمصدر',
            'source_urls.max' => 'خمسة مصادر كحد أقصى',
            'source_urls.*.required' => 'أحد روابط المصادر فارغ',
            'source_urls.*.url' => 'يجب أن يكون رابط المصدر صالحاً ويبدأ بـ https://',
            'source_urls.*.max' => 'رابط المصدر طويل جداً',
            'note.max' => 'الملاحظات طويلة جداً',
        ]);

        $this->submissions->suggest($request->user(), $data);

        return response()->json([
            'message' => 'شكراً لك، وصل اقتراحك وسيُراجَع قبل نشره',
        ], 201);
    }

    public function storeReport(Request $request, int $number): JsonResponse
    {
        $promise = $this->findPublished($number);

        $data = $request->validate([
            'kind' => ['required', Rule::in(PromiseReport::KINDS)],
            'body' => ['required', 'string', 'min:10', 'max:2000'],
            'source_url' => [
                Rule::requiredIf($request->input('kind') === 'progress'),
                'nullable', 'url:http,https', 'max:2048',
            ],
        ], [
            'kind.required' => 'نوع الرسالة غير صالح',
            'kind.in' => 'نوع الرسالة غير صالح',
            'body.required' => 'اكتب ما تريد إبلاغنا به',
            'body.min' => 'اكتب 10 أحرف على الأقل',
            'body.max' => 'النص طويل جداً',
            'source_url.required' => 'أرفق رابطاً يثبت التحديث',
            'source_url.url' => 'يجب أن يكون الرابط صالحاً ويبدأ بـ https://',
            'source_url.max' => 'الرابط طويل جداً',
        ]);

        $this->submissions->report($request->user(), $promise, $data);

        return response()->json([
            'message' => 'شكراً لك، سيراجع المحررون ما أرسلته',
        ], 201);
    }

    public function vote(Request $request, int $number): JsonResponse
    {
        $promise = $this->findPublished($number);

        $data = $request->validate([
            'believes' => ['required', 'boolean'],
            'device_id' => ['nullable', 'string', 'max:64'],
        ], [
            'believes.required' => 'اختر إجابة',
            'believes.boolean' => 'اختر إجابة',
            'device_id.string' => 'تعذّر تسجيل التصويت، أعد تحميل الصفحة وحاول مجدداً',
            'device_id.max' => 'تعذّر تسجيل التصويت، أعد تحميل الصفحة وحاول مجدداً',
        ]);

        $tally = $this->votes->cast(
            $promise,
            (bool) $data['believes'],
            $request->user(),
            $data['device_id'] ?? null,
            $request->ip(),
        );

        return response()->json(['votes' => $tally]);
    }

    private function findPublished(int $number): Promise
    {
        return Promise::published()->where('number', $number)->first() ?? abort(404);
    }
}
