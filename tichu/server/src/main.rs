use tichu_game::setting::Setting;
use tichu_game::Event;
use tichu_game::server::TichuRoom;

use game_server::*;

#[tokio::main]
async fn main() {
	Server::new("0.0.0.0:7998", "Tichu")
	// .unix_socket("unix_sock")
		.build::<Setting, Event, TichuRoom>()
		.await;
}
