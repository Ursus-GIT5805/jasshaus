use serde::*;
use std::{future::Future, pin::Pin, sync::Arc};
use tokio::sync::Mutex;
use std::marker::Send;

use tokio::net::UnixListener;

use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade}, http::{Response, StatusCode}, routing::{get, post}, Router,
	extract::Path,
};

use futures:: StreamExt;

#[macro_use]
mod log;

pub mod room;
pub mod socket_message;

use room::*;

type RoomHandlerRef<S,E,G> = Arc<Mutex<RoomManager<S,E,G>>>;

async fn handle_ws_connection<S,E,G>(ws: WebSocket, id: String, rooms: RoomHandlerRef<S,E,G>)
where
	S: Default + Clone + Send + 'static,
	E: Clone + Send + Serialize + for<'de> Deserialize<'de>,
	G: ServerRoom<E> + Send + TryFrom<S>,
{
	let room = {
		let handler = rooms.lock().await;
		match handler.get_room(&id) {
			Some(c) => c,
			None => {
				error!("Room {} is not available!", id);
				return;
			},
		}
	};

	handle_room(ws, room).await;

	let mut handler = rooms.lock().await;
	handler.maintain_room(&id).await;
}

async fn handle_room<Setting,Event,Game>(ws: WebSocket, room: RoomRef<Setting,Event,Game>)
where
	Setting: Default + Clone + Send + 'static,
	Game: ServerRoom<Event> + Send + TryFrom<Setting>,
	Event: Clone + Serialize + for<'de> Deserialize<'de>,
{
    let (ws_tx, mut ws_rx) = ws.split();
    let (conn, client_id) = room
        .lock()
        .await
        .register(ws_tx)
        .await
        .expect("The room was already full!");

    debug!("Client[{}] connected!", client_id);

    while let Some(message) = ws_rx.next().await {
		let message = match message {
			Ok(msg) => msg,
			Err(e) => {
				error!("{}", e);
				continue;
			}
		};

		match message {
			Message::Text(string) => {
				debug!("Client[{}]: {}", client_id, string);
				conn.lock().await.last_response = tokio::time::Instant::now();

				let msg = match serde_json::from_str(string.as_str()) {
					Ok(msg) => msg,
					Err(_) => {
						error!("Could not parse message!");
						continue;
					},
				};
				room.lock().await.handle_input(msg, client_id).await;
			},
			Message::Close(_) => {
				debug!("Client[{}] connection closed!", client_id);
				break;
			},
			_ => {},
		}
    }

	room.lock()
		.await
		.unregister(client_id)
		.await;
    debug!("Client[{}] disconnected!", client_id);
}

pub struct Server<'a> {
	addr: &'a str,
	name: &'a str,

	socket_file: Option<Box<std::path::Path>>,
}

impl<'a> Server<'a> {
	pub fn new(addr: &'a str, name: &'a str) -> Self {
		Self {
			addr,
			name,

			socket_file: None,
		}
	}

	pub fn unix_socket(mut self, path: &'static str) -> Self {
		let path = std::path::Path::new(path);
		self.socket_file = Some(Box::from(path));
		self
	}

	pub async fn build<S,E,G>(self)
	where
		S: Default + Clone + for<'de> Deserialize<'de> + Send + 'static,
		E: Clone + Serialize + for<'de> Deserialize<'de> + Send + 'static,
		G: ServerRoom<E> + Send + 'static + TryFrom<S>,
	{
		let rooms = RoomManager::<S,E,G>::new();
		let roomsref = Arc::from( Mutex::from(rooms) );

		let post_binding = roomsref.clone();
		let rooms_binding = roomsref.clone();
		let ws_binding = roomsref.clone();

		let app = Router::new()
			.route("/rooms", post(|req: String| async move {
				let mut rooms = post_binding.lock().await;

				let setting: S = match serde_json::from_str(req.as_str()) {
					Ok(msg) => msg,
					Err(_) => return Response::builder()
						.status(StatusCode::FORBIDDEN)
						.body(String::from("Invalid game settings"))
						.unwrap()
				};
				let res = rooms.create_room(RoomSetting {
					game_setting: setting,
					public: true,
				});

				match res {
					Some((id, _)) => Response::builder()
						.status(StatusCode::OK)
						.body(id)
						.unwrap(),
					None =>	Response::builder()
						.status(StatusCode::FORBIDDEN)
						.body(String::from("Could not create room"))
						.unwrap()
				}
			}))
			.route("/rooms", get(|_: String| async move {
				let index = {
					let handler = rooms_binding.lock().await;
					handler.index_rooms().await
				};

				let body = serde_json::to_string(&index).unwrap();

				Response::builder()
					.status(StatusCode::OK)
					.body(body)
					.unwrap()
			}))
			.route("/ws/{room_id}",
				   get(|ws: WebSocketUpgrade, Path(room_id): Path<String>| async move {
					   ws.on_upgrade(|ws: WebSocket| async move {
						   handle_ws_connection(ws, room_id, ws_binding).await;
					   })
				   })
			);

		// ===== Tasks =====

		let rooms = roomsref.clone();
		let maintenance = async move {
			let duration = tokio::time::Duration::from_secs( 3600 );

			loop {
				tokio::time::sleep( duration ).await;
				debug!("Room maintenance...");
				rooms.lock().await.maintain().await;
			}
		};

		let server = async move {
			let listener = tokio::net::TcpListener::bind(self.addr).await.unwrap();
			axum::serve(listener, app).await
				.expect("Could not start server!");
		};

		let mut tasks: Vec< Pin<Box<dyn Future<Output = ()> + Send>> > = vec![
			Box::pin(maintenance),
			Box::pin(server),
		];

		// = futures::future::join(maintenance, server);

		if let Some(path) = self.socket_file {
			let rooms = roomsref.clone();
			let unix_socket = async move {
				let listener = match UnixListener::bind(&path) {
					Ok(l) => l,
					Err(_) => {
						std::fs::remove_file(&path).expect("Could not remove socket!");
						UnixListener::bind(&path).expect("Could not bind to socket!")
					}
				};


				while let Ok((socket, _addr)) = listener.accept().await {
					let roomsref = rooms.clone();
					tokio::spawn(async move {
						let binding = roomsref.clone();
						let mut handler = binding.lock().await;

						let mut data = vec![];
						socket.try_read_buf(&mut data).unwrap();

						let cmd: ServerRequest = bincode::deserialize(&data).unwrap();
						let answer = handler.process_request(cmd).await;

						let msg = bincode::serialize(&answer).unwrap();
						// println!("{:?}", msg);
						socket.try_write(&msg).unwrap();
					});
				}
			};

			tasks.push( Box::pin(unix_socket) );
		}

		println!("Started server {} at {}", self.name, self.addr);

		futures::future::join_all(tasks).await;
	}
}
