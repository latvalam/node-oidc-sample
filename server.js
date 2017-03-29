// Server
var http = require("http");
var express = require("express");
var app = express(); // Our application singleton

// Authentication
var session = require("express-session");
var passport = require("passport");
var bodyParser = require("body-parser");
var Issuer = require("openid-client").Issuer;
var Strategy = require("openid-client").Strategy;

// Discover issuer and continue initialization
var discoverPromise = Issuer.discover("http://localhost/authsrv/oidc")
    .catch(function (info) {
        console.log('Failed to discover issuer');
        console.log(info);
    })
    .then(function (issuer) {
        OnIssuerDiscovered(issuer);
    });

// This cb is called when the issuer has been successfully discovered
function OnIssuerDiscovered(issuer) {

    // Setup our client
    var client = new issuer.Client({
        client_id: "browserclient",
        client_secret: "4C701024-0770-4794-B93D-52B5EB6487A0"
    });

    const params = {
        scope: "openid profile offline_access platform",
        redirect_uri: "http://localhost:5000/node/signin-oidc",
        response_type: "code id_token",
        response_mode: "form_post",
        acr_values: "tenant:default clienthost:http://localhost:5000"
    }

    // Initialize passport strategy
    var oidcStrategy = new Strategy({ client, params }, (tokenset, userinfo, done) => {
        console.log('tokenset', tokenset);
        console.log('access_token', tokenset.access_token);
        console.log('id_token', tokenset.id_token);
        console.log('claims', tokenset.claims);
        console.log('userinfo', userinfo);

        User.findOne({ id: tokenset.claims.sub }, function (err, user) {
            if (err) return done(err);

            return done(null, user);
        });
    });

    passport.use('oidc', oidcStrategy);

    // View engine setup
    app.set(express.static(__dirname + "/public"));

    // Middleware
    app.use(session({ secret: "Ceiling cat", resave: true, saveUninitialized: true }));
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(bodyParser.urlencoded({ extended: false }));

    // Login
    app.get("/node/login", passport.authenticate("oidc"));

    // Login callback
    app.post("/node/signin-oidc",
        passport.authenticate("oidc", {
            successRedirect: "/node",
            failureRedirect: "/node/login",
        }
    ));

    // Root
    app.get("/node", passport.authenticate("oidc"), function (request, response) {
        response.send("<html><body><p>Node.js says hello!</p></body></html>");
    });

    var server = http.createServer(app);
    server.listen(5000);

    console.log("Server listening to port 5000...");

}