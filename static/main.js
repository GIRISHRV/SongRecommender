document.addEventListener('DOMContentLoaded', function() {
    const playlistLinkInput = document.querySelector('.playlist-link');
    const recommendButton = document.querySelector('.recommend-button');
    const generateAgainButton = document.getElementById('generate-again-button');
    const spinner = document.querySelector('.spinner');
    const recommendationsContainer = document.querySelector('.recommendations-container');
    const errorMessage = document.createElement('p');
    errorMessage.style.color = 'red';
    recommendationsContainer.appendChild(errorMessage);

    playlistLinkInput.addEventListener('input', function() {
        if (playlistLinkInput.value.trim() !== '') {
            recommendButton.disabled = false;
            errorMessage.textContent = ''; // Clear error message
        } else {
            recommendButton.disabled = true;
            errorMessage.textContent = ''; // Clear error message
        }
    });

    recommendButton.addEventListener('click', function() {
        const link = playlistLinkInput.value.trim();
        if (link) {
            fetchRecommendations(link);
        } else {
            errorMessage.textContent = 'Please enter a playlist link.';
        }
    });

    generateAgainButton.addEventListener('click', function() {
        location.reload();
    });

    function fetchRecommendations(link) {
        const baseUrl = window.location.origin;

        // Disable inputs and show spinner
        recommendButton.disabled = true;
        playlistLinkInput.disabled = true;
        spinner.classList.remove('d-none');

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
            getRecommendations(tracks, baseUrl)
                .then(recommendations => {
                    displayRecommendations(recommendations);
                    spinner.classList.add('d-none');
                    generateAgainButton.style.display = 'inline-block';
                })
                .catch(error => {
                    errorMessage.textContent = 'Failed to get recommendations. Please try again.';
                    spinner.classList.add('d-none');
                });
        })
        .catch(error => {
            errorMessage.textContent = 'Failed to fetch playlist details. Please ensure the playlist is public and accessible.';
            spinner.classList.add('d-none');
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
        recommendationsContainer.innerHTML = ''; // Clear previous recommendations

        if (Array.isArray(recommendations) && recommendations.length > 0) {
            recommendations.forEach(rec => {
                const imageUrl = rec.image ? rec.image : 'static/missing.jpg';
                const recElement = document.createElement('div');
                recElement.className = 'col';
                recElement.innerHTML = `
                    <div class="card text-white bg-success mb-3" style="width: 12rem;">
                        <img class="card-img-top" src="${imageUrl}" alt="${rec.track}" style="height: 150px; object-fit: cover;">
                        <div class="card-body">
                            <h5 class="card-title">${rec.track}</h5>
                            <p class="card-text">${rec.artist}</p>
                            <p class="card-text">${rec.release_date}</p>
                            <a href="${rec.spotifyUrl}" class="btn btn-primary">Spotify</a>
                        </div>
                    </div>
                `;
                recommendationsContainer.appendChild(recElement);
            });
        } else {
            recommendationsContainer.innerHTML = '<p>No recommendations available.</p>';
        }
    }
});