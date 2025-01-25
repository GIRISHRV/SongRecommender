from flask import Flask, jsonify, request, redirect, session, url_for, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import os
import requests
import google.generativeai as genai
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from collections import Counter
import sys
import time



# Ensure UTF-8 encoding
sys.stdout.reconfigure(encoding='utf-8')

# Load environment variables from .env file
load_dotenv()

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
spotify_redirect_uri = os.environ.get("SPOTIFY_REDIRECT_URI")
scope = "playlist-modify-public playlist-modify-private"

sp_oauth = SpotifyOAuth(client_id=spotify_client_id, client_secret=spotify_client_secret, redirect_uri=spotify_redirect_uri, scope=scope)

def get_spotify_client():
    token_info = get_token()
    if not token_info:
        return None
    return spotipy.Spotify(auth=token_info['access_token'])

@app.route('/login')
def login():
    auth_url = sp_oauth.get_authorize_url()
    return redirect(auth_url)

@app.route('/callback')
def callback():
    session.clear()
    code = request.args.get('code')
    token_info = sp_oauth.get_access_token(code)
    session['token_info'] = token_info
    return redirect(url_for('main_app'))

@app.route('/create_playlist', methods=['POST'])
def create_playlist():
    sp = get_spotify_client()
    if not sp:
        return redirect(url_for('login'))

    user_id = sp.current_user()['id']
    playlist_name = request.json.get('playlist_name', 'New Playlist')
    playlist_description = request.json.get('playlist_description', 'Created with TuneSearch')
    track_uris = request.json.get('track_uris', [])
    playlist = sp.user_playlist_create(user=user_id, name=playlist_name, public=True, description=playlist_description)
    sp.playlist_add_items(playlist['id'], track_uris)
    return jsonify(playlist)

@app.route('/add_tracks_to_playlist', methods=['POST'])
def add_tracks_to_playlist():
    sp = get_spotify_client()
    if not sp:
        return redirect(url_for('login'))

    playlist_id = request.json.get('playlist_id')
    track_uris = request.json.get('track_uris', [])
    sp.playlist_add_items(playlist_id, track_uris)
    return jsonify({'status': 'success'})

@app.route('/get_user_playlists', methods=['GET'])
def get_user_playlists():
    sp = get_spotify_client()
    if not sp:
        return redirect(url_for('login'))

    playlists = sp.current_user_playlists()
    return jsonify(playlists)

def get_token():
    token_info = session.get('token_info', None)
    if not token_info:
        return None

    now = int(time.time())
    is_expired = token_info['expires_at'] - now < 60
    if is_expired:
        token_info = sp_oauth.refresh_access_token(token_info['refresh_token'])
    return token_info

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

    if not playlist_link:
        return jsonify({'error': 'No playlist link provided.'}), 400

    sp = get_spotify_client()
    if not sp:
        return redirect(url_for('login'))

    try:
        playlist_id = playlist_link.split('/')[-1].split('?')[0]
        playlist = sp.playlist(playlist_id)
        playlist_name = playlist['name']
        owner = playlist['owner']['display_name']
        image_url = playlist['images'][0]['url'] if playlist['images'] else ''
        tracks = [{'artist': item['track']['artists'][0]['name'], 'track': item['track']['name'], 'id': item['track']['id']} for item in playlist['tracks']['items']]
        
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
        return jsonify(response)
    except Exception as e:
        return jsonify({'error': 'Failed to fetch playlist. Please ensure the playlist is public and accessible.'}), 400

@app.route('/recommendations', methods=['POST'])
def get_recommendations():
    data = request.json
    tracks = data.get('tracks', [])
    playlist_link = data.get('playlistLink', '')

    sp = get_spotify_client()
    if not sp:
        return redirect(url_for('login'))

    if playlist_link:
        try:
            playlist_id = playlist_link.split('/')[-1].split('?')[0]
            results = sp.playlist_tracks(playlist_id)
            tracks = [{'artist': item['track']['artists'][0]['name'], 'track': item['track']['name']} for item in results['items']]
        except Exception as e:
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
        
        return jsonify(recommendations_with_metadata)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/track-details', methods=['POST'])
def track_details():
    data = request.json
    track_uris = data.get('track_uris', [])
    tracks = []

    sp = get_spotify_client()
    if not sp:
        return redirect(url_for('login'))

    for uri in track_uris:
        track_data = sp.track(uri)
        track_info = {
            'name': track_data['name'],
            'artist': ', '.join([artist['name'] for artist in track_data['artists']])
        }
        tracks.append(track_info)

    return jsonify(tracks)

@app.route('/proxy/playlist-details', methods=['POST'])
def proxy_playlist_details():
    data = request.json
    playlist_link = data.get('playlistLink', '')

    sp = get_spotify_client()
    if not sp:
        return redirect(url_for('login'))

    if playlist_link:
        try:
            playlist_id = playlist_link.split('/')[-1].split('?')[0]
            playlist = sp.playlist(playlist_id)
            playlist_name = playlist['name']
            tracks = [{'artist': item['track']['artists'][0]['name'], 'track': item['track']['name']} for item in playlist['tracks']['items']]
            response = {'playlistName': playlist_name, 'tracks': tracks}
            return jsonify(response)
        except Exception as e:
            return jsonify({'error': 'Failed to fetch playlist. Please ensure the playlist is public and accessible.'}), 400

    return jsonify({'error': 'No playlist link provided.'}), 400

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'login.html')

@app.route('/main_app')
def main_app():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory(app.static_folder, path)

@app.route('/test')
def test():
    return "App is working!"

if __name__ == '__main__':
    app.run(debug=False)