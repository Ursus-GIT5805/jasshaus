/*

//TODO some fancy comments EVERYWHERE!
This struct contains all the different settings you can choose before a game.

*/

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
pub enum Team {
    None,
    Manually(Vec<usize>),
    Evenly(usize), // Evenly spaced with n teams
    Blocks(usize), // Creates blocks of n players each
}

#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Copy, Serialize, Deserialize)]
pub enum WinningCondition {
	Points(i32),
	Rounds(i32),
}

// #[derive(Tsify)]
// #[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Serialize, Deserialize)]
pub struct Setting {
    pub max_points: i32,                  // used
	pub less_points_win: bool,
    pub point_recv_order: Vec<PointRule>, // used

	pub allow_shows: bool,            // used
	pub show_gives_negative: bool, // used

	pub allow_misere: bool,           // used
    pub allow_pass: bool,             // used
	pub allowed_playtypes: Vec<bool>, // used

	pub passed_player_begins: Vec<bool>, // used
	pub playtype_multiplier: Vec<i32>, // used

	pub match_points: i32,    // used
    pub marriage_points: i32, // used

    pub allow_back_pass: bool, // used
    pub pass_to_same_team: bool, // used

    pub startcondition: StartingCondition,      // used
    pub apply_startcondition_on_revanche: bool, // used

    // pub react_time: u32,

    // pub passed_player_begins: Vec<bool>, // used
    pub show_points_maximum: i32, // used
}

#[wasm_bindgen]
impl Setting {
	pub fn schieber() -> Self {
        Setting {
			max_points: 1000,
			less_points_win: false,
            point_recv_order: vec![PointRule::MARRIAGE, PointRule::SHOW, PointRule::PLAY],

			allow_shows: true,
			show_gives_negative: false,

			allow_misere: true,
            allow_pass: true,
			allowed_playtypes: vec![true; NUM_PLAYTYPES],

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

            allow_back_pass: false,
            pass_to_same_team: true,

            match_points: 100,
            marriage_points: 20,

            startcondition: StartingCondition::CARD(Card::new(0, 4)),
            apply_startcondition_on_revanche: false,

            // react_time: 0,

            // passed_player_begins: beg_passed,
            show_points_maximum: 300,
        }
	}
}
