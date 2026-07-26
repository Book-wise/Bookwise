# Signal Forms - Angular

Signal Forms manage form state using Angular signals to provide automatic
synchronization between your data model and the UI with Angular Signals.

This guide walks you through the core concepts to create forms with Signal
Forms. Here's how it works:

## Creating your first form

1. Create a form model with `signal()`

Every form starts by creating a signal that holds your form's data model:

```typescript
interface LoginData {
  email: string;
  password: string;
}
const loginModel = signal<LoginData>({
  email: '',
  password: '',
});
```

2. Pass the form model to `form()` to create a FieldTree

Then, you pass your form model into the `form()` function to create a field
tree - an object structure that mirrors your model's shape, allowing you to
access fields with dot notation.

Both the root form object and its nested properties are FieldTree nodes:

```typescript
const loginForm = form(loginModel);
loginForm; // is a FieldTree
loginForm.email; // is also a FieldTree
```

3. Bind HTML inputs with `[formField]` directive

Next, you bind your HTML inputs to the form using the `[formField]` directive,
which creates two-way binding between them:

```html
<input type="email" [formField]="loginForm.email" />
<input type="password" [formField]="loginForm.password" />
```

> **NOTE:** The `[formField]` directive also syncs field state for attributes
> like `required`, `disabled`, and `readonly` when appropriate.

4. Read state with FieldTree signals

You can access state for any part of the tree by calling the FieldTree node as
a function. This returns a state object containing reactive signals for the
value, validation status, and interaction state:

```typescript
loginForm(); // Returns state for the whole form
loginForm.email(); // Returns state for the email field
```

To read the current value, access the `value()` signal:

```html
<!-- Render values that update automatically as user types -->
<p>Form value: {{ loginForm().value() | json }}</p>
<p>Email: {{ loginForm.email().value() }}</p>
```

```typescript
// Get the current value
const currentEmail = loginForm.email().value();
```

5. Update values with `set()`

You can programmatically update values using the `value.set()` method on any
node. This updates both the FieldTree and the underlying model signal:

```typescript
// Update the value programmatically
loginForm.email().value.set('alice@wonderland.com');
```

As a result, both the field value and the model signal are updated
automatically:

```typescript
// The model signal is also updated
console.log(loginModel().email); // 'alice@wonderland.com'
```

## Basic usage

The `[formField]` directive works with all standard HTML input types. Here are
the most common patterns:

### Text inputs

```html
<!-- Text and email -->
<input type="text" [formField]="form.name" />
<input type="email" [formField]="form.email" />
```

### Numbers

```html
<!-- Number - automatically converts to number type -->
<input type="number" [formField]="form.age" />
```

### Date and time

```html
<!-- Date and time - stores as ISO format strings -->
<input type="date" [formField]="form.eventDate" />
<input type="time" [formField]="form.eventTime" />
```

If you need to convert date strings to Date objects, you can do so by passing
the field value into `Date()`:

```typescript
const dateObject = new Date(form.eventDate().value());
```

### Multiline text

```html
<!-- Textarea -->
<textarea [formField]="form.message" rows="4"></textarea>
```

### Checkboxes

```html
<!-- Single checkbox -->
<label>
  <input type="checkbox" [formField]="form.agreeToTerms" />
  I agree to the terms
</label>
```

### Multiple checkboxes

```html
<label>
  <input type="checkbox" [formField]="form.emailNotifications" />
  Email notifications
</label>
<label>
  <input type="checkbox" [formField]="form.smsNotifications" />
  SMS notifications
</label>
```

### Radio buttons

Radio buttons work similarly to checkboxes. As long as the radio buttons use
the same `[formField]` value, Signal Forms will automatically bind the same
`name` attribute to all of them:

```html
<label>
  <input type="radio" value="free" [formField]="form.plan" />
  Free
</label>
<label>
  <input type="radio" value="premium" [formField]="form.plan" />
  Premium
</label>
```

When a user selects a radio button, the form formField stores the value from
that radio button's `value` attribute. For example, selecting "Premium" sets
`form.plan().value()` to `"premium"`.

### Select dropdowns

Select elements work with both static and dynamic options:

```html
<!-- Static options -->
<select [formField]="form.country">
  <option value="">Select a country</option>
  <option value="us">United States</option>
  <option value="ca">Canada</option>
</select>

<!-- Dynamic options with @for -->
<select [formField]="form.productId">
  <option value="">Select a product</option>
  @for (product of products; track product.id) {
    <option [value]="product.id">{{ product.name }}</option>
  }
</select>
```

> **NOTE:** Multiple select (`<select multiple>`) is not supported by the
> `[formField]` directive at this time.

## Validation and state

Signal Forms provides built-in validators that you can apply to your form
fields. To add validation, pass a schema function as the second argument to
`form()`:

```typescript
const loginForm = form(loginModel, (schemaPath) => {
  debounce(schemaPath.email, 500);
  required(schemaPath.email);
  email(schemaPath.email);
});
```

The schema function receives a schema path parameter that provides paths to
your fields for configuring validation rules.

### Common validators

- `required()` - Ensures the field has a value
- `email()` - Validates email format
- `min()` / `max()` - Validates number ranges
- `minLength()` / `maxLength()` - Validates string or collection length
- `pattern()` - Validates against a regex pattern

### Custom error messages

You can also customize error messages by passing an options object as the
second argument to the validator:

```typescript
required(schemaPath.email, {message: 'Email is required'});
email(schemaPath.email, {message: 'Please enter a valid email address'});
```

## FieldTree State Signals

Every node in the tree, including the root form object, provides the same
signals to track its state. Since every node is a `FieldTree`, the API for
monitoring validity and interaction is identical at every level.

| State      | Description                                                          |
| ---------- | -------------------------------------------------------------------- |
| `valid()`  | Returns `true` if the node passes all validation rules               |
| `invalid()` | Returns `true` if there are validation errors                       |
| `pending()` | Returns `true` if async validation is in progress                   |
| `touched()` | Returns `true` if the user has focused and blurred the field or any child field |
| `dirty()`  | Returns `true` if the value has been changed by the user             |
| `disabled()` | Returns `true` if the node is disabled                             |
| `readonly()` | Returns `true` if the node is readonly                             |
| `errors()` | Returns an array of validation errors with `kind` and `message` properties |

## Complete example

```typescript
import {Component, signal} from '@angular/core';
import {form, FormField} from '@angular/forms/signals';

interface LoginData {
  email: string;
  password: string;
}

@Component({
  selector: 'app-root',
  templateUrl: 'app.html',
  styleUrl: 'app.css',
  imports: [FormField],
})
export class App {
  loginModel = signal<LoginData>({
    email: '',
    password: '',
  });
  loginForm = form(this.loginModel);

  onSubmit(event: Event) {
    event.preventDefault();
    // Perform login logic here
    const credentials = this.loginModel();
    console.log('Logging in with:', credentials);
    // e.g., await this.authService.login(credentials);
  }
}
```
