<h1>last.fm-wrapped</h1>
<h3>A node.js app that collects the data for your own 'wrapped' showcase from your Last.fm profile</h3>

<p>Usage: <tt>node app.js -u Vulpeace</tt></p>
<p>You will need to pass either <tt>-u</tt> or <tt>--username</tt> followed by a Last.fm username to the app.</p>
<p>Don't forget to rename .env.example to .env and fill in the fields. You will need to procure your own Last.fm and Spotify API keys.</p>
<p>https://developer.spotify.com/dashboard</p>
<p>https://www.last.fm/api/accounts</p>
<br>
<h3>How it works</h3>

<p>The app fetches the user's 12-month-old stats using user.getTopTracks method. Unfortunately, Last.fm doesn't provide the length for each and every track, that's why we have to look it up from Spotify
for the entries where <tt>duration</tt> is 0. After the app combines the data from Last.fm and Spotify, it formats the result as a json,
outputs it to the console and writes it to file named <tt>wrapped.json</tt>.</p>

```
{
    "artists": [
        {
            "name": "Teminite",
            "playMinutes": 4939
        },
        {
            "name": "cYsmix",
            "playMinutes": 4256
        },
        {
            "name": "Haywyre",
            "playMinutes": 2792
        },
        {
            "name": "Evilwave",
            "playMinutes": 2494
        },
        {
            "name": "Nhato",
            "playMinutes": 2023
        }
    ],
    "songs": [
        {
            "name": "Believe",
            "playCount": "103",
            "playMinutes": 583
        },
        {
            "name": "With Or Without",
            "playCount": "96",
            "playMinutes": 358
        },
        {
            "name": "Gekka",
            "playCount": "88",
            "playMinutes": 542
        },
        {
            "name": "Break Free",
            "playCount": "87",
            "playMinutes": 439
        },
        {
            "name": "Change Your Mind",
            "playCount": "84",
            "playMinutes": 235
        }
    ],
    "minutesListened": 38961,
    "tracksTotal": 1778,
    "strayMinutes": 2438
}
```

<p><tt>strayMinutes</tt> is a sum of playcount values for the tracks that could not be found on Spotify multiplied by the average track length.</p>