from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import os
import requests
import google.generativeai as genai
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
from collections import Counter

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__, static_folder='static')
CORS(app)

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

@app.route('/playlist-details', methods=['POST'])
def get_playlist_details():
    data = request.json
    playlist_link = data.get('playlistLink', '')
    detail_level = data.get('detailLevel', 'detailed')  # 'detailed' or 'basic'

    if not playlist_link:
        return jsonify({'error': 'No playlist link provided.'}), 400

    # Fetch playlist details from Spotify
    try:
        playlist_id = playlist_link.split('/')[-1].split('?')[0]
        playlist = spotify.playlist(playlist_id)
        playlist_name = playlist['name']
        owner = playlist['owner']['display_name']
        image_url = playlist['images'][0]['url'] if playlist['images'] else ''
        tracks = [{'artist': item['track']['artists'][0]['name'], 'track': item['track']['name'], 'id': item['track']['artists'][0]['id']} for item in playlist['tracks']['items']]

        if detail_level == 'basic':
            response = {'playlistName': playlist_name, 'tracks': tracks}
            return jsonify(response)

        genres = []
        for track in tracks:
            artist_id = track['id']
            try:
                artist_genres = spotify.artist(artist_id)['genres']
                genres.extend(artist_genres)
            except spotipy.exceptions.SpotifyException as e:
                if e.http_status == 404:
                    continue  # Skip if artist not found
                else:
                    raise e

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

    if playlist_link:
        try:
            playlist_id = playlist_link.split('/')[-1].split('?')[0]
            results = spotify.playlist_tracks(playlist_id)
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
                # Replace with actual code to fetch Spotify track details
                track_data = spotify.search(q=f"track:{track_name} artist:{artist}", type='track')
                if track_data['tracks']['items']:
                    track_info = track_data['tracks']['items'][0]
                    spotify_url = track_info['external_urls']['spotify']
                    image_url = track_info['album']['images'][0]['url'] if track_info['album']['images'] else ''

                    recommendations_with_metadata.append({
                        'artist': artist,
                        'track': track_name,
                        'spotifyUrl': spotify_url,
                        'image': image_url
                    })

        return jsonify(recommendations_with_metadata)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory(app.static_folder, path)

@app.route('/test')
def test():
    return "App is working!"

if __name__ == '__main__':
    app.run(debug=True)