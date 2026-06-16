export interface WwbWinner {
  member_id: number | null;
  guest_id: number | null;
  name: string;
  points: number;
}

export interface WwbResult {
  adhoc_game_id: number;
  club_id: number;
  game_date: string;
  ww_front9_winner_id: number | null;
  ww_front9_guest_id: number | null;
  ww_front9_points: number | null;
  ww_back9_winner_id: number | null;
  ww_back9_guest_id: number | null;
  ww_back9_points: number | null;
  ww_overall_winner_id: number | null;
  ww_overall_guest_id: number | null;
  ww_overall_points: number | null;
  birdie_pool_total: number;
  birdie_pool_per_birdie: number;
  birdie_pool_entrants: number;
  birdie_pool_total_birdies: number;
}

export interface WwbBirdiePayout {
  adhoc_game_id: number;
  member_id: number | null;
  guest_id: number | null;
  birdies_scored: number;
  payout_amount: number;
}
