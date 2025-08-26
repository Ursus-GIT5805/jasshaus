use proc_macro2::TokenStream;
use quote::*;
use syn::*;

fn handle_attr(attr: Attribute) -> Option<TokenStream> {
	match attr.meta {
		Meta::List(l) => Some(l.tokens),
		_ => None,
	}
}

fn handle_field(item: Field) -> TokenStream {
	let ty = match item.ty {
		Type::Path(p) => p,
		_ => todo!(),
	};

	let v: Vec<_> = item
		.attrs
		.into_iter()
		.map(handle_attr)
		.filter(|c| c.is_some())
		.map(|c| c.unwrap())
		.collect();

	match item.ident {
		Some(ident) => match v.len() {
			0 => quote! { #ident: <#ty>::form_data() },
			_ => quote! {
				#ident: {
					"#type": <#ty>::form_data(),
					#(#v),*
				}
			},
		},
		None => match v.len() {
			0 => quote! { <#ty>::form_data() },
			_ => quote! {
				{
					"#type": <#ty>::form_data(),
					#(#v),*
				}
			},
		},
	}
}

fn handle_fields(item: Fields) -> TokenStream {
	match item {
		Fields::Named(fields) => {
			let inpl: Vec<_> = fields.named.into_iter().map(handle_field).collect();

			quote! {
				json::object! { #(#inpl),* }
			}
		}
		Fields::Unnamed(fields) => {
			let inpl: Vec<_> = fields.unnamed.into_iter().map(handle_field).collect();

			let res = match inpl.len() {
				1 => quote! { #(#inpl),* },
				_ => quote! { [ #(#inpl),* ] },
			};

			res
		}
		Fields::Unit => quote! { "none" },
	}
}

fn handle_struct(item: DataStruct) -> TokenStream {
	handle_fields(item.fields)
}

fn handle_variant(item: Variant) -> TokenStream {
	let ident = item.ident;

	let v: Vec<_> = item
		.attrs
		.into_iter()
		.map(handle_attr)
		.filter(|c| c.is_some())
		.map(|c| c.unwrap())
		.collect();

	let res = handle_fields(item.fields);

	quote! {
		#ident: {
			"#type": #res,
			#(#v),*
		}
	}
}

fn handle_enum(item: DataEnum) -> TokenStream {
	let variants: Vec<_> = item.variants.into_iter().map(handle_variant).collect();

	quote! {
		json::object! {
			"#option": true,
			#(#variants),*
		}
	}
}

#[proc_macro_derive(HtmlForm, attributes(Form, custom))]
pub fn html_form(item: proc_macro::TokenStream) -> proc_macro::TokenStream {
	let derive: DeriveInput = syn::parse(item).unwrap();

	let ident = derive.ident;

	let out = match derive.data {
		Data::Struct(data) => handle_struct(data),
		Data::Enum(data) => handle_enum(data),
		_ => panic!("Target derive input is not supported!"),
	};

	let out = quote! {
		impl HtmlForm for #ident {
			fn form_data() -> json::JsonValue {
				#out
			}
		}
	};

	out.into()
}
