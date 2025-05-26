import init, { get_gamesettingform, get_num_playtypes, playtype_from_id, setting_molotow, setting_schieber } from "../pkg/jasshaus_game.js";
import { get_pt_name } from "./jass.js";
import { createForm } from "./formcreator.js";
import { get_setting_form, save_jass_setting } from "./jasssettings.js";
import { get_client_settings, getClientSettingForm, save_client_setting } from "./clientsetting.js";
import { construct_fetch_url, enter_room, get_rooms, request_room } from "./roomfinder.js";

const URL = construct_fetch_url(7999);

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
			.text("Beitreten")
			.click(() => enter_room(room.id));

		let ratio = `${room.players.length}/${room.max_players}`;
		let text = `Raum ${room.id} (${ratio})`;

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

	formdata['#title'] = "Spieleinstellungen";
	formdata['playtype']['#type']['#movable'] = false;
	formdata['playtype']['#type']['#size'] = get_num_playtypes();
	formdata['playtype']['#type']['#name_handler'] = get_pt_name;

	formdata['point_recv_order']['#type']['#size'] = 4;
	formdata['point_recv_order']['#type']['#moveable'] = true;

	let entire_form = {
		"#option": true,
		"classic": {
			"#name": "Klassisch",
			"#type": "none",
		},
		"molotow": {
			"#name": "Molotow",
			"#type": "none",
		},
		"custom": {
			"#name": "Benutzerdefiniert",
			"#type": formdata,
		},
	};

	let form = createForm(entire_form, "Spielregeln");

	form.set({ "custom": setting_schieber() });
	form.set("classic");

	return form;
}

window.onload = async () => {
	await init(); // init WASM

	let client = getClientSettingForm();
	client.set( get_client_settings() );

	let game = get_setting_form();

	window.onbeforeunload = () => {
		save_client_setting(client.get());
		save_jass_setting(game.get());
	}

	if(client.ele) $("#settings").append( client.ele );
	if(game.ele) $("#settings").append( game.ele );

	let gameForm: any = createGameSettingForm();

	$("#gameSettings").append( gameForm.ele );
	$("#createRoom").click(async () => {
		let result = gameForm.get();

		let data;
		if(result === 'classic') data = setting_schieber();
		if(result === 'molotow') data = setting_molotow();
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
