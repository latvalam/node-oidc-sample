Startup();

async function Startup() {
    // Server
    const http = require('http');
    const express = require('express');
    const app = express(); // Our application singleton

    // Authentication
    const session = require('express-session');
    const passport = require('passport');
    const bodyParser = require('body-parser');
    const Issuer = require('openid-client').Issuer;
    const Strategy = require('openid-client').Strategy;

    let idsrvIssuer;

    try {
        // Discover issuer and continue initialization
        idsrvIssuer = await Issuer.discover('http://localhost/authsrv');
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
        acr_values: 'tenant:default clienthost:http://localhost:5000'
    }

    // Passport user serialization
    passport.serializeUser(function (user, done) {
        console.log("serializing " + user.id);
        done(null, user);
    });

    passport.deserializeUser(function (obj, done) {
        console.log("deserializing " + obj);
        done(null, obj);
    });

    // Initialize passport strategy
    passport.use('oidc',
        new Strategy({ client, params }, (tokenset, done) => {
            console.log('tokenset', tokenset);
            console.log('access_token', tokenset.access_token);
            console.log('id_token', tokenset.id_token);
            console.log('claims', tokenset.claims);

            let user = {
                id: tokenset.claims.sub,
                claims: tokenset.claims
            };

            done(null, user);
        }
    ));

    // View engine setup
    app.set(express.static(__dirname + '/public'));

    // Middleware
    app.use(session({ secret: 'Ceiling cat', resave: true, saveUninitialized: true }));
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(bodyParser.urlencoded({ extended: false }));

    // Login
    app.get('/node/login', passport.authenticate('oidc'));

    // Login callback
    app.post('/node/signin-oidc', function (req, res, next) {
        passport.authenticate('oidc', function (err, user, info) {

            // Error!
            if (err) {
                console.log(err);
                return next(err); // will generate a 500 error
            }

            // Generate a JSON response reflecting authentication status
            if (!user) {
                return res.send(401, { success: false, message: 'authentication failed' });
            }

            // Login the user
            req.login(user, function (err) {
                if (err) {
                    return next(err);
                }
                return res.redirect('/node');
            });
        })(req, res, next);
    });

    // Root
    app.get('/node', passport.authenticate('oidc'), function (request, response) {
        response.send('<html><body><p>Node.js says hello!</p></body></html>');
    });

    var server = http.createServer(app);
    server.listen(5000);

    console.log('Server listening to port 5000...');
}