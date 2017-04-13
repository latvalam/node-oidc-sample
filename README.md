## Barebone implementation of an OpenIdConnect enabled Node.js server

> Requires Node.js 7.7.4 or newer

This project demonstrates how to use OIDC authentication with Express and Passport.

### Dependencies
* body-parser
* cookie-parser
* cookie-session
* express
* openid-client
* passport

## How it works

At startup the server immediately attempts to contact the oidc authority and discover its services. After the issuer settings have been discovered, the main server is launched

```javascript
idsrvIssuer = await Issuer.discover('http://localhost:5001');
```

When the issuer is known, we start initializing the actual service. First we instruct Passport to use the strategy provided by [openid-client](https://www.npmjs.com/package/openid-client)

```javascript
passport.use('oidc',
    new Strategy({ client, params }, (tokenset, done) => {
        ...
    }
));
```

We also define that the session should be stored in a cookie

```javascript
app.use(cookieSession({
    name: 'opuscapita-auth',
    secret: 'cookie-secret'
}));     
```

Whenever a page is now requested, we check if Passport has filled in the user for us. If the user object doesn't exist, the browser will be redirected to the login route. Passport then automatically handles all communication with the authority and stores the session after a successful login.

```javascript
function isLoggedIn (request, response, next) {
    if (request.user) {
        next();
    } else {
        response.redirect('/node/login');
    }
};

app.get('/node', isLoggedIn, function (request, response) {
    ...
```