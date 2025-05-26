import { createForm } from "./formcreator.js";
import { get_client_settings, getClientSettingForm, save_client_setting } from "./clientsetting.js";
import { construct_fetch_url, enter_room, get_rooms, request_room } from "./roomfinder.js";

import init, { get_gamesettingform, setting_classic } from "../pkg/tichu_game.js"
import { get_setting_form, save_tichu_setting } from "./tichusettings.js";

const URL = construct_fetch_url(7998);

async function update_rooms() {
	let rooms = undefined;

	try {
		rooms = await get_rooms(URL);
	} catch(e) {
		$("#rooms")
			.text("Could not connect to server!")
			.addClass("Error");
		return;
	}

	let eles = rooms.map((room: any) => {
		let ele = $('<div>').addClass("Room");
		let join = $('<button>')
			.text("Enter")
			.click(() => enter_room(room.id));

		let ratio = `${room.players.length}/${room.max_players}`;
		let text = `Room ${room.id} (${ratio})`;

		let title = $('<h2>').text(text);
		let names = $('<p>').text( room.players.join(", ") );

		ele.append(title)
			.append(names)
			.append( $('<p>').append(join) );

		return ele;
	});

	$("#rooms").removeClass("Error");
	if(eles.length > 0) {
		$("#rooms").html(eles);
	} else {
		$("#rooms").text("No open room found.");
	}
}

export function createGameSettingForm(): object {
	let formdata = JSON.parse( get_gamesettingform() );

	let entire_form = {
		"#option": true,
		"classic": {
			"#name": "Classic",
			"#type": "none",
		},
		"custom": {
			"#name": "Custom",
			"#type": formdata,
		},
	};

	let form = createForm(entire_form, "Game Settings");

	form.set({ "custom": setting_classic() });
	form.set("classic");

	return form;
}

window.onload = async () => {
	await init(); // init WASM

	let client = getClientSettingForm();
	client.set( get_client_settings() );

	let game_settings = get_setting_form();

	window.onbeforeunload = () => {
		save_client_setting(client.get());
		save_tichu_setting(game_settings.get());
	}

	if(client.ele) $("#settings").append( client.ele );
	if(game_settings.ele) $("#settings").append( game_settings.ele );

	let gameForm: any = createGameSettingForm();

	$("#gameSettings").append( gameForm.ele );
	$("#createRoom").click(async () => {
		let result = gameForm.get();

		let data;
		if(result === 'classic') data = setting_classic();
		if(result.hasOwnProperty('custom')) data = result['custom'];

		let response = await request_room(URL, data);

		if(response.status === 200) {
			let room_id = await response.text();
			enter_room( room_id );
		} else {
			$("#settingInfo").text("An error occured while creating a room. Have you entered valid data?");
		}
	});
	$("#manualRoomEnter").click(() => {
		let id = $("#roomInput").val();
		if(typeof id === 'string' || typeof id === 'number') {
			 enter_room( id );
		}
	})

	update_rooms();
}
