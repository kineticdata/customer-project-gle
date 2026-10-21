[&#x2B9C; Back to Kinetic Form Widgets](README.md#available-widgets)

## Signature Widget

The signature widget renders a signature element, which opens a modal where the user can draw their signature or type it using a preselected font. The signature is stored as an image attachment field on the form.

```js
// Initialize the Signature widget
bundle.widgets.Signature({ container, field, config, id });

// Retrieve a reference to the widget's API
bundle.widgets.Signature.get(id);
```

### Parameters

![name=container](https://img.shields.io/badge/container-gray)
![type=HTMLElement](https://img.shields.io/badge/HTMLElement-e66e22)  
The HTML element into which the widget should be rendered.

![name=field](https://img.shields.io/badge/field-gray)
![type=Object](https://img.shields.io/badge/Object-e66e22)  
The Kinetic field object used to store the value of the signature.

<details>
<summary>
  <img alt="name=config" src="https://img.shields.io/badge/config-gray">
  <img alt="type=Object" src="https://img.shields.io/badge/Object-e66e22">
  <br>
  An object of configurations for the widget.
</summary>
<br>
<blockquote>

![name=disabled](https://img.shields.io/badge/disabled-gray)
![type=boolean](https://img.shields.io/badge/boolean-e66e22)  
Should the signature be read-only. If omitted, this will be set to `true` if the form is in review mode. When `disabled` is `true`, this widget will display the saved signature (or `emptyLabel` if there isn't one) and can't be signed or cleared.

![name=modalTitle](https://img.shields.io/badge/modalTitle-gray)
![type=string](https://img.shields.io/badge/string-e66e22)  
The title displayed at the top of the signature modal.

![name=signaturePadLabel](https://img.shields.io/badge/signaturePadLabel-gray)
![type=string](https://img.shields.io/badge/string-e66e22)  
The label displayed above the signature pad.

![name=fullNameLabel](https://img.shields.io/badge/fullNameLabel-gray)
![type=string](https://img.shields.io/badge/string-e66e22)  
Label for the full name input field

![name=agreementText](https://img.shields.io/badge/agreementText-gray)
![type=string](https://img.shields.io/badge/string-e66e22)  
Agreement text displayed below the signature field

![name=savedButtonLabel](https://img.shields.io/badge/savedButtonLabel-gray)
![type=string](https://img.shields.io/badge/string-e66e22)  
Label for the save button in the signature modal

![name=savedFileName](https://img.shields.io/badge/savedFileName-gray)
![type=string](https://img.shields.io/badge/string-e66e22)  
Name of the saved signature file

![name=buttonLabel](https://img.shields.io/badge/buttonLabel-gray)
![type=string](https://img.shields.io/badge/string-e66e22)  
Label for the button that opens the signature modal

![name=clearButtonLabel](https://img.shields.io/badge/clearButtonLabel-gray)
![type=string](https://img.shields.io/badge/string-e66e22)  
Label for the button that clears the signature

![name=emptyLabel](https://img.shields.io/badge/emptyLabel-gray)
![type=string](https://img.shields.io/badge/string-e66e22)  
Text displayed when the widget is disabled and there is no signature

</blockquote>
</details>

![name=id](https://img.shields.io/badge/id-gray)
![type=string](https://img.shields.io/badge/string-e66e22)  
A unique id that can be used to retrieve the API of the widget.

### API

![name=getValue](https://img.shields.io/badge/getValue%28%29-gray)
![type=Function](https://img.shields.io/badge/Function-e66e22)  
Retrieves the current value of the signature.

![name=reset](https://img.shields.io/badge/reset%28%29-gray)
![type=Function](https://img.shields.io/badge/Function-e66e22)  
Resets the signature field, clearing the stored signature.

![name=enable](https://img.shields.io/badge/enable%28%29-gray)
![type=Function](https://img.shields.io/badge/Function-e66e22)  
Enables the widget so the user can sign or clear the signature.

![name=disable](https://img.shields.io/badge/disable%28%29-gray)
![type=Function](https://img.shields.io/badge/Function-e66e22)  
Disables the widget, and displays the saved signature as read-only.

### Example

```js
bundle.widgets.Signature({
  container: K('section[Signature Widget]').element(),
  field: K('field[Signature]'),
  config: {
    // Disable in review mode
    disabled: K('form').reviewMode(),
    // Title of the signature modal
    modalTitle: 'Sign your form',
    // Label displayed above the signature pad
    signaturePadLabel: 'Signature',
    // Label for the full name input field
    fullNameLabel: 'Full Name*',
    // Agreement text displayed below the signature field
    agreementText:
      'I understand this is a legal representation of my signature.',
    // Label for the save button
    savedButtonLabel: 'Save',
    //  Name of the saved signature file
    savedFileName: 'signature_widget',
    // Label for the button that opens the signature modal
    buttonLabel: 'Signature',
    // Label for the button that clears the signature
    clearButtonLabel: 'Clear',
  },
  id: 'sig',
});
```
