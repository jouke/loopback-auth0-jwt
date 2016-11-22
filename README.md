# loopback-auth0-jwt

  loopback-auth0-jwt is middleware for Loopback to use [Auth0](https://auth0.com/)'s [JWT](https://www.jwt.io) to [Loopback](https://loopback.io/) Users and accessTokens.

```js
// load loopback-auth0-jwt module
var auth0Jwt = require('loopback-auth0-jwt');

var authConfig = {
  secretKey    : new Buffer(process.env['AUTH0_CLIENT_SECRET'], 'base64'),
  model        : 'Profile'
};

function errorHandler(err, req, res, next) {
  console.error(err);
  if (err.name === 'UnauthorizedError') {
    res.status(401).send('invalid token, or no token supplied');
  } else {
    res.status(500).send(err);
  }
}

var auth = auth0Jwt(app, authConfig);

app.use('/api', auth.authenticated);

app.get('/api/logout', auth.logout);

app.use(errorHandler);


```

## About

loopback-auth0-jwt is a fork of loopback-jwt. It is a bit more sophisticated and integrates better with Loopback's 
authentication mechanism, and the way it uses accessTokens.
It is assuming you use the [Lock](https://auth0.com/docs/libraries/lock) that Auth0 provides, which is basically providing 
the entire login process for you for Web, iOS and Android use. I personally use it in an Angular2 project, and I can tell you,
it makes authentication Done Right very easy.
The JWT (JSON Web Token) that Auth0 returns can be used as Bearer token in the 'Authoriztion' header of requests to your
Loopback API. If the user does not exist yet in Loopback, it is automatically created, and authenticated with your API.


### Installation

```sh
$ npm install loopback-auth0-jwt --save
```

### loading loopback-auth0-jwt

`var auth = require('loopback-auth0-jwt')(app,{options});`

`options` allows any options that are permitted to be passed to the loopback-auth0-jwt middleware


options:
- `secretKey` the key need to verify the jwt (required)
- `model` the loopback model used for User maintenance (defaults to 'User', but you should really create your own user model that is uses User as a base model)
- `identifier` the jwt claim to identify the user (defaults to 'email')
- `password` the default password to use when creating loopback users (defaults to uuid.v4())

### Using loopback-auth0-jwt

the `authenticated` method of loopback-auth0-jwt is added to any path that you wish to protect. If the client has not supplied a valid, signed jwt then an error will be raised

```js

// apply to a path /api for all of the api, but you can also protect specific models here and repeat the
// app.use for each model's path
app.use('/api',auth.authenticated,function(req,res,next) {
    debug("has valid token",req.user);
    next();
});
```

If a new user needs to be created, it will only set email and password. The latter you need not worry about, as it is auto-generated.
 The email is in the form `<authprovider>|<userid>`, like 'google-oauth2|123456740664426998765' or 'twitter|12345678'.
 Once authenticated you can let the client put more data in the model using authenticated calls.
 
The login process of Loopback assumes an accessToken instance to be created for the authenticated user. This is also handled, and the 
ttl for the accessToken is set correctly so it matches the expiration of the JWT.

## Author

Jouke Visser

## Contributors

 Special thanks to Julian Lyndon-Smith from whoGloo who created loopback-jwt.

 https://github.com/jouke/loopback-auth0-jwt/graphs

## License

[MIT](LICENSE)

