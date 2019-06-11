# Node body validator
Makes parameters validation in Node.js a breeze. With promise chaining, you validate incoming requests straight away, data flows between controllers and models and errored requests are efficiently handled.

As an exemple, let's validate a login request.

```js
// /controllers/userController

const RequestValidator = require('node-body-validator');
const handleError = require('../lib/handleError');
const userModel = require('../models/userModel');

const reqValidator = new RequestValidator('form');

exports.register = function (req, res) {
    reqValidator.validate(req, [
        { name: 'email', type: 'string', validator: v => v.pattern(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+.[A-Z]{2,6}$/i), failMsg: 'email must be an email string' },
        { name: 'password', type: 'string', validator: v => v.minLength(8).maxLength(50), failMsg: 'password must be comprised between 8 and 50 chars' }
    ])
    then(
        post => userModel.create(post.email, post.password)
        .then(([id, token]) => res.status(201).json({ id, token }));
    )
    .catch(err => handleError(err, res));
};
```

Simple, expressive and beautifully powerful, right? Data flows thoughout your app.

Convinced? Let's explore all the possibilities in the next section.

## Installation & usage
The module requires at least Node V6, appart from this, its install procedure is boringly conventional.

```js
npm install --save node-body-validator
```

This validator is the pure Node.js version of the [express-body-validator](https://github.com/Buzut/express-body-validator). The only difference between the them is that node-body-validator handles raw `request` object whereas with Express.js, `bodyParser` has taken care of the parsing.

Hence, this validator takes two parameters on instanciation:
* `contentType` that can be either `form` for `application/x-www-form-urlencoded` or `json` for `application/json` (you can also pass full value if you whish).
* `maxBodySize` is the maximum authorized size of the body in bytes. It defaults to 1MB. Promise is rejected if request is bigger than that.

```js
const RequestValidator = require('node-body-validator');
const reqValidator = new RequestValidator('json', 10e6); // JSON encoding with body up to 10MB
```

Apart from that, the API is exactly the same as the other module. Check out the [docs there](https://github.com/Buzut/express-body-validator).

## Contributing
There's sure room for improvement, so feel free to hack around and submit PRs!
Please just follow the style of the existing code, which is [Airbnb's style](http://airbnb.io/javascript/) with [minor modifications](.eslintrc).

To maintain things clear and visual, please follow the [git commit template](https://github.com/Buzut/git-emojis-hook).
