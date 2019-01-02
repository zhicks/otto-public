const SpotifyWebApi = require('spotify-web-api-node');

declare const require;

let volume = 50;
const ACTIVE = true;
const fs = require('fs');
const TOKEN_WRITE_PATH = './spotify-refresh-token.txt';

class OttoSpotifyController {

    spotifyApi: any;

    init() {
        const spotifyApi = this.spotifyApi = new SpotifyWebApi({
            clientId: 'd0ff16d46f7141d78e84e6037c141245',
            clientSecret: '736905969562471295271581faf80742',
            redirectUri: 'http://www.example.com/callback'
        });

        const refreshToken = fs.readFileSync(TOKEN_WRITE_PATH).toString();
        console.log('spotify refresh token read: ', refreshToken);
        spotifyApi.setRefreshToken(refreshToken);

        setInterval(() => {
            this.refreshAccessToken();
        }, 30 * 60 * 1000);
        this.refreshAccessToken();

        // For setup:
        // this.oneTimeGetAuthCode();
        // this.oneTimeTokenRetrieval();
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
            volume += 16;
            volume = Math.min(volume, 100);
            this.spotifyApi.setVolume(volume, null, (res) => {
                console.log('upped volume', res);
            });
        }
    }

    volumeDown() {
        if (ACTIVE) {
            volume -= 12;
            volume = Math.max(volume, 30);
            this.spotifyApi.setVolume(volume, null, (res) => {
                console.log('down volume', res);
            });
        }
    }

    pausePlay() {
        this.spotifyApi.pause()
            .then(() => {
                console.log('pause was successful');
            })
            .catch(() => {
                console.log('pause was not successful, calling resume');
                this.spotifyApi.play()
                    .then(() => {
                        console.log('play was successful');
                    })
                    .catch(() => {
                        console.log('play was not successful');
                    });
            });
    }

    private refreshAccessToken() {
        console.log('refreshing spotify token');
        this.spotifyApi.refreshAccessToken().then(
            (data) => {
                console.log('The access token has been refreshed!');
                this.spotifyApi.setAccessToken(data.body['access_token']);
            },
            (err) => {
                console.log('Could not refresh access token', err);
            }
        );
    }

    // To obtain a code
    // Steps: call this, follow the URL it logs out in a browser,
    // accept and see where it forwarded you to in the navigation pane,
    // take that code and call oneTimeTokenRetrieval.
    // That will write the access token and refresh token to a file
    // in here. Every time it's refreshed it will then rewrite it
    // to that file.
    private oneTimeGetAuthCode() {
        const scopes = ['user-read-private', 'user-read-email', 'user-modify-playback-state'],
            redirectUri = 'https://example.com/callback',
            clientId = 'd0ff16d46f7141d78e84e6037c141245',
            state = 'some-state-of-my-choice';
        const authorizeURL = this.spotifyApi.createAuthorizeURL(scopes, state);
        console.log(authorizeURL);
    }

    private oneTimeTokenRetrieval() {
        const code = 'AQDI1UjxH4r7iOQUWuF4L7tDgdhCfNjxUS7SaSRC608qNB4RHl87fs2j6WyL-Ffk7pkbWF9y9WPQL47k90_MDtZvVVUl-zaQeHxVLx19jEPuwFUblDi71du5E6rujzkbkP6skKRVyha-fUu6RWclOMmDFa3lq9dSqfiplVCiKU93q8-8TgFenF1MDx2S9IDmiFHvXfGF19xnVhDdiUl0uGGzU4C1NLU1rraKut0lXIrTc1JdnI1lqkJ9LFhCLoi3-SSvtFTlwI7RSGx3FjaWiRKBelK9HkU';
        this.spotifyApi.authorizationCodeGrant(code).then(
            (data) => {
                console.log('Spotify: The token expires in ' + data.body['expires_in']);
                console.log('Spotify: The access token is ' + data.body['access_token']);
                console.log('Spotify: The refresh token is ' + data.body['refresh_token']);

                // Set the access token on the API object to use it in later calls
                this.spotifyApi.setAccessToken(data.body['access_token']);
                this.spotifyApi.setRefreshToken(data.body['refresh_token']);

                this.writeToken(data.body['refresh_token']);
            },
            (err) => {
                console.log('Something went wrong!', err);
            }
        );
    }

    private writeToken(refreshToken: string) {
        fs.writeFile(TOKEN_WRITE_PATH, refreshToken, err => {
            if (err) {
                console.log('there was an error writing the token');
            } else {
                console.log('spotify: wrote refresh token');
            }
        });
    }

}

export const ottoSpotifyController = new OttoSpotifyController();