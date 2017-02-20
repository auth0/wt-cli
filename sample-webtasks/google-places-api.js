"use latest";

// Using the request-promise module [https://www.npmjs.com/package/request-promise]
var request = require('request-promise');

// Create webtask using wt create -s gpakey=<YOUR GOOGLE PLACES API KEY> google-places-api
const googlePlacesUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/';
const keyword = 'food';
const output = 'json';

/**
 * Google Places API webhook example via webtask
 * 
 * Looks for open food locations within a specified radius
 * of a target latitude and longitude.
 * 
 * This uses the Google Place API for web-services found here: https://developers.google.com/places/web-service/search
 * 
 * Setup Guide:
 * 1. Install the webtask cli: `npm install -g wt-cli`
 * 2. Create the webtask profile: `wt init` or `wt init <your account name/email>`
 * 2.a. Check your email and enter verification code if necessary
 * 3. Create a Google Places API Key here: https://developers.google.com/places/web-service/get-api-key
 * 4. Push your webhook to the server using (while in same directory): `wt create -s gpakey=<API_KEY> --name google-places-api google-places-api.js`
 * 4.a. Substitute <API_KEY> with the Google Places API Key from Step 3
 * 5. Test webhook using: `curl -d longitude=100.5017651 -d latitude=13.7563309 -d radius=100 <WEBHOOK_URL>`
 * 5.a. Substitute <WEBHOOK_URL> with the url contained in the response from Step 4
 * 5.b. Need curl to be installed. Type (On Ubuntu): `sudo apt-get install -y curl`
 * 6. Inspect error/debug using `wt logs`
 * 
 * @webtask_data latitude   - Latitude of the center point of the search area (default 0.0)
 * @webtask_data longitude  - Longitude of the center point of the search area (default 0.0)
 * @webtask_data radius     - Radius from center point to search in meters (default 100 meters)
 * @webtask_secret gpakey   - Your Google Places API Key 
 */

module.exports = function(context, cb) {
    let lat = context.data.latitude || 0.0;
    let long = context.data.longitude || 0.0;

    let radius = context.data.radius || 100;
    let location = `${lat},${long}`;
    let key = context.data.gpakey;

    let request_url = `${googlePlacesUrl}${output}?location=${location}&radius=${radius}&keyword=${keyword}&key=${key}&opennow=true`;
    
    request(request_url)
        .then( function(data) {
            data = JSON.parse(data);
            if(data && (data.status == 'OK' || data.status == 'ZERO_RESULTS') ) {
                let response = {
                    timestamp: new Date(),
                    latitude: lat,
                    longitude: long,
                    radius: radius,
                    results: data.results || []
                };
                cb(null, response);
            } else {
                let error = new Error(`${data.status}${data.error_message ? ':'+data.error_message : ''}`);
                return cb(error);
            }
        })
        .catch( function(error) {
            cb(error);
        });
};
