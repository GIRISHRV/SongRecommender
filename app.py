from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import os
import requests
import google.generativeai as genai
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__, static_folder='static')
CORS(app)

# Get the Last.fm API key from the environment variables
lastfm_api_key = os.environ.get("LASTFM_API_KEY")
if not lastfm_api_key:
    raise ValueError("No LASTFM_API_KEY found in environment variables")

# Configure the Gemini API client with the API key from the environment variable
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    raise ValueError("No GEMINI_API_KEY found in environment variables")
genai.configure(api_key=api_key)

# Configure Spotify API client
spotify_client_id = os.environ.get("SPOTIFY_CLIENT_ID")
spotify_client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET")
if not spotify_client_id or not spotify_client_secret:
    raise ValueError("No Spotify client credentials found in environment variables")
spotify = spotipy.Spotify(client_credentials_manager=SpotifyClientCredentials(client_id=spotify_client_id, client_secret=spotify_client_secret))

@app.route('/config')
def get_config():
    return jsonify({
        'clientId': os.getenv('SPOTIFY_CLIENT_ID'),
        'redirectUri': os.getenv('SPOTIFY_REDIRECT_URI')
    })
@app.route('/playlist-details', methods=['POST'])
def get_playlist_details():
    data = request.json
    playlist_link = data.get('playlistLink', '')

    if playlist_link:
        try:
            playlist_id = playlist_link.split('/')[-1].split('?')[0]
            playlist = spotify.playlist(playlist_id)
            playlist_name = playlist['name']
            tracks = [{'artist': item['track']['artists'][0]['name'], 'track': item['track']['name']} for item in playlist['tracks']['items']]
            return jsonify({'playlistName': playlist_name, 'tracks': tracks})
        except Exception as e:
            return jsonify({'error': 'Failed to fetch playlist. Please ensure the playlist is public and accessible.'}), 400

    return jsonify({'error': 'No playlist link provided.'}), 400

@app.route('/recommendations', methods=['POST'])
def get_recommendations():
    data = request.json
    tracks = data.get('tracks', [])
    playlist_link = data.get('playlistLink', '')

    if playlist_link:
        try:
            playlist_id = playlist_link.split('/')[-1].split('?')[0]
            results = spotify.playlist_tracks(playlist_id)
            tracks = [{'artist': item['track']['artists'][0]['name'], 'track': item['track']['name']} for item in results['items']]
        except Exception as e:
            return jsonify({'error': 'Failed to fetch playlist. Please ensure the playlist is public and accessible.'}), 400

    #print('Received tracks:', tracks)  # Debugging statement

    # Prepare the prompt for the Gemini API
    prompt = "Provide exactly 30 song suggestions based on the following list of tracks. Each suggestion must closely align with the genre, style, energy, and overall vibe of the original tracks. For genres like metal, rock, pop, or hip-hop, ensure suggestions reflect defining musical characteristics (e.g., distorted guitars for metal, punchy beats for hip-hop). Maintain a proportional balance between the languages present in the original list—for example, if the playlist includes English and Tamil tracks, the suggestions must include songs from both languages.\n\nSuggestions should also consider the popularity, influence, and cultural relevance of the songs within their respective genres and languages. Where possible, include tracks that match the mood or emotional tone (e.g., upbeat, melancholic, energetic) of the original tracks. Suggest songs from a similar release period as the original tracks unless the genre/style calls for a timeless or modern interpretation. Include a mix of popular tracks and hidden gems to balance familiarity with discovery. Ensure no duplication of tracks from the original list or overly similar suggestions.\n\n Take into account audio attributes like tempo, key, and production style to ensure each suggestion complements the original tracks. You may include up to two experimental or genre-bending tracks that push the boundaries of the original playlist’s style while still aligning with its overall vibe.\n\nEnsure the output contains **only** the song suggestions, strictly formatted as 'Artist - Song', with no additional text, commentary, or formatting.\n\nHere are the tracks:\n" 

    for track in tracks:
        prompt += f"{track['artist']} - {track['track']}\n"

    # Call the Gemini API
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        recommendations = response.text.split('\n')

        # Fetch metadata for each recommended track from Last.fm
        recommendations_with_metadata = []
        for rec in recommendations:
            if ' - ' in rec:
                artist, track_name = rec.split(' - ', 1)
                response = requests.get(
                    'http://ws.audioscrobbler.com/2.0/',
                    params={
                        'method': 'track.getInfo',
                        'api_key': lastfm_api_key,
                        'artist': artist,
                        'track': track_name,
                        'format': 'json'
                    },
                    headers={'User-Agent': 'YourAppName/1.0'}
                )
                if response.status_code == 200:
                    track_info = response.json().get('track', {})
                    #print(f"Metadata for {artist} - {track_name}: {track_info}")  # Debugging statement
                    recommendations_with_metadata.append({
                        'artist': artist,
                        'track': track_name,
                        'image': track_info.get('album', {}).get('image', [{}])[-1].get('#text', '')  # Get the largest image
                    })
                else:
                    print(f"Error fetching metadata for {artist} - {track_name}: {response.status_code}, {response.text}")

        #print('Final recommendations with metadata:', recommendations_with_metadata)  # Debugging statement
        return jsonify(recommendations_with_metadata)

    except Exception as e:
        print('Error calling Gemini API:', e)  # Debugging statement
        return jsonify({'error': str(e)}), 500

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory(app.static_folder, path)

@app.route('/test')
def test():
    return "App is working!"

"""if __name__ == '__main__':
   app.run(debug=False) """