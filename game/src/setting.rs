/*

//TODO some fancy comments EVERYWHERE!
This struct contains all the different settings you can choose before a game.

*/

use crate::card::*;

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
pub enum Team {
    None,
    Manually(Vec<usize>),
    Evenly(usize), // Evenly spaced with n teams
    Blocks(usize), // Creates blocks of n players each
}


// #[derive(Tsify)]
// #[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Serialize, Deserialize)]
pub struct Setting {
    pub max_points: u16,                  // used
    pub point_recv_order: Vec<PointRule>, // used
    // pub playtype_multiplier: Vec<i32>, // used
    // pub allow_playtype: Vec<bool>, // used
    pub allow_misere: bool,        // used
    pub allow_pass: bool,          // used

    // pub automatic_show: bool,
    // pub automatic_marriage: bool,
    pub match_points: u16,    // used
    pub marriage_points: u16, // used

    // pub team: Team,
    pub allow_back_pass: bool,
    pub pass_to_same_team: bool,

    pub startcondition: StartingCondition,      // used
    pub apply_startcondition_on_revanche: bool, // used

    // pub react_time: u32,

    // pub passed_player_begins: Vec<bool>, // used
    pub show_points_maximum: u16, // used
}

#[wasm_bindgen]
impl Setting {
	pub fn schieber() -> Self {
        Setting {
			// let mut beg_passed = vec![true; NUM_PLAYTYPES];
			// beg_passed[SHIELD as usize] = false;
			// beg_passed[ACORN as usize] = false;
			// beg_passed[ROSE as usize] = false;
			// beg_passed[BELL as usize] = false;

			max_points: 20,
            point_recv_order: vec![PointRule::MARRIAGE, PointRule::SHOW, PointRule::PLAY],
            // playtype_multiplier: vec![1; NUM_PLAYTYPES],
            // allow_playtype: vec![true; NUM_PLAYTYPES],
            allow_misere: true,
            allow_pass: true,

            // automatic_show: false,
            // automatic_marriage: true,
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
