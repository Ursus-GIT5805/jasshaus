use crate::{
	card::*,
	ruleset::*,
};

use serde::{Deserialize, Serialize};
use tsify_next::Tsify;
use wasm_bindgen::prelude::*;

use htmlform::*;
use htmlform_macros::*;

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Copy, Serialize, Deserialize)]
#[derive(HtmlForm)]
pub enum StartingCondition {
	#[Form("#title": "Zufällig")]
    Random,
	#[Form("#title": "Karte")]
    Card(Card),
}

#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Copy, Serialize, Deserialize)]
#[wasm_bindgen]
#[derive(HtmlForm)]
pub enum PointRule {
	#[Form("#title": "Stich")]
    Play,
	#[Form("#title": "Weis")]
    Show,
	#[Form("#title": "Stöck")]
    Marriage,
	#[Form("#title": "Tischweis")]
    TableShow,
}

#[wasm_bindgen]
pub fn get_gamesettingform() -> String {
	json::stringify(Setting::form_data())
}

/// Rules of how teams are chosen
#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Serialize, Deserialize)]
#[derive(HtmlForm)]
pub enum TeamChoosing {
	#[Form("#title": "Keine Teams")]
    None, // There are no teams, everyone vs everyone
	#[Form("#title": "Periodisch")]
	#[Form("#description": "Personen werden im gegenuhrzeigersinn bis n periodisch nummeriert.")]
	Periodic(usize), // Creates n teams, where player_id=(pid) has team (pid%n)
	// #[Form("#title": "Block")]
	// #[Form("#description": "Immer n spieler nacheinander werden gruppiert.")]
    // Blocks(usize), // Creates blocks of n players each
}

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Copy, Serialize, Deserialize)]
#[non_exhaustive]
#[derive(HtmlForm)]
pub enum EndCondition {
	#[Form("#title": "Auf Punkte")]
	Points(i32),
	#[Form("#title": "Auf Runden")]
	Rounds(i32),
}

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Copy, Serialize, Deserialize)]
#[non_exhaustive]
#[derive(HtmlForm)]
pub enum PointEval {
	#[Form("#title": "Punkte Addieren")]
	Add,
	#[Form("#title": "Differenz nehmen")]
	Difference {
		#[Form("#title": "Weise berücksichtigen")]
		include_shows: bool,
		#[Form("#title": "Stöck berücksichtigen")]
		include_marriage: bool,

		#[Form("#title": "Nulldifferenz Extrapunkte")]
		zero_diff_points: i32,
		#[Form("#title": "Stich benötigt")]
		#[Form("#description": "Entscheiden, ob mindestens ein Stich für die Extrapunkte benötigt wird.")]
		needs_win: bool,
	},
}

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Copy, Serialize, Deserialize)]
#[non_exhaustive]
#[derive(HtmlForm)]
pub enum AnnounceRule {
	#[Form("#title": "Manuelle Ansage")]
	Choose,
	#[Form("#title": "Zufällig")]
	Random,
}

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Copy, Serialize, Deserialize)]
#[non_exhaustive]
#[derive(HtmlForm)]
pub struct PlaytypeSetting {
	#[Form("#title": "Erlauben")]
	pub allow: bool,
	#[Form("#title": "Multiplikator")]
	pub multiplier: i32,
	#[Form("#title": "Zugeschobener Spieler beginnt")]
	pub passed_player_begins: bool,
}

// #[derive(Tsify)]
// #[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Serialize, Deserialize)]
#[non_exhaustive]
#[derive(HtmlForm)]
pub struct Setting {
	#[Form("#title": "Anzahl Spieler")]
	pub num_players: usize,
	#[Form("#title": "Teams")]
	pub team_choosing: TeamChoosing,
	#[Form("#title": "Ziel")]
	pub end_condition: EndCondition,
	#[Form("#title": "Punkteauswertung")]
	#[Form("#description": "Wie werden die Punkte ausgewertet?")]
	pub point_eval: PointEval,

	#[Form("#title": "Wenig Punkte")]
	#[Form("#description": "Entscheiden, ob das Ziel ist, möglichst wenig Punkte zu erzielen.")]
	pub less_points_win: bool,
	#[Form("#title": "Punkteregelung")]
	#[Form("#description": "Reihenfolge der Punkteverrechnung. Zuoberst wird zuerst verrechnet.")]
    pub point_recv_order: Vec<PointRule>,


	#[Form("#title": "Weise erlauben")]
	pub allow_shows: bool,
	#[Form("#title": "Weise geben Negativpunkte")]
	pub show_gives_negative: bool,

	#[Form("#title": "Tischweise erlauben")]
	pub allow_table_shows: bool,
	#[Form("#title": "Tischweise geben Negativpunkte")]
	pub table_show_gives_negative: bool,

	#[Form("#title": "Maximale Weispunkte")]
    pub show_points_maximum: i32,

	#[Form("#title": "Stöck erlauben")]
	pub allow_marriage: bool,
	#[Form("#title": "Stöckpunkte")]
    pub marriage_points: i32,

	#[Form("#title": "Ansage")]
	pub announce: AnnounceRule,
	#[Form("#title": "Trumpfeinstellungen")]
	pub playtype: Vec<PlaytypeSetting>,

	#[Form("#title": "Striktes Untertrumpfregel")]
	#[Form("#description": "Entscheiden, ob man nie untertrumpfen darf (ausser man hat keine andere Wahll)")]
	pub strict_undertrumpf: bool,
	#[Form("#title": "Misère erlauben")]
	pub allow_misere: bool,

	#[Form("#title": "Matchpunkte")]
	pub match_points: i32,
	#[Form("#title": "Punkte des letzten Stichs")]
	pub last_points: i32,

	#[Form("#title": "Schieben erlauben")]
    pub allow_pass: bool,
	#[Form("#title": "Zurückschieben erlauben")]
    pub allow_back_pass: bool,
	#[Form("#title": "Zum gleichen Team schieben")]
	#[Form("#description": "Entscheiden, falls zum gleichen Team, oder zum nächsten Spieler geschoben wird.")]
    pub pass_to_same_team: bool,

	#[Form("#title": "Beginnender Spieler")]
	#[Form("#description": "Entscheiden, wie der beginnende Spieler bestimmt wird.")]
    pub startcondition: StartingCondition,
	#[Form("#title": "Diese Regel bei Revanche anwenden")]
    pub apply_startcondition_on_revanche: bool,
}

#[wasm_bindgen]
impl Setting {
	pub fn schieber() -> Self {
        Setting {
			num_players: 4,
			team_choosing: TeamChoosing::Periodic(2),
			end_condition: EndCondition::Points(1000),

			point_eval: PointEval::Add,

			less_points_win: false,
            point_recv_order: vec![PointRule::Marriage, PointRule::TableShow, PointRule::Show, PointRule::Play],

			allow_shows: true,
			allow_table_shows: false,
			show_gives_negative: false,
			table_show_gives_negative: false,

			allow_misere: true,

			announce: AnnounceRule::Choose,
			playtype: {
				let mut v = vec![PlaytypeSetting {
					allow: true,
					multiplier: 1,
					passed_player_begins: true,
				}; NUM_PLAYTYPES];
				for c in 0..NUM_COLORS {
					if let Some(id) = Playtype::Color(c as u8).get_id() {
						match v.get_mut(id) {
							Some(c) => c.passed_player_begins = false,
							None => {},
						}
					}
				}
				v
			},

			allow_marriage: true,

            match_points: 100,
			last_points: 5,
            marriage_points: 20,
            show_points_maximum: 300,

			allow_pass: true,
            allow_back_pass: false,
            pass_to_same_team: true,

			strict_undertrumpf: true,

            startcondition: StartingCondition::Card(Card::new(0, 4)),
            apply_startcondition_on_revanche: false,
        }
	}

	pub fn molotow() -> Self {
        Setting {
			num_players: 4,
			team_choosing: TeamChoosing::None,
			end_condition: EndCondition::Rounds(12),
			point_eval: PointEval::Add,

			less_points_win: true,
            point_recv_order: vec![PointRule::Marriage, PointRule::TableShow, PointRule::Show, PointRule::Play],

			allow_shows: false,
			allow_table_shows: true,
			show_gives_negative: false,
			table_show_gives_negative: false,

			allow_misere: false,

			announce: AnnounceRule::Random,
			playtype: {
				let mut v = vec![PlaytypeSetting {
					allow: false,
					multiplier: 1,
					passed_player_begins: false,
				}; NUM_PLAYTYPES];

				let pt_id = Playtype::Molotow.get_id().unwrap_or(0);
				match v.get_mut(pt_id) {
					Some(c) => c.allow = true,
					None => {},
				}
				v
			},

			allow_marriage: true,

            match_points: 100,
			last_points: 5,
            marriage_points: -20,
            show_points_maximum: 300,

			allow_pass: false,
            allow_back_pass: false,
            pass_to_same_team: true,

			strict_undertrumpf: false,

            startcondition: StartingCondition::Random,
            apply_startcondition_on_revanche: false,
        }
	}

	pub fn must_bid(&self) -> bool {
		match self.point_eval {
			PointEval::Difference { .. } => true,
			_ => false,
		}
	}

	pub fn num_allowed(&self) -> usize {
		self.playtype.iter()
			.map(|p| p.allow as usize)
			.sum()
	}
}

impl Default for Setting {
	fn default() -> Self {
		Self::schieber()
	}
}

#[wasm_bindgen]
/// Return true if it's a legal setting else, not
pub fn legal_setting(setting: &Setting) -> bool {
	// Some conditions which are illegal
	let donts = vec![
		setting.num_allowed() == 0,
		setting.num_players > NUM_CARDS,
	];

	match setting.startcondition {
		StartingCondition::Card(c) => {
			if c.color as usize >= NUM_COLORS ||
				c.number as usize >= NUM_NUMBERS {
				return false;
			}
		}
		_ => {},
	}

	!donts.into_iter().any(|x| x)
}

#[cfg(target_family = "wasm")]
#[wasm_bindgen]
pub fn must_bid(setting: &Setting) -> bool {
	setting.must_bid()
}
