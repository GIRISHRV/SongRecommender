from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import os
import requests
import google.generativeai as genai
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
from collections import Counter
import sys
import logging

# Ensure UTF-8 encoding
sys.stdout.reconfigure(encoding='utf-8')

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__, static_folder='static')
app.secret_key = os.urandom(24)
CORS(app, resources={r"/*": {"origins": "*"}})

# Configure the Gemini API client with the API key from the environment variable
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    raise ValueError("No GEMINI_API_KEY found in environment variables")
genai.configure(api_key=api_key)

# Configure Spotify API client
spotify_client_id = os.environ.get("SPOTIFY_CLIENT_ID")
spotify_client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET")
if not spotify_client_id or not spotify_client_secret:
    raise ValueError("Spotify client ID or secret not set in environment variables")

sp = spotipy.Spotify(auth_manager=SpotifyClientCredentials(client_id=spotify_client_id, client_secret=spotify_client_secret))

@app.route('/config')
def get_config():
    logging.debug("Config route accessed")
    return jsonify({
        'clientId': os.getenv('SPOTIFY_CLIENT_ID')
    })

@app.route('/playlist-details', methods=['POST'])
def get_playlist_details():
    logging.debug("Get playlist details route accessed")
    data = request.json
    playlist_link = data.get('playlistLink', '')
    detail_level = data.get('detailLevel', 'detailed')  # 'detailed' or 'basic'

    if not playlist_link:
        logging.debug("No playlist link provided")
        return jsonify({'error': 'No playlist link provided.'}), 400

    try:
        playlist_id = playlist_link.split('/')[-1].split('?')[0]
        playlist = sp.playlist(playlist_id)
        playlist_name = playlist['name']
        owner = playlist['owner']['display_name']
        image_url = playlist['images'][0]['url'] if playlist['images'] else ''
        tracks = [{'artist': item['track']['artists'][0]['name'], 'track': item['track']['name'], 'id': item['track']['id']} for item in playlist['tracks']['items']]

        if detail_level == 'basic':
            response = {'playlistName': playlist_name, 'tracks': tracks}
            logging.debug(f"Basic playlist details: {response}")
            return jsonify(response)

        genres = []
        for track in tracks:
            artist_id = sp.track(track['id'])['artists'][0]['id']
            artist_genres = sp.artist(artist_id)['genres']
            genres.extend(artist_genres)

        genre_counts = Counter(genres)
        total_genres = sum(genre_counts.values())
        genre_percentages = {genre: (count / total_genres) * 100 for genre, count in genre_counts.items()}

        stats = f"{len(tracks)} tracks"
        response = {'playlistName': playlist_name, 'owner': owner, 'imageUrl': image_url, 'stats': stats, 'tracks': tracks, 'genres': genre_percentages}
        logging.debug(f"Detailed playlist details: {response}")
        return jsonify(response)
    except Exception as e:
        logging.error(f"Failed to fetch playlist: {e}")
        return jsonify({'error': 'Failed to fetch playlist. Please ensure the playlist is public and accessible.'}), 400

@app.route('/recommendations', methods=['POST'])
def get_recommendations():
    logging.debug("Get recommendations route accessed")
    data = request.json
    tracks = data.get('tracks', [])
    playlist_link = data.get('playlistLink', '')

    if playlist_link:
        try:
            playlist_id = playlist_link.split('/')[-1].split('?')[0]
            results = sp.playlist_tracks(playlist_id)
            tracks = [{'artist': item['track']['artists'][0]['name'], 'track': item['track']['name']} for item in results['items']]
        except Exception as e:
            logging.error(f"Failed to fetch playlist: {e}")
            return jsonify({'error': 'Failed to fetch playlist. Please ensure the playlist is public and accessible.'}), 400

    prompt = """
    Provide exactly 30, no less, song suggestions based on the following tracks, ensuring each aligns with the genre, style, energy, and overall vibe of the original playlist. Adhere to the following criteria:

    1. **Genre Consistency**: Match defining characteristics of genres in the playlist (e.g., distorted guitars for metal, punchy beats for hip-hop).
    2. **Language Balance**: Suggest songs from all languages in the playlist.
    3. **Mood & Emotional Tone**: Match the mood as much as possible (e.g., upbeat, melancholic, energetic) of the originals.
    4. **Release Period**: Play with the release periods as you want.
    5. **Discovery & Popularity**: Balance well-known tracks with hidden gems for variety.
    6. **Audio Attributes**: Consider tempo, key, and production style for cohesive suggestions.
    7. **No Duplication**: Avoid duplicating or suggesting overly similar tracks from the original list.

    Format your output as **'Artist - Song'**, with no additional commentary or formatting.

    Here are the tracks:

    """

    for track in tracks:
        prompt += f"{track['artist']} - {track['track']}\n"

    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        recommendations = response.text.split('\n')

        recommendations_with_metadata = []
        for rec in recommendations:
            if ' - ' in rec:
                artist, track_name = rec.split(' - ', 1)
                spotify_results = sp.search(q=f"artist:{artist} track:{track_name}", type='track', limit=1)
                if spotify_results['tracks']['items']:
                    track_data = spotify_results['tracks']['items'][0]
                    track_url = track_data['external_urls']['spotify']
                    album_images = track_data['album']['images']
                    image_url = album_images[0]['url'] if album_images else ''
                    album_name = track_data['album']['name']
                    release_date = track_data['album']['release_date']
                    popularity = track_data['popularity']

                    recommendations_with_metadata.append({
                        'artist': artist,
                        'track': track_name,
                        'spotifyUrl': track_url,
                        'image': image_url,
                        'album': album_name,
                        'release_date': release_date[0:4],
                        'popularity': popularity
                    })
        
        logging.debug(f"Recommendations: {recommendations_with_metadata}")
        return jsonify(recommendations_with_metadata)

    except Exception as e:
        logging.error(f"Failed to get recommendations: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/track-details', methods=['POST'])
def track_details():
    logging.debug("Track details route accessed")
    data = request.json
    track_uris = data.get('track_uris', [])
    tracks = []

    try:
        for uri in track_uris:
            track_data = sp.track(uri)
            track_info = {
                'name': track_data['name'],
                'artist': ', '.join([artist['name'] for artist in track_data['artists']])
            }
            tracks.append(track_info)

        logging.debug(f"Track details: {tracks}")
        return jsonify(tracks)
    except Exception as e:
        logging.error(f"Failed to fetch track details: {e}")
        return jsonify({'error': 'Failed to fetch track details.'}), 500

@app.route('/')
def index():
    logging.debug("Main app route accessed")
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/static/<path:path>')
def send_static(path):
    logging.debug(f"Static file requested: {path}")
    return send_from_directory(app.static_folder, path)

@app.route('/test')
def test():
    logging.debug("Test route accessed")
    return "App is working!"

if __name__ == '__main__':
    logging.debug("Starting app")
    app.run(debug=True)