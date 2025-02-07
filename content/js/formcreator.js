const NULL_FORM = { ele: undefined, get: () => undefined, get: () => {} };

var form_type_handler = {
	'checkbox': createCheckbox,
	'number': createNumber,
	'list': createList,
	'none': () => createForm(),
}

function createGeneral(type) {
	let input = $("<input>").attr("type", type);
	return {
		ele: input,
		get: () => input.val(),
		set: (val) => input.val(val),
	};
}

function createCheckbox() {
	let input = $("<input>").attr("type", "checkbox");
	return {
		ele: input,
		get: () => input.is(":checked"),
		set: (val) => input.prop("checked", val),
	};
}

function createNumber() {
	let input = $("<input>").attr("type", "number");
	return {
		ele: input,
		get: () => Number(input.val()),
		set: (val) => input.val(val),
	};
}

function createList(ident, entry) {
	let list = [];
	let eles = $("<div>")
		.css("display", "flex")
		.css("flex-direction", "column");
	let input = $("<div>").addClass("SettingList");
	input.append( $("<div>").addClass("Title").text(ident) );
	input.append(eles);

	let resizable = true;
	let movable = true;

	if(entry.hasOwnProperty('#id')) input.prop("id", entry["#id"]);
	if(entry.hasOwnProperty('#title')) title = entry['#title'];
	if(entry.hasOwnProperty('#resizable')) resizable = entry['#resizable'];
	if(entry.hasOwnProperty('#movable')) movable = entry['#movable'];

	let child = entry['#list'];

	let createEle = () => {
		let obj = createForm(null, child);

		let ele = $("<div>").addClass("SettingListEntry");
		let buttons = $("<div>").addClass("Buttons");
		if(movable) {
			let up = $("<button>")
				.text("Up")
				.click(() => {
					let idx = ele.index();
					if(idx == 0) return;
					ele.insertBefore(ele.prev());
					[list[idx-1], list[idx]] = [list[idx], list[idx-1]];
				});
			buttons.append(up);
		}
		if(resizable) {
			let del = $("<button>")
				.text("Remove")
				.click(() => {
					let idx = ele.index();
					ele.remove();
					list.splice(idx,1);
				});
			buttons.append(del);
		}
		if(movable) {
			let down = $("<button>")
				.text("Down")
				.click(() => {
					let idx = ele.index();
					if(idx+1 >= list.length) return;
					ele.insertAfter(ele.next());
					[list[idx+1], list[idx]] = [list[idx], list[idx+1]];
				});
			buttons.append(down);
		}

		obj.ele = ele.append(buttons).append(obj.ele);
		list.push(obj);
		eles.append( obj.ele );
	};

	if(resizable) {
		let add = $("<button>")
			.text("Add")
			.click(createEle);
		input.append(add);
	}

	let getter = () => list.map((x) => x.get());
	let setter = (val) => {
		eles.html("");
		list = [];
		for(let i = 0 ; i < val.length ; ++i) {
			createEle();
			list[i].set(val[i]);
		}
	};

	return {
		ele: input,
		get: getter,
		set: setter,
	}
}

// ===== Object/List handler =====

function createListed(ident, entry) {
	let lst = [];
	for(let i = 0 ; i < entry.length ; ++i) lst.push( createForm(ident + i, entry[i]) );

	let ele = $("<div>");
	for(let obj of lst) ele.append( obj.ele );

	let getter = () => lst.map((obj) => obj.get());
	let setter = (val) => {
		for(let i = 0 ; i < lst.length ; ++i) lst[i].set(val[i]);
	};

	return {
		ele: ele,
		get: getter,
		set: setter,
	};
}

function createFromObject(ident, obj) {
	let form = $("<div>").addClass("SettingGroup");
	let children = {};

	let title = ident;
	let option = false;

	if("#title" in obj) title = obj["#title"];
	if("#option" in obj) option = obj["#option"];
	if(obj.hasOwnProperty('#id')) form.prop("id", obj["#id"]);

	if("#type" in obj) return createForm(title, obj['#type']);
	if("#list" in obj) return createList(title, obj);

	form.append( $("<div>").addClass("Title").text(title) );
	let opts = $("<div>");

	for(let key in obj) {
		if(key.startsWith("#")) continue;

		let input = createForm(key, obj[key]);
		children[key] = input;
		if(input.ele) opts.append(input.ele);
	}

	let getter = () => {
		let out = {};
		for(let key in children) out[key] = children[key].get();
		return out;
	};
	let setter = (val) => {
		for(let key in children) children[key].set( val[key] );
	}

	if(option) {
		let select = $('<select>');
		for(let key in obj) {
			if(key.startsWith("#")) continue;
			let opt = $('<option>')
				.attr('value', key);
			if(obj[key].hasOwnProperty('#title')) opt.text(obj[key]['#title'] );
			else opt.text(key);
			select.append(opt);
		}
		select.change(() => {
			let val = select.val();
			for(let key in children) {
				let ele = children[key].ele;

				if(ele) {
					if(val == key) ele.css('display', 'block');
					else ele.css('display', 'none');
				}
			}
		});

		form.append(select)

		getter = () => {
			let val = select.val();
			if(children[val].ele) {
				let obj = {};
				obj[val] = children[val].get();
				return obj;
			}
			return val;
		}
		setter = (val) => {
			if(typeof val === 'string') select.val(val);
			else {
				for(let key in val) {
					select.val(key);
					children[key].set(val[key]);
				}
			}
			select.change();
		};
	}


	form.append(opts);

	return {
		ele: form,
		get: getter,
		set: setter,
	};
}

function createFromString(ident, string) {
	let div = $("<div>").addClass("SingleSetting");
	if(ident) div.append( $("<label>").text(ident + ": ") );

	let input = null;
	if(string in form_type_handler) input = form_type_handler[string]();
	else input = createGeneral(string);

	if(!input.ele) return NULL_FORM;

	input.ele = div.append( input.ele );
	return input;
}

// ===== All this code, for this function =====

function createForm(ident, entry, def=null) {
	if(!entry) return NULL_FORM;

	let input = null;
	if(typeof entry === 'string') input = createFromString(ident, entry);
	else if(Object.prototype.toString.call(entry) === '[object Object]') {
		input = createFromObject(ident, entry);

		if('#disabled' in entry && entry['#disabled']) {
			input.ele.find("input,select").each((i, e) => e.setAttribute("disabled", "true"));
		}
		if('#onchange' in entry) {
			input.ele.find("input,select").each((i, e) => {
				e.addEventListener("change", () => entry['#onchange']( input.get() ))
			});
		}
	}
	else if(Object.prototype.toString.call(entry) === '[object Array]')
		input = createListed(ident, entry);

	if(entry.hasOwnProperty('#description')) {
		let div = $("<div>").append(input.ele);
		let desc = $("<i>").text("(" + entry['#description'] + ")");
		div.addClass("Descriptionpair");
		div.append(desc);

		input.ele = div;
	}

	if(entry.hasOwnProperty('#default')) input.set(entry['#default']);

	if(def) input.set(def);
	if(!input) return NULL_FORM;
	return input;
}
