$(document).ready(() => {
    const toggleButtonState = ($button, enable) => $button.prop('disabled', !enable);
    const clearToast = () => $('.toast-container').empty();
    const showToast = (message, isSuccess = false) => {
        const toastHtml = `
            <div class="toast align-items-center ${isSuccess ? 'text-bg-success' : 'text-bg-danger'} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">${message}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;
        const $toast = $(toastHtml);
        $('.toast-container').append($toast);
        new bootstrap.Toast($toast[0]).show();
    };

    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    };

    const showLoadingSpinner = () => {
        const spinner = document.getElementById('#loading-spinner');
        if (spinner) {
            spinner.classList.remove('d-none');
        }
    };

    const hideLoadingSpinner = () => {
        const spinner = document.getElementById('#loading-spinner');
        if (spinner) {
            spinner.classList.add('d-none');
        }
    };

    const $playlistLinkInput = $('.playlist-link');
    const $recommendButton = $('.recommend-button');
    const $generateAgainButton = $('#generate-again-button');
    const $playlistDetails = $('.playlist-details');
    const $uploadContainer = $('.upload-container');
    const $owlCarousel = $('.owl-carousel');
    const $playlistOptions = $('.playlist-options');
    const $addToPlaylistButton = $('#add-to-playlist-button');
    const $playlistModal = $('#playlistModal');
    const $playlistAction = $('#playlist-action');
    const $existingPlaylistSection = $('#existing-playlist-section');
    const $existingPlaylistSelect = $('#existing-playlist-select');
    const $newPlaylistSection = $('#new-playlist-section');
    const $newPlaylistName = $('#new-playlist-name');
    const $modalOkButton = $('#modal-ok-button');
    const $confirmationModal = $('#confirmationModal');
    const $confirmationTrackList = $('#confirmation-track-list');
    const $confirmAddButton = $('#confirm-add-button');

    let trackUris = [];

    const fetchRecommendations = (link) => {
        const baseUrl = window.location.origin;
        toggleButtonState($recommendButton, false);
        $playlistLinkInput.prop('disabled', true);
        showLoadingSpinner();

        const requestData = { playlistLink: link };

        $.ajax({
            url: `${baseUrl}/playlist-details`,
            method: 'POST',
            contentType: 'application/json; charset=utf-8',
            data: JSON.stringify(requestData),
            success: (data) => {
                const { playlistName, tracks, owner, imageUrl, stats, genres } = data;
                displayPlaylistDetails(playlistName, owner, imageUrl, stats, genres);
                getRecommendations(tracks, baseUrl)
                    .then((recommendations) => {
                        displayRecommendations(recommendations);
                        $playlistOptions.removeClass('d-none');
                        loadUserPlaylists();
                        hideLoadingSpinner();
                    })
                    .catch(() => {
                        showToast('Failed to get recommendations. Please try again.');
                        hideLoadingSpinner();
                    });
            },
            error: (jqXHR, textStatus, errorThrown) => {
                showToast('Failed to fetch playlist details. Ensure the playlist is public and accessible.');
                hideLoadingSpinner();
            },
        });
    };

    const getRecommendations = (tracks, baseUrl) => {
        const requestData = { tracks };

        return $.ajax({
            url: `${baseUrl}/recommendations`,
            method: 'POST',
            contentType: 'application/json; charset=utf-8',
            data: JSON.stringify(requestData),
        });
    };

    const displayPlaylistDetails = (name, owner, imageUrl, stats, genres) => {
        $uploadContainer.children().not('#generate-again-button').remove();
        const genreList = Object.entries(genres).map(([genre, percentage]) => `<span class="badge bg-secondary m-1">${genre}: ${percentage.toFixed(2)}%</span>`).join('');
        const detailsHtml = `
            <div class="row">
                <div class="col-md-6 d-flex align-items-stretch">
                    <div class="card text-white bg-dark mb-3 w-100">
                        <div class="row g-0">
                            <div class="col-md-4">
                                <img src="${imageUrl}" class="img-fluid rounded-start" alt="${name}">
                            </div>
                            <div class="col-md-8">
                                <div class="card-body">
                                    <h5 class="card-title">${name}</h5>
                                    <p class="card-text">Owner: ${owner}</p>
                                    <p class="card-text">Stats: ${stats}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 d-flex align-items-stretch">
                    <div class="card text-white bg-dark mb-3 w-100">
                        <div class="card-body">
                            <h5 class="card-title">Genres</h5>
                            <div>${genreList}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        $playlistDetails.html(detailsHtml);
        $uploadContainer.prepend($playlistDetails);
    };

    const displayRecommendations = (recommendations) => {
        $owlCarousel.trigger('destroy.owl.carousel');
        $owlCarousel.html('');
        $('.recommendations-container').find('h1').text('Recommended Tracks');
        if (Array.isArray(recommendations) && recommendations.length > 0) {
            recommendations.forEach(({ track, artist, release_date, image, spotifyUrl }) => {
                const recElement = `
                    <div class="item">
                        <div class="card text-white bg-dark h-100">
                            <a href="${spotifyUrl}" style="text-decoration: none; color: inherit;">
                                <img class="card-img-top" src="${image || 'static/missing.jpg'}" alt="${track}" style="height: 150px; object-fit: cover;">
                                <div class="card-body">
                                    <h5 class="card-title">${track}</h5>
                                    <p class="card-text">${artist} - ${release_date}</p>
                                </div>
                            </a>
                        </div>
                    </div>
                `;
                $owlCarousel.append(recElement);
            });
            $owlCarousel.owlCarousel({
                loop: true,
                margin: 10,
                nav: true,
                navText: ["<div class='nav-btn prev-slide'></div>", "<div class='nav-btn next-slide'></div>"],
                responsive: {
                    0: { items: 1 },
                    600: { items: 3 },
                    1000: { items: 5 },
                },
            });
            $generateAgainButton.removeClass("d-none");
        } else {
            showToast('No recommendations available.');
        }
    };

    const resetUI = () => {
        location.reload();
    };

    const attachEventListeners = () => {
        $playlistLinkInput.on('input', debounce(() => {
            const isInputValid = $playlistLinkInput.val().trim() !== '';
            toggleButtonState($recommendButton, isInputValid);
            clearToast();
        }, 300));

        $recommendButton.on('click', () => {
            const link = $playlistLinkInput.val().trim();
            if (link) fetchRecommendations(link);
            else showToast('Please enter a playlist link.');
        });

        $generateAgainButton.on('click', resetUI);

        $addToPlaylistButton.on('click', () => {
            $playlistModal.modal('show');
        });

        $playlistAction.on('change', () => {
            const action = $playlistAction.val();
            $existingPlaylistSection.addClass('d-none');
            $newPlaylistSection.addClass('d-none');
            $modalOkButton.addClass('d-none');

            if (action === 'existing') {
                $existingPlaylistSection.removeClass('d-none');
            } else if (action === 'new') {
                $newPlaylistSection.removeClass('d-none');
                $modalOkButton.removeClass('d-none');
            }
        });

        $existingPlaylistSelect.on('change', () => {
            $modalOkButton.removeClass('d-none');
        });

        $modalOkButton.on('click', () => {
            trackUris = getTrackUris(); // Function to get track URIs from recommendations
            showLoadingSpinner();
            fetchTrackDetails(trackUris).then((tracks) => {
                displayConfirmationModal(tracks);
                hideLoadingSpinner();
            }).catch(() => {
                showToast('Failed to fetch track details.');
                hideLoadingSpinner();
            });
        });

        $confirmAddButton.on('click', () => {
            const action = $playlistAction.val();
            showLoadingSpinner();
            if (action === 'existing') {
                const playlistId = $existingPlaylistSelect.val();
                $.ajax({
                    url: '/add_tracks_to_playlist',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ playlist_id: playlistId, track_uris: trackUris }),
                    success: (data) => {
                        hideLoadingSpinner();
                        $confirmationModal.modal('hide');
                        $playlistModal.modal('hide');
                        showToast('Tracks added to playlist successfully!', true);
                    },
                    error: (jqXHR, textStatus, errorThrown) => {
                        hideLoadingSpinner();
                        showToast('Failed to add tracks to playlist.');
                    }
                });
            } else if (action === 'new') {
                const playlistName = $newPlaylistName.val().trim();
                const playlistDescription = 'Made Using TuneSearch Beta';
                $.ajax({
                    url: '/create_playlist',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ playlist_name: playlistName, playlist_description: playlistDescription, track_uris: trackUris }),
                    success: (data) => {
                        hideLoadingSpinner();
                        $confirmationModal.modal('hide');
                        $playlistModal.modal('hide');
                        showToast('Playlist created successfully!', true);
                    },
                    error: (jqXHR, textStatus, errorThrown) => {
                        hideLoadingSpinner();
                        showToast('Failed to create playlist.');
                    }
                });
            }
        });
    };

    const getTrackUris = () => {
        // Function to get track URIs from recommendations
        // This should return an array of track URIs
        const trackUris = [];
        $owlCarousel.find('.item').each((index, element) => {
            const spotifyUrl = $(element).find('a').attr('href');
            const trackUri = spotifyUrl.split('/').pop().split('?')[0];
            trackUris.push(`spotify:track:${trackUri}`);
        });
        return [...new Set(trackUris)]; // Return unique track URIs
    };

    const fetchTrackDetails = (trackUris) => {
        const baseUrl = window.location.origin;
        return $.ajax({
            url: `${baseUrl}/track-details`,
            method: 'POST',
            contentType: 'application/json; charset=utf-8',
            data: JSON.stringify({ track_uris: trackUris }),
        });
    };

    const displayConfirmationModal = (tracks) => {
        $confirmationTrackList.empty();
        tracks.forEach((track) => {
            $confirmationTrackList.append(`<p class="list-group-item bg-dark text-white">${track.name} - ${track.artist}<br></p>`);
        });
        $playlistModal.modal('hide');
        $confirmationModal.modal('show');
    };

    const loadUserPlaylists = () => {
        $.ajax({
            url: '/get_user_playlists',
            method: 'GET',
            success: (data) => {
                const playlists = data.items;
                $existingPlaylistSelect.empty();
                $existingPlaylistSelect.append('<option value="" disabled selected>Select a playlist</option>');
                playlists.forEach((playlist) => {
                    $existingPlaylistSelect.append(new Option(playlist.name, playlist.id));
                });
            },
            error: (jqXHR, textStatus, errorThrown) => {
                showToast('Failed to load user playlists.');
            }
        });
    };

    $owlCarousel.owlCarousel({
        loop: true,
        margin: 10,
        nav: true,
        navText: ["<div class='nav-btn prev-slide'></div>", "<div class='nav-btn next-slide'></div>"],
        responsive: {
            0: { items: 1 },
            600: { items: 3 },
            1000: { items: 5 },
        },
    });

    $generateAgainButton.addClass("d-none");
    toggleButtonState($recommendButton, false);

    attachEventListeners();
});