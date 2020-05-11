// Import the Webex browser SDK (this will be bundled by Browserify)
window.Webex = require('webex')

// Function to generate random uuids for State value
function uuidv4() {
    return ( [1e7]+-1e3+-4e3+-8e3+-1e11).replace( /[018]/g, c =>
      ( c ^ crypto.getRandomValues( new Uint8Array( 1 ) ) [ 0 ] & 15 >> c / 4 ).toString( 16 )
    );
  }
  
// Fires when the user clicks the 'Request Auth Code' button
function loginClick() {

    window.webex.authorization.initiateLogin()
    .catch( err => {
        alert( `Error during login: ${ err }` );
    } );
}

// Use the webex.people.get API to retrieve the access token user's display name info
function userClick() {

    webex.people.get( 'me' )
    .then( person => {
        document.getElementById( 'userNameData' ).value = person.displayName;
    } )
    .catch( err => {
        alert( `Could not retreive your details, webex.people.get/me returned: ${ err }` );
    } )
}

// On page load wire up onClick events
window.onload = function( e ) {

    //Build the request URL.  The base URL and next 4 items are typically always the same for Webex Teams web apps
    var requestUrl = 'https://api.ciscospark.com/v1/authorize?' + //Spark OAuth2 base URL
        `scope=${ encodeURIComponent( 'spark:all' ) }&` + // Requested permission, here all user scopes
        `client_id=${ encodeURIComponent( document.getElementById( 'clientId' ).value ) }&` + // The custom app Client ID
        `redirect_uri=${ encodeURIComponent( document.getElementById( 'redirectUri' ).value ) }&` + // The custom app's Redirect URI
        `state=${ encodeURIComponent( uuidv4() ) }`

    window.webex = window.Webex.init( {
        config: {
            credentials: { authorizationString: requestUrl }
        }
    } )

    webex.once( 'ready', () => {
        if ( webex.canAuthorize ) {
            document.getElementById( 'loginMessage' ).value = 'Success!';
            document.getElementById( 'userButton' ).removeAttribute( 'disabled' );
        }
        else {
            document.getElementById( 'loginButton' ).removeAttribute( 'disabled' );
        }
    } );

    document.getElementById( 'loginButton' ).addEventListener( 'click', loginClick )
    document.getElementById( 'userButton' ).addEventListener( 'click', userClick )
}