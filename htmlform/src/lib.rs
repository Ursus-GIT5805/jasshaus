use json::*;

pub trait HtmlForm {
	fn form_data() -> JsonValue;
}

macro_rules! html_generic {
	($x:literal for $t:ty) => {
		impl HtmlForm for $t {
			fn form_data() -> JsonValue {
				JsonValue::String($x.into())
			}
		}
	};
	($x:literal for $t:ty, $($t2:ty),+) => {
		html_generic!{$x for $($t2),*}
		html_generic!{$x for $t}
	};
}

html_generic!{"number" for isize, usize, i64, u64, i32, u32, i16, u16, i8, u8}
html_generic!{"text" for String, &str}
html_generic!{"checkbox" for bool}

impl<T> HtmlForm for Vec<T>
where T: HtmlForm {
	fn form_data() -> JsonValue {
		object! {
			"#list": T::form_data(),
		}
	}
}
