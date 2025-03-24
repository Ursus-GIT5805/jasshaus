const NULL_FORM: Form = {
	ele: undefined,
	set: () => undefined,
	get: () => {},
};

var form_type_handler: any = {
	'checkbox': createCheckbox,
	'number': createNumber,
	'list': createList,
	'none': () => NULL_FORM,
};

interface Form {
	ele?: JQuery<HTMLElement>;
	get: () => any;
	set: (val: any) => void;
}

function createGeneral(type: string): Form {
	let input = $("<input>").attr("type", type);
	return {
		ele: input,
		get: () => input.val(),
		set: (val) => input.val(val),
	};
}

function createCheckbox(): Form {
	let input = $("<input>").attr("type", "checkbox");
	return {
		ele: input,
		get: () => input.is(":checked"),
		set: (val) => input.prop("checked", val),
	};
}

function createNumber(): Form {
	let input = $("<input>").attr("type", "number");
	return {
		ele: input,
		get: () => Number(input.val()),
		set: (val) => input.val(val),
	};
}

function createList(entry: any, ident?: string): Form {
	let list: Form[] = [];
	let eles = $("<div>")
		.css("display", "flex")
		.css("flex-direction", "column");
	let input = $("<div>").addClass("SettingList");
	if(ident) input.append( $("<div>").addClass("Title").text(ident) );
	input.append(eles);

	let resizable = true;
	let movable = true;

	if(entry.hasOwnProperty('#id')) input.prop("id", entry["#id"]);
	if(entry.hasOwnProperty('#resizable')) resizable = entry['#resizable'];
	if(entry.hasOwnProperty('#movable')) movable = entry['#movable'];

	let child = entry['#list'];

	let createEle = () => {
		let obj = createForm(child);

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

		if(obj.ele) {
			obj.ele = ele.append(buttons).append(obj.ele);
			list.push(obj);
			eles.append( obj.ele );
		}
	};

	if(resizable) {
		let add = $("<button>")
			.text("Add")
			.click(createEle);
		input.append(add);
	}

	let getter = () => list.map((x) => x.get());
	let setter = (val: any) => {
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

function createListed(entry: any, ident?: string): Form {
	let lst = [];
	for(let i = 0 ; i < entry.length ; ++i) lst.push( createForm(entry[i], `${ident}${i}`) );

	let ele = $("<div>");
	for(let obj of lst) {
		if(obj.ele) ele.append( obj.ele );
	}

	let getter = () => lst.map((obj) => obj.get());
	let setter = (val: any) => {
		for(let i = 0 ; i < lst.length ; ++i) lst[i].set(val[i]);
	};

	return {
		ele: ele,
		get: getter,
		set: setter,
	};
}

function createFromObject(obj: any, ident?: string): Form {
	let form = $("<div>").addClass("SettingGroup");
	let children: any = {};

	let title = ident;
	let option = false;

	if("#title" in obj) title = obj["#title"];
	if("#option" in obj) option = obj["#option"];
	if(obj.hasOwnProperty('#id')) form.prop("id", obj["#id"]);

	if("#type" in obj) return createForm(obj['#type'], title);
	if("#list" in obj) return createList(obj, title);

	if(title) form.append( $("<div>").addClass("Title").text(title) );
	let opts = $("<div>");

	for(let key in obj) {
		if(key.startsWith("#")) continue;

		let input = createForm(obj[key], key);
		children[key] = input;
		if(input.ele) opts.append(input.ele);
	}

	let getter = (): any => {
		let out: any = {};
		for(let key in children) out[key] = children[key].get();
		return out;
	};
	let setter = (val: any) => {
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

		getter = (): any => {
			let val = select.val();
			if(typeof val != 'string') return undefined;

			if( children[val].ele ) {
				let obj: any = {};
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

function createFromString(str: string, ident?: string): Form {
	let div = $("<div>").addClass("SingleSetting");
	if(ident) div.append( $("<label>").text(ident + ": ") );

	let input = null;
	if(str in form_type_handler) input = form_type_handler[str]();
	else input = createGeneral(str);

	if(!input.ele) return NULL_FORM;

	input.ele = div.append( input.ele );
	return input;
}

// ===== All this code, for these exports =====

export function extractDefault(entry: any): any {
	if(entry.hasOwnProperty('#default')) return entry['#default'];

	if(Object.prototype.toString.call(entry) === '[object Object]') {
		let out: any = {};
		for(let key in entry) {
			if(key.startsWith("#")) continue;
			out[key] = extractDefault(entry[key]);
		}

		return out;
	}

	return undefined;
}


export function createForm(entry: any, ident?: string, def?: any): Form {
	if(!entry) return NULL_FORM;

	let input: any = null;
	if(typeof entry === 'string') input = createFromString(entry, ident);
	else if(Object.prototype.toString.call(entry) === '[object Object]') {
		input = createFromObject(entry, ident);

		if('#disabled' in entry && entry['#disabled']) {
			input.ele.find("input,select").each((_: number, e: any) => {
				e.setAttribute("disabled", "true");
			});
		}
		if('#onchange' in entry) {
			input.ele.find("input,select").each((_: number, e: any) => {
				e.addEventListener("change", () => entry['#onchange']( input.get() ))
			});
		}
	}
	else if(Object.prototype.toString.call(entry) === '[object Array]')
		input = createListed(entry, ident);

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
