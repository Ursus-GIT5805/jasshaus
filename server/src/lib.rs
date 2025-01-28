use serde::*;
use std::sync::Arc;
use tokio::sync::Mutex;

use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    routing::get,
    Router,
};

use futures:: StreamExt;

#[macro_use]
mod log;

pub mod room;
pub mod socket_message;

use room::ServerRoom;

use room::Room;

async fn handle_websocket<E,G>(ws: WebSocket, room: Arc<Mutex< Room<E,G> >>)
where
	G: Default + ServerRoom<E> + std::marker::Send,
	E: Clone + Serialize + for<'de> Deserialize<'de>,
{
    let (ws_tx, mut ws_rx) = ws.split();
    let client_id: usize = room
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

	let mut rlock = room.lock().await;
    rlock.unregister(client_id).await;
	if rlock.should_close() {
		rlock.cleanup().await;
		*rlock = Room::<E,G>::new();
	}
    debug!("Client[{}] disconnected!", client_id);
}

pub async fn run_server<E,G>(addr: &'static str)
where
	G: Default + ServerRoom<E> + std::marker::Send + 'static,
	E: Clone + Serialize + for<'de> Deserialize<'de> + std::marker::Send + 'static,
{
	let room = Arc::new( Mutex::new( Room::<E,G>::new() ) );

    let app = Router::new().route(
        "/ws",
        get(|ws: WebSocketUpgrade| async move {
            ws.on_upgrade(|ws: WebSocket| async move {
				handle_websocket(ws, room.clone()).await;
			})
        }),
    );

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
	axum::serve(listener, app).await.unwrap();
}
