//
// Copyright (c) 2020 Cisco Systems
// Licensed under the MIT License
//

/*
 * a Webex Teams Integration based on nodejs, that acts on user's behalf.
 * implements the Webex Teams OAuth flow, to retreive Webex Teams API access tokens.
 *
 * See documentation: https://developer.webex.com/docs/integrations
 *
 */

const debug = require( 'debug' )( 'oauth' );
const fine = require( 'debug' )( 'oauth:fine' );
const fetch = require( 'node-fetch' );
const express = require( 'express' );
const session = require( 'express-session' );
const https = require('https')
const ejs = require( 'ejs' );
const { v4: uuidv4 } = require( 'uuid' );
const { URLSearchParams } = require('url');
const fs = require( 'fs' )
const csp = require( 'helmet-csp' );
const join = require( 'path' ).join;

// Load process.env values from .env file
require('dotenv').config();

// Create the Express app object
const app = express();

// Initialize Expression session storage with a unique secret
app.use( session( { secret: uuidv4() } ) );

// Implement Content Security Policy (CSP) directives supported by Widgets
app.use( csp( {
    directives: {
        scriptSrc: [ `'self' 'unsafe-inline' code.s4d.io` ],
        styleSrc: [ `'self' 'unsafe-inline' code.s4d.io` ],
        mediaSrc: [ `'self' code.s4d.io *.giphy.com *.clouddrive.com *.webexcontent.com data: blob:` ],
        fontSrc: [ `'self' code.s4d.io` ],
        imgSrc: [ `'self' code.s4d.io *.clouddrive.com data: blob: *.rackcdn.com` ],
        connectSrc: [ `'self' localhost wss://*.wbx2.com https://*.wbx2.com wss://*.wbx.com https://*.webex.com ` +
            'https://code.s4d.io https://*.code.s4d.io wss://*.ciscospark.com https://*.ciscospark.com ' +
            'https://myspark.cisco.com https://*.webexcontent.com https://*.giphy.com https://*.clouddrive.com/' ]
    }
} ) )

// Create a Webex Teams integration from https://developer.webex.com/my-apps
// Make sure to create two redirect URLs, one for server-side, one for client-side
// Enter your integration details in .env
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redirectUriServer = process.env.REDIRECT_URI_SERVER; // e.g. https://localhost:3000/oauth_server
const redirectUriClient = process.env.REDIRECT_URI_CLIENT; // e.g. https://localhost:3000/oauth_client
const redirectUriBrowser = process.env.REDIRECT_URI_BROWSER; // e.g. https://localhost:3000/browser_sdk

// Supported scopes are documented at: https://developer.webex.com/docs/integrations
//   The scopes separator is a space, example: "spark:people_read spark:rooms_read"
//   spark:all is necessary for registering Widgets
const scopes = 'spark:all'; 

// Serve static pages/resources from /public
app.use( express.static( 'public' ) )

// Start - Express routes

// Serve the main menu page
app.get( '/', function ( req, res ) {

    debug( 'Serving the main menu page' );

    // Read/compile the server_side page
    const content = fs.readFileSync( join( __dirname, 'views', 'index.ejs' ), 'utf8' );

    // If the user is not already logged in (i.e. token data exists in the Express session)
    //    mark the Logout and Refresh Token button as disabled
    const disabled = req.session.tokens ? '' : 'disabled';

    res.send( ejs.compile( content )( { 'disabled': disabled } ) )
} )

// Serve the /next page
app.get( '/next/:next', function ( req, res ) {

    debug( 'Saving the selected sample destination and redirecting to OAuth URL' );
    
    // Store the selected next page in the Express session
    req.session.next = req.params.next;

    // If the user selected client-side as their next destination, send to /oauth_client
    if ( req.params.next == 'oauth_client' ) {
        res.redirect( '/oauth_client' );
        return;
    }

    // If no tokens are present in the Express session, start the OAuth flow
    // Else redirect directly to the selected page (/server_side /widget or /refresh)
    if ( !req.session.tokens ) {

        // Generate a random/unique state value
        //   State can be used for security and/or correlation purposes
        req.session.state = uuidv4(); 

        // Build the server-side OAuth flow URL
        const initiateUriServer = 'https://api.ciscospark.com/v1/authorize?'
        + 'client_id=' + clientId
        + '&response_type=code' // Using the 'authorization code' grant type
        + '&redirect_uri=' + encodeURIComponent( redirectUriServer )
        + '&scope=' + encodeURIComponent( scopes )
        + '&state=' + encodeURIComponent( req.session.state );

        res.redirect( initiateUriServer );
    }
    else res.redirect( `/${ req.session.next }` );
} );

// Serve the dynamically created Widget page
app.get( '/widget', function( req, res) {
    
    debug( 'Serving the widget page' );

    const content = fs.readFileSync( join( __dirname, '/views/widget.ejs' ), 'utf8' );
    
    res.send( ejs.compile( content )( { 'token': req.session.tokens.access_token, 'targetEmail': process.env.WIDGET_TARGET_EMAIL } ) );

} )

// Serve the client-side page
app.get( '/oauth_client', function ( req, res ) {

    debug( 'Serving the client-side SPA' );

    // Read/compile the client side single-page app
    const content = fs.readFileSync( join( __dirname, 'views', 'oauth_client.ejs' ), 'utf8' );
    const client_side = ejs.compile( content )( { 
        'clientId': clientId,
        'clientSecret': clientSecret,
        'redirectUriClient': redirectUriClient
    } );

    res.send( client_side );
} )

// Serve the browser SDK page
app.get( '/browser_sdk', function ( req, res ) {

    debug( 'Serving the Browser SDK SPA' );

    // Read/compile the browser SDK single-page app
    const content = fs.readFileSync( join( __dirname, 'views', 'browser_sdk.ejs' ), 'utf8' );
    const browser_sdk = ejs.compile( content )( { 
        'clientId': clientId,
        'redirectUriBrowser': redirectUriBrowser
    } );

    res.send( browser_sdk );
} )

// Process OAuth authorization code for server-side pages
app.get( '/oauth_server', function ( req, res ) {

    debug( 'OAuth server callback entered' );

    // Check for various common errors, or provide a default error message
    if ( req.query.error ) {

        if ( req.query.error == 'access_denied' ) {
            debug( `User declined, received err: ${ req.query.error }` );
            res.send( '<h1>OAuth integration could not complete</h1><p>Got your NO...ciao</p>' );
            return;
        }

        if ( req.query.error == 'invalid_scope' ) {
            debug( `Wrong scope requested, received err: ${ req.query.error }` );
            res.send( '<h1>OAuth Integration could not complete</h1><p>The application is requesting an invalid scope, Bye bye.</p>' );
            return;
        }

        if ( req.query.error == 'server_error' ) {
            debug( `Server error, received err: ${ req.query.error }` );
            res.send( '"<h1>OAuth Integration could not complete</h1><p>Webex Teams sent a Server Error, Auf Wiedersehen.</p>' );
            return;
        }

        debug( `Received err: ${ req.query.error }` );
        res.send( '<h1>OAuth Integration could not complete</h1><p>Error case not implemented, au revoir.</p>' );
        return;
    }

    // Check request parameters include the access code and state values
    if ( ( !req.query.code ) || ( !req.query.state ) ) {
        debug( 'Expected code & state query parameters are not present' );
        res.send( '<h1>OAuth Integration could not complete</h1><p>Unexpected query parameters, ignoring...</p>' );
        return;
    }

    // Validate that state matches what was sent in the init URL
    // [NOTE] we implement a security check below, but the state variable can also be leveraged for correlation purposes
    if ( req.session.state != req.query.state ) {
        debug( 'State value does not match');
        res.send( '<h1>OAuth Integration could not complete</h1><p>State value does not match</p>' );
        return;
    }

    // Retreive access token (expires in 14 days) & refresh token (expires in 90 days)
    
    // Create a URLSearchParams object to hold values to be x-www-url-encoded by fetch
    const params = new URLSearchParams( {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: req.query.code,
        redirect_uri: redirectUriServer
    } );
     
    // Fetch the access token from Webex
    fetch( 'https://api.ciscospark.com/v1/access_token', { method: 'POST', body: params } )
    .then( fetchRes => {

        // If the response status code is no in the 200 range...
        if ( !fetchRes.ok ) {

            debug( `Access token not issued, status code: ${ fetchRes.status } / ${ fetchRes.reason }` );

            switch ( fetchRes.status ) {

                case 400:
                    res.send( `<h1>OAuth Integration could not complete</h1><p>Bad request</p>` );
                    break;

                case 401:
                    res.send( '<h1>OAuth Integration could not complete</h1><p>OAuth authentication error. Check the client ID / client secret</p>' );
                    break;

                default:
                    res.send( '<h1>OAuth Integration could not complete</h1><p>Sorry, could not retreive your access token. Try again...</p>' );
                    break;
            }

            return;
        }
        // Return the response content as JSON
        return fetchRes.json( )
    } )
    .then( data => {

        // If no JSON data was returned, or tokens/info could not be parsed...
        if ( 
            !data ||
            !data.access_token ||
            !data.expires_in ||
            !data.refresh_token ||
            !data.refresh_token_expires_in ) {
            
                debug( 'Could not parse access & refresh tokens' );
                
                res.send( '<h1>OAuth Integration could not complete</h1><p>Sorry, could not parse tokens/info</p>' );
                return;
            }  

        debug( `OAuth flow completed, fetched tokens: ${ JSON.stringify( data ) }` );

        // Store tokens in the Express session for future use
        req.session.tokens = data;

        // Calculate/store the access_token expiration timestamp (used by /refresh page)
        let timeStamp = new Date();
        timeStamp.setSeconds( timeStamp.getSeconds() + Number( req.session.tokens.expires_in ) );
        req.session.tokens.expires_date = timeStamp.toJSON();

        // Redirect to the selected page (/server_side or /widget)
        res.redirect( `/${ req.session.next }` )
    } )
    .catch( reason => {
        
        debug( `Could not reach Webex Teams to retreive access & refresh tokens: ${ reason }` );

        res.send( '<h1>OAuth Integration could not complete</h1><p>Sorry, could not retreive your access token. Try again...</p>' );
        return;
    } )

} );

// Serve the dynamically created server-side page
app.get( '/server_side', function ( req, res ) {

    debug( 'Serving the server-side page' );

    // Retreive logged-in user's display name
    fetch( 'https://api.ciscospark.com/v1/people/me', {
        headers: { 'Authorization': `Bearer ${ req.session.tokens.access_token }` }
    } )
    .then( fetchRes => {

        if ( !fetchRes.ok ){

            debug( `Could not retreive your details, /people/me returned: ${ fetchRes.status } / ${ fetchRes.reason }` );

            res.send( '<h1>OAuth Integration could not complete</h1><p>Sorry, could not retreive your Webex Teams account details. Try again...</p>' );
            return;            
        }

        return fetchRes.json()
    } )
    .then( data => {

        if ( ( !data ) || ( !data.displayName ) ) {

            debug( 'Could not parse Person details: no JSON payload or could not find displayName' );

            res.send( '<h1>OAuth Integration could not complete</h1><p>no JSON payload or could not find displayName</p>' );
            return;
        }

        // Read/compile the server_side.ejs page
        const content = fs.readFileSync( join( __dirname, '/views/server_side.ejs' ), 'utf8' );
    
        res.send( ejs.compile( content )( { 'displayName': data.displayName } ) );
    })
    .catch( reason => {

        debug( `Could not reach Webex Teams to retreive Person's details, error: ${ reason }` );

        res.send( '<h1>OAuth Integration could not complete</h1><p>Sorry, could not retreive your Webex Teams account details</p>' );
        return;        
    })

} )

// Serve the refresh page
app.get( '/refresh', function ( req, res ) {

    debug( 'Serving the refresh token page' );

    if ( !req.session.tokens ) {

        debug( 'Cant serve the Refresh Token page - it appears the user has not logged in' );

        res.send( '<h1>Cant serve the Refresh Token page - it appears the user has not logged in</p>' );
        return;           
    }

    previousTimeStamp = req.session.tokens.expires_date;

    // Request a new access token using the refresh token
    
    // Create a URLSearchParams object to hold values to be x-www-url-encoded by fetch
    const params = new URLSearchParams( {
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: req.session.tokens.refresh_token
    } );
     
    // Fetch the access token from Webex
    fetch( 'https://api.ciscospark.com/v1/access_token', { method: 'POST', body: params } )
    .then( fetchRes => {

        // If the response status code is no in the 200 range...
        if ( !fetchRes.ok ) {

            debug( `Access token not issued, status code: ${ fetchRes.status } / ${ fetchRes.reason }` );

            switch ( fetchRes.status ) {

                case 400:
                    res.send( `<h1>OAuth Integration could not complete</h1><p>Bad request</p>` );
                    break;

                case 401:
                    res.send( '<h1>OAuth Integration could not complete</h1><p>OAuth authentication error. Check the client ID / client secret</p>' );
                    break;

                default:
                    res.send( '<h1>OAuth Integration could not complete</h1><p>Sorry, could not retreive your access token. Try again...</p>' );
                    break;
            }

            return;
        }
        // Return the response content as JSON
        return fetchRes.json( )
    } )
    .then( data => {

        // If no JSON data was returned, or tokens/info could not be parsed...
        if ( 
            !data ||
            !data.access_token ||
            !data.expires_in ||
            !data.refresh_token ||
            !data.refresh_token_expires_in ) {
            
                debug( 'Could not parse access & refresh tokens' );
                
                res.send( '<h1>OAuth Integration could not complete</h1><p>Sorry, could not parse tokens/info</p>' );
                return;
            }  

        debug( `Token refresh completed, new fetched tokens: ${ JSON.stringify( data ) }` );

        // Store tokens in the Express session for future use
        req.session.tokens = data;

        // Calculate/store the new access_token expiration timestamp
        let timeStamp = new Date();
        timeStamp.setSeconds( timeStamp.getSeconds() + Number( req.session.tokens.expires_in ) );
        req.session.tokens.expires_date = timeStamp.toJSON();
        
        newTimeStamp = req.session.tokens.expires_date;
    
        // Read/compile the server_side page
        const content = fs.readFileSync( join( __dirname, 'views', 'refresh.ejs' ), 'utf8' );
        
        res.send( ejs.compile( content )( { 'previousTimeStamp': previousTimeStamp, 'newTimeStamp': newTimeStamp } ) )
        return;    
    } )
    .catch( reason => {
        
        debug( `Could not reach Webex Teams to retreive access & refresh tokens: ${ reason }` );

        res.send( '<h1>OAuth Integration could not complete</h1><p>Sorry, could not retreive your access token. Try again...</p>' );
        return;
    } )
    
} )

// Redirect to the Webex logout page
app.get( '/logout', function ( req, res ) {

    debug( 'Redirecting to the Webex logout page' );

    // const rootURL = `${ req.protocol }://${ req.get( 'host' ) }${ req.originalUrl }`;
    const logoutUrl = 'https://idbroker.webex.com/idb/oauth2/v1/logout?'
        // + `goto=${ encodeURIComponent(rootURL) }`
        + `"&token=${ req.session.tokens.access_token }`;

    // Delete the user tokens from the Express session
    delete req.session.tokens;
    
    res.redirect( logoutUrl );
} )

// Starts the app with HTTPS certificate and key
https.createServer( {
    key: fs.readFileSync( 'server.key' ),
    cert: fs.readFileSync( 'server.cert' )
  },
  app
)
.listen( process.env.PORT, function () {
    debug( `Webex Teams OAuth integration started on port: ${ process.env.PORT }` );
} )

