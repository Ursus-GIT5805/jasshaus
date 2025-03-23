use tichu_game::setting::Setting;
use tichu_game::Event;
use tichu_game::server::TichuRoom;

use game_server::run_server;

#[tokio::main]
async fn main() {
	run_server::<Setting, Event, TichuRoom>("0.0.0.0:7998").await;
}
