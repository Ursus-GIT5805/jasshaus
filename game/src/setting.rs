use crate::{
	card::*,
	ruleset::*,
};

use serde::{Deserialize, Serialize};
use tsify_next::Tsify;
use wasm_bindgen::prelude::*;

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Copy, Serialize, Deserialize)]
pub enum StartingCondition {
    RANDOM,
    PLAYER(u8),
    CARD(Card),
}

#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Copy, Serialize, Deserialize)]
#[wasm_bindgen]
pub enum PointRule {
    PLAY,
    SHOW,
    MARRIAGE,
}

/// Rules of how teams are chosen
#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Serialize, Deserialize)]
pub enum TeamChoosing {
    None, // There are no teams, everyone vs everyone
    // Manually(Vec<usize>),
	Periodic(usize), // Creates n teams, where player_id=(pid) has team (pid%n)
    Blocks(usize), // Creates blocks of n players each
}

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Copy, Serialize, Deserialize)]
#[non_exhaustive]
pub enum EndCondition {
	Points(i32),
	Rounds(i32),
}

// #[derive(Tsify)]
// #[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Serialize, Deserialize)]
#[non_exhaustive]
pub struct Setting {
	pub num_players: usize,
	pub team_choosing: TeamChoosing,
	pub end_condition: EndCondition,

	pub less_points_win: bool,
    pub point_recv_order: Vec<PointRule>,

	pub allow_shows: bool,
	pub allow_table_shows: bool,
	pub show_gives_negative: bool,

	pub allow_misere: bool,
    pub allow_pass: bool,
	pub allowed_playtypes: Vec<bool>,

	pub allow_marriage: bool,
	pub marriage_gives_negative: bool,

	pub passed_player_begins: Vec<bool>,
	pub playtype_multiplier: Vec<i32>,

	pub match_points: i32,
	pub last_points: i32,
    pub marriage_points: i32,
    pub show_points_maximum: i32,

    pub allow_back_pass: bool,
    pub pass_to_same_team: bool,

    pub startcondition: StartingCondition,
    pub apply_startcondition_on_revanche: bool,
}

#[wasm_bindgen]
impl Setting {
	pub fn schieber() -> Self {
        Setting {
			num_players: 4,
			team_choosing: TeamChoosing::Periodic(2),
			end_condition: EndCondition::Points(1000),
			less_points_win: false,
            point_recv_order: vec![PointRule::MARRIAGE, PointRule::SHOW, PointRule::PLAY],

			allow_shows: true,
			allow_table_shows: false,
			show_gives_negative: false,

			allow_misere: true,
            allow_pass: true,
			allowed_playtypes: vec![true; NUM_PLAYTYPES],

			allow_marriage: true,
			marriage_gives_negative: false,

			passed_player_begins: {
				let mut v = vec![true; NUM_PLAYTYPES];
				for c in 0..NUM_COLORS {
					if let Some(id) = Playtype::Color(c as u8).get_id() {
						match v.get_mut(id) {
							Some(c) => *c = false,
							None => {},
						}
					}
				}
				v
			},
			playtype_multiplier: vec![1; NUM_PLAYTYPES],

            match_points: 100,
			last_points: 5,
            marriage_points: 20,
            show_points_maximum: 300,

            allow_back_pass: false,
            pass_to_same_team: true,

            startcondition: StartingCondition::CARD(Card::new(0, 4)),
            apply_startcondition_on_revanche: false,
        }
	}
}
