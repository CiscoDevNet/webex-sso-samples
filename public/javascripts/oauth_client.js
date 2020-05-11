// Function to generate random uuids for State value

var appClientId;
var appClientSecret;
var appRedirectUri;

function uuidv4() {
    return ( [1e7]+-1e3+-4e3+-8e3+-1e11).replace( /[018]/g, c =>
      ( c ^ crypto.getRandomValues( new Uint8Array( 1 ) ) [ 0 ] & 15 >> c / 4 ).toString( 16 )
    );
  }
  
// Step #1: Fires when the user clicks the 'Request Auth Code' button
function codeClick() {

    //Build the request URL.  The base URL and next 4 items are typically always the same for Webex Teams web apps
    var requestUrl = 'https://api.ciscospark.com/v1/authorize?' + //Spark OAuth2 base URL
        'response_type=code&' + // Requesting the OAuth2 'authorization code' grant flow
        `scope=${ encodeURIComponent( 'spark:all' ) }&` + // Requested permission, here all user scopes
        // The following items are provided by the developer in the source code/config or generated dynamically at run time
        `state=${ encodeURIComponent( uuidv4() ) }&` +	// Random string for OAuth2 nonce replay protection
        `client_id=${ encodeURIComponent( clientId ) }&` + // The custom app Client ID
        `redirect_uri=${ encodeURIComponent( redirectUri ) }&` // The custom app's Redirect URI

    window.location = requestUrl; // Redirect the browser to the OAuth2 kickoff URL
}

// Step #2: On page load, check if the 'code=' query param is present
// If so user has already authenticated, and  page has been reloaded via the Redirect URI
window.onload = function( e ) {

    clientId = document.getElementById( 'clientId' ).value;
    clientSecret = document.getElementById( 'clientSecret' ).value;
    redirectUri = document.getElementById( 'redirectUri' ).value;

    // Parse the query string params into a dictionary
    params = new URL( window.location ).searchParams;
    
    // If the query param 'code' exists, then...
    if ( params.get( 'code' ) ) {

        // Display the auth code
        document.getElementById( 'code' ).value = params.get( 'code' ); 
        document.getElementById( 'tokenButton' ).removeAttribute( 'disabled' ); 
    }
    
    // If the query param 'error' exists, then something went wrong...
    if ( params.get( 'error' ) ) { 
    
        alert( `Error requesting auth code: ${ params.get( 'error' ) }/${ params.get( 'error_description' ) }` );
    }

    document.getElementById( 'codeButton' ).addEventListener( 'click', codeClick )
    document.getElementById( 'tokenButton' ).addEventListener( 'click', tokenClick )
    document.getElementById( 'userButton' ).addEventListener( 'click', userClick )
}
  
// Step #3: Fires when the user clicks the 'Request Access Token' button
// Takes the auth code and requests an access token
function tokenClick() {

    // Create a URLSearchParams object for our x-www-form-urlencoded values
    const params = new URLSearchParams( {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: document.getElementById( 'code' ).value,
        redirect_uri: redirectUri
    } );
    
    // Fetch the access token from Webex
    fetch( 'https://api.ciscospark.com/v1/access_token', { method: 'POST', body: params } )
    .then( fetchRes => {

        if ( !fetchRes.ok ) {

            switch ( fetchRes.status ) {

                case 400:
                    alert( `OAuth Integration could not complete\nBad request` );
                    break;

                case 401:
                    alert( 'OAuth Integration could not complete\nOAuth authentication error. Please check your client secret' );
                    break;

                default:
                    alert( 'OAuth Integration could not complete\nSorry, could not retreive your access token' );
                    break;
            }

            return;
        }

        return fetchRes.json()
    } )
    .then( data => {

        // If no JSON data is returned, or we can't parse out the token info...
        if ( 
            !data ||
            !data.access_token ||
            !data.expires_in ||
            !data.refresh_token ||
            !data.refresh_token_expires_in ) {
            
                alert( 'OAuth Integration could not complete\nCould not parse access & refresh tokens' );
                return;
            }  

        // Parse the access_token field, and display it
        document.getElementById( 'token' ).value = data.access_token; 
        document.getElementById( 'userButton' ).removeAttribute( 'disabled' );
    } )
    .catch( reason => {
        
        alert( `Could not reach Webex Teams to retreive access & refresh tokens: ${ reason }` );
        return;
    } )

}

//Step #4: Use the /people/me API to retrieve the access token user's display name info
function userClick() {

    // Use our new access token to request the /people/me resource from Webex
    fetch( 'https://api.ciscospark.com/v1/people/me', {
        headers: { 'Authorization': `Bearer ${ document.getElementById( 'token' ).value }` }
    } )
    .then( fetchRes => {

        if ( !fetchRes.ok ){

            alert( `Could not retreive your details, /people/me returned: ${ fetchRes.status }` );
            return;            
        }

        return fetchRes.json()
    } )
    .then( data => {

        // If no data returned, or doesn't contain displayName...
        if ( !data || !data.displayName ) {

            alert( 'Could not parse Person details: bad json payload or could not find a displayName.' );
            return;
        }

        // Display the returned displayName value
        document.getElementById( 'userNameData' ).value = data.displayName;
    })
    .catch( reason => {

        alert( `Could not reach Webex Teams to retreive Person's details, error: ${ reason }` );
        return;        
    })

}