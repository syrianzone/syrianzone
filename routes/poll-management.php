<?php

use App\Http\Controllers\CandidateController;
use App\Http\Controllers\CandidateGroupController;
use App\Http\Controllers\PollController;
use Illuminate\Support\Facades\Route;

return function (bool $canonical): Closure {
    return function () use ($canonical): void {
        if ($canonical) {
            Route::get('/polls', [PollController::class, 'adminIndex'])->middleware('polls_admin:any');
            Route::get('/polls/{id}', [PollController::class, 'adminShow'])->middleware('polls_admin:any');
        }

        Route::post('/polls', [PollController::class, 'store'])
            ->middleware('polls_admin:polls.create');
        Route::put('/polls/{id}', [PollController::class, 'update'])
            ->middleware('polls_admin:polls.edit');
        Route::delete('/polls/{id}', [PollController::class, 'destroy'])
            ->middleware('polls_admin:polls.delete');

        // Candidates and candidate groups are the editable content of a
        // poll. Creating them is part of building a poll, so it takes
        // polls.create; changing them takes polls.edit; removing them takes
        // polls.delete. That is what makes polls.create sufficient to
        // assemble a poll and no more.
        //
        // These are spelled out rather than declared with apiResource
        // because apiResource attaches one middleware string to the whole
        // resource, and `any` here would let a create-only user delete.
        // Read-only, and tagged `any` to keep the previous breadth: any
        // single polls capability could read these before, and reads are
        // not the risk writes are. Only mutating actions are separated.
        Route::get('/candidate-groups', [CandidateGroupController::class, 'index'])
            ->middleware('polls_admin:any');
        Route::get('/candidate-groups/{id}', [CandidateGroupController::class, 'show'])
            ->middleware('polls_admin:any');
        Route::post('/candidate-groups', [CandidateGroupController::class, 'store'])
            ->middleware('polls_admin:polls.create');
        Route::put('/candidate-groups/{id}', [CandidateGroupController::class, 'update'])
            ->middleware('polls_admin:polls.edit');
        Route::patch('/candidate-groups/{id}', [CandidateGroupController::class, 'update'])
            ->middleware('polls_admin:polls.edit');
        Route::delete('/candidate-groups/{id}', [CandidateGroupController::class, 'destroy'])
            ->middleware('polls_admin:polls.delete');
        Route::post('/candidate-groups/reorder', [CandidateGroupController::class, 'reorder'])
            ->middleware('polls_admin:polls.edit');
        Route::post('/candidate-groups/{id}/default', [CandidateGroupController::class, 'setDefault'])
            ->middleware('polls_admin:polls.edit');

        Route::post('/candidates', [CandidateController::class, 'store'])
            ->middleware('polls_admin:polls.create');
        Route::put('/candidates/{id}', [CandidateController::class, 'update'])
            ->middleware('polls_admin:polls.edit');
        Route::patch('/candidates/{id}', [CandidateController::class, 'update'])
            ->middleware('polls_admin:polls.edit');
        Route::delete('/candidates/{id}', [CandidateController::class, 'destroy'])
            ->middleware('polls_admin:polls.delete');
        Route::patch('/candidates/{id}/archive', [CandidateController::class, 'archive'])
            ->middleware('polls_admin:polls.edit');
        Route::patch('/candidates/{id}/restore', [CandidateController::class, 'restore'])
            ->middleware('polls_admin:polls.edit');

    };
};
