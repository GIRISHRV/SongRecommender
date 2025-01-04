document.getElementById('file-input').addEventListener('change', function() {
    const fileInput = document.getElementById('file-input');
    const fileName = document.getElementById('file-name');
    const recommendButton = document.getElementById('recommend-button');
    const playlistLink = document.getElementById('playlist-link');
    const errorMessage = document.getElementById('error-message');

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileExtension = file.name.split('.').pop().toLowerCase();

        if (fileExtension === 'txt') {
            fileName.textContent = `Selected file: ${file.name}`;
            recommendButton.disabled = false;
            playlistLink.value = ''; // Clear playlist link if file is selected
            errorMessage.textContent = ''; // Clear error message
        } else {
            fileName.textContent = '';
            recommendButton.disabled = true;
            errorMessage.textContent = 'Invalid file type. Please select a .txt file.';
        }
    } else {
        fileName.textContent = '';
        recommendButton.disabled = true;
    }
});

document.getElementById('playlist-link').addEventListener('input', function() {
    const playlistLink = document.getElementById('playlist-link');
    const recommendButton = document.getElementById('recommend-button');
    const fileInput = document.getElementById('file-input');
    const fileName = document.getElementById('file-name');
    const errorMessage = document.getElementById('error-message');

    if (playlistLink.value.trim() !== '') {
        recommendButton.disabled = false;
        fileInput.value = ''; // Clear file input if playlist link is provided
        fileName.textContent = ''; // Clear file name if playlist link is provided
        errorMessage.textContent = ''; // Clear error message

        // Fetch and display playlist name if the URL is valid
        fetchPlaylistName(playlistLink.value.trim());
    } else {
        recommendButton.disabled = true;
        fileName.textContent = ''; // Clear file name if playlist link is cleared
        errorMessage.textContent = ''; // Clear error message
    }
});

document.getElementById('recommend-button').addEventListener('click', function() {
    const fileInput = document.getElementById('file-input');
    const fileInputLabel = document.querySelector('.file-input-label');
    const recommendButton = document.getElementById('recommend-button');
    const spinner = document.getElementById('spinner');
    const generateAgainButton = document.getElementById('generate-again-button');
    const fileName = document.getElementById('file-name');
    const playlistLink = document.getElementById('playlist-link');
    const errorMessage = document.getElementById('error-message');
    const recommendationsDiv = document.getElementById('recommendations');
    const file = fileInput.files[0];
    const link = playlistLink.value.trim();

    // Clear previous error message
    errorMessage.textContent = '';

    // Disable buttons and inputs
    fileInput.disabled = true;
    fileInputLabel.style.backgroundColor = '#555';
    fileInputLabel.style.cursor = 'not-allowed';
    recommendButton.disabled = true;
    playlistLink.disabled = true;

    // Show spinner
    spinner.style.display = 'flex';

    // Clear previous recommendations
    recommendationsDiv.innerHTML = '';

    const baseUrl = window.location.origin;

    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const fileContent = event.target.result;
            const tracks = parseFileContent(fileContent);
            getRecommendations(tracks, baseUrl)
                .then(recommendations => {
                    displayRecommendations(recommendations);
                    // Hide spinner
                    spinner.style.display = 'none';
                    // Show generate again button
                    generateAgainButton.style.display = 'inline-block';
                })
                .catch(error => {
                    errorMessage.textContent = 'Failed to get recommendations. Please try again.';
                    // Hide spinner
                    spinner.style.display = 'none';
                });
        };
        reader.readAsText(file);
    } else if (link) {
        fetch(`${baseUrl}/playlist-details`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ playlistLink: link })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const { playlistName, tracks } = data;
            fileName.textContent = `Selected playlist: ${playlistName}`;
            getRecommendations(tracks, baseUrl)
                .then(recommendations => {
                    displayRecommendations(recommendations);
                    // Hide spinner
                    spinner.style.display = 'none';
                    // Show generate again button
                    generateAgainButton.style.display = 'inline-block';
                })
                .catch(error => {
                    errorMessage.textContent = 'Failed to get recommendations. Please try again.';
                    // Hide spinner
                    spinner.style.display = 'none';
                });
        })
        .catch(error => {
            errorMessage.textContent = 'Failed to fetch playlist details. Please ensure the playlist is public and accessible.';
            // Hide spinner
            spinner.style.display = 'none';
        });
    } else {
        errorMessage.textContent = 'Please upload a file or enter a playlist link.';
        // Hide spinner
        spinner.style.display = 'none';
    }
});

document.getElementById('generate-again-button').addEventListener('click', function() {
    location.reload();
});

function parseFileContent(content) {
    // Example function to parse file content into an array of tracks
    // Assuming each line in the file is in the format "artist - track"
    return content.split('\n').map(line => {
        const [artist, track] = line.split(' - ');
        return { artist, track };
    });
}

function getRecommendations(tracks, baseUrl) {
    return fetch(`${baseUrl}/recommendations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tracks: tracks })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    });
}

function fetchPlaylistName(playlistLink) {
    const baseUrl = window.location.origin;
    fetch(`${baseUrl}/playlist-details`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playlistLink: playlistLink })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        const { playlistName } = data;
        const fileName = document.getElementById('file-name');
        fileName.textContent = `Selected playlist: ${playlistName}`;
    })
    .catch(error => {
        const fileName = document.getElementById('file-name');
        fileName.textContent = ''; // Clear file name if playlist link is invalid
    });
}

function displayRecommendations(recommendations) {
    const recommendationsDiv = document.getElementById('recommendations');
    recommendationsDiv.innerHTML = ''; // Clear previous recommendations

    if (Array.isArray(recommendations) && recommendations.length > 0) {
        recommendations.forEach(rec => {
            //console.log('Recommendation:', rec); // Debugging statement
            const imageUrl = rec.image ? rec.image : 'static/missing.jpg';
            const recElement = document.createElement('div');
            recElement.className = 'item';
            recElement.innerHTML = `
                <a href="${rec.spotifyUrl}" target="_blank" style="text-decoration: none; color: inherit;">
                    <img src="${imageUrl}" alt="${rec.track}">
                    <h4>${rec.track}</h4>
                    <p>${rec.artist}</p>
                </a>
            `;
            recommendationsDiv.appendChild(recElement);
        });
    } else {
        recommendationsDiv.innerHTML = '<p>No recommendations available.</p>';
    }
}