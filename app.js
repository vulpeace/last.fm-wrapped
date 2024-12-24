import 'dotenv/config.js';
import { writeFileSync } from 'fs';

async function fetchSpotifyToken() {
    const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(process.env.SPOTIFY_ID + ':' + process.env.SPOTIFY_SECRET).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: new URLSearchParams({
            grant_type: 'client_credentials'
        }),
    };

    try {
        const response = await fetch(authOptions.url, {
            method: 'POST',
            headers: authOptions.headers,
            body: authOptions.data
        });

        if (!response.ok) {
            throw new Error(`Error fetching Spotify token: ${response.status}\n${await response.text()}`);
        }

        const responseData = await response.json();
        const token = responseData.access_token;
        return token;
    } catch (error) {
        throw error;
    }
}

async function fetchSpotifyResponse(token, name, artist) {
    try {
        let query = encodeURIComponent(`track:${name} artist:${artist}`);
        query = encodeURIComponent(query);

        const response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&market=US&locale=en-US`, {
            headers: {
                Authorization: 'Bearer ' + token
            }
        });

        if (response.status === 429) {
            return {"retryAfter": response.headers.get('retry-after')};
        }

        if (!response.ok) {
            throw new Error(`Error fetching Spotify response: ${response.status}\n${await response.text()}`);
        }

        return await response.json();
    } catch (error) {
        throw error;
    }
}

async function fetchDuration(token, name, artist) {
    try {
        let strippedName = name.replace(/\s*\(.*?\)/g, '').replace(/\s\b(feat|ft)\b.*/gi, '');

        let spotifyResponse = await fetchSpotifyResponse(token, strippedName, artist);

        if (spotifyResponse.retryAfter) {
            await new Promise(resolve => setTimeout(resolve, (spotifyResponse.retryAfter + 1) * 1000));
            spotifyResponse = await fetchSpotifyResponse(token, strippedName, artist);
        }

        if (Object.keys(spotifyResponse.tracks.items).length) {
            for (let i = 0; i < Object.keys(spotifyResponse.tracks.items).length; i++) {
                const spotifyName = spotifyResponse.tracks.items[i].name;
                if (spotifyResponse.tracks.items[i].artists.find(x =>
                    x.name.localeCompare(artist, undefined,
                    { sensitivity: 'accent' }) === 0)) {
                        if ((spotifyName.localeCompare(name, undefined,
                            { sensitivity: 'accent' }) === 0) || (spotifyName.localeCompare(name.replace(/\s*\((.*?)\)/, ' - $1'), undefined,
                            { sensitivity: 'accent' }) === 0) || (spotifyName.replace(/\s*\(.*?\)/g, '').replace(/\s\b(feat|ft)\b.*/gi, '').localeCompare(strippedName, undefined,
                            { sensitivity: 'accent' }) === 0)) {
                                return Math.floor(spotifyResponse.tracks.items[i].duration_ms / 1000);
                        }
                }
            }
        }

        return 0;
    } catch(error) {
        throw error;
    }
}

async function fetchLastfmResponse(username) {
    try {
        const url = `https://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&format=json&extended=true&api_key=${process.env.LASTFM_API_KEY}&limit=1000&user=${username}&period=12month`;

        let response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error fetching Last.fm response: ${response.status}\n${await response.text()}`);
        }

        response = await response.json();
        const jsonPages = response.toptracks["@attr"].totalPages;
        delete response.toptracks["@attr"];

        if (jsonPages > 1) {
            for (let i = 2; i <= jsonPages; i++) {
                let tempResponse = await fetch(url + `&page=${i}`);
                if (!tempResponse.ok) {
                    throw new Error(`Error fetching Last.fm response: ${tempResponse.status}\n${await tempResponse.text()}`);
                }

                tempResponse = await tempResponse.json();
                delete tempResponse.toptracks["@attr"];
                response.toptracks.track.push(...tempResponse.toptracks.track);
            }
        }

        return response;
    } catch(error) {
        throw error;
    }
}

async function fetchStats(username) {
    try{
        const response = await fetchLastfmResponse(username);
        const jsonLength = Object.keys(response.toptracks.track).length;

        let secondsListened = 0;
        let topArtists = [];
        let nonMatched = 0;

        const token = await fetchSpotifyToken();
        for (let number = 0; number < jsonLength; number++) {
            const track = response.toptracks.track[number];
            const artist = track.artist.name.replace(/(;|,).*/gi, '');

            if (track.duration == 0) {
                let duration = await fetchDuration(token, track.name, artist);

                track.duration = duration;
                nonMatched += duration ? 0 : 1;
            }

            const localArtist = topArtists.find(x => x.name === artist);

            if (localArtist) {
                localArtist.playSeconds += track.duration * track.playcount;
            } else {
                topArtists.push( { "name": `${artist}`, "playSeconds": track.duration * track.playcount} );
            }
            secondsListened += track.duration * track.playcount;
        }

        let topSongs = [];
        for (let i = 0; i < 5; i++) {
            const track = response.toptracks.track[i];
            topSongs.push({ "name": track.name, "playCount": track.playcount,
                "playMinutes": Math.floor(track.duration * track.playcount / 60) });
        }

        const minutesListened = Math.floor(secondsListened / 60);

        topArtists = topArtists.sort((a, b) => b.playSeconds - a.playSeconds).slice(0, 5);

        for (let i = 0; i < 5; i++) {
            topArtists[i].playMinutes = Math.floor(topArtists[i].playSeconds / 60);
            delete topArtists[i].playSeconds;
        }

        const strayMinutes = nonMatched * Math.floor(minutesListened / (jsonLength - nonMatched));

        return { "artists": topArtists, "songs": topSongs, "minutesListened": minutesListened,
            "tracksTotal": jsonLength, "strayMinutes": strayMinutes };
    } catch(error) {
        throw error;
    }
}

async function main() {
    try {
        let username;

        const argIndex = process.argv.find(x => x === '-u') ? process.argv.indexOf('-u') : process.argv.indexOf('--username');
        if (argIndex > -1) {
            username = process.argv[argIndex + 1];
        } else {
            throw new Error(`Last.fm username required. Use '-u' or '--username' to pass it.
       Example: 'node --env-file=.env app.js -u Vulpeace'`);
        }

        if (!(process.env.LASTFM_API_KEY && process.env.SPOTIFY_ID && process.env.SPOTIFY_SECRET)) {
            throw new Error(`Env file required. Rename '.env.example' to '.env' and fill in the fields.`);
        }

        let stats = await fetchStats(username);
        stats = JSON.stringify(stats, null, 4);

        writeFileSync('stats.json', stats);
        console.log('Success! The result is written to stats.json');
    } catch (error) {
        console.error(error);
    }
}

main();
