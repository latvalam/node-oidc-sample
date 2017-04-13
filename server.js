Startup();

async function Startup() {
    // Server
    const http = require('http');
    const express = require('express');
    const app = express(); // Our application singleton

    // Authentication
    const passport = require('passport');
    const bodyParser = require('body-parser');
    const cookieParser = require('cookie-parser');
    const cookieSession = require('cookie-session');
    const Issuer = require('openid-client').Issuer;
    const Strategy = require('openid-client').Strategy;

    let idsrvIssuer;

    Issuer.defaultHttpOptions = {
        timeout: 4000,
        retries: 2,
        followRedirect: false
    };

    try {
        // Discover issuer
        console.log('Discovering issuer...');
        idsrvIssuer = await Issuer.discover('http://localhost:5001');
    } catch (err) {
        console.log('Failed to discover issuer');
        console.log(err);
    }

    // Setup our client
    const client = new idsrvIssuer.Client({
        client_id: 'browserclient',
        client_secret: '4C701024-0770-4794-B93D-52B5EB6487A0'
    });

    const params = {
        scope: 'openid offline_access platform',
        redirect_uri: 'http://localhost:5000/node/signin-oidc',
        response_type: 'code id_token',
        response_mode: 'form_post',
        acr_values: 'tenant:default clienthost:http://localhost:5000',// idp:opuscapita',
    }

    // Passport user serialization
    passport.serializeUser(function (user, done) {
        done(null, user);
    });

    passport.deserializeUser(function (obj, done) {
        done(null, obj);
    });

    // Initialize passport strategy
    passport.use('oidc',
        new Strategy({ client, params }, (tokenset, done) => {
            console.log('User ' + tokenset.claims.sub + ' successfully logged in');

            let user = {
                id: tokenset.claims.sub,
                name: tokenset.claims.name,
                id_token: tokenset.id_token,
                claims: tokenset.claims
            };

            return done(null, user);
        }
    ));

    // View engine setup
    app.set(express.static(__dirname + '/public'));

    // Needed for parsing form type responses
    app.use(bodyParser.urlencoded({
        extended: false
    }));

    // Needed for cookie session storage
    app.use(cookieParser(
        'cookie-secret'
    ));

    // Store session in a cookie
    app.use(cookieSession({
        name: 'opuscapita-auth',
        secret: 'cookie-secret'
    }));                    

    app.use(passport.initialize());
    app.use(passport.session());

    // Login failed page
    app.get('/loginfailed', function (request, response) {
        response.send('<html><body><p>Oh no. Looks like you failed to log in</p></body></html>');
    });

    // Login
    app.get('/node/login', passport.authenticate('oidc'));

    // Login callback
    app.post('/node/signin-oidc', function (req, res, next) {
        passport.authenticate('oidc', function (err, user, info) {

            console.log('Authorize endpoint response received');

            // Error!
            if (err) {
                console.log('Authentication failed');
                console.log(err);
                return next(err); // will generate a 500 error
            }

            // Generate a JSON response reflecting authentication status
            if (!user) {
                console.log('Authentication failed. The response did not contain an identity');
                return res.redirect('/loginfailed');
            }

            // Login the user
            req.login(user, function (err) {
                if (err) {
                    console.log('Login failed');
                    console.log(err);
                    return next(err);
                }

                return res.redirect('/node');
            });
        })(req, res, next);
    });

    // Passport will set the request.user when authenticated
    function isLoggedIn (request, response, next) {
        if (request.user) {
            next();
        } else {
            response.redirect('/login');
        }
    };

    // Success
    app.get('/node', isLoggedIn, function (request, response) {
        response.send('<html><body><p>Hello there, ' + request.user.name + '!</p></body></html>');
    });

    // Start server
    var server = http.createServer(app);
    server.listen(5000);

    console.log('Server started and listening to port 5000...');
}