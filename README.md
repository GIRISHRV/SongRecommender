
# Music Recommendation Project

This project leverages AI and various APIs to provide personalized music recommendations based on your playlist. It uses Flask for the backend, Spotipy for interacting with the Spotify API, and the Last.fm API for fetching track metadata.

## Features

- **Upload Your Playlist**: Upload a playlist file or enter a Spotify playlist link.
- **AI-Powered Recommendations**: Generates song suggestions that closely match the genre, style, and energy of your original tracks using the Gemini API.
- **Metadata Enrichment**: Fetches additional metadata for each recommended track from Last.fm.
- **User-Friendly Interface**: A clean and intuitive UI to enhance user experience.

## Technologies Used

- **Flask**: For building the backend API.
- **Spotipy**: For interacting with the Spotify API.
- **Last.fm API**: For fetching track metadata.
- **Google Generative AI**: For generating music recommendations.
- **HTML, CSS, JavaScript**: For the frontend.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/music-recommendation-project.git
   cd music-recommendation-project
   ```

2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
   ```

3. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables:
   Create a .env file in the root directory and add your API keys:
   ```plaintext
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   LASTFM_API_KEY=your_lastfm_api_key
   ```

5. Run the Flask application:
   ```bash
   flask run
   ```

6. Open your browser and navigate to `http://127.0.0.1:5000` to access the application.

## Usage

1. **Upload or Enter Playlist**: Users can either upload a playlist file or enter a Spotify playlist link.
2. **Get Recommendations**: The AI processes the playlist and provides a list of recommended tracks.
3. **Explore and Enjoy**: Users can explore the recommended tracks and discover new music.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any improvements or bug fixes.

## Contact

For any questions or feedback, please contact [GIRISHRV](mailto:girish29052005@gmail.com).

