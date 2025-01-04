document.getElementById('file-input').addEventListener('change', function() {
    const fileInput = document.getElementById('file-input');
    const fileName = document.getElementById('file-name');
    const recommendButton = document.getElementById('recommend-button');
    const playlistLink = document.getElementById('playlist-link');

    if (fileInput.files.length > 0) {
        fileName.textContent = `Selected file: ${fileInput.files[0].name}`;
        recommendButton.disabled = false;
        playlistLink.value = ''; // Clear playlist link if file is selected
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

    if (playlistLink.value.trim() !== '') {
        recommendButton.disabled = false;
        fileInput.value = ''; // Clear file input if playlist link is provided
        fileName.textContent = ''; // Clear file name if playlist link is provided
    } else {
        recommendButton.disabled = true;
    }
});

document.getElementById('recommend-button').addEventListener('click', function() {
    console.log('Recommend button clicked');
    const fileInput = document.getElementById('file-input');
    const fileInputLabel = document.querySelector('.file-input-label');
    const recommendButton = document.getElementById('recommend-button');
    const spinner = document.getElementById('spinner');
    const generateAgainButton = document.getElementById('generate-again-button');
    const fileName = document.getElementById('file-name');
    const playlistLink = document.getElementById('playlist-link');
    const file = fileInput.files[0];
    const link = playlistLink.value.trim();

    // Disable buttons and inputs
    fileInput.disabled = true;
    fileInputLabel.style.backgroundColor = '#555';
    fileInputLabel.style.cursor = 'not-allowed';
    recommendButton.disabled = true;
    playlistLink.disabled = true;

    // Show spinner
    spinner.style.display = 'flex';

    const baseUrl = window.location.origin;

    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            console.log('File read successfully');
            const fileContent = event.target.result;
            console.log('File content:', fileContent);
            const tracks = parseFileContent(fileContent);
            console.log('Parsed tracks:', tracks);
            getRecommendations(tracks, baseUrl)
                .then(recommendations => {
                    console.log('Received recommendations:', recommendations);
                    displayRecommendations(recommendations);
                    // Hide spinner
                    spinner.style.display = 'none';
                    // Show generate again button
                    generateAgainButton.style.display = 'inline-block';
                })
                .catch(error => {
                    console.error('Error fetching recommendations:', error);
                    alert('Failed to get recommendations. Please try again.');
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
                    console.log('Received recommendations:', recommendations);
                    displayRecommendations(recommendations);
                    // Hide spinner
                    spinner.style.display = 'none';
                    // Show generate again button
                    generateAgainButton.style.display = 'inline-block';
                })
                .catch(error => {
                    console.error('Error fetching recommendations:', error);
                    alert('Failed to get recommendations. Please try again.');
                    // Hide spinner
                    spinner.style.display = 'none';
                });
        })
        .catch(error => {
            console.error('Error fetching playlist details:', error);
            alert('Failed to fetch playlist details. Please ensure the playlist is public and accessible.');
            // Hide spinner
            spinner.style.display = 'none';
        });
    } else {
        alert('Please upload a file or enter a playlist link.');
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

function displayRecommendations(recommendations) {
    const recommendationsSection = document.querySelector('.recommendations-section');
    const recommendationsDiv = document.getElementById('recommendations');
    recommendationsDiv.innerHTML = ''; // Clear previous recommendations

    if (Array.isArray(recommendations)) {
        recommendations.forEach(rec => {
            const imageUrl = rec.image ? rec.image : 'static/images/missing.jpg';
            const recElement = document.createElement('div');
            recElement.className = 'item';
            recElement.innerHTML = `
                <img src="${imageUrl}" alt="${rec.track}">
                <h4>${rec.track}</h4>
                <p>${rec.artist}</p>
            `;
            recommendationsDiv.appendChild(recElement);
        });
        recommendationsSection.style.display = 'block'; // Show recommendations section
    } else {
        console.error('Recommendations is not an array:', recommendations);
    }
}