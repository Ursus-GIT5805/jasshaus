use crate::{card::*, ruleset::*};

use serde::{Deserialize, Serialize};
use tsify_next::Tsify;
use wasm_bindgen::prelude::*;

use htmlform::*;
use htmlform_macros::*;

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Copy, Serialize, Deserialize)]
#[non_exhaustive]
#[derive(HtmlForm)]
pub enum StartingCondition {
	#[Form("#name": "Zufällig")]
	Random,
	#[Form("#name": "Karte")]
    #[Form("#type": "Card")]
	Card(Card),
}

#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Copy, Serialize, Deserialize)]
#[wasm_bindgen]
#[non_exhaustive]
#[derive(HtmlForm)]
pub enum PointRule {
	#[Form("#name": "Stich")]
	Play,
	#[Form("#name": "Weis")]
	Show,
	#[Form("#name": "Stöck")]
	Marriage,
	#[Form("#name": "Tischweis")]
	TableShow,
}

/// Rules of how teams are chosen
#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Serialize, Deserialize)]
#[non_exhaustive]
#[derive(HtmlForm)]
pub enum TeamChoosing {
	#[Form("#name": "Keine Teams")]
	None, // There are no teams, everyone vs everyone
	#[Form("#name": "Periodisch")]
	#[Form("#desc": "Personen werden im gegenuhrzeigersinn bis n periodisch nummeriert.")]
	Periodic(usize), // Creates n teams, where player_id=(pid) has team (pid%n)
	                 // #[Form("#name": "Block")]
	                 // #[Form("#desc": "Immer n spieler nacheinander werden gruppiert.")]
	                 // Blocks(usize), // Creates blocks of n players each
}

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Copy, Serialize, Deserialize)]
#[non_exhaustive]
#[derive(HtmlForm)]
pub enum EndCondition {
	#[Form("#name": "Auf Punkte")]
	Points(i32),
	#[Form("#name": "Auf Runden")]
	Rounds(i32),
    #[Form("#name": "Kein")]
    None,
}

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Copy, Serialize, Deserialize)]
#[non_exhaustive]
#[derive(HtmlForm)]
pub enum PointEval {
	#[Form("#name": "Punkte Addieren")]
	Add,
	#[Form("#name": "Differenz nehmen")]
	Difference {
		#[Form("#name": "Weise berücksichtigen")]
		include_shows: bool,
		#[Form("#name": "Stöck berücksichtigen")]
		include_marriage: bool,

		#[Form("#name": "Nulldifferenz Extrapunkte")]
		zero_diff_points: i32,
		#[Form("#name": "Stich benötigt")]
		#[Form("#desc": "Entscheiden, ob mindestens ein Stich für die Extrapunkte benötigt wird.")]
		needs_win: bool,
	},
}

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Copy, Serialize, Deserialize)]
#[non_exhaustive]
#[derive(HtmlForm)]
pub enum AnnounceRule {
	#[Form("#name": "Manuelle Ansage")]
	Choose,
	#[Form("#name": "Zufällig")]
	Random,
    #[Form("#name": "Einmal Trumpf")]
	#[Form("#desc": "Jeder Trumpf kann nur einmal angesagt werden. Kann nichts mehr angesagt werden, endet das Spiel.")]
    Onetime {
        #[Form("#name": "Einmal Slalom")]
	    #[Form("#desc": "Entweder Slalom Obenabe oder Undeufe.")]
        link_slalom: bool,
        #[Form("#name": "Einmal Riesenslalom")]
        link_big_slalom: bool,
        #[Form("#name": "Einmal Guschti/Mary")]
        link_guschtimary: bool,
    },
}

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Copy, Serialize, Deserialize)]
#[non_exhaustive]
#[derive(HtmlForm)]
pub struct PlaytypeSetting {
	#[Form("#name": "Erlauben")]
	pub allow: bool,
	#[Form("#name": "Multiplikator")]
	pub multiplier: i32,
	#[Form("#name": "Zugeschobener Spieler beginnt")]
	pub passed_player_begins: bool,
}

#[derive(Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[derive(PartialEq, Eq, std::fmt::Debug, Clone, Serialize, Deserialize)]
#[non_exhaustive]
#[derive(HtmlForm)]
pub struct Setting {
	#[Form("#name": "Anzahl Spieler")]
	pub num_players: usize,
	#[Form("#name": "Teams")]
	pub team_choosing: TeamChoosing,
	#[Form("#name": "Ziel")]
	pub end_condition: EndCondition,
	#[Form("#name": "Punkteauswertung")]
	#[Form("#desc": "Wie werden die Punkte ausgewertet?")]
	pub point_eval: PointEval,

    #[Form("#name": "Punkte nur für Ansager")]
	#[Form("#desc": "Werden die Punkte nur für die ansagende Partei ausgewertet?")]
    pub points_only_announcer: bool,

	#[Form("#name": "Wenig Punkte")]
	#[Form("#desc": "Entscheiden, ob das Ziel ist, möglichst wenig Punkte zu erzielen.")]
	pub less_points_win: bool,
	#[Form("#name": "Punkteregelung")]
	#[Form("#desc": "Reihenfolge der Punkteverrechnung. Zuoberst wird zuerst verrechnet.")]
	pub point_recv_order: Vec<PointRule>,

	#[Form("#name": "Weise erlauben")]
	pub allow_shows: bool,
	#[Form("#name": "Weise geben Negativpunkte")]
	pub show_gives_negative: bool,

	#[Form("#name": "Tischweise erlauben")]
	pub allow_table_shows: bool,
	#[Form("#name": "Tischweise geben Negativpunkte")]
	pub table_show_gives_negative: bool,

	#[Form("#name": "Maximale Weispunkte")]
	pub show_points_maximum: i32,

	#[Form("#name": "Stöck erlauben")]
	pub allow_marriage: bool,
	#[Form("#name": "Stöckpunkte")]
	pub marriage_points: i32,

	#[Form("#name": "Ansage")]
	pub announce: AnnounceRule,
	#[Form("#name": "Trumpfeinstellungen")]
	pub playtype: Vec<PlaytypeSetting>,

	#[Form("#name": "Strikte Untertrumpfregel")]
	#[Form("#desc": "Entscheiden, ob man nie untertrumpfen darf (ausser man hat keine andere Wahll)")]
	pub strict_undertrumpf: bool,
	#[Form("#name": "Misère erlauben")]
	pub allow_misere: bool,

	#[Form("#name": "Matchpunkte")]
	pub match_points: i32,
	#[Form("#name": "Punkte des letzten Stichs")]
	pub last_points: i32,

	#[Form("#name": "Schieben erlauben")]
	pub allow_pass: bool,
	#[Form("#name": "Zurückschieben erlauben")]
	pub allow_back_pass: bool,
	#[Form("#name": "Zum gleichen Team schieben")]
	#[Form("#desc": "Entscheiden, falls zum gleichen Team, oder zum nächsten Spieler geschoben wird.")]
	pub pass_to_same_team: bool,

	#[Form("#name": "Beginnender Spieler")]
	#[Form("#desc": "Entscheiden, wie der beginnende Spieler bestimmt wird.")]
	pub startcondition: StartingCondition,
	#[Form("#name": "Diese Regel bei Revanche anwenden")]
	pub apply_startcondition_on_revanche: bool,
}

#[wasm_bindgen]
pub fn setting_schieber() -> Setting {
	Setting {
		num_players: 4,
		team_choosing: TeamChoosing::Periodic(2),
		end_condition: EndCondition::Points(1000),

		point_eval: PointEval::Add,
        points_only_announcer: false,

		less_points_win: false,
		point_recv_order: vec![
			PointRule::Marriage,
			PointRule::TableShow,
			PointRule::Show,
			PointRule::Play,
		],

		allow_shows: true,
		allow_table_shows: false,
		show_gives_negative: false,
		table_show_gives_negative: false,

		allow_misere: true,

		announce: AnnounceRule::Choose,
		playtype: {
			let mut v = vec![
				PlaytypeSetting {
					allow: true,
					multiplier: 1,
					passed_player_begins: true,
				};
				NUM_PLAYTYPES
			];

			for c in 0..NUM_COLORS {
				let id1 = Playtype::Color(c as u8).get_id();
				let id2 = Playtype::ColorDownup(c as u8).get_id();

				match v.get_mut(id1) {
					Some(c) => c.passed_player_begins = false,
					None => {}
				}

				match v.get_mut(id2) {
					Some(c) => c.passed_player_begins = false,
					None => {}
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

#[wasm_bindgen]
pub fn setting_molotow() -> Setting {
	Setting {
		num_players: 4,
		team_choosing: TeamChoosing::None,
		end_condition: EndCondition::Rounds(12),
		point_eval: PointEval::Add,
        points_only_announcer: false,

		less_points_win: true,
		point_recv_order: vec![
			PointRule::Marriage,
			PointRule::TableShow,
			PointRule::Show,
			PointRule::Play,
		],

		allow_shows: true,
		allow_table_shows: true,
		show_gives_negative: true,
		table_show_gives_negative: false,

		allow_misere: false,

		announce: AnnounceRule::Random,
		playtype: {
			let mut v = vec![
				PlaytypeSetting {
					allow: false,
					multiplier: 1,
					passed_player_begins: false,
				};
				NUM_PLAYTYPES
			];

			let pt_id = Playtype::Molotow.get_id();
			match v.get_mut(pt_id) {
				Some(c) => c.allow = true,
				None => {}
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

#[wasm_bindgen]
pub fn setting_coiffeur() -> Setting {
	Setting {
		num_players: 4,
		team_choosing: TeamChoosing::Periodic(2),
		end_condition: EndCondition::None,
		point_eval: PointEval::Add,
        points_only_announcer: true,

		less_points_win: false,
		point_recv_order: vec![
			PointRule::Marriage,
			PointRule::TableShow,
			PointRule::Show,
			PointRule::Play,
		],

		allow_shows: true,
		allow_table_shows: false,
		show_gives_negative: false,
		table_show_gives_negative: false,

		allow_misere: false,

		announce: AnnounceRule::Onetime {
            link_slalom: false,
            link_big_slalom: false,
            link_guschtimary: false,
        },
		playtype: {
            // TODO Remove magic numbers
            let pts = vec![
                (Playtype::Updown, 5),
                (Playtype::Downup, 6),
                (Playtype::Color(0), 3),
                (Playtype::Color(1), 1),
                (Playtype::Color(2), 2),
                (Playtype::Color(3), 4),
            ];

            let mut v = vec![
				PlaytypeSetting {
					allow: false,
					multiplier: 1,
					passed_player_begins: false,
				};
				NUM_PLAYTYPES
			];

            for (pt, mult) in pts {
                let pt_id = pt.get_id();

			    match v.get_mut(pt_id) {
				    Some(c) => {
                        c.allow = true;
                        c.multiplier = mult;
                    },
				    None => {}
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
		pass_to_same_team: false,

		strict_undertrumpf: true,

		startcondition: StartingCondition::Random,
		apply_startcondition_on_revanche: false,
	}
}

impl Setting {
	pub fn must_bid(&self) -> bool {
		match self.point_eval {
			PointEval::Difference { .. } => true,
			_ => false,
		}
	}

	pub fn num_allowed(&self) -> usize {
		self.playtype.iter().map(|p| p.allow as usize).sum()
	}
}

impl Default for Setting {
	fn default() -> Self {
		setting_schieber()
	}
}

#[wasm_bindgen]
/// Return true if it's a legal setting else, not
pub fn legal_setting(setting: &Setting) -> bool {
	// Some conditions which are illegal
	let donts = vec![setting.num_allowed() == 0, setting.num_players > NUM_CARDS];

	match setting.startcondition {
		StartingCondition::Card(c) => {
			if c.color as usize >= NUM_COLORS || c.number as usize >= NUM_NUMBERS {
				return false;
			}
		}
		_ => {}
	}

	!donts.into_iter().any(|x| x)
}

#[cfg(target_family = "wasm")]
#[wasm_bindgen]
pub fn must_bid(setting: &Setting) -> bool {
	setting.must_bid()
}

#[cfg(target_family = "wasm")]
#[wasm_bindgen]
pub fn get_gamesettingform() -> String {
	json::stringify(Setting::form_data())
}
