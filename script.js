document.addEventListener("DOMContentLoaded", () => {
    fetch('sample.json')
        .then(response => response.json())
        .then(players => {
            const playerCardsContainer = document.getElementById('player-cards');
            players.forEach(player => {
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <button>Nominate</button>
                    <h2>${player.player}</h2>
                    <p>PPG: ${player.ppg}</p>
                    <p>APG: ${player.apg}</p>
                    <p>RPG: ${player.rpg}</p>
                    <p>Team: ${player.team}</p>
                    <p>Pos: ${player.pos}</p>
                `;
                playerCardsContainer.appendChild(card);
            });
        })
        .catch(error => console.error('Error fetching player data:', error));

    const ROSTER_SIZE = 13;
    const leagueSizeSelect = document.getElementById('league-size');
    const livePlayersSelect = document.getElementById('live-players');

    leagueSizeSelect.addEventListener('change', function() {
        const selectedLeagueSize = parseInt(leagueSizeSelect.value);
        livePlayersSelect.innerHTML = '';

        if (selectedLeagueSize) {
            for (let i = 1; i <= selectedLeagueSize; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = i;
                livePlayersSelect.appendChild(option);
            }
        }
    });

    document.getElementById('auction-settings').addEventListener('submit', function(event) {
        event.preventDefault();

        const leagueSize = parseInt(leagueSizeSelect.value);
        const livePlayers = parseInt(livePlayersSelect.value);
        const total = leagueSize * ROSTER_SIZE;

        document.getElementById('settings-form').classList.add('hidden');
        document.getElementById('auction-interface').classList.remove('hidden');
        
        console.log(`League Size: ${leagueSize}, Players in League: ${livePlayers}`);

        const participants = Array.from({length: leagueSize}, (_, i) => `Participant ${i + 1}`);
        const randomizedOrder = randomizeArray(participants);
        console.log("randomized order: ", randomizedOrder);
    });

    function randomizeArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
});
