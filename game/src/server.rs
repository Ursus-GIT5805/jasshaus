use game_server::socket_message::SocketMessage;
use async_trait::async_trait;

use rand::Rng;
use rand::prelude::SliceRandom;

use crate::*;
use game_server::room::{
	*,
	client::*,
};

#[derive(Clone, Copy)]
pub enum GameError {
	IllegalPlay,
	NotOnTurn,
}

#[derive(Clone)]
#[derive(PartialEq, std::fmt::Debug, Serialize, Deserialize)]
#[non_exhaustive]
pub enum GameEvent {
    PlayCard(Card),
	PlayShow(Show),

	Announce(Playtype, bool),
	Pass,

	ShowPoints(i32,usize),
    ShowList(Vec<Vec<Show>>),
    HasMarriage(usize),

    SetAnnouncePlayer(usize),
    GameState(Game, Cardset),
    GameSetting(Setting),
	EverythingPlaytype(Playtype),

    NewCards(Cardset),

	StartGame,
}
use GameEvent::*;

#[derive(Clone)]
pub struct JassRoom {
	starts: u32,
	game: Game,
}

impl Default for JassRoom {
	fn default() -> Self {
		let game = Game::new( Setting::schieber() );
		Self {
			starts: 0,
			game,
		}
	}
}

impl JassRoom {
    fn get_first_announceplayer(&self) -> usize {
        match self.game.setting.startcondition {
            StartingCondition::Card(card) => self.game.players
                .iter()
                .position(|plr| plr.hand.contains(card))
                .unwrap_or(0),
            StartingCondition::Random => {
                let mut rng = rand::thread_rng();
                rng.gen::<usize>() % self.game.players.len()
            }
        }
    }

	async fn start_round(&mut self, clients: &mut ClientHandler) {
		let cards = {
			let mut cards = all_cards();
			let mut rng = rand::thread_rng();
			cards.shuffle(&mut rng);

			let plrs = self.game.players.len();
			let cards_per_player = cards.len() / plrs;
			let mut out = vec![Cardset::default(); plrs];

			for (i, card) in cards.into_iter().enumerate() {
				out[i / cards_per_player].insert(card);
			}

			out
		};

		self.game.start_new_round(cards);

        for (_, client) in clients.iter_mut() {
            let plr_id = client.player_id;
			let ev = SocketMessage::Event(
				GameEvent::NewCards(self.game.players[plr_id].hand)
			);
            client.send(ev).await;
        }
    }

	async fn play_card(&mut self, clients: &mut ClientHandler, card: Card, plr_id: usize) {
		if self.game.should_end() { return; }
		if self.game.current_player != plr_id { return; }
        if !self.game.is_legal_card(&self.game.players[plr_id].hand, card) { return; }

        self.game.play_card(card);

		if self.game.get_turn() == 0 && self.game.setting.allow_shows {
			if self.game.num_played_cards() == self.game.players.len()-1 {
				let shows: Vec<Vec<Show>> = self
					.game
					.players
					.iter()
					.map(|plr| plr.shows.clone())
					.collect();

				clients.ev_send_to_all(GameEvent::ShowList(shows)).await;
			}
        }

		if !self.game.should_end() && self.game.round_ended() {
            self.start_round(clients).await;
		}
		clients.ev_send_to_all(GameEvent::PlayCard(card)).await;

		if let Playtype::Everything = self.game.ruleset.playtype {
			if self.game.num_played_cards() == 0 {
				let choices = vec![
					Playtype::Updown,
					Playtype::Downup,
					Playtype::Color(0),
					Playtype::Color(1),
					Playtype::Color(2),
					Playtype::Color(3),
				];
				let ele = {
					let mut rng = rand::thread_rng();
					*choices.choose(&mut rng)
						.unwrap_or(&Playtype::Updown)
				};

				self.game.ruleset.active = ele;
				clients.ev_send_to_all(GameEvent::EverythingPlaytype(ele)).await;
			}
		}
	}

	async fn announce(&mut self, clients: &mut ClientHandler, pt: Playtype, misere: bool, plr_id: usize) {
        if self.game.can_announce(plr_id) {
			self.game.announce(pt, misere);
			clients.ev_send_to_all(GameEvent::Announce(pt, misere)).await;

			if let Some(plr) = self.game.player_with_marriage() {
				let team = self.game.players[plr].team_id;
				if self.game.marriage_would_win(team) {
					clients.ev_send_to_all(GameEvent::HasMarriage(plr)).await;
				}
			}
        }
    }

	async fn pass(&mut self, clients: &mut ClientHandler, plr_id: usize) {
		if self.game.can_pass(plr_id) {
			self.game.pass();
			clients.ev_send_to_all(GameEvent::Pass).await;
		}
	}

	async fn play_show(&mut self, clients: &mut ClientHandler, show: Show, plr_id: usize) {
        if !self.game.can_show(plr_id) { return; }
        if let Err(_) = self.game.players[plr_id].hand.has_show(show) { return; }
        if self.game.players[plr_id].shows.iter().any(|s| *s == show) { return; }

		self.game.play_show(show, plr_id);
        let points = self.game.ruleset.get_show_value(show);
        clients.ev_send_to_all(GameEvent::ShowPoints(points, plr_id)).await;
	}
}

#[async_trait]
impl ServerRoom<GameEvent> for JassRoom {
	type Err = GameError;

	async fn start(&mut self, clients: &mut ClientHandler) -> Result<(), Self::Err> {
		self.game = Game::new( Setting::schieber() );

        self.game.announce_player = if self.starts == 0 || self.game.setting.apply_startcondition_on_revanche {
            self.get_first_announceplayer()
        } else {
            let mut rng = rand::thread_rng();
			let worst_tid = *self.game.rank_teams().last().unwrap_or(&0);

			*self.game.get_players_of_team(worst_tid)
				.choose(&mut rng)
				.unwrap_or(&0)
		};

		self.game.current_player = self.game.announce_player;

		self.starts += 1;
        self.start_round(clients).await;

        clients.ev_send_to_all(StartGame).await;
        clients.ev_send_to_all(SetAnnouncePlayer(self.game.announce_player))
            .await;

		Ok(())
	}

	async fn on_enter(&mut self, clients: &mut ClientHandler, plr_id: usize) {
		if self.starts > 0 {
			let game = self.game.clone();
            let hand = self.game.players[plr_id].hand;
            clients.ev_send_to(plr_id, GameState(game, hand)).await;
		} else {
			let setting = self.game.setting.clone();
			clients.ev_send_to(plr_id, GameEvent::GameSetting(setting)).await;
		}
	}
	async fn on_leave(&mut self, _clients: &mut ClientHandler, _plr_id: usize) {}

	async fn on_event(&mut self, clients: &mut ClientHandler, event: GameEvent, plr_id: usize)
				-> Result<(), Self::Err>
	{
		match event {
			GameEvent::PlayCard(card) => self.play_card(clients, card, plr_id).await,
			GameEvent::Announce(pt, misere) => self.announce(clients, pt, misere, plr_id).await,
			GameEvent::Pass => self.pass(clients, plr_id).await,
			GameEvent::PlayShow(show) => self.play_show(clients, show, plr_id).await,
			_ => {},
		}
		Ok(())
	}

	fn get_num_players(&self) -> usize { self.game.players.len() }
	fn should_end(&self) -> bool { self.game.should_end() }
}
