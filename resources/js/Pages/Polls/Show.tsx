import React from "react";
import { Link } from "@inertiajs/react";
import MainLayout from "@/Layouts/MainLayout";
import TierBoard, { type Candidate, type CandidateGroup } from "@/Components/poll/TierBoard";
import { Button } from "@/Components/ui/button";
import type { Poll } from "@/Domain/polls/types";

interface PollShowProps {
  poll: Poll;
  candidates: Candidate[];
  groups: CandidateGroup[];
  voteDay: string;
}

export default function PollShow({ poll, candidates, groups, voteDay }: PollShowProps) {
  return (
    <MainLayout>
      <div className="max-w-screen-lg mx-auto px-4 pt-6">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold text-foreground mb-2">{poll.title}</h1>
          <p className="text-muted-foreground text-sm mb-4">
            اسحب البطاقات لترتيبها ضمن المستويات (من S إلى F)، أو اضغط على البطاقة لاختيار المستوى مباشرة، ثم شارك تقييمك!
          </p>
          <div className="flex justify-center gap-4">
            <Button asChild variant="outline" size="lg">
              <Link href={`/polls/${poll.slug}/leaderboard`}>
                عرض النتائج العامة
              </Link>
            </Button>
          </div>
        </div>

        <div className="mb-12">
          <TierBoard
            initialCandidates={candidates}
            groups={groups}
            pollId={poll.id}
            voteDay={voteDay}
            pollSlug={poll.slug}
          />
        </div>
      </div>
    </MainLayout>
  );
}
