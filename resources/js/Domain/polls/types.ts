/** The poll administration shapes, as the backend sends them. */

export interface Poll {
  id: string;
  title: string;
  slug: string;
  timezone?: string;
  is_active: boolean;
  candidates_count: number;
}

export interface PollCandidate {
  id: string;
  candidate_group_id?: string | null;
  name: string;
  title?: string | null;
  x_handle?: string | null;
  image_url?: string | null;
  /** The editor's own copy of `image_url`; not a column. */
  imageUrl?: string | null;
  category?: string | null;
  status?: 'active' | 'archived';
  term_started_at?: string | null;
  term_ended_at?: string | null;
  archive_reason?: string | null;
  successor_id?: string | null;
}

export interface PollGroup {
  id: string;
  poll_id: string;
  name: string;
  key?: string | null;
  sort_order: number;
  is_default?: boolean;
  /** Disabled categories keep their data but leave the public site. */
  is_active?: boolean;
}

export interface PollDetails {
  poll?: Poll;
  candidates?: PollCandidate[];
  groups?: PollGroup[];
}

export interface CandidateInput {
  name: string;
  title: string | null;
  x_handle: string | null;
  image_url: string | null;
  candidate_group_id: string | null;
  poll_id?: string;
}

export interface CandidateArchiveInput {
  term_ended_at: string | null;
  archive_reason: string | null;
  successor_id: string | null;
}
