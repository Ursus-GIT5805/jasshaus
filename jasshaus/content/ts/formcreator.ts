interface Form {
	ele?: JQuery<HTMLElement>;
	get: () => any;
	set: (val: any) => void;
}

const NULL_FORM: Form = {
	ele: undefined,
	get: () => undefined,
	set: () => {},
};

const PROPERTY_PREFIX = "#";

const PROP_NAME = "#name";
const PROP_DESC = "#desc";
const PROP_TYPE = "#type";
const PROP_DEFAULT = "#default";

// Dictionary containing the handler of Type-Form
var form_type_handler: { [key: string]: () => Form } = {
	'int': createInt,
	'string': createString,
	'bool': createCheckbox,
	'none': () => NULL_FORM,
};

function createCheckbox(): Form {
	let input = $("<input>").attr("type", "checkbox");
	return {
		ele: input,
		get: () => input.is(":checked"),
		set: (val) => input.prop("checked", val),
	};
}

function createString(): Form {
    let input = $("<input>").attr("type", "text");
    return {
        ele: input,
        get: () => input.val(),
        set: (val) => input.val(val),
    };
}

function createInt(): Form {
	let input = $("<input>").attr("type", "number");
	return {
		ele: input,
		get: () => Number(input.val()),
		set: (val) => input.val(val),
	};
}

// ===== Object/List handler =====

/// Create a form from a string
function create_primitive_form(str: string, ident?: string, desc?: string): Form {
	if(!(str in form_type_handler)) throw new Error(`Form type '${str}' does not exist!`);

	let div = $('<div>').addClass(["Form", "PrimitiveForm"]);
	let inp = $('<div>');

	if(ident) inp.append( $('<label>').text(`${ident}: `) );

	// Create form
	let form = form_type_handler[str]()

	if(form.ele) {
		inp.append( form.ele );
		form.ele = div;
	}

	div.append(inp);
	if(desc) div.append( $('<div>').append($('<i>').text(`(${desc})`)) );

	return form;
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

function create_basic_form(
	form: any,
	ident?: string,
): Form {
	let ele = $('<div>').addClass("Form");
	let children: { [id: string]: Form } = {};

	let name = form[PROP_NAME] || ident;
	if(name) ele.append( $('<h3>').text(name) );

	let desc = form[PROP_DESC];
	if(desc) ele.append( $('<i>').text(`(${desc})`) );

	if(form.hasOwnProperty(PROP_TYPE)) {
		let is_primitive_form = typeof form[PROP_TYPE] === 'string';

		if(is_primitive_form) {
			return create_primitive_form(form[PROP_TYPE], name, desc);
		} else {
			return createForm(form[PROP_TYPE], name);;
		}
	}

	for(const key in form) {
		if(key.startsWith(PROPERTY_PREFIX)) continue;

		let child_form = createForm(form[key], key);
		if(child_form.ele) ele.append( child_form.ele );

		children[key] = child_form;
	}


	let get = () => {
		let out: any = {};
		for(const key in children) out[key] = children[key].get();
		return out;
	};

	let set = (val: any) => {
		for(const key in val) {
			if(!children.hasOwnProperty(key)) {
				throw new Error("Invalid property name on form set!");
			}
			children[key].set( val[key] );
		}
	};

	return {ele, get, set};
}

function create_option_form(
	form: any,
	ident?: string
): Form {
	let ele = $('<div>').addClass(["Form", "OptionForm"]);
	let children: { [id: string]: Form } = {};

	let title = form[PROP_NAME] || ident;
	if(title) ele.append( $('<h3>').text(title) );

	let desc = form[PROP_DESC];
	if(desc) ele.append( $('<i>').text(`(${desc})`) );

	// Create a select element for the option form
	let select = $('<select>');
	select.change(() => {
		let key = select.val();
		if(typeof key !== 'string') return undefined;

		for(const key in children) children[key].ele?.css('display', 'none');
		if(typeof key === 'string') children[key].ele?.css('display', 'block')
	});

	ele.append(select);

	let first = true;

	for(const key in form) {
		if(key.startsWith(PROPERTY_PREFIX)) continue;

		let child_form = createForm(form[key], key);
		if(child_form.ele) {
			if(!first) child_form.ele.css('display', 'none');
			ele.append( child_form.ele );
		}

		children[key] = child_form;

		let opt_name = form[key][PROP_NAME] || key;
		let option = $('<option>')
			.text(opt_name)
			.attr('value', key);
		select.append( option );

		first = false;
	}

	let get = () => {
		let key = select.val();
		if(typeof key !== 'string') return undefined;

		let val = children[key].get();

		if(val === undefined) return key;

		let out: any = {};
		out[key] = val;
		return out;
	};

	let set = (val: any) => {
		if(typeof val === 'string') {
			select.val(val);
		} else {
			let key = Object.keys(val)[0];
			children[key].set( val[key] );
		}
	};

	return {ele, get, set};
}

function create_list_form(
	form: any,
	ident?: string,
): Form {
	if(!form.hasOwnProperty(PROP_TYPE)) throw new Error("List Forms must provide a #type property!");

	let ele = $('<div>').addClass(["Form", "ListForm"])

	let title = form[PROP_NAME] || ident;
	if(title) ele.append( $('<h3>').text(title) );

	let desc = form[PROP_DESC];
	if(desc) ele.append( $('<i>').text(`(${desc})`) );

	let list = $('<div>');
	ele.append(list);

	let size = -1;
	if(form.hasOwnProperty('#size')) size = form['#size'];

	let name_handler = (_: any) => undefined;
	if(form.hasOwnProperty('#name_handler')) name_handler = form['#name_handler'];

	let resizable = (false || form['#resizable']) && (size == -1);
	let moveable = false || form['#moveable'];

	let children: Form[] = [];

	let append_new = (def?: any) => {
		let ele = $('<div>').addClass("ListFormEntry");

		let nth = children.length;
		let child = createForm(form['#type'], name_handler(nth));

		let buttons = $('<div>').addClass("ListFormButtons");

		if(moveable) {
			let up = $("<button>")
				.text("Up")
				.click(() => {
					let idx = ele.index();
					if(idx == 0) return;
					ele.insertBefore(ele.prev());
					[children[idx-1], children[idx]] = [children[idx], children[idx-1]];
				});
			buttons.append(up);
		}

		if(resizable) {
			let del = $("<button>")
				.text("Remove")
				.click(() => {
					let idx = ele.index();
					ele.remove();
					children.splice(idx,1);
				});

			buttons.append(del);
		}

		if(moveable) {
			let down = $("<button>")
				.text("Down")
				.click(() => {
					let idx = ele.index();
					if(children.length <= idx+1) return;
					ele.insertAfter(ele.next());
					[children[idx+1], children[idx]] = [children[idx], children[idx+1]];
				});
			buttons.append(down);
		}

		ele.append(buttons);

		if(child.ele) ele.append( child.ele );
		if(def !== undefined) child.set(def);

		list.append(ele);
		children.push(child);
	};

	if(size != -1) {
		for(let i = 0 ; i < size ; ++i) append_new();
	}

	if(resizable) {
		let create = $('<button>')
			.text("Add")
			.click(() => append_new());

		ele.append(create);
	}

	let get = () => Array.from( children.map((child) => child.get()) );
	let set = (val: any[]) => {
		for(let def in val) append_new(def);
	};

	return {ele, get, set};
}

export function add_custom_type(name: string, handler: () => Form) {
	form_type_handler[name] = handler;
}

export function createForm(form: any, ident?: string, def?: any): Form {
	let is_option = false || form['#option'];
	let is_list = false || form['#list'];
	let is_type = typeof form === 'string';

	if(is_option && is_list) throw new Error("Form can't be a list and option form at the same time!");

	let data;
	if(is_option) data = create_option_form(form, ident);
	else if(is_list) data = create_list_form(form, ident);
	else if(is_type) data = create_primitive_form(form, ident);
	else data = create_basic_form(form, ident);

	if(form.hasOwnProperty(PROP_DEFAULT)) data.set(form[PROP_DEFAULT]);
	if(def !== undefined) data.set(def);

	return data;
}
