const SpotifyWebApi = require('spotify-web-api-node');

declare const require;

let volume = 50;
const ACTIVE = true;

class OttoSpotifyController {

    spotifyApi: any;

    init() {
        // var scopes = ['user-read-private', 'user-read-email', 'user-modify-playback-state'],
        //     redirectUri = 'https://example.com/callback',
        //     clientId = 'd0ff16d46f7141d78e84e6037c141245',
        //     state = 'some-state-of-my-choice';
        let spotifyApi = this.spotifyApi = new SpotifyWebApi({
            clientId: 'd0ff16d46f7141d78e84e6037c141245',
            clientSecret: '736905969562471295271581faf80742',
            redirectUri: 'http://www.example.com/callback'
        });
        // var authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
        // console.log(authorizeURL);

        let code = 'AQAqnv72ZtYX4hNNuEa91EUMuTNnBeKJNSCMEoIv2n6o-p6uTmp3FZ_olae8NfNzS_uHu_0mUzrEVs58JMN38y6-tBDD023TqfiPRfjnWsZLWvWS1WpXNbzfVyVQSTCvmcSfO29a5GtFAAF0xRacyt7oFXFqU5NluHh4jzvprAo7qNVAZSW-rmIcKEmVrydFe41bYXFUdyYn9Tqe2IQ-pXLyi_-6jJNt4YUWJzw-OR0UjVvn5fesiAF1p7EQPrIHXZ1lTwqKtLXjdlKZ2FX3hYUJxyr7qTw';
        //
        spotifyApi.authorizationCodeGrant(code).then(
            function(data) {
                console.log('The token expires in ' + data.body['expires_in']);
                console.log('The access token is ' + data.body['access_token']);
                console.log('The refresh token is ' + data.body['refresh_token']);

                // Set the access token on the API object to use it in later calls
                spotifyApi.setAccessToken(data.body['access_token']);
                spotifyApi.setRefreshToken(data.body['refresh_token']);
            },
            function(err) {
                console.log('Something went wrong!', err);
            }
        );

        setInterval(() => {
            console.log('refreshing spotify token');
            spotifyApi.refreshAccessToken().then(
                function(data) {
                    console.log('The access token has been refreshed!');

                    // Save the access token so that it's used in future calls
                    spotifyApi.setAccessToken(data.body['access_token']);
                },
                function(err) {
                    console.log('Could not refresh access token', err);
                }
            );
        }, 30 * 60 * 1000);

        // let accessToken = 'BQBJoLYG0Heq3y0HbywYqOWcnKlPc7QSCmvAZG-g0eyeR76VyNySNi1FLaUhZU8xYG1Oru_qolaqgTOQIU322Hs0WEH1wYlwPKkGLu_vLW-B6p9AwtUbNgF9eqZaECb1JELPgz6ATS580fEy--tT8ew1vacaTA3A3eUA';
        // // The refresh token is AQBiq6391AT2JTq5Wmx4s5MYUjcXH3ToB_S1tKQ59Yf0qQ1NMZVL7xUHqx8kzazZQZrCAXBE8uDwUfYefWE5bqT7UZvV9wyQ8GUSW3DhtyKOgVaW58j_x8j5jyu5cAYWl0R9Ng
        // spotifyApi.setAccessToken(accessToken);

        // const accessToken = 'BQA1ETJ05rlxlTfn411tOGUdihMX5umw-KAYk8qxeB7_QAWks-_aZPAI2Nomls1rRaill7MIQ3t-SV1xXxm4t4i6Lub5H9JNr90sjBG_sCKKLh1pNtyAblxwFZc2Hd69OCqgBn2matoNqCK-I8IuNGC88ErDgDiuifWp';
        // spotifyApi.setAccessToken(accessToken);

    }

    nextSong() {
        if (ACTIVE) {
            this.spotifyApi.skipToNext(res => {
                console.log('next song', res);
            });
        }
    }

    volumeUp() {
        if (ACTIVE) {
            volume += 20;
            volume = Math.min(volume, 100);
            this.spotifyApi.setVolume(volume, null, (res) => {
                console.log('upped volume', res);
            });
        }
    }

    volumeDown() {
        if (ACTIVE) {
            volume -= 5;
            volume = Math.max(volume, 30);
            this.spotifyApi.setVolume(volume, null, (res) => {
                console.log('down volume', res);
            });
        }
    }

}

export const ottoSpotifyController = new OttoSpotifyController();