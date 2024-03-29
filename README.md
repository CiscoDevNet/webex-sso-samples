# webex-sso-samples

Server-side (Node.JS) and client-side sample apps demonstrating OAuth2 with Webex REST APIs.

Included samples:

* `browser_sdk` - Use the Webex Browser SDK and the implicit grant type to authenticate in a single-page app.

* `oauth_client` - Use Node/JavaScript primitives to authenticate using the authorization code grant type in a single-page app.

* `server_side` - Authenticate using the authorization grant type on the server side.

* `widget` - Authenticate a user server-side, then launch a Space Widget embedded in a web page to collaborate with a target Webex user.

* `refresh` - Demonstrate using a refresh token to renew an access token.

* `logout` - Demonstrate logging a user out / invalidating an access token.

## Pre-Requisites

* **NodeJS & NPM** - [Node.js](https://nodejs.org) and [NPM](https://www.npmjs.com/) to install dependencies.  

    If you do not have Node/NPM installed, see the following guides:

    * Linux: http://blog.teamtreehouse.com/install-node-js-npm-linux
    * Mac: http://blog.teamtreehouse.com/install-node-js-npm-mac
    * Windows: http://blog.teamtreehouse.com/install-node-js-npm-windows

* **An IDE or developer code editor** - This project was built using [Visual Studio Code](https://code.visualstudio.com/), which has great support for debugging Node.JS.

* **Git** - Source code management and sharing [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)

>Note: this sample was tested using:
>* Ubuntu 22.04
>* Node.js 16.14
>* Firefox / Chrome

## Running the Samples

1. Create a Webex 'integration' type application: https://developer.webex.com/my-apps

    * Select the `spark:all` scope

    * Specify three **Redirect URI**s:

        ```bash
        https://localhost:3000/oauth_client
        ```

        ```bash
        https://localhost:3000/oauth_server
        ```

        ```bash
        https://localhost:3000/browser_sdk
        ```

    * Once generated, keep the **Client ID** and **Client Secret** values visible (or otherwise in a safe place).

1. From a terminal window, use `git` to clone this repo:

    ```bash
    git clone https://github.com/CiscoDevNet/webex-sso-samples.git
    ```

1. Change into the repo directory, and install dependencies with `npm`:

    ```bash
    cd webex-sso-samples
    npm install
    ```

1. Generate a self-signed certificate set ( or obtain one from your CA).

    On Ubuntu 22.04:

    ```bash
    openssl req -nodes -new -x509 -keyout server.key -out server.cert
    ```
    
1. Open the project in your IDE.

    For Visual Studio code:
    
    ```bash
    code .
    ```

1. Rename `.env.example` to `.env` 

    Then open it and enter your integration client Id / client secret and a target Webex user email (for use with the Widget sample).
    
    >Note: make sure this user is different from the Webex user who you will authenticate with the app - you can't call yourself!)

    Be sure to save the file.

1. (Before first run, or if code/dependencies have been updated) In VS Code, build the Browserify bundle by switching to the **Run and Debug** tab, selecting **Build**, and clicking the green launch arrow (or press **F5**).

    To run from a terminal:

    ```bash
    #This only needs to be run once
    npm run build
    ```

1. Launch the server from the **Run** tab, by selecting **Launch** and clicking the green arrow or pressing **F5**.

    To run from a terminal:

    ```bash
    npm run start
    ```

1. In a browser, open [https://localhost:3000](https://localhost:3000) to access the app.

## Hints

1. **OAuth allow-listing** - Organizations (e.g. Cisco IT) can enforce an allow-list for Webex OAuth integrations - you may need to create a separate Webex account with a non-organization email in order to develop / test your integration, and work with your Webex management team to approve your app for production.

1. **Bundling the Webex SDK with Browserify** - The source file `browserify/browser_sdk.js` is a 'pre-bundled' file.  In order to efficiently bundle the Webex Browser SDK into the file, this project uses [Browserify](http://browserify.org/).  After bundling, the complete and ready-to-go file is placed in `public/javascripts/browser_sdk.js` where it can be statically served.  

    This only needs to happen once, sometime before the project is run the first time, **unless** either the Webex Browser SDK package in the project is updated (e.g. via `npm update`), or the source file `browserify/browser_sdk.js` is modified.

    The `browser_sdk.js` file can be manually browserfied any time by running the below from a terminal in the project root directory:

    ```bash
    npm run build
    ```

[![published](https://static.production.devnetcloud.com/codeexchange/assets/images/devnet-published.svg)](https://developer.cisco.com/codeexchange/github/repo/CiscoDevNet/webex-teams-sso-samples)