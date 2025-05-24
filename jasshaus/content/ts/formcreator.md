# General

I created this little library to make creating forms easier, and also portable!
Forms are created with JSON.

# Specification

## Primitive types

There are several base types including basic ones:

- **int**: A whole number (32-bit)
- **float**: Decimal number
- **bool**: True/False
- **string**: text

Addition to those basic types, there are also:

- **none**: Has no input field

You may define your custom types. However, they mustn't interfer with the naming
of the primitive types.

## Form structure

There are several types of forms:

- **Basic Form**: A form containing multiple forms
- **Primitive Form**: A form containing **only** a primitive or custom defined type
- **Option Form**: A form containing multiple forms, but only one is active.
- **List Form**: A form containing one type form, which can be concatenated into one list of forms.

Every `key` in the dictionary is the corresponding identifier of the output.
However, a key's name mustn't begin with `#`, because that is reserved for form property identifiers.

### Form properties

You can attach any property to a form. Those are prefixed with `#`.
Some reserved properties are:

- `#name` (string): A name for the form. It is **not** the identifier.
- `#desc` (string): A description of the form.
- `#type` (Formdata): The content of the form. This will ignore `#option` and every non-property key.
- `#option` (boolean): Specify whether the form is an 'Option Form'
- `#list` (boolean): Specify whether the form is a 'List Form'
- `#default`: Specify the default value of the field.

### List Form properties

- `#size` (int): Set a fix size for the number of elements
- `#resizable` (bool): Specify whether you can add and remove elements. Is ignored if `#size` is set.
- `#moveable` (bool): Specify whether you can swap the position of an element.
- `#name_handler` ((int) => string): Specify a function which handles the name of the i-th element.
