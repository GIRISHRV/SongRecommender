document.addEventListener('DOMContentLoaded', () => {
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
            const spinner = document.getElementById('loading-spinner');
            if (spinner) {
                spinner.classList.remove('d-none');
            } else {
                console.error('Loading spinner element not found');
            }
        };

        const hideLoadingSpinner = () => {
            const spinner = document.getElementById('loading-spinner');
            if (spinner) {
                spinner.classList.add('d-none');
            } else {
                console.error('Loading spinner element not found');
            }
        };

        const $playlistLinkInput = $('.playlist-link');
        const $recommendButton = $('.recommend-button');
        const $generateAgainButton = $('#generate-again-button');
        const $playlistDetails = $('.playlist-details');
        const $uploadContainer = $('.upload-container');
        const $owlCarousel = $('.owl-carousel');
        const $playlistOptions = $('.playlist-options');

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
                            hideLoadingSpinner();
                        })
                        .catch(() => {
                            showToast('Failed to get recommendations. Please try again.');
                            hideLoadingSpinner();
                            toggleButtonState($recommendButton, true);
                            $playlistLinkInput.prop('disabled', false);
                        });
                },
                error: (jqXHR, textStatus, errorThrown) => {
                    showToast('Failed to fetch playlist details. Ensure the playlist is public and accessible.');
                    hideLoadingSpinner();
                    toggleButtonState($recommendButton, true);
                    $playlistLinkInput.prop('disabled', false);
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

        const displayPlaylistDetails = (name, owner, imageUrl, stats, genres = {}) => {
            $uploadContainer.children().not('#generate-again-button').remove();
            const genreList = Object.entries(genres).map(([genre, percentage]) => `<span class="badge bg-secondary m-1">${genre}: ${percentage.toFixed(2)}%</span>`).join('');
            const detailsHtml = `
                <div class="row">
                    <div class="col-md-6 d-flex align-items-stretch">
                        <div class="card text-white bg-dark mb-3 w-100">
                            <div class="row g-0">
                            <a href="${link}" target="_blank">
                                        <img src="${imageUrl}" class="img-fluid rounded-start" alt="${name}">
                                    </a>
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
                recommendations.forEach(({ track, artist, image, spotifyUrl }) => {
                    const recElement = `
                        <div class="item">
                            <div class="card text-white bg-dark h-100">
                                <a href="${spotifyUrl}" style="text-decoration: none; color: inherit;">
                                    <img class="card-img-top" src="${image || 'static/missing.jpg'}" alt="${track}" style="height: 150px; object-fit: cover;">
                                    <div class="card-body">
                                        <h5 class="card-title">${track}</h5>
                                        <p class="card-text">${artist}</p>
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
                else {
                    showToast('Please enter a playlist link.');
                    toggleButtonState($recommendButton, true);
                    $playlistLinkInput.prop('disabled', false);
                }
            });

            $generateAgainButton.on('click', resetUI);
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
});